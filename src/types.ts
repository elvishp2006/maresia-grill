export type Categoria = string;

export interface Item {
  id: string;
  nome: string;
  categoria: Categoria;
}

// Used as fallback when Firestore has no saved categories list
export const DEFAULT_CATEGORIES: Categoria[] = ['Saladas', 'Acompanhamentos', 'Carnes', 'Churrasco'];
