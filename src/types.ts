export type Categoria = string;

export interface Item {
  id: string;
  nome: string;
  categoria: Categoria;
}

export interface EditorLock {
  sessionId: string;
  userEmail: string;
  deviceLabel: string;
  status: 'active';
  acquiredAt: number;
  lastHeartbeatAt: number;
  expiresAt: number;
}

// Used as fallback when Firestore has no saved categories list
export const DEFAULT_CATEGORIES: Categoria[] = ['Saladas', 'Acompanhamentos', 'Carnes', 'Churrasco'];
