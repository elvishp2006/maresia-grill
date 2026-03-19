const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_PART_MAX_LENGTH = 64;
const EMAIL_ALLOWED_LOCAL_PART = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const EMAIL_ALLOWED_DOMAIN_LABEL = /^[A-Za-z0-9-]+$/;

export const normalizeCustomerEmail = (value: string) => value.trim().toLowerCase();

export const isValidCustomerEmail = (value: string) => {
  const normalized = normalizeCustomerEmail(value);
  if (!normalized || normalized.length > EMAIL_MAX_LENGTH) return false;

  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0 || atIndex !== normalized.lastIndexOf('@')) return false;

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);

  if (
    !localPart
    || !domain
    || localPart.length > EMAIL_LOCAL_PART_MAX_LENGTH
    || localPart.startsWith('.')
    || localPart.endsWith('.')
    || localPart.includes('..')
    || !EMAIL_ALLOWED_LOCAL_PART.test(localPart)
  ) {
    return false;
  }

  const labels = domain.split('.');
  if (labels.length < 2) return false;

  return labels.every((label, index) => {
    if (
      !label
      || label.length > 63
      || label.startsWith('-')
      || label.endsWith('-')
      || !EMAIL_ALLOWED_DOMAIN_LABEL.test(label)
    ) {
      return false;
    }

    if (index === labels.length - 1 && label.length < 2) return false;
    return true;
  });
};
