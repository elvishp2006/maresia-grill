import { validateSelection as validateDomainSelection } from '@maresia-grill/domain/menu';
import type { CategorySelectionRule, Item, SelectedPublicItem } from '../types';

export interface CategorySelectionRuleInput {
  minSelections?: number | null;
  maxSelections?: number | null;
  sharedLimitGroupId?: string | null;
  linkedCategories?: string[];
  allowRepeatedItems?: boolean;
}

export interface SelectionViolation {
  type: 'category' | 'group' | 'min';
  category: string;
  maxSelections?: number;
  minSelections?: number;
  selectedCount: number;
  categories: string[];
  groupId?: string;
  message: string;
}

const normalizePositiveInteger = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  return normalized > 0 ? normalized : null;
};

export const normalizeGroupId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeCategorySelectionRule = (value: unknown): CategorySelectionRule | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.category !== 'string' || candidate.category.trim().length === 0) return null;

  return {
    category: candidate.category.trim(),
    minSelections: normalizePositiveInteger(candidate.minSelections),
    maxSelections: normalizePositiveInteger(candidate.maxSelections),
    sharedLimitGroupId: normalizeGroupId(candidate.sharedLimitGroupId),
    allowRepeatedItems: candidate.allowRepeatedItems === true ? true : undefined,
  };
};

export const normalizeCategorySelectionRules = (value: unknown): CategorySelectionRule[] => {
  if (!Array.isArray(value)) return [];

  const deduped = new Map<string, CategorySelectionRule>();
  for (const candidate of value) {
    const normalized = normalizeCategorySelectionRule(candidate);
    if (!normalized) continue;
    deduped.set(normalized.category, normalized);
  }
  return Array.from(deduped.values());
};

export const sanitizeCategorySelectionRuleInput = (
  category: string,
  input: CategorySelectionRuleInput,
): CategorySelectionRule | null => {
  const normalizedCategory = category.trim();
  if (!normalizedCategory) return null;

  const normalized: CategorySelectionRule = {
    category: normalizedCategory,
    minSelections: normalizePositiveInteger(input.minSelections),
    maxSelections: normalizePositiveInteger(input.maxSelections),
    sharedLimitGroupId: normalizeGroupId(input.sharedLimitGroupId),
    allowRepeatedItems: input.allowRepeatedItems ? true : undefined,
  };

  if (normalized.minSelections === null && normalized.maxSelections === null && !normalized.sharedLimitGroupId && !normalized.allowRepeatedItems) return null;
  return normalized;
};

export const upsertCategorySelectionRule = (
  rules: CategorySelectionRule[],
  category: string,
  input: CategorySelectionRuleInput,
): CategorySelectionRule[] => {
  const normalizedCategory = category.trim();
  const normalizedRules = normalizeCategorySelectionRules(rules);
  const normalizedLinkedCategories = Array.from(new Set(
    (input.linkedCategories ?? [])
      .map(candidate => candidate.trim())
      .filter(candidate => candidate.length > 0 && candidate !== normalizedCategory)
  ));
  const desiredCategories = Array.from(new Set([normalizedCategory, ...normalizedLinkedCategories]));
  const nextMaxSelections = normalizePositiveInteger(input.maxSelections);

  const getGroupMembers = (groupId: string | null | undefined) => (
    groupId
      ? normalizedRules
        .filter(rule => rule.sharedLimitGroupId === groupId)
        .map(rule => rule.category)
      : []
  );

  const affectedCategories = new Set<string>([normalizedCategory]);
  const currentRule = normalizedRules.find(rule => rule.category === normalizedCategory);

  for (const candidate of getGroupMembers(currentRule?.sharedLimitGroupId)) {
    affectedCategories.add(candidate);
  }

  for (const linkedCategory of normalizedLinkedCategories) {
    affectedCategories.add(linkedCategory);
    const linkedRule = normalizedRules.find(rule => rule.category === linkedCategory);
    for (const candidate of getGroupMembers(linkedRule?.sharedLimitGroupId)) {
      affectedCategories.add(candidate);
    }
  }

  const nextRules = normalizedRules.filter(rule => !affectedCategories.has(rule.category));
  const nextAllowRepeatedItems = input.allowRepeatedItems ?? currentRule?.allowRepeatedItems ?? false;
  const nextMinSelections = normalizePositiveInteger(input.minSelections);

  if (typeof nextMaxSelections === 'number') {
    if (desiredCategories.length > 1) {
      const existingGroupId = normalizeGroupId(input.sharedLimitGroupId)
        ?? currentRule?.sharedLimitGroupId
        ?? `shared:${desiredCategories
          .slice()
          .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }))
          .join('__')}`;

      for (const targetCategory of desiredCategories) {
        const previousRule = normalizedRules.find(rule => rule.category === targetCategory);
        nextRules.push({
          category: targetCategory,
          minSelections: targetCategory === normalizedCategory ? nextMinSelections : (previousRule?.minSelections ?? null),
          maxSelections: nextMaxSelections,
          sharedLimitGroupId: existingGroupId,
          allowRepeatedItems: targetCategory === normalizedCategory
            ? (nextAllowRepeatedItems ? true : undefined)
            : (previousRule?.allowRepeatedItems ? true : undefined),
        });
      }
    } else {
      nextRules.push({
        category: normalizedCategory,
        minSelections: nextMinSelections,
        maxSelections: nextMaxSelections,
        sharedLimitGroupId: null,
        allowRepeatedItems: nextAllowRepeatedItems ? true : undefined,
      });
    }
  } else if (nextAllowRepeatedItems || nextMinSelections !== null) {
    nextRules.push({
      category: normalizedCategory,
      minSelections: nextMinSelections,
      maxSelections: null,
      sharedLimitGroupId: null,
      allowRepeatedItems: nextAllowRepeatedItems ? true : undefined,
    });
  }

  for (const affectedCategory of affectedCategories) {
    if (desiredCategories.includes(affectedCategory)) continue;
    const previousRule = normalizedRules.find(rule => rule.category === affectedCategory);
    if (!previousRule || (typeof previousRule.maxSelections !== 'number' && !previousRule.minSelections)) continue;
    nextRules.push({
      category: affectedCategory,
      minSelections: previousRule.minSelections ?? null,
      maxSelections: previousRule.maxSelections ?? null,
      sharedLimitGroupId: null,
      allowRepeatedItems: previousRule.allowRepeatedItems ? true : undefined,
    });
  }

  return normalizeCategorySelectionRules(nextRules);
};

