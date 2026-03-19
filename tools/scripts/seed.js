process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180';

import admin from 'firebase-admin';

const PROJECT_ID = 'maresia-grill-local';
const PUBLIC_TOKEN = 'teste-pagamento';
const HISTORY_DAYS = 90;
const VERSION_SUFFIX = '__seed_public';
const ORDER_STATUS = {
  FREE: 'not_required',
  AWAITING: 'awaiting_payment',
  PAID: 'paid',
};

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

const CATALOG = [
  {
    id: 'pratos',
    name: 'Pratos',
    selectionPolicy: {
      maxSelections: 1,
      sharedLimitGroupId: null,
      allowRepeatedItems: false,
    },
    items: [
      { id: 'prato-1', name: 'Prato executivo', priceCents: 0 },
      { id: 'prato-2', name: 'Prato vegetariano', priceCents: 0 },
    ],
  },
  {
    id: 'bebidas',
    name: 'Bebidas',
    selectionPolicy: {
      maxSelections: null,
      sharedLimitGroupId: null,
      allowRepeatedItems: true,
    },
    items: [
      { id: 'bebida-1', name: 'Agua com gas', priceCents: 450 },
      { id: 'bebida-2', name: 'Refrigerante lata', priceCents: 700 },
    ],
  },
  {
    id: 'sobremesas',
    name: 'Sobremesas',
    selectionPolicy: {
      maxSelections: null,
      sharedLimitGroupId: null,
      allowRepeatedItems: true,
    },
    items: [
      { id: 'sobremesa-1', name: 'Brownie', priceCents: 900 },
    ],
  },
  {
    id: 'saladas',
    name: 'Saladas',
    selectionPolicy: {
      maxSelections: null,
      sharedLimitGroupId: null,
      allowRepeatedItems: false,
    },
    items: [
      { id: 'sal-1', name: 'Salada Tropical', priceCents: 0 },
      { id: 'sal-2', name: 'Salada Caesar', priceCents: 0 },
      { id: 'sal-3', name: 'Salada Grega', priceCents: 0 },
      { id: 'sal-4', name: 'Salada de Repolho', priceCents: 0 },
      { id: 'sal-5', name: 'Salada Caprese', priceCents: 0 },
    ],
  },
  {
    id: 'acompanhamentos',
    name: 'Acompanhamentos',
    selectionPolicy: {
      maxSelections: null,
      sharedLimitGroupId: null,
      allowRepeatedItems: false,
    },
    items: [
      { id: 'aco-1', name: 'Arroz Branco', priceCents: 0 },
      { id: 'aco-2', name: 'Feijao Tropeiro', priceCents: 0 },
      { id: 'aco-3', name: 'Macarrao Alho e Oleo', priceCents: 0 },
      { id: 'aco-4', name: 'Pure de Batata', priceCents: 0 },
      { id: 'aco-5', name: 'Farofa', priceCents: 0 },
    ],
  },
  {
    id: 'carnes',
    name: 'Carnes',
    selectionPolicy: {
      maxSelections: null,
      sharedLimitGroupId: null,
      allowRepeatedItems: false,
    },
    items: [
      { id: 'car-1', name: 'Frango Assado', priceCents: 0 },
      { id: 'car-2', name: 'Carne de Sol', priceCents: 0 },
      { id: 'car-3', name: 'Costela de Porco', priceCents: 0 },
      { id: 'car-4', name: 'File de Peixe', priceCents: 0 },
      { id: 'car-5', name: 'Frango Grelhado', priceCents: 0 },
    ],
  },
  {
    id: 'churrasco',
    name: 'Churrasco',
    selectionPolicy: {
      maxSelections: null,
      sharedLimitGroupId: null,
      allowRepeatedItems: false,
    },
    items: [
      { id: 'chu-1', name: 'Picanha', priceCents: 0 },
      { id: 'chu-2', name: 'Alcatra', priceCents: 0 },
      { id: 'chu-3', name: 'Linguica Toscana', priceCents: 0 },
      { id: 'chu-4', name: 'Fraldinha', priceCents: 0 },
      { id: 'chu-5', name: 'Cordeiro', priceCents: 0 },
    ],
  },
];

