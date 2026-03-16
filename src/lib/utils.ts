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
