import type { CategorySelectionRule, Item } from '../types';

export interface CategorySelectionRuleInput {
  maxSelections?: number | null;
  sharedLimitGroupId?: string | null;
  linkedCategories?: string[];
}

export interface SelectionViolation {
  type: 'category' | 'group';
  category: string;
  maxSelections: number;
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
    maxSelections: normalizePositiveInteger(candidate.maxSelections),
    sharedLimitGroupId: normalizeGroupId(candidate.sharedLimitGroupId),
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
    maxSelections: normalizePositiveInteger(input.maxSelections),
    sharedLimitGroupId: normalizeGroupId(input.sharedLimitGroupId),
  };

  if (normalized.maxSelections === null && !normalized.sharedLimitGroupId) return null;
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

  if (typeof nextMaxSelections === 'number') {
    if (desiredCategories.length > 1) {
      const existingGroupId = normalizeGroupId(input.sharedLimitGroupId)
        ?? currentRule?.sharedLimitGroupId
        ?? normalizedLinkedCategories
          .map(linkedCategory => normalizedRules.find(rule => rule.category === linkedCategory)?.sharedLimitGroupId)
          .find((groupId): groupId is string => typeof groupId === 'string' && groupId.length > 0)
        ?? `shared:${desiredCategories
          .slice()
          .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }))
          .join('__')}`;

      for (const targetCategory of desiredCategories) {
        nextRules.push({
          category: targetCategory,
          maxSelections: nextMaxSelections,
          sharedLimitGroupId: existingGroupId,
        });
      }
    } else {
      nextRules.push({
        category: normalizedCategory,
        maxSelections: nextMaxSelections,
        sharedLimitGroupId: null,
      });
    }
  }

  for (const affectedCategory of affectedCategories) {
    if (desiredCategories.includes(affectedCategory)) continue;
    const previousRule = normalizedRules.find(rule => rule.category === affectedCategory);
    if (!previousRule || typeof previousRule.maxSelections !== 'number') continue;
    nextRules.push({
      category: affectedCategory,
      maxSelections: previousRule.maxSelections,
      sharedLimitGroupId: null,
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
  if (!rule || rule.maxSelections === null) return null;

  if (rule.sharedLimitGroupId) {
    const groupedCategories = normalizedRules
      .filter(candidate => candidate.sharedLimitGroupId === rule.sharedLimitGroupId)
      .map(candidate => candidate.category)
      .sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }));
    return `Escolha ate ${rule.maxSelections} somando com ${groupedCategories.filter(candidate => candidate !== category).join(', ')}`;
  }

  return `Escolha ate ${rule.maxSelections}`;
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

const getSelectionCounts = (items: Item[], selectedItemIds: string[]) => {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!selectedItemIds.includes(item.id)) continue;
    counts.set(item.categoria, (counts.get(item.categoria) ?? 0) + 1);
  }
  return counts;
};

export const validateSelectionRules = (
  items: Item[],
  selectedItemIds: string[],
  rules: CategorySelectionRule[],
): SelectionViolation[] => {
  const normalizedRules = normalizeCategorySelectionRules(rules);
  const counts = getSelectionCounts(items, selectedItemIds);
  const violations: SelectionViolation[] = [];

  for (const rule of normalizedRules) {
    if (!rule.sharedLimitGroupId && typeof rule.maxSelections === 'number') {
      const selectedCount = counts.get(rule.category) ?? 0;
      if (selectedCount > rule.maxSelections) {
        violations.push({
          type: 'category',
          category: rule.category,
          categories: [rule.category],
          maxSelections: rule.maxSelections,
          selectedCount,
          message: `Voce pode escolher ate ${rule.maxSelections} item(ns) em ${rule.category}.`,
        });
      }
    }
  }

  const groupedRules = normalizedRules.reduce<Map<string, CategorySelectionRule[]>>((acc, rule) => {
    if (!rule.sharedLimitGroupId) return acc;
    acc.set(rule.sharedLimitGroupId, [...(acc.get(rule.sharedLimitGroupId) ?? []), rule]);
    return acc;
  }, new Map());

  for (const [groupId, groupRules] of groupedRules.entries()) {
    const groupMaxCandidates = groupRules
      .map(rule => rule.maxSelections)
      .filter((value): value is number => typeof value === 'number');
    if (groupMaxCandidates.length === 0) continue;

    const groupMax = Math.min(...groupMaxCandidates);
    const categories = groupRules.map(rule => rule.category);
    const selectedCount = categories.reduce((sum, category) => sum + (counts.get(category) ?? 0), 0);
    if (selectedCount <= groupMax) continue;

    violations.push({
      type: 'group',
      category: categories[0] ?? '',
      categories,
      groupId,
      maxSelections: groupMax,
      selectedCount,
      message: `Voce pode escolher ate ${groupMax} item(ns) entre ${categories.join(' e ')}.`,
    });
  }

  return violations;
};

export const canSelectItem = ({
  items,
  selectedItemIds,
  itemId,
  rules,
}: {
  items: Item[];
  selectedItemIds: string[];
  itemId: string;
  rules: CategorySelectionRule[];
}) => {
  if (selectedItemIds.includes(itemId)) return { allowed: true as const };

  const nextSelectedItemIds = [...selectedItemIds, itemId];
  const violations = validateSelectionRules(items, nextSelectedItemIds, rules);
  if (violations.length === 0) return { allowed: true as const };

  return {
    allowed: false as const,
    violation: violations[0],
  };
};

export const getItemSelectionAvailability = ({
  items,
  selectedItemIds,
  item,
  rules,
}: {
  items: Item[];
  selectedItemIds: string[];
  item: Item;
  rules: CategorySelectionRule[];
}) => {
  const active = selectedItemIds.includes(item.id);
  if (active) {
    return {
      active: true,
      disabled: false,
      helperText: 'Selecionado no pedido',
    };
  }

  const result = canSelectItem({
    items,
    selectedItemIds,
    itemId: item.id,
    rules,
  });

  if (result.allowed) {
    return {
      active: false,
      disabled: false,
      helperText: 'Disponivel para incluir',
    };
  }

  return {
    active: false,
    disabled: true,
    helperText: 'Limite atingido',
    violation: result.violation,
  };
};