const ITEM_BY_ID = new Map(
  CATALOG.flatMap((category) => category.items.map((item) => [item.id, {
    ...item,
    categoryId: category.id,
    categoryName: category.name,
  }])),
);

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const dateKey = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const dateKeyDaysAgo = (daysAgo) => {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  return dateKey(value);
};

const weekdayDaysAgo = (daysAgo) => {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  return value.getDay();
};

const versionIdForDate = (key) => `${key}${VERSION_SUFFIX}`;

const listDocumentRefs = async (collectionPath) => {
  const collectionRef = db.collection(collectionPath);
  return collectionRef.listDocuments();
};

const deleteDocumentTree = async (docRef) => {
  const subcollections = await docRef.listCollections();
  for (const collectionRef of subcollections) {
    const nestedDocs = await collectionRef.listDocuments();
    for (const nestedDoc of nestedDocs) {
      await deleteDocumentTree(nestedDoc);
    }
  }
  await docRef.delete().catch((error) => {
    if (error?.code === 5) return;
    throw error;
  });
};

const clearCollection = async (collectionPath) => {
  const refs = await listDocumentRefs(collectionPath);
  for (const refsChunk of chunk(refs, 25)) {
    await Promise.all(refsChunk.map((ref) => deleteDocumentTree(ref)));
  }
};

const deleteDocIfExists = async (docPath) => {
  await db.doc(docPath).delete().catch((error) => {
    if (error?.code === 5) return;
    throw error;
  });
};

const buildHistoricalItemIds = (daysAgo) => {
  const weekday = weekdayDaysAgo(daysAgo);
  const ids = new Set(['aco-1']);

  if (daysAgo !== 20 && daysAgo !== 45) ids.add('car-1');
  if (daysAgo % 5 !== 0) ids.add('aco-2');
  if (daysAgo % 3 !== 0) ids.add('chu-1');
  if (weekday === 1 || weekday === 3 || weekday === 4 || daysAgo % 8 === 0) ids.add('sal-1');
  if (weekday === 5 || weekday === 6 || daysAgo % 10 === 0) ids.add('chu-3');
  if (weekday === 2 || weekday === 4) ids.add('sal-4');
  if (daysAgo % 4 === 1) ids.add('chu-2');
  if (daysAgo % 5 === 1) ids.add('car-2');
  if (daysAgo % 6 === 0) ids.add('aco-5');
  if (daysAgo % 9 === 0) ids.add('sal-2');
  if (daysAgo % 11 === 0) ids.add('aco-4');
  if (daysAgo % 12 === 0) ids.add('car-5');
  if (daysAgo % 13 === 0) ids.add('aco-3');
  if (daysAgo % 15 === 0) ids.add('chu-4');
  if (daysAgo % 20 === 0) ids.add('car-3');
  if (daysAgo % 30 === 0) ids.add('sal-3');
  if (daysAgo === 25) ids.add('car-4');
  if (daysAgo === 50 || daysAgo === 70) ids.add('sal-5');
  if (daysAgo === 80) ids.add('chu-5');

  return Array.from(ids);
};

