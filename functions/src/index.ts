import { randomUUID } from 'node:crypto';
import admin from 'firebase-admin';
import Stripe from 'stripe';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  buildReturnUrl,
  createBasePaymentSummary,
  isDuplicatePaidDraft,
  isWinningOrderDraft,
  mapPaymentMethods,
  normalizeCustomerName,
  normalizePriceCents,
  validateSelection,
} from './core.js';

admin.initializeApp();

type PaymentStatus = 'not_required' | 'awaiting_payment' | 'paid' | 'refund_pending' | 'refunded' | 'failed';
type PaymentProvider = 'stripe';
type PaymentMethod = 'pix' | 'card' | null;

interface Item {
  id: string;
  nome: string;
  categoria: string;
  priceCents?: number | null;
}

interface CategorySelectionRule {
  category: string;
  maxSelections?: number | null;
  sharedLimitGroupId?: string | null;
}

interface PublicMenuDocument {
  token: string;
  dateKey: string;
  acceptingOrders: boolean;
  currentVersionId: string;
  categories: string[];
  items: Item[];
  categorySelectionRules: CategorySelectionRule[];
}

interface PublicMenuVersionDocument {
  id: string;
  token: string;
  dateKey: string;
  itemIds: string[];
  items: Item[];
}

interface OrderPaymentSummary {
  freeTotalCents: number;
  paidTotalCents: number;
  currency: 'BRL';
  paymentStatus: PaymentStatus;
  provider: PaymentProvider | null;
  paymentMethod: PaymentMethod;
  providerPaymentId: string | null;
  refundedAt: number | null;
}

interface CheckoutSessionState {
  checkoutUrl: string | null;
  clientSecret: string | null;
  sessionId: string | null;
  provider: PaymentProvider;
  availableMethods: Array<'pix' | 'card'>;
  expiresAt: number | null;
}

interface PublicOrderDraft {
  id: string;
  dateKey: string;
  shareToken: string;
  orderId: string;
  customerName: string;
  menuVersionId: string;
  selectedItemIds: string[];
  paymentSummary: OrderPaymentSummary;
  checkoutSession: CheckoutSessionState | null;
  failureReason?: 'superseded';
  supersededByDraftId?: string | null;
  supersededAt?: number | null;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

interface StoredOrderEntry {
  orderId: string;
  customerName: string;
  selectedItemIds: string[];
  paymentSummary: OrderPaymentSummary;
  sourceDraftId?: string | null;
}

interface PreparePublicOrderCheckoutBody {
  orderId: string;
  dateKey: string;
  shareToken: string;
  customerName: string;
  selectedItemIds: string[];
  successUrl?: string;
  pendingUrl?: string;
  failureUrl?: string;
}

const db = admin.firestore();

const publicBrowserEndpointOptions = {
  cors: true,
  invoker: 'public' as const,
};

const publicWebhookOptions = {
  invoker: 'public' as const,
};

const json = (res: Parameters<Parameters<typeof onRequest>[0]>[1], status: number, body: unknown) => {
  if (status === 204) {
    res.status(status).send();
    return;
  }
  res.status(status).json(body);
};

const parseBody = <T>(raw: unknown): T => {
  if (!raw || typeof raw !== 'object') throw new Error('Payload inválido.');
  return raw as T;
};

const loadPublicMenu = async (shareToken: string, requireAcceptingOrders = true) => {
  const snap = await db.doc(`publicMenus/${shareToken}`).get();
  if (!snap.exists) throw new Error('Cardápio público indisponível.');
  const menu = snap.data() as PublicMenuDocument;
  if (requireAcceptingOrders && !menu.acceptingOrders) {
    throw new Error('Os pedidos deste cardápio foram encerrados.');
  }
  return menu;
};

const loadPublicMenuVersion = async (versionId: string) => {
  const snap = await db.doc(`publicMenuVersions/${versionId}`).get();
  if (!snap.exists) throw new Error('Snapshot do cardápio indisponível.');
  return snap.data() as PublicMenuVersionDocument;
};

const buildOrderPayload = (
  menu: Pick<PublicMenuDocument, 'dateKey' | 'token'> & { currentVersionId: string; items: Item[] },
  input: {
    orderId: string;
    customerName: string;
    selectedItemIds: string[];
    sourceDraftId?: string | null;
  },
  paymentSummary: OrderPaymentSummary,
) => ({
  orderId: input.orderId,
  dateKey: menu.dateKey,
  shareToken: menu.token,
  menuVersionId: menu.currentVersionId,
  customerName: input.customerName.trim(),
  selectedItemIds: input.selectedItemIds,
  sourceDraftId: input.sourceDraftId ?? null,
  selectedPaidItemIds: menu.items
    .filter(item => input.selectedItemIds.includes(item.id) && normalizePriceCents(item.priceCents) > 0)
    .map(item => item.id),
  paymentSummary,
  submittedAt: admin.firestore.FieldValue.serverTimestamp(),
});

let stripeClient: Stripe | null = null;

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY não configurado.');
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
};

