import { describe, it, expect } from 'vitest';
import { formatMenuText, groupOrderItemsByCategory } from '../lib/utils';
import type { Item } from '../types';

const items: Item[] = [
  { id: '1', nome: 'Arroz', categoria: 'Acompanhamentos' },
  { id: '2', nome: 'Feijão', categoria: 'Acompanhamentos' },
  { id: '3', nome: 'Frango', categoria: 'Carnes' },
  { id: '4', nome: 'Alface', categoria: 'Saladas' },
];

const categories = ['Saladas', 'Acompanhamentos', 'Carnes'];

describe('formatMenuText', () => {
  it('includes only selected items', () => {
    const text = formatMenuText(items, ['1', '3'], categories);
    expect(text).toContain('Arroz');
    expect(text).toContain('Frango');
    expect(text).not.toContain('Feijão');
    expect(text).not.toContain('Alface');
  });

  it('groups items by category in the given order', () => {
    const text = formatMenuText(items, ['1', '2', '3', '4'], categories);
    const saladIdx = text.indexOf('Saladas');
    const acompIdx = text.indexOf('Acompanhamentos');
    const carnesIdx = text.indexOf('Carnes');
    expect(saladIdx).toBeLessThan(acompIdx);
    expect(acompIdx).toBeLessThan(carnesIdx);
  });

  it('sorts items alphabetically within each category', () => {
    const text = formatMenuText(items, ['1', '2'], categories);
    const arrozIdx = text.indexOf('Arroz');
    const feijaoIdx = text.indexOf('Feijão');
    expect(arrozIdx).toBeLessThan(feijaoIdx);
  });

  it('skips empty categories', () => {
    const text = formatMenuText(items, ['1'], categories);
    expect(text).not.toContain('Carnes');
  });

  it('returns empty menu text when nothing is selected', () => {
    const text = formatMenuText(items, [], categories);
    expect(text).not.toContain('Arroz');
    expect(text).not.toContain('Saladas');
  });

  it('respects custom category order', () => {
    const customOrder = ['Carnes', 'Saladas', 'Acompanhamentos'];
    const text = formatMenuText(items, ['1', '3', '4'], customOrder);
    const carnesIdx = text.indexOf('Carnes');
    const saladIdx = text.indexOf('Saladas');
    expect(carnesIdx).toBeLessThan(saladIdx);
  });
});

describe('groupOrderItemsByCategory', () => {
  it('groups items by category using the configured category order first', () => {
    const grouped = groupOrderItemsByCategory([
      { id: '4', nome: 'Alface', categoria: 'Saladas' },
      { id: '1', nome: 'Arroz', categoria: 'Acompanhamentos' },
      { id: '3', nome: 'Frango', categoria: 'Carnes' },
    ], ['Carnes', 'Saladas', 'Acompanhamentos']);

    expect(grouped).toEqual([
      { category: 'Carnes', names: ['Frango'] },
      { category: 'Saladas', names: ['Alface'] },
      { category: 'Acompanhamentos', names: ['Arroz'] },
    ]);
  });

  it('sorts item names alphabetically inside each category', () => {
    const grouped = groupOrderItemsByCategory([
      { id: '2', nome: 'Feijão', categoria: 'Acompanhamentos' },
      { id: '1', nome: 'Arroz', categoria: 'Acompanhamentos' },
    ], ['Acompanhamentos']);

    expect(grouped).toEqual([
      { category: 'Acompanhamentos', names: ['Arroz', 'Feijão'] },
    ]);
  });

  it('places legacy categories after configured ones', () => {
    const grouped = groupOrderItemsByCategory([
      { id: '8', nome: 'Molho da casa', categoria: 'Molhos' },
      { id: '3', nome: 'Frango', categoria: 'Carnes' },
      { id: '4', nome: 'Alface', categoria: 'Saladas' },
    ], ['Saladas', 'Carnes']);

    expect(grouped).toEqual([
      { category: 'Saladas', names: ['Alface'] },
      { category: 'Carnes', names: ['Frango'] },
      { category: 'Molhos', names: ['Molho da casa'] },
    ]);
  });
});
