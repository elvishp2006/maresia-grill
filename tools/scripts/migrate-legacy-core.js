import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const parseArgs = (argv) => {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(token, true);
      continue;
    }
    args.set(token, next);
    index += 1;
  }
  return args;
};

const args = parseArgs(process.argv.slice(2));
const projectId = String(args.get('--project') || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '').trim();
const dryRun = args.has('--dry-run') || !args.has('--execute');

if (!projectId) {
  throw new Error('Informe --project <projectId>.');
}

const apiBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

const getAccessToken = () => {
  if (typeof process.env.GOOGLE_OAUTH_ACCESS_TOKEN === 'string' && process.env.GOOGLE_OAUTH_ACCESS_TOKEN.trim()) {
    return process.env.GOOGLE_OAUTH_ACCESS_TOKEN.trim();
  }

  return execFileSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
};

const accessToken = getAccessToken();

const firestoreRequest = async (pathname, init = {}) => {
  const response = await fetch(`${apiBase}/${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firestore request failed (${response.status}) for ${pathname}: ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
};

const decodeValue = (value) => {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('nullValue' in value) return null;
  if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {});
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('timestampValue' in value) return value.timestampValue;
  return null;
};

const decodeFields = (fields) => Object.fromEntries(
  Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
);

const encodeValue = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') return { mapValue: { fields: encodeFields(value) } };
  throw new Error(`Tipo nao suportado na serializacao: ${typeof value}`);
};

const encodeFields = (record) => Object.fromEntries(
  Object.entries(record).map(([key, value]) => [key, encodeValue(value)]),
);

const normalizeTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getDocument = async (docPath) => {
  const payload = await firestoreRequest(docPath);
  if (!payload) return null;
  return {
    path: docPath,
    name: payload.name,
    data: decodeFields(payload.fields ?? {}),
    createTime: payload.createTime ?? null,
    updateTime: payload.updateTime ?? null,
  };
};

const listCollection = async (collectionPath) => {
  const documents = [];
  let pageToken = null;

  do {
    const suffix = pageToken
      ? `${collectionPath}?pageSize=500&pageToken=${encodeURIComponent(pageToken)}`
      : `${collectionPath}?pageSize=500`;
    const payload = await firestoreRequest(suffix);
    const entries = Array.isArray(payload?.documents) ? payload.documents : [];
    documents.push(...entries.map((entry) => ({
      path: entry.name.split('/documents/')[1],
      id: entry.name.split('/').at(-1) ?? '',
      data: decodeFields(entry.fields ?? {}),
      createTime: entry.createTime ?? null,
      updateTime: entry.updateTime ?? null,
    })));
    pageToken = payload?.nextPageToken ?? null;
  } while (pageToken);

  return documents;
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

const createCategoryId = (name) => (
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

const normalizePriceCents = (value) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
);

const unique = (values) => {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const normalizeLegacyCategoryNames = (value) => (
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []
);

const normalizeCategoryRules = (rawRules) => (
  Array.isArray(rawRules)
    ? rawRules
      .filter((rule) => rule && typeof rule === 'object' && typeof rule.category === 'string')
      .map((rule) => ({
        category: rule.category.trim(),
        maxSelections: typeof rule.maxSelections === 'number' && Number.isFinite(rule.maxSelections)
          ? Math.trunc(rule.maxSelections)
          : null,
        sharedLimitGroupId: typeof rule.sharedLimitGroupId === 'string' && rule.sharedLimitGroupId.trim()
          ? rule.sharedLimitGroupId.trim()
          : null,
        allowRepeatedItems: rule.allowRepeatedItems === true,
      }))
      .filter((rule) => rule.category.length > 0)
    : []
);

const normalizeLegacyItems = (rawItems) => (
  Array.isArray(rawItems)
    ? rawItems
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id.trim() : '',
        name: typeof item.nome === 'string' ? item.nome.trim() : '',
        category: typeof item.categoria === 'string' ? item.categoria.trim() : '',
        priceCents: normalizePriceCents(item.priceCents),
      }))
      .filter((item) => item.id && item.name && item.category)
    : []
);

const normalizeLegacySelectionIds = (value) => (
  Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []
);

const run = async () => {
  const [legacyCategoriesDoc, legacyItemsDoc, legacyRulesDoc, selectionDocs, existingCategoryDocs, existingItemDocs] = await Promise.all([
    getDocument('config/categories'),
    getDocument('config/complements'),
    getDocument('config/categorySelectionRules'),
    listCollection('selections'),
    listCollection('catalog/root/categories'),
    listCollection('catalog/root/items'),
  ]);

  const orderedCategoryNames = unique([
    ...normalizeLegacyCategoryNames(legacyCategoriesDoc?.data?.items),
    ...normalizeCategoryRules(legacyRulesDoc?.data?.rules).map((rule) => rule.category),
    ...normalizeLegacyItems(legacyItemsDoc?.data?.items).map((item) => item.category),
  ]);

  if (orderedCategoryNames.length === 0) {
    throw new Error('Nenhuma categoria legada encontrada em config/categories, config/categorySelectionRules ou config/complements.');
  }

  const categoryRules = new Map(normalizeCategoryRules(legacyRulesDoc?.data?.rules).map((rule) => [rule.category, rule]));
  const categoryNameById = new Map();
  const categories = orderedCategoryNames.map((name, sortOrder) => {
    const id = createCategoryId(name);
    const conflictingName = categoryNameById.get(id);
    if (conflictingName && conflictingName !== name) {
      throw new Error(`Categorias legadas colidem no novo identificador: "${conflictingName}" e "${name}" => "${id}".`);
    }
    categoryNameById.set(id, name);
    const rule = categoryRules.get(name);
    return {
      id,
      name,
      sortOrder,
      selectionPolicy: {
        maxSelections: rule?.maxSelections ?? null,
        sharedLimitGroupId: rule?.sharedLimitGroupId ?? null,
        allowRepeatedItems: rule?.allowRepeatedItems === true,
      },
    };
  });

  const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
  const sortOrderByCategory = new Map();
  const items = normalizeLegacyItems(legacyItemsDoc?.data?.items).map((item) => {
    const categoryId = categoryIdByName.get(item.category);
    if (!categoryId) {
      throw new Error(`Item legado "${item.name}" referencia categoria desconhecida "${item.category}".`);
    }
    const sortOrder = sortOrderByCategory.get(categoryId) ?? 0;
    sortOrderByCategory.set(categoryId, sortOrder + 1);
    return {
      id: item.id,
      categoryId,
      name: item.name,
      priceCents: item.priceCents,
      isActive: true,
      sortOrder,
    };
  });

  const validItemIds = new Set(items.map((item) => item.id));
  const droppedSelectionRefs = [];
  const dailyMenus = [];
  for (const selectionDoc of selectionDocs) {
    const dateKey = selectionDoc.id;
    const existingDailyMenu = await getDocument(`dailyMenus/${dateKey}`);
    const rawIds = normalizeLegacySelectionIds(selectionDoc.data?.ids);
    const itemIds = rawIds.filter((itemId) => validItemIds.has(itemId));
    const droppedIds = rawIds.filter((itemId) => !validItemIds.has(itemId));
    if (droppedIds.length > 0) {
      droppedSelectionRefs.push({ dateKey, droppedIds });
    }
    dailyMenus.push({
      dateKey,
      status: existingDailyMenu?.data?.status === 'published' || existingDailyMenu?.data?.status === 'closed'
        ? existingDailyMenu.data.status
        : 'draft',
      shareToken: typeof existingDailyMenu?.data?.shareToken === 'string' ? existingDailyMenu.data.shareToken : null,
      activeVersionId: typeof existingDailyMenu?.data?.activeVersionId === 'string' ? existingDailyMenu.data.activeVersionId : null,
      itemIds,
      updatedAt: normalizeTimestamp(selectionDoc.updateTime) ?? Date.now(),
    });
  }

  const backupPayload = {
    exportedAt: new Date().toISOString(),
    projectId,
    dryRun,
    legacy: {
      categories: legacyCategoriesDoc,
      complements: legacyItemsDoc,
      categorySelectionRules: legacyRulesDoc,
      selections: selectionDocs,
    },
    next: {
      categories,
      items,
      dailyMenus,
    },
  };

  const backupPath = path.join('/tmp', `maresia-grill-legacy-core-backup-${projectId}-${Date.now()}.json`);
  await fs.writeFile(backupPath, JSON.stringify(backupPayload, null, 2));

  const categoryIds = new Set(categories.map((category) => category.id));
  const itemIds = new Set(items.map((item) => item.id));
  const staleCategoryPaths = existingCategoryDocs
    .map((doc) => doc.id)
    .filter((id) => !categoryIds.has(id))
    .map((id) => `catalog/root/categories/${id}`);
  const staleItemPaths = existingItemDocs
    .map((doc) => doc.id)
    .filter((id) => !itemIds.has(id))
    .map((id) => `catalog/root/items/${id}`);

  console.log(JSON.stringify({
    projectId,
    dryRun,
    backupPath,
    categories: categories.length,
    items: items.length,
    dailyMenus: dailyMenus.length,
    staleCategoriesToDelete: staleCategoryPaths.length,
    staleItemsToDelete: staleItemPaths.length,
    droppedSelectionRefs,
  }, null, 2));

  if (dryRun) return;

  for (const category of categories) {
    await patchDocument(`catalog/root/categories/${category.id}`, {
      name: category.name,
      sortOrder: category.sortOrder,
      selectionPolicy: category.selectionPolicy,
    });
  }

  for (const item of items) {
    await patchDocument(`catalog/root/items/${item.id}`, item);
  }

  for (const stalePath of staleCategoryPaths) {
    await deleteDocument(stalePath);
  }

  for (const stalePath of staleItemPaths) {
    await deleteDocument(stalePath);
  }

  for (const dailyMenu of dailyMenus) {
    await patchDocument(`dailyMenus/${dailyMenu.dateKey}`, dailyMenu);
  }

  console.log('Migracao concluida.');
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