const getWebhookSecret = () => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET não configurado.');
  return secret;
};

const createStripeCheckout = async (
  draft: PublicOrderDraft,
  payload: PreparePublicOrderCheckoutBody,
  requestOrigin?: string,
) => {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    ui_mode: 'custom',
    mode: 'payment',
    return_url: buildReturnUrl(
      draft.id,
      payload.pendingUrl ?? payload.successUrl,
      requestOrigin,
    ),
    client_reference_id: draft.id,
    metadata: {
      draftId: draft.id,
      orderId: draft.orderId,
      shareToken: draft.shareToken,
      dateKey: draft.dateKey,
      menuVersionId: draft.menuVersionId,
    },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'brl',
        unit_amount: draft.paymentSummary.paidTotalCents,
        product_data: {
          name: `Extras do pedido ${draft.customerName}`,
        },
      },
    }],
  }, {
    idempotencyKey: draft.id,
  });

  if (!session.client_secret) {
    throw new Error('Checkout do Stripe sem client secret.');
  }

  return {
    checkoutUrl: session.url ?? null,
    clientSecret: session.client_secret,
    sessionId: session.id,
    provider: 'stripe' as const,
    availableMethods: mapPaymentMethods(session.payment_method_types),
    expiresAt: typeof session.expires_at === 'number' ? session.expires_at * 1000 : null,
  };
};

const refundStripePayment = async (providerPaymentId: string) => {
  await getStripeClient().refunds.create({
    payment_intent: providerPaymentId,
  }, {
    idempotencyKey: `refund-${providerPaymentId}`,
  });
};

const expireStripeCheckoutSession = async (sessionId: string) => {
  await getStripeClient().checkout.sessions.expire(sessionId);
};

const getStripePaymentMethod = async (paymentIntentId: string): Promise<PaymentMethod> => {
  const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge || typeof latestCharge === 'string') return null;
  const methodType = latestCharge.payment_method_details?.type;
  return methodType === 'pix' || methodType === 'card' ? methodType : null;
};

const finalizeOrderFromDraft = async (
  draft: PublicOrderDraft,
  paymentSummary: OrderPaymentSummary,
) => {
  const version = await loadPublicMenuVersion(draft.menuVersionId);
  const orderRef = db.doc(`orders/${draft.dateKey}/entries/${draft.orderId}`);
  let created = false;

  await db.runTransaction(async (transaction) => {
    const existingOrder = await transaction.get(orderRef);
    if (existingOrder.exists) return;
    created = true;

    transaction.set(orderRef, buildOrderPayload({
      dateKey: draft.dateKey,
      token: draft.shareToken,
      currentVersionId: draft.menuVersionId,
      items: version.items,
    }, {
      orderId: draft.orderId,
      customerName: draft.customerName,
      selectedItemIds: draft.selectedItemIds,
      sourceDraftId: draft.id,
    }, paymentSummary));
  });

  return created;
};