const buildSelectionEntries = (selectedItemIds) => {
  const counts = new Map();
  for (const itemId of selectedItemIds) {
    counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
};

const buildOrderLines = (selectedItemIds) => buildSelectionEntries(selectedItemIds).map(({ itemId, quantity }) => {
  const item = ITEM_BY_ID.get(itemId);
  if (!item) {
    throw new Error(`Item desconhecido no seed: ${itemId}`);
  }
  return {
    itemId,
    quantity,
    unitPriceCents: item.priceCents,
    name: item.name,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
  };
});

const buildPaymentSummary = (lines, paymentStatus, provider = null, paymentMethod = null, providerPaymentId = null) => {
  const paidTotalCents = lines.reduce((total, line) => total + (line.unitPriceCents * line.quantity), 0);
  return {
    freeTotalCents: 0,
    paidTotalCents,
    currency: 'BRL',
    paymentStatus,
    provider,
    paymentMethod,
    providerPaymentId,
    refundedAt: null,
  };
};

const buildPublishedCategories = (itemIds) => {
  const categoryIds = new Set(itemIds.map((itemId) => ITEM_BY_ID.get(itemId)?.categoryId).filter(Boolean));
  return CATALOG
    .map((category, index) => ({ ...category, sortOrder: index }))
    .filter((category) => categoryIds.has(category.id))
    .map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      selectionPolicy: category.selectionPolicy,
    }));
};

const buildPublishedItems = (itemIds) => itemIds
  .map((itemId) => ITEM_BY_ID.get(itemId))
  .filter(Boolean)
  .map((item, index) => ({
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    priceCents: item.priceCents,
    sortOrder: index,
  }));

const writeCatalog = async () => {
  const batch = db.batch();

  CATALOG.forEach((category, categoryIndex) => {
    batch.set(db.doc(`catalog/root/categories/${category.id}`), {
      name: category.name,
      sortOrder: categoryIndex,
      selectionPolicy: category.selectionPolicy,
    });

    category.items.forEach((item, itemIndex) => {
      batch.set(db.doc(`catalog/root/items/${item.id}`), {
        categoryId: category.id,
        name: item.name,
        priceCents: item.priceCents,
        isActive: true,
        sortOrder: itemIndex,
      });
    });
  });

  await batch.commit();
};

const writeMenuDay = async (daysAgo) => {
  const currentDateKey = dateKeyDaysAgo(daysAgo);
  const versionId = versionIdForDate(currentDateKey);
  const defaultItemIds = buildHistoricalItemIds(daysAgo);
  const itemIds = daysAgo === 0
    ? ['prato-1', 'prato-2', 'bebida-1', 'bebida-2', 'sobremesa-1', ...defaultItemIds]
    : defaultItemIds;
  const uniqueItemIds = Array.from(new Set(itemIds));
  const status = daysAgo === 0 ? 'published' : 'closed';
  const shareToken = daysAgo === 0 ? PUBLIC_TOKEN : null;
  const categories = buildPublishedCategories(uniqueItemIds);
  const items = buildPublishedItems(uniqueItemIds);
  const now = Date.now() - (daysAgo * 60_000);

  await db.doc(`dailyMenus/${currentDateKey}`).set({
    dateKey: currentDateKey,
    status,
    shareToken,
    activeVersionId: versionId,
    itemIds: uniqueItemIds,
    updatedAt: now,
  });

  await db.doc(`dailyMenus/${currentDateKey}/versions/${versionId}`).set({
    id: versionId,
    dateKey: currentDateKey,
    shareToken: shareToken ?? `seed-${currentDateKey}`,
    createdAt: now,
    categories,
    items,
  });

  if (shareToken) {
    await db.doc(`dailyMenuTokens/${shareToken}`).set({
      shareToken,
      dateKey: currentDateKey,
      activeVersionId: versionId,
      createdAt: now,
      updatedAt: now,
    });
  }
};

