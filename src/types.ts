export type Categoria = string;

export interface Item {
  id: string;
  nome: string;
  categoria: Categoria;
}

export interface CategorySelectionRule {
  category: Categoria;
  maxSelections?: number | null;
  sharedLimitGroupId?: string | null;
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

export interface PublicMenu {
  token: string;
  dateKey: string;
  expiresAt: number;
  acceptingOrders: boolean;
  currentVersionId: string;
  categories: Categoria[];
  items: Item[];
  categorySelectionRules: CategorySelectionRule[];
}

export interface OrderEntry {
  id: string;
  dateKey: string;
  shareToken: string;
  orderId: string;
  customerName: string;
  menuVersionId?: string;
  selectedItemIds: string[];
  submittedItems?: Item[];
  submittedAt: number;
}

export interface PublicMenuVersion {
  id: string;
  token: string;
  dateKey: string;
  categories: Categoria[];
  itemIds: string[];
  items: Item[];
  categorySelectionRules: CategorySelectionRule[];
  createdAt: number;
}

// Used as fallback when Firestore has no saved categories list
export const DEFAULT_CATEGORIES: Categoria[] = ['Saladas', 'Acompanhamentos', 'Carnes', 'Churrasco'];
