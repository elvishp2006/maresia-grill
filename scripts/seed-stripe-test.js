process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';

import admin from 'firebase-admin';

const PROJECT_ID = 'maresia-grill-local';
const TEST_TOKEN = 'teste-pagamento';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const dateKey = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const today = dateKey();
const versionId = `${today}-stripe-test`;
const categories = ['Pratos', 'Bebidas', 'Sobremesas'];
const items = [
  { id: 'prato-1', nome: 'Prato executivo', categoria: 'Pratos', priceCents: 0 },
  { id: 'prato-2', nome: 'Prato vegetariano', categoria: 'Pratos', priceCents: 0 },
  { id: 'bebida-1', nome: 'Agua com gas', categoria: 'Bebidas', priceCents: 450 },
  { id: 'bebida-2', nome: 'Refrigerante lata', categoria: 'Bebidas', priceCents: 700 },
  { id: 'sobremesa-1', nome: 'Brownie', categoria: 'Sobremesas', priceCents: 900 },
];
const categorySelectionRules = [
  { category: 'Pratos', maxSelections: 1, sharedLimitGroupId: null },
];

const baseUrl = 'http://localhost:5173';
const publicUrl = `${baseUrl}/s/${TEST_TOKEN}#/pedido`;

const deleteCollection = async (path) => {
  const docs = await db.collection(path).listDocuments();
  await Promise.all(docs.map((ref) => ref.delete()));
};

async function seedStripeTest() {
  console.log('Resetando pedidos e drafts de teste...');
  await deleteCollection('publicOrderDrafts');
  await deleteCollection(`orders/${today}/entries`);

  console.log('Gravando configuracoes base...');
  await db.doc('config/categories').set({ items: categories });
  await db.doc('config/complements').set({ items });
  await db.doc('config/categorySelectionRules').set({ rules: categorySelectionRules });
  await db.doc(`selections/${today}`).set({ ids: items.map((item) => item.id) });

  const createdAt = new Date();
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(24, 0, 0, 0);

  console.log('Gravando share link e snapshot publico...');
  await db.doc(`shareLinks/${today}`).set({
    token: TEST_TOKEN,
    dateKey: today,
    acceptingOrders: true,
    createdAt,
    expiresAt,
  });

  await db.doc(`publicMenuVersions/${versionId}`).set({
    id: versionId,
    token: TEST_TOKEN,
    dateKey: today,
    categories,
    itemIds: items.map((item) => item.id),
    items,
    categorySelectionRules,
    createdAt,
  });

  await db.doc(`publicMenus/${TEST_TOKEN}`).set({
    token: TEST_TOKEN,
    dateKey: today,
    acceptingOrders: true,
    currentVersionId: versionId,
    categories,
    items,
    categorySelectionRules,
    createdAt,
    expiresAt,
  });

  console.log('');
  console.log('Cenario local pronto para teste Stripe.');
  console.log(`URL publica: ${publicUrl}`);
  console.log('Exemplo de selecao paga: "Prato executivo" + "Refrigerante lata" = R$ 7,00');
  console.log('Exemplo de selecao gratis: apenas "Prato executivo" = envio sem checkout.');
}

seedStripeTest().catch((error) => {
  console.error(error);
  process.exit(1);
});