const writeSeedOrders = async () => {
  const today = dateKeyDaysAgo(0);
  const todayVersionId = versionIdForDate(today);
  const previousDay = dateKeyDaysAgo(1);
  const previousVersionId = versionIdForDate(previousDay);

  const orderSpecs = [
    {
      path: `dailyMenus/${today}/orders/seed-order-free`,
      payload: {
        id: 'seed-order-free',
        dateKey: today,
        shareToken: PUBLIC_TOKEN,
        menuVersionId: todayVersionId,
        customerName: 'Pedido Gratis',
        lines: buildOrderLines(['prato-1']),
        submittedAt: Date.now(),
      },
      paymentStatus: ORDER_STATUS.FREE,
    },
    {
      path: `dailyMenus/${today}/orders/seed-order-paid`,
      payload: {
        id: 'seed-order-paid',
        dateKey: today,
        shareToken: PUBLIC_TOKEN,
        menuVersionId: todayVersionId,
        customerName: 'Pedido Pago',
        lines: buildOrderLines(['prato-1', 'bebida-2']),
        submittedAt: Date.now() - 1_000,
      },
      paymentStatus: ORDER_STATUS.PAID,
      provider: 'stripe',
      paymentMethod: 'card',
      providerPaymentId: 'pi_seed_paid',
    },
    {
      path: `dailyMenus/${previousDay}/orders/seed-order-history`,
      payload: {
        id: 'seed-order-history',
        dateKey: previousDay,
        shareToken: `seed-${previousDay}`,
        menuVersionId: previousVersionId,
        customerName: 'Pedido Historico',
        lines: buildOrderLines(['aco-1', 'car-1', 'chu-1']),
        submittedAt: Date.now() - 86_400_000,
      },
      paymentStatus: ORDER_STATUS.FREE,
    },
    {
      path: `dailyMenus/${today}/orders/seed-order-awaiting`,
      payload: {
        id: 'seed-order-awaiting',
        dateKey: today,
        shareToken: PUBLIC_TOKEN,
        menuVersionId: todayVersionId,
        customerName: 'Pedido Aguardando Pagamento',
        lines: buildOrderLines(['prato-2', 'sobremesa-1']),
        submittedAt: Date.now() - 2_000,
      },
      paymentStatus: ORDER_STATUS.AWAITING,
      provider: 'stripe',
      paymentMethod: 'pix',
    },
  ];

  for (const spec of orderSpecs) {
    await db.doc(spec.path).set({
      ...spec.payload,
      paymentSummary: buildPaymentSummary(
        spec.payload.lines,
        spec.paymentStatus,
        spec.provider ?? null,
        spec.paymentMethod ?? null,
        spec.providerPaymentId ?? null,
      ),
    });
  }
};

const clearSeedTargets = async () => {
  console.log('Limpando dados do schema novo...');
  await clearCollection('catalog/root/categories');
  await clearCollection('catalog/root/items');
  await clearCollection('dailyMenus');
  await clearCollection('dailyMenuTokens');
  await clearCollection('publicOrderDrafts');
  await deleteDocIfExists('config/editorLock');

  console.log('Limpando residuos do schema legado...');
  await Promise.all([
    clearCollection('shareLinks'),
    clearCollection('selections'),
    clearCollection('publicMenus'),
    clearCollection('publicMenuVersions'),
    clearCollection('orders'),
  ]);
  await Promise.all([
    deleteDocIfExists('config/categories'),
    deleteDocIfExists('config/complements'),
    deleteDocIfExists('config/categorySelectionRules'),
  ]);
};

async function seed() {
  await clearSeedTargets();

  console.log('Gravando catalogo...');
  await writeCatalog();

  console.log(`Gravando ${HISTORY_DAYS} dias de menus diarios...`);
  for (let index = HISTORY_DAYS - 1; index >= 0; index -= 1) {
    await writeMenuDay(index);
  }

  console.log('Gravando pedidos de exemplo...');
  await writeSeedOrders();

  const today = dateKeyDaysAgo(0);
  console.log('');
  console.log('Seed local concluido.');
  console.log(`Projeto: ${PROJECT_ID}`);
  console.log(`Cardapio publico: http://localhost:5173/s/${PUBLIC_TOKEN}#/pedido`);
  console.log(`Menu do dia: dailyMenus/${today}`);
  console.log(`Versao ativa: dailyMenus/${today}/versions/${versionIdForDate(today)}`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