const updateDraftPaymentSummary = async (
  draftId: string,
  paymentSummary: OrderPaymentSummary,
) => {
  await db.doc(`publicOrderDrafts/${draftId}`).set({
    paymentSummary,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
};

const updateDraftMetadata = async (
  draftId: string,
  patch: Record<string, unknown>,
) => {
  await db.doc(`publicOrderDrafts/${draftId}`).set({
    ...patch,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
};

const supersedeExistingDrafts = async (
  shareToken: string,
  dateKey: string,
  orderId: string,
  nextDraftId: string,
) => {
  const existingDrafts = await db.collection('publicOrderDrafts')
    .where('shareToken', '==', shareToken)
    .where('dateKey', '==', dateKey)
    .where('orderId', '==', orderId)
    .get();

  for (const existingDraftDoc of existingDrafts.docs) {
    const existingDraft = existingDraftDoc.data() as PublicOrderDraft;
    if (existingDraft.paymentSummary.paymentStatus !== 'awaiting_payment') continue;

    const sessionId = existingDraft.checkoutSession?.sessionId;
    if (sessionId) {
      try {
        await expireStripeCheckoutSession(sessionId);
      } catch (error) {
        logger.warn('Falha ao expirar sessão Stripe anterior.', {
          draftId: existingDraft.id,
          orderId,
          sessionId,
          error,
        });
      }
    }

    await updateDraftMetadata(existingDraftDoc.id, {
      paymentSummary: {
        ...existingDraft.paymentSummary,
        paymentStatus: 'failed' as const,
      },
      failureReason: 'superseded',
      supersededByDraftId: nextDraftId,
      supersededAt: Date.now(),
    });
  }
};

const getDraftFromCheckoutSession = async (session: Stripe.Checkout.Session) => {
  const draftId = session.metadata?.draftId ?? session.client_reference_id;
  if (!draftId) return null;
  const draftRef = db.doc(`publicOrderDrafts/${draftId}`);
  const draftSnap = await draftRef.get();
  if (!draftSnap.exists) return null;
  return {
    draftId,
    draftRef,
    draft: draftSnap.data() as PublicOrderDraft,
  };
};

export const preparePublicOrderCheckout = onRequest(publicBrowserEndpointOptions, async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { message: 'Método não permitido.' });

  try {
    const body = parseBody<PreparePublicOrderCheckoutBody>(req.body);
    const menu = await loadPublicMenu(body.shareToken, true);
    if (menu.dateKey !== body.dateKey) throw new Error('Cardápio público indisponível para este pedido.');
    const customerName = normalizeCustomerName(body.customerName);

    const selectedItemIds = menu.items
      .filter(item => body.selectedItemIds.includes(item.id))
      .map(item => item.id);
    if (selectedItemIds.length === 0) throw new Error('Nenhum item válido encontrado para este pedido.');

    validateSelection(menu.items, selectedItemIds, menu.categorySelectionRules);
    const paymentSummary = createBasePaymentSummary(menu.items, selectedItemIds, 'awaiting_payment');

    if (paymentSummary.paidTotalCents === 0) {
      const finalizedSummary: OrderPaymentSummary = {
        ...paymentSummary,
        paymentStatus: 'not_required',
        provider: null,
      };
      await db.doc(`orders/${menu.dateKey}/entries/${body.orderId}`).set(
        buildOrderPayload(menu, {
          orderId: body.orderId,
          customerName,
          selectedItemIds,
        }, finalizedSummary),
      );

      return json(res, 200, {
        kind: 'free_order_confirmed',
        order: {
          orderId: body.orderId,
          customerName,
          selectedItemIds,
          paymentSummary: finalizedSummary,
        },
      });
    }

    const draftId = randomUUID();
    await supersedeExistingDrafts(menu.token, menu.dateKey, body.orderId, draftId);
    const now = admin.firestore.Timestamp.now();
    const draft: PublicOrderDraft = {
      id: draftId,
      dateKey: menu.dateKey,
      shareToken: menu.token,
      orderId: body.orderId,
      customerName,
      menuVersionId: menu.currentVersionId,
      selectedItemIds,
      paymentSummary,
      checkoutSession: null,
      createdAt: now,
      updatedAt: now,
    };

    const checkoutSession = await createStripeCheckout(draft, body, req.get('origin') ?? undefined);
    await db.doc(`publicOrderDrafts/${draftId}`).set({
      ...draft,
      checkoutSession,
    });

    return json(res, 200, {
      kind: 'payment_required',
      draftId,
      checkoutUrl: checkoutSession.checkoutUrl,
      checkoutSession: {
        draftId,
        ...checkoutSession,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao preparar o checkout.';
    logger.error(message, error);
    return json(res, 400, { message });
  }
});

export const publicOrderStatus = onRequest(publicBrowserEndpointOptions, async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { message: 'Método não permitido.' });

  try {
    const body = parseBody<{ draftId: string; shareToken: string }>(req.body);
    const draftSnap = await db.doc(`publicOrderDrafts/${body.draftId}`).get();
    if (!draftSnap.exists) throw new Error('Checkout não encontrado.');

    const draft = draftSnap.data() as PublicOrderDraft;
    if (draft.shareToken !== body.shareToken) throw new Error('Checkout não corresponde ao cardápio.');

    const orderSnap = await db.doc(`orders/${draft.dateKey}/entries/${draft.orderId}`).get();
    if (draft.paymentSummary.paymentStatus === 'failed'
      || draft.paymentSummary.paymentStatus === 'refund_pending'
      || draft.paymentSummary.paymentStatus === 'refunded') {
      return json(res, 200, {
        draftId: draft.id,
        paymentStatus: draft.paymentSummary.paymentStatus,
      });
    }

    if (orderSnap.exists) {
      const order = orderSnap.data() as StoredOrderEntry;
      if (isWinningOrderDraft(order, draft.id, draft.paymentSummary.providerPaymentId)) {
        return json(res, 200, {
          draftId: draft.id,
          paymentStatus: order.paymentSummary.paymentStatus,
          order,
        });
      }
    }

    return json(res, 200, {
      draftId: draft.id,
      paymentStatus: draft.paymentSummary.paymentStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar o pagamento.';
    return json(res, 400, { message });
  }
});

export const cancelPublicOrder = onRequest(publicBrowserEndpointOptions, async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { message: 'Método não permitido.' });

  try {
    const body = parseBody<{ orderId: string; dateKey: string; shareToken: string }>(req.body);
    const orderRef = db.doc(`orders/${body.dateKey}/entries/${body.orderId}`);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new Error('Pedido não encontrado.');

    const order = orderSnap.data() as { paymentSummary: OrderPaymentSummary; shareToken: string };
    if (order.shareToken !== body.shareToken) throw new Error('Pedido não corresponde ao cardápio.');

    if (order.paymentSummary.paidTotalCents > 0 && order.paymentSummary.providerPaymentId) {
      await refundStripePayment(order.paymentSummary.providerPaymentId);
    }

    await orderRef.delete();
    return json(res, 200, {
      refunded: order.paymentSummary.paidTotalCents > 0,
      paymentSummary: {
        ...order.paymentSummary,
        paymentStatus: order.paymentSummary.paidTotalCents > 0 ? 'refund_pending' : 'not_required',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao cancelar o pedido.';
    return json(res, 400, { message });
  }
});

export const paymentWebhook = onRequest(publicWebhookOptions, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || !signature.trim()) {
      res.status(400).send('Missing Stripe signature');
      return;
    }

    const rawBody = req.rawBody ?? Buffer.from(
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
    );
    const event = getStripeClient().webhooks.constructEvent(rawBody, signature, getWebhookSecret());

    if (
      event.type === 'checkout.session.completed'
      || event.type === 'checkout.session.async_payment_succeeded'
      || event.type === 'checkout.session.async_payment_failed'
      || event.type === 'checkout.session.expired'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const draftPayload = await getDraftFromCheckoutSession(session);
      if (!draftPayload) {
        res.status(202).send('missing draft');
        return;
      }

      const { draft, draftId } = draftPayload;
      const providerPaymentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : draft.paymentSummary.providerPaymentId;

      const paymentStatus: PaymentStatus = (
        event.type === 'checkout.session.async_payment_failed'
        || event.type === 'checkout.session.expired'
      )
        ? 'failed'
        : session.payment_status === 'paid'
          ? 'paid'
          : 'awaiting_payment';

      const paymentMethod = providerPaymentId && paymentStatus === 'paid'
        ? await getStripePaymentMethod(providerPaymentId)
        : draft.paymentSummary.paymentMethod;

      const nextSummary: OrderPaymentSummary = {
        ...draft.paymentSummary,
        paymentStatus,
        provider: 'stripe',
        providerPaymentId,
        paymentMethod,
      };

      if (paymentStatus === 'paid') {
        const created = await finalizeOrderFromDraft(draft, nextSummary);
        if (created) {
          await updateDraftPaymentSummary(draftId, nextSummary);
          res.status(200).send('ok');
          return;
        }

        const orderSnap = await db.doc(`orders/${draft.dateKey}/entries/${draft.orderId}`).get();
        const order = orderSnap.exists ? orderSnap.data() as StoredOrderEntry : null;

        if (isDuplicatePaidDraft(order, draft.id, providerPaymentId)) {
          if (!providerPaymentId) {
            logger.error('Pagamento duplicado sem providerPaymentId.', { draftId, orderId: draft.orderId });
            await updateDraftPaymentSummary(draftId, nextSummary);
            res.status(200).send('ok');
            return;
          }

          await refundStripePayment(providerPaymentId);
          await updateDraftMetadata(draftId, {
            paymentSummary: {
              ...nextSummary,
              paymentStatus: 'refund_pending' as const,
            },
            failureReason: 'superseded',
            supersededByDraftId: order?.sourceDraftId ?? null,
            supersededAt: Date.now(),
          });
          res.status(200).send('ok');
          return;
        }
      }

      await updateDraftPaymentSummary(draftId, nextSummary);

      res.status(200).send('ok');
      return;
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
      if (!paymentIntentId) {
        res.status(202).send('ignored');
        return;
      }

      const draftQuery = await db.collection('publicOrderDrafts')
        .where('paymentSummary.providerPaymentId', '==', paymentIntentId)
        .limit(1)
        .get();
      if (draftQuery.empty) {
        res.status(202).send('ignored');
        return;
      }

      const draftDoc = draftQuery.docs[0]!;
      const draft = draftDoc.data() as PublicOrderDraft;
      await updateDraftPaymentSummary(draftDoc.id, {
        ...draft.paymentSummary,
        paymentStatus: 'refunded',
        refundedAt: Date.now(),
      });
      res.status(200).send('ok');
      return;
    }

    res.status(200).send('ignored');
    return;
  } catch (error) {
    logger.error('Falha no webhook de pagamento.', error);
    res.status(400).send('error');
    return;
  }
});
