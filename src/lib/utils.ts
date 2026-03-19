import type { Item } from '../types';

export const normalize = (str: string): string =>
  str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const formatMenuText = (complements: Item[], daySelection: string[], categories: string[]): string => {
  const now = new Date();
  const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const dayName = weekdays[now.getDay()];
  const date = now.toLocaleDateString('pt-BR');

  let text = `Maresia Grill — Menu de Hoje — ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${date}\n`;

  const selectedItems = complements.filter(item => daySelection.includes(item.id));

  for (const categoria of categories) {
    const items = selectedItems
      .filter(item => item.categoria === categoria)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

    if (items.length === 0) continue;

    text += `\n${categoria}\n`;
    for (const item of items) {
      text += `- ${item.nome}\n`;
    }
  }

  return text.trim();
};

export const formatOrderItems = (items: Item[], selectedItemIds: string[], categories: string[]): string => {
  const selectedItems = items.filter(item => selectedItemIds.includes(item.id));

  return categories
    .map((category) => {
      const names = selectedItems
        .filter(item => item.categoria === category)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
        .map(item => item.nome);

      if (names.length === 0) return null;
      return `${category}: ${names.join(', ')}`;
    })
    .filter((value): value is string => value !== null)
    .join(' • ');
};

export const groupOrderItemsByCategory = (items: Item[], configuredCategories: string[]) => {
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

      if (names.length === 0) return null;

      return {
        category,
        names,
      };
    })
    .filter((value): value is { category: string; names: string[] } => value !== null);
};
