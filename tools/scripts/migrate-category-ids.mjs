/**
 * migrate-category-ids.mjs
 *
 * Migra categorias com IDs baseados em slug (ex: "saladas") para UUIDs
 * (ex: "a1b2c3d4-..."). Atualiza o campo categoryId de todos os itens
 * do catálogo que referenciam o slug antigo.
 *
 * Uso (emulador local):
 *   node tools/scripts/migrate-category-ids.mjs --project maresia-grill-local --emulator [--dry-run]
 *   node tools/scripts/migrate-category-ids.mjs --project maresia-grill-local --emulator --execute
 *
 * Uso (produção):
 *   node tools/scripts/migrate-category-ids.mjs --project <projectId> [--dry-run]
 *   node tools/scripts/migrate-category-ids.mjs --project <projectId> --execute
 *
 * Flags:
 *   --project  <id>   ID do projeto Firebase (obrigatório)
 *   --emulator        Aponta para o emulador local (127.0.0.1:8180), bypassa rules
 *   --execute         Aplica as alterações no Firestore (padrão: dry-run)
 *   --dry-run         Apenas simula e imprime o plano (padrão quando --execute ausente)
 *
 * Pré-requisitos (produção):
 *   gcloud auth application-default login  (ou GOOGLE_APPLICATION_CREDENTIALS definido)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const parseArgs = (argv) => {
  const args = new Map();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { args.set(token, true); continue; }
    args.set(token, next);
    i++;
  }
  return args;
};

const args = parseArgs(process.argv.slice(2));
const projectId = String(args.get('--project') || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '').trim();
const dryRun = args.has('--dry-run') || !args.has('--execute');
const useEmulator = args.has('--emulator');
const emulatorHost = String(args.get('--emulator-host') || '127.0.0.1:8180').trim();

if (!projectId) {
  console.error('Erro: informe --project <projectId>.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase Admin SDK setup
// ---------------------------------------------------------------------------

if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// UUID detection
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (str) => UUID_RE.test(str);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const listCollection = async (collectionPath) => {
  const snap = await db.collection(collectionPath).get();
  return snap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() }));
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const run = async () => {
  console.log(JSON.stringify({ projectId, dryRun, useEmulator }, null, 2));

  const [categoryDocs, itemDocs] = await Promise.all([
    listCollection('catalog/root/categories'),
    listCollection('catalog/root/items'),
  ]);

  // Separar categorias com slug ID das que já têm UUID
  const slugCategories = categoryDocs.filter((doc) => !isUUID(doc.id));
  const uuidCategories = categoryDocs.filter((doc) => isUUID(doc.id));

  if (slugCategories.length === 0) {
    console.log('Nenhuma categoria com slug ID encontrada. Nada a migrar.');
    return;
  }

  // Construir mapeamento slug → novo UUID
  const slugToUUID = new Map(slugCategories.map((doc) => [doc.id, randomUUID()]));

  // Calcular o maior sortOrder existente entre categorias UUID (para evitar colisões)
  const maxExistingSortOrder = uuidCategories.reduce(
    (max, doc) => Math.max(max, typeof doc.data.sortOrder === 'number' ? doc.data.sortOrder : -1),
    -1,
  );

  // Preparar plano de categorias
  const categoriesToCreate = slugCategories.map((doc, index) => ({
    oldId: doc.id,
    newId: slugToUUID.get(doc.id),
    data: {
      name: doc.data.name ?? doc.id,
      sortOrder: typeof doc.data.sortOrder === 'number'
        ? doc.data.sortOrder
        : maxExistingSortOrder + 1 + index,
      selectionPolicy: doc.data.selectionPolicy ?? {
        minSelections: null,
        maxSelections: null,
        sharedLimitGroupId: null,
        allowRepeatedItems: false,
      },
      ...(doc.data.excludeFromShare ? { excludeFromShare: true } : {}),
    },
  }));

  // Preparar plano de itens que precisam ter categoryId atualizado
  const itemsToUpdate = itemDocs
    .filter((doc) => slugToUUID.has(doc.data.categoryId))
    .map((doc) => ({
      id: doc.id,
      ref: doc.ref,
      oldCategoryId: doc.data.categoryId,
      newCategoryId: slugToUUID.get(doc.data.categoryId),
    }));

  const itemsAlreadyOk = itemDocs.filter((doc) => !slugToUUID.has(doc.data.categoryId));

  // Backup
  const backup = {
    exportedAt: new Date().toISOString(),
    projectId,
    dryRun,
    plan: {
      categoriesToCreate,
      slugCategoriesToDelete: slugCategories.map((doc) => `catalog/root/categories/${doc.id}`),
      itemsToUpdate: itemsToUpdate.map(({ id, oldCategoryId, newCategoryId }) => ({ id, oldCategoryId, newCategoryId })),
    },
    original: {
      categories: categoryDocs.map((d) => ({ id: d.id, data: d.data })),
      items: itemDocs.map((d) => ({ id: d.id, data: d.data })),
    },
  };

  const backupPath = path.join('/tmp', `maresia-grill-category-ids-backup-${projectId}-${Date.now()}.json`);
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));

  console.log(JSON.stringify({
    categoriesToMigrate: categoriesToCreate.map((c) => ({ oldId: c.oldId, newId: c.newId, name: c.data.name })),
    categoriesAlreadyUUID: uuidCategories.map((d) => d.id),
    itemsToUpdate: itemsToUpdate.map((i) => ({ id: i.id, oldCategoryId: i.oldCategoryId, newCategoryId: i.newCategoryId })),
    itemsAlreadyOk: itemsAlreadyOk.length,
    backupPath,
  }, null, 2));

  if (dryRun) {
    console.log('\nDry-run: nenhuma alteração aplicada. Use --execute para aplicar.');
    return;
  }

  // -------------------------------------------------------------------------
  // Execução — usa batches de 500 (limite do Firestore)
  // -------------------------------------------------------------------------

  // 1. Criar novos docs de categoria com UUID
  console.log(`\nCriando ${categoriesToCreate.length} categoria(s) com UUID...`);
  for (const category of categoriesToCreate) {
    await db.collection('catalog/root/categories').doc(category.newId).set(category.data);
    console.log(`  ✓ ${category.data.name}: ${category.oldId} → ${category.newId}`);
  }

  // 2. Atualizar categoryId nos itens (em batches)
  console.log(`\nAtualizando categoryId em ${itemsToUpdate.length} item(s)...`);
  const BATCH_SIZE = 490;
  for (let i = 0; i < itemsToUpdate.length; i += BATCH_SIZE) {
    const chunk = itemsToUpdate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const item of chunk) {
      batch.update(item.ref, { categoryId: item.newCategoryId });
      console.log(`  ✓ item ${item.id}: ${item.oldCategoryId} → ${item.newCategoryId}`);
    }
    await batch.commit();
  }

  // 3. Deletar docs antigos com slug ID
  console.log(`\nRemovendo ${slugCategories.length} categoria(s) com slug ID...`);
  const deleteBatch = db.batch();
  for (const doc of slugCategories) {
    deleteBatch.delete(doc.ref);
    console.log(`  ✓ removido: catalog/root/categories/${doc.id}`);
  }
  await deleteBatch.commit();

  console.log('\nMigração concluída com sucesso.');
  console.log(`Backup salvo em: ${backupPath}`);
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => admin.app().delete());
