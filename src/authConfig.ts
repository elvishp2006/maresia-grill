export const AUTHORIZED_EMAILS = [
  'elvishp2006@gmail.com',
] as const;

export const normalizeEmail = (email: string | null | undefined) =>
  (email ?? '').trim().toLowerCase();

export const isAuthorizedEmail = (email: string | null | undefined) =>
  (AUTHORIZED_EMAILS as readonly string[]).includes(normalizeEmail(email));
