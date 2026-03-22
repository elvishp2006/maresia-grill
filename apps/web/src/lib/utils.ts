import type { Item, CategoryEntry } from '../types';

export const normalize = (str: string): string =>
  str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const formatMenuText = (complements: Item[], daySelection: string[], categories: CategoryEntry[]): string => {
  const now = new Date();
  const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const dayName = weekdays[now.getDay()];
  const date = now.toLocaleDateString('pt-BR');

  let text = `Maresia Grill — Menu de Hoje — ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${date}\n`;

  const selectedItems = complements.filter(item => daySelection.includes(item.id));

  for (const categoria of categories) {
    const items = selectedItems
      .filter(item => item.categoria === categoria.id)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

    if (items.length === 0) continue;

    text += `\n${categoria.name}\n`;
    for (const item of items) {
      text += `- ${item.nome}\n`;
    }
  }

  return text.trim();
};

export const groupOrderItemsByCategory = (items: Item[], configuredCategories: string[]) => {
  // `categories` is derived from `firstSeenCategories` (categories that appear in `items`),
  // so every entry in the iteration has at least one item — empty-names groups cannot occur.
  const firstSeenCategories = Array.from(new Set(items.map(item => item.categoria)));
  const configuredCategorySet = new Set(configuredCategories);
  const categories = [
    ...configuredCategories.filter(category => firstSeenCategories.includes(category)),
    ...firstSeenCategories.filter(category => !configuredCategorySet.has(category)),
  ];

  return categories
    .map((category) => {
      const names = items
        .filter(item => item.categoria === category)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
        .map(item => {
          const quantity = typeof item.quantity === 'number' && item.quantity > 1 ? Math.trunc(item.quantity) : 1;
          return quantity > 1 ? `${quantity}x ${item.nome}` : item.nome;
        });

      return {
        category,
        names,
      };
    });
};
