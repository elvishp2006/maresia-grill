export type Categoria = 'Saladas' | 'Acompanhamentos' | 'Carnes' | 'Churrasco';
export const CATEGORIES: Categoria[] = ['Saladas', 'Acompanhamentos', 'Carnes', 'Churrasco'];

export interface Item {
  id: string;
  nome: string;
  categoria: Categoria;
}
