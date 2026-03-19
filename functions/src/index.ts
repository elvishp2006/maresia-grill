import { randomUUID } from 'node:crypto';
import admin from 'firebase-admin';
import Stripe from 'stripe';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import {
  buildOrder,
  calculateOrderPaymentSummaryFromLines,
  normalizeSelectionEntries,
  parseDateKeyFromVersionId,
  resolveOrderLines,
} from '../../domain/menu.js';
import type {
  OrderLine,
  OrderPaymentSummary,
  PublishedMenuVersion,
  SelectionEntry,
} from '../../domain/menu.js';
import {
  buildReturnUrl,
  canReplaceExistingOrderWithPaidDraft,
  createBasePaymentSummary,
  isDuplicatePaidDraft,
  isWinningOrderDraft,
  mapPaymentMethods,
  normalizeCustomerName,
  validateSelectionForVersion,
} from './core.js';

admin.initializeApp();

interface DailyMenuRecord {
  dateKey: string;
  status: 'draft' | 'published' | 'closed';
  shareToken?: string | null;
  activeVersionId?: string | null;
}

interface DailyMenuTokenRecord {
  shareToken: string;
  dateKey: string;
  activeVersionId: string;
}

interface CheckoutSessionState {
  checkoutUrl: string | null;
  clientSecret: string | null;
  sessionId: string | null;
  provider: 'stripe';
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
  selectedItems: SelectionEntry[];
  paymentSummary: OrderPaymentSummary;
  checkoutSession: CheckoutSessionState | null;
  failureReason?: 'superseded';
  supersededByDraftId?: string | null;
  supersededAt?: number | null;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

interface StoredOrderEntry {
  sourceDraftId?: string | null;
  paymentSummary?: Partial<Pick<OrderPaymentSummary, 'providerPaymentId' | 'paidTotalCents' | 'paymentStatus'>>;
  customerName?: string;
  lines?: Array<{
    itemId: string;
    quantity: number;
    unitPriceCents: number;
    name: string;
    categoryId: string;
    categoryName: string;
  }>;
}

interface PreparePublicOrderCheckoutBody {
  orderId: string;
  dateKey: string;
  shareToken: string;
  customerName: string;
  selectedItems: SelectionEntry[];
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

const loadActivePublicMenu = async (shareToken: string, requireAcceptingOrders = true) => {
  const tokenSnap = await db.doc(`dailyMenuTokens/${shareToken}`).get();
  if (!tokenSnap.exists) throw new Error('Cardápio público indisponível.');
  const tokenRecord = tokenSnap.data() as DailyMenuTokenRecord;
  if (!tokenRecord?.dateKey || !tokenRecord?.activeVersionId) throw new Error('Cardápio público indisponível.');

  const dailyMenuDoc = await db.doc(`dailyMenus/${tokenRecord.dateKey}`).get();
  if (!dailyMenuDoc.exists) throw new Error('Cardápio público indisponível.');
  const dailyMenu = dailyMenuDoc.data() as DailyMenuRecord;
  if (!dailyMenu.activeVersionId) throw new Error('Cardápio público indisponível.');
  if (dailyMenu.activeVersionId !== tokenRecord.activeVersionId) throw new Error('Cardápio público indisponível.');
  if (requireAcceptingOrders && dailyMenu.status === 'closed') {
    throw new Error('Os pedidos deste cardápio foram encerrados.');
  }

  const versionSnap = await db.doc(`dailyMenus/${tokenRecord.dateKey}/versions/${dailyMenu.activeVersionId}`).get();
  if (!versionSnap.exists) throw new Error('Snapshot do cardápio indisponível.');

  return {
    menu: {
      dateKey: tokenRecord.dateKey,
      token: shareToken,
      currentVersionId: dailyMenu.activeVersionId,
      acceptingOrders: dailyMenu.status !== 'closed',
    },
    version: versionSnap.data() as PublishedMenuVersion,
  };
};

const buildFinalizedPublicOrder = (
  orderId: string,
  customerName: string,
  lines: OrderLine[],
  paymentSummary: OrderPaymentSummary,
) => ({
  orderId,
  customerName,
  lines,
  paymentSummary,
});

let stripeClient: Stripe | null = null;

const getStripeModeFromSecretKey = (secretKey: string): 'test' | 'live' => {
  const trimmed = secretKey.trim();
  if (trimmed.startsWith('sk_test_')) return 'test';
  if (trimmed.startsWith('sk_live_')) return 'live';
  throw new Error('STRIPE_SECRET_KEY inválido. Use uma chave Stripe test ou live.');
};

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY não configurado.');
  const stripeMode = getStripeModeFromSecretKey(secretKey);
  if (!stripeClient) {
    logger.info('Inicializando cliente Stripe.', { stripeMode });
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
  const stripeMode = getStripeModeFromSecretKey(process.env.STRIPE_SECRET_KEY ?? '');
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

  logger.info('Checkout Stripe criado.', {
    draftId: draft.id,
    orderId: draft.orderId,
    stripeMode,
    clientSecretPrefix: session.client_secret.slice(0, 7),
  });

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

const getStripePaymentMethod = async (paymentIntentId: string): Promise<'pix' | 'card' | null> => {
  const paymentIntent = await getStripeClient().paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge || typeof latestCharge === 'string') return null;
  const methodType = latestCharge.payment_method_details?.type;
  return methodType === 'pix' || methodType === 'card' ? methodType : null;
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

const finalizeOrderFromDraft = async (
  draft: PublicOrderDraft,
  paymentSummary: OrderPaymentSummary,
): Promise<'created' | 'replaced' | 'duplicate'> => {
  const dateKey = parseDateKeyFromVersionId(draft.menuVersionId) || draft.dateKey;
  const versionSnap = await db.doc(`dailyMenus/${dateKey}/versions/${draft.menuVersionId}`).get();
  if (!versionSnap.exists) throw new Error('Snapshot do cardápio indisponível.');
  const version = versionSnap.data() as PublishedMenuVersion;
  const lines = resolveOrderLines(version, draft.selectedItems);
  const orderRef = db.doc(`dailyMenus/${draft.dateKey}/orders/${draft.orderId}`);
  let result: 'created' | 'replaced' | 'duplicate' = 'duplicate';

  const orderPayload = buildOrder({
    id: draft.orderId,
    dateKey: draft.dateKey,
    shareToken: draft.shareToken,
    menuVersionId: draft.menuVersionId,
    customerName: draft.customerName,
    lines,
    paymentSummary,
    submittedAt: Date.now(),
    sourceDraftId: draft.id,
  });

  await db.runTransaction(async (transaction) => {
    const existingOrder = await transaction.get(orderRef);
    if (!existingOrder.exists) {
      result = 'created';
      transaction.set(orderRef, orderPayload);
      return;
    }

    const existing = existingOrder.data() as StoredOrderEntry;
    if (!canReplaceExistingOrderWithPaidDraft(existing)) return;

    result = 'replaced';
    transaction.set(orderRef, orderPayload);
  });

  return result;
};

export const preparePublicOrderCheckout = onRequest(publicBrowserEndpointOptions, async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { message: 'Método não permitido.' });

  try {
    const body = parseBody<PreparePublicOrderCheckoutBody>(req.body);
    const { menu, version } = await loadActivePublicMenu(body.shareToken, true);
    if (menu.dateKey !== body.dateKey) throw new Error('Cardápio público indisponível para este pedido.');
    const customerName = normalizeCustomerName(body.customerName);

    const normalizedSelectedItems = normalizeSelectionEntries(body.selectedItems);
    const allowedItemIds = new Set(version.items.map(item => item.id));
    const selectedItems = normalizedSelectedItems.filter(item => allowedItemIds.has(item.itemId));
    if (selectedItems.length === 0) throw new Error('Nenhum item válido encontrado para este pedido.');

    validateSelectionForVersion(version, selectedItems);
    const paymentSummary = createBasePaymentSummary(version, selectedItems, 'awaiting_payment');

    if (paymentSummary.paidTotalCents === 0) {
      const finalizedSummary: OrderPaymentSummary = {
        ...paymentSummary,
        paymentStatus: 'not_required',
        provider: null,
      };
      const lines = resolveOrderLines(version, selectedItems);
      await db.doc(`dailyMenus/${menu.dateKey}/orders/${body.orderId}`).set(buildOrder({
        id: body.orderId,
        dateKey: menu.dateKey,
        shareToken: menu.token,
        menuVersionId: menu.currentVersionId,
        customerName,
        lines,
        paymentSummary: finalizedSummary,
        submittedAt: Date.now(),
      }));

      return json(res, 200, {
        kind: 'free_order_confirmed',
        order: buildFinalizedPublicOrder(body.orderId, customerName, lines, finalizedSummary),
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
      selectedItems,
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

    const orderSnap = await db.doc(`dailyMenus/${draft.dateKey}/orders/${draft.orderId}`).get();
    if (
      draft.paymentSummary.paymentStatus === 'failed'
      || draft.paymentSummary.paymentStatus === 'refund_pending'
      || draft.paymentSummary.paymentStatus === 'refunded'
    ) {
      return json(res, 200, {
        draftId: draft.id,
        paymentStatus: draft.paymentSummary.paymentStatus,
      });
    }

    if (orderSnap.exists) {
      const order = orderSnap.data() as StoredOrderEntry & { customerName: string; lines: OrderLine[]; paymentSummary: OrderPaymentSummary };
      if (isWinningOrderDraft(order, draft.id, draft.paymentSummary.providerPaymentId)) {
        return json(res, 200, {
          draftId: draft.id,
          paymentStatus: order.paymentSummary.paymentStatus,
          order: buildFinalizedPublicOrder(
            draft.orderId,
            order.customerName ?? draft.customerName,
            (order.lines ?? []) as OrderLine[],
            order.paymentSummary,
          ),
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
    const orderRef = db.doc(`dailyMenus/${body.dateKey}/orders/${body.orderId}`);
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

      const paymentStatus = (
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

      const dateKey = parseDateKeyFromVersionId(draft.menuVersionId) || draft.dateKey;
      const versionSnap = await db.doc(`dailyMenus/${dateKey}/versions/${draft.menuVersionId}`).get();
      if (!versionSnap.exists) throw new Error('Snapshot do cardápio indisponível.');
      const version = versionSnap.data() as PublishedMenuVersion;
      const lines = resolveOrderLines(version, draft.selectedItems);
      const nextSummary: OrderPaymentSummary = {
        ...calculateOrderPaymentSummaryFromLines(lines, paymentStatus, 'stripe', paymentMethod),
        providerPaymentId: providerPaymentId ?? null,
        refundedAt: draft.paymentSummary.refundedAt ?? null,
      };

      if (paymentStatus === 'paid') {
        const finalizeResult = await finalizeOrderFromDraft(draft, nextSummary);
        if (finalizeResult === 'created' || finalizeResult === 'replaced') {
          await updateDraftPaymentSummary(draftId, nextSummary);
          res.status(200).send('ok');
          return;
        }

        const orderSnap = await db.doc(`dailyMenus/${draft.dateKey}/orders/${draft.orderId}`).get();
        const order = orderSnap.exists ? orderSnap.data() as StoredOrderEntry : null;

        if (isDuplicatePaidDraft(order, draft.id, providerPaymentId ?? null)) {
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

      const draftDoc = draftQuery.docs[0];
      if (!draftDoc) {
        res.status(202).send('ignored');
        return;
      }
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
