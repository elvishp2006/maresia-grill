/**
 * migrate-category-ids.mjs
 *
 * Migra categorias com IDs baseados em slug (ex: "saladas") para UUIDs
 * (ex: "a1b2c3d4-..."). Atualiza o campo categoryId de todos os itens
 * do catálogo que referenciam o slug antigo.
 *
 * Uso:
 *   node tools/scripts/migrate-category-ids.mjs --project <projectId> [--dry-run]
 *   node tools/scripts/migrate-category-ids.mjs --project <projectId> --execute
 *
 * Flags:
 *   --project  <id>   ID do projeto Firebase (obrigatório)
 *   --execute         Aplica as alterações no Firestore (padrão: dry-run)
 *   --dry-run         Apenas simula e imprime o plano (padrão quando --execute ausente)
 *
 * Pré-requisitos:
 *   gcloud auth login  (ou GOOGLE_OAUTH_ACCESS_TOKEN no ambiente)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

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

if (!projectId) {
  console.error('Erro: informe --project <projectId>.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firestore REST helpers (sem dependência do SDK)
// ---------------------------------------------------------------------------

const apiBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

const getAccessToken = () => {
  if (typeof process.env.GOOGLE_OAUTH_ACCESS_TOKEN === 'string' && process.env.GOOGLE_OAUTH_ACCESS_TOKEN.trim()) {
    return process.env.GOOGLE_OAUTH_ACCESS_TOKEN.trim();
  }
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
};

const accessToken = getAccessToken();

const firestoreRequest = async (pathname, init = {}) => {
  const res = await fetch(`${apiBase}/${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore request failed (${res.status}) for ${pathname}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
};

// ---------------------------------------------------------------------------
// Encode / decode Firestore wire format
// ---------------------------------------------------------------------------

const decodeValue = (v) => {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return Boolean(v.booleanValue);
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ('timestampValue' in v) return v.timestampValue;
  return null;
};

const decodeFields = (fields) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));

const encodeValue = (v) => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v) } };
  throw new Error(`Tipo não suportado na serialização: ${typeof v}`);
};

const encodeFields = (record) =>
  Object.fromEntries(Object.entries(record).map(([k, v]) => [k, encodeValue(v)]));

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

const listCollection = async (collectionPath) => {
  const docs = [];
  let pageToken = null;
  do {
    const suffix = pageToken
      ? `${collectionPath}?pageSize=500&pageToken=${encodeURIComponent(pageToken)}`
      : `${collectionPath}?pageSize=500`;
    const payload = await firestoreRequest(suffix);
    const entries = Array.isArray(payload?.documents) ? payload.documents : [];
    docs.push(...entries.map((e) => ({
      path: e.name.split('/documents/')[1],
      id: e.name.split('/').at(-1) ?? '',
      data: decodeFields(e.fields ?? {}),
    })));
    pageToken = payload?.nextPageToken ?? null;
  } while (pageToken);
  return docs;
};

const createDocument = async (collectionPath, documentId, data) => {
  await firestoreRequest(`${collectionPath}?documentId=${encodeURIComponent(documentId)}`, {
    method: 'POST',
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
};

const patchDocument = async (docPath, data) => {
  await firestoreRequest(docPath, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
};

const deleteDocument = async (docPath) => {
  await firestoreRequest(docPath, { method: 'DELETE' });
};

// ---------------------------------------------------------------------------
// UUID detection
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (str) => UUID_RE.test(str);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const run = async () => {
  console.log(JSON.stringify({ projectId, dryRun }, null, 2));

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
      // Preservar sortOrder original; se colide com UUID existente, colocar no final
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
      path: doc.path,
      oldCategoryId: doc.data.categoryId,
      newCategoryId: slugToUUID.get(doc.data.categoryId),
      data: { ...doc.data, categoryId: slugToUUID.get(doc.data.categoryId) },
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
      itemsToUpdate,
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
  // Execução
  // -------------------------------------------------------------------------

  // 1. Criar novos docs de categoria com UUID
  console.log(`\nCriando ${categoriesToCreate.length} categoria(s) com UUID...`);
  for (const category of categoriesToCreate) {
    await createDocument('catalog/root/categories', category.newId, category.data);
    console.log(`  ✓ ${category.data.name}: ${category.oldId} → ${category.newId}`);
  }

  // 2. Atualizar categoryId nos itens
  console.log(`\nAtualizando categoryId em ${itemsToUpdate.length} item(s)...`);
  for (const item of itemsToUpdate) {
    await patchDocument(item.path, item.data);
    console.log(`  ✓ item ${item.id}: ${item.oldCategoryId} → ${item.newCategoryId}`);
  }

  // 3. Deletar docs antigos com slug ID
  console.log(`\nRemovendo ${slugCategories.length} categoria(s) com slug ID...`);
  for (const doc of slugCategories) {
    await deleteDocument(`catalog/root/categories/${doc.id}`);
    console.log(`  ✓ removido: catalog/root/categories/${doc.id}`);
  }

  console.log('\nMigração concluída com sucesso.');
  console.log(`Backup salvo em: ${backupPath}`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
