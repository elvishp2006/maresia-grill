process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';

import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'maresia-grill-local' });
const db = admin.firestore();

const CATEGORIES = ['Saladas', 'Acompanhamentos', 'Carnes', 'Churrasco'];

const ITEMS = [
  { id: 'sal-1', nome: 'Salada Tropical', categoria: 'Saladas' },
  { id: 'sal-2', nome: 'Salada Caesar', categoria: 'Saladas' },
  { id: 'sal-3', nome: 'Salada Grega', categoria: 'Saladas' },
  { id: 'sal-4', nome: 'Salada de Repolho', categoria: 'Saladas' },
  { id: 'sal-5', nome: 'Salada Caprese', categoria: 'Saladas' },
  { id: 'aco-1', nome: 'Arroz Branco', categoria: 'Acompanhamentos' },
  { id: 'aco-2', nome: 'Feijão Tropeiro', categoria: 'Acompanhamentos' },
  { id: 'aco-3', nome: 'Macarrão Alho e Óleo', categoria: 'Acompanhamentos' },
  { id: 'aco-4', nome: 'Purê de Batata', categoria: 'Acompanhamentos' },
  { id: 'aco-5', nome: 'Farofa', categoria: 'Acompanhamentos' },
  { id: 'car-1', nome: 'Frango Assado', categoria: 'Carnes' },
  { id: 'car-2', nome: 'Carne de Sol', categoria: 'Carnes' },
  { id: 'car-3', nome: 'Costela de Porco', categoria: 'Carnes' },
  { id: 'car-4', nome: 'Filé de Peixe', categoria: 'Carnes' },
  { id: 'car-5', nome: 'Frango Grelhado', categoria: 'Carnes' },
  { id: 'chu-1', nome: 'Picanha', categoria: 'Churrasco' },
  { id: 'chu-2', nome: 'Alcatra', categoria: 'Churrasco' },
  { id: 'chu-3', nome: 'Linguiça Toscana', categoria: 'Churrasco' },
  { id: 'chu-4', nome: 'Fraldinha', categoria: 'Churrasco' },
  { id: 'chu-5', nome: 'Cordeiro', categoria: 'Churrasco' },
];

function dateKey(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function getWeekday(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.getUTCDay();
}

function getIdsForDay(idx) {
  const wd = getWeekday(idx);
  const ids = [];

  // aco-1: every day
  ids.push('aco-1');

  // car-1: every day except idx 20 and 45
  if (idx !== 20 && idx !== 45) ids.push('car-1');

  // aco-2: all except multiples of 5
  if (idx % 5 !== 0) ids.push('aco-2');

  // chu-1: all except multiples of 3
  if (idx % 3 !== 0) ids.push('chu-1');

  // sal-1: Mon/Wed/Thu + idx % 8 === 0
  if (wd === 1 || wd === 3 || wd === 4 || idx % 8 === 0) ids.push('sal-1');

  // chu-3: Fri/Sat + idx % 10 === 0
  if (wd === 5 || wd === 6 || idx % 10 === 0) ids.push('chu-3');

  // sal-4: Tue/Thu
  if (wd === 2 || wd === 4) ids.push('sal-4');

  // chu-2: idx % 4 === 1
  if (idx % 4 === 1) ids.push('chu-2');

  // car-2: idx % 5 === 1
  if (idx % 5 === 1) ids.push('car-2');

  // aco-5: idx % 6 === 0
  if (idx % 6 === 0) ids.push('aco-5');

  // sal-2: idx % 9 === 0
  if (idx % 9 === 0) ids.push('sal-2');

  // aco-4: idx % 11 === 0
  if (idx % 11 === 0) ids.push('aco-4');

  // car-5: idx % 12 === 0
  if (idx % 12 === 0) ids.push('car-5');

  // aco-3: idx % 13 === 0
  if (idx % 13 === 0) ids.push('aco-3');

  // chu-4: idx % 15 === 0
  if (idx % 15 === 0) ids.push('chu-4');

  // car-3: idx % 20 === 0
  if (idx % 20 === 0) ids.push('car-3');

  // sal-3: idx % 30 === 0
  if (idx % 30 === 0) ids.push('sal-3');

  // car-4: only idx 25
  if (idx === 25) ids.push('car-4');

  // sal-5: only idx 50 and 70
  if (idx === 50 || idx === 70) ids.push('sal-5');

  // chu-5: only idx 80
  if (idx === 80) ids.push('chu-5');

  return ids;
}

async function seed() {
  console.log('Clearing existing selections...');
  const existing = await db.collection('selections').listDocuments();
  await Promise.all(existing.map(ref => ref.delete()));
  console.log(`  Deleted ${existing.length} documents`);

  console.log('Writing config/categories...');
  await db.doc('config/categories').set({ items: CATEGORIES });

  console.log('Writing config/complements...');
  await db.doc('config/complements').set({ items: ITEMS });

  console.log('Writing 89 days of selections...');
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let count = 0;

  for (let idx = 1; idx <= 89; idx++) {
    const key = dateKey(idx);
    const ids = getIdsForDay(idx);
    batch.set(db.doc(`selections/${key}`), { ids });
    count++;

    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
  }

  console.log(`  Written ${count} selection documents`);
  console.log('Done. Open http://localhost:4000 to verify in Emulator UI.');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