export const removeCategorySelectionRule = (
  rules: CategorySelectionRule[],
  category: string,
): CategorySelectionRule[] => {
  const normalizedRules = normalizeCategorySelectionRules(rules);
  const removedRule = normalizedRules.find(rule => rule.category === category);
  const nextRules = normalizedRules.filter(rule => rule.category !== category);

  if (!removedRule?.sharedLimitGroupId) return nextRules;

  const remainingGroupMembers = nextRules.filter(rule => rule.sharedLimitGroupId === removedRule.sharedLimitGroupId);
  if (remainingGroupMembers.length !== 1) return nextRules;

  return normalizeCategorySelectionRules(nextRules.map(rule => (
    rule.category === remainingGroupMembers[0]?.category
      ? { ...rule, sharedLimitGroupId: null }
      : rule
  )));
};

export const describeCategorySelectionRule = (
  category: string,
  rules: CategorySelectionRule[],
): string | null => {
  const normalizedRules = normalizeCategorySelectionRules(rules);
  const rule = normalizedRules.find(candidate => candidate.category === category);
  if (!rule || (rule.maxSelections == null && rule.minSelections == null)) return null;

  const min = rule.minSelections ?? null;
  const max = rule.maxSelections ?? null;

  if (rule.sharedLimitGroupId) {
    const groupedCategories = normalizedRules
      .filter(candidate => candidate.sharedLimitGroupId === rule.sharedLimitGroupId)
      .map(candidate => candidate.category)
      .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
    const others = groupedCategories.filter(candidate => candidate !== category).join(', ');
    if (min !== null && max !== null) return `Escolha de ${min} a ${max} somando com ${others}`;
    if (min !== null) return `Escolha pelo menos ${min} somando com ${others}`;
    return `Escolha até ${max} somando com ${others}`;
  }

  if (min !== null && max !== null) return `Escolha de ${min} a ${max}`;
  if (min !== null) return `Escolha pelo menos ${min}`;
  return `Escolha até ${max}`;
};

export const getLinkedCategories = (
  category: string,
  rules: CategorySelectionRule[],
): string[] => {
  const normalizedRules = normalizeCategorySelectionRules(rules);
  const rule = normalizedRules.find(candidate => candidate.category === category);
  if (!rule?.sharedLimitGroupId) return [];

  return normalizedRules
    .filter(candidate => candidate.sharedLimitGroupId === rule.sharedLimitGroupId && candidate.category !== category)
    .map(candidate => candidate.category)
    .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
};

const normalizeSelectedItems = (selected: string[] | SelectedPublicItem[]) => {
  if (selected.length === 0) return [] as SelectedPublicItem[];

  if (typeof selected[0] === 'string') {
    const counts = new Map<string, number>();
    for (const itemId of selected as string[]) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  return (selected as SelectedPublicItem[])
    .filter(item => typeof item.itemId === 'string' && Number.isFinite(item.quantity) && item.quantity > 0)
    .map(item => ({ itemId: item.itemId, quantity: Math.trunc(item.quantity) }));
};

export const validateSelectionRules = (
  items: Item[],
  selectedItemIds: string[] | SelectedPublicItem[],
  rules: CategorySelectionRule[],
): SelectionViolation[] => {
  const normalizedRules = normalizeCategorySelectionRules(rules);
  const categories = Array.from(new Set(items.map(item => item.categoria))).map(categoryName => {
    const rule = normalizedRules.find(candidate => candidate.category === categoryName);
    return {
      id: categoryName,
      name: categoryName,
      selectionPolicy: {
        minSelections: rule?.minSelections ?? null,
        maxSelections: rule?.maxSelections ?? null,
        sharedLimitGroupId: rule?.sharedLimitGroupId ?? null,
        allowRepeatedItems: rule?.allowRepeatedItems === true,
      },
    };
  });

  return validateDomainSelection(
    categories,
    items.map(item => ({ id: item.id, categoryId: item.categoria })),
    normalizeSelectedItems(selectedItemIds),
  );
};
