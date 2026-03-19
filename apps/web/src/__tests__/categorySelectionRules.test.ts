import { describe, expect, it } from 'vitest';
import {
  describeCategorySelectionRule,
  getLinkedCategories,
  normalizeCategorySelectionRule,
  normalizeCategorySelectionRules,
  normalizeGroupId,
  removeCategorySelectionRule,
  sanitizeCategorySelectionRuleInput,
  upsertCategorySelectionRule,
  validateSelectionRules,
} from '../lib/categorySelectionRules';
import type { CategorySelectionRule, Item, SelectedPublicItem } from '../types';

const items: Item[] = [
  { id: 'salad-1', nome: 'Alface', categoria: 'Saladas' },
  { id: 'drink-1', nome: 'Coca-Cola', categoria: 'Bebidas' },
  { id: 'dessert-1', nome: 'Brownie', categoria: 'Sobremesas' },
];

describe('categorySelectionRules', () => {
  it('normalizes group ids and category rules', () => {
    expect(normalizeGroupId(' extras ')).toBe('extras');
    expect(normalizeGroupId('   ')).toBeNull();

    expect(normalizeCategorySelectionRule({
      category: '  Bebidas ',
      maxSelections: 1.8,
      sharedLimitGroupId: ' extras ',
      allowRepeatedItems: true,
    })).toEqual({
      category: 'Bebidas',
      maxSelections: 1,
      sharedLimitGroupId: 'extras',
      allowRepeatedItems: true,
    });

    expect(normalizeCategorySelectionRule({ category: '   ' })).toBeNull();
  });

  it('deduplicates and sanitizes normalized rules', () => {
    expect(normalizeCategorySelectionRules([
      { category: 'Bebidas', maxSelections: 1 },
      { category: '  Bebidas ', maxSelections: 2, sharedLimitGroupId: 'extras' },
      null,
      { category: '' },
    ])).toEqual([
      {
        category: 'Bebidas',
        maxSelections: 2,
        sharedLimitGroupId: 'extras',
        allowRepeatedItems: undefined,
      },
    ]);
  });

  it('sanitizes input and drops empty rule definitions', () => {
    expect(sanitizeCategorySelectionRuleInput('  Sobremesas ', { maxSelections: 2, allowRepeatedItems: true }))
      .toEqual({
        category: 'Sobremesas',
        maxSelections: 2,
        sharedLimitGroupId: null,
        allowRepeatedItems: true,
      });

    expect(sanitizeCategorySelectionRuleInput('   ', { maxSelections: 2 })).toBeNull();
    expect(sanitizeCategorySelectionRuleInput('Sobremesas', {})).toBeNull();
  });

  it('creates and updates shared selection groups through upsert', () => {
    const rules = upsertCategorySelectionRule([], 'Bebidas', {
      maxSelections: 1,
      linkedCategories: ['Sobremesas'],
      allowRepeatedItems: true,
    });

    expect(rules).toEqual([
      {
        category: 'Bebidas',
        maxSelections: 1,
        sharedLimitGroupId: 'shared:Bebidas__Sobremesas',
        allowRepeatedItems: true,
      },
      {
        category: 'Sobremesas',
        maxSelections: 1,
        sharedLimitGroupId: 'shared:Bebidas__Sobremesas',
        allowRepeatedItems: undefined,
      },
    ]);

    expect(getLinkedCategories('Bebidas', rules)).toEqual(['Sobremesas']);
    expect(describeCategorySelectionRule('Bebidas', rules)).toBe('Escolha ate 1 somando com Sobremesas');

    expect(upsertCategorySelectionRule(rules, 'Bebidas', {
      maxSelections: 2,
      linkedCategories: [],
    })).toEqual([
      {
        category: 'Bebidas',
        maxSelections: 2,
        sharedLimitGroupId: null,
        allowRepeatedItems: true,
      },
      {
        category: 'Sobremesas',
        maxSelections: 1,
        sharedLimitGroupId: null,
        allowRepeatedItems: undefined,
      },
    ]);
  });

  it('keeps remaining categories valid when removing a grouped rule', () => {
    const rules: CategorySelectionRule[] = [
      { category: 'Bebidas', maxSelections: 1, sharedLimitGroupId: 'extras' },
      { category: 'Sobremesas', maxSelections: 1, sharedLimitGroupId: 'extras' },
    ];

    expect(removeCategorySelectionRule(rules, 'Bebidas')).toEqual([
      { category: 'Sobremesas', maxSelections: 1, sharedLimitGroupId: null, allowRepeatedItems: undefined },
    ]);
  });

  it('validates selections against category and group limits', () => {
    expect(validateSelectionRules(items, ['salad-1', 'drink-1'], [
      { category: 'Saladas', maxSelections: 1 },
      { category: 'Bebidas', maxSelections: 1 },
    ])).toEqual([]);

    expect(validateSelectionRules(items, ['drink-1', 'dessert-1'], [
      { category: 'Bebidas', maxSelections: 1, sharedLimitGroupId: 'extras' },
      { category: 'Sobremesas', maxSelections: 1, sharedLimitGroupId: 'extras' },
    ])).toEqual([
      expect.objectContaining({
        type: 'group',
        groupId: 'extras',
        selectedCount: 2,
      }),
    ]);
  });

  it('validates repeated selections when given entry objects', () => {
    const selected: SelectedPublicItem[] = [
      { itemId: 'salad-1', quantity: 2 },
    ];

    expect(validateSelectionRules(items, selected, [
      { category: 'Saladas', maxSelections: 1 },
    ])).toEqual([
      expect.objectContaining({
        type: 'category',
        category: 'Saladas',
        selectedCount: 2,
      }),
    ]);
  });
});
