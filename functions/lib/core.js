export const normalizePriceCents = (value) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0);
export const normalizeCustomerName = (value) => {
    if (typeof value !== 'string')
        throw new Error('Nome do cliente inválido.');
    const normalized = value.trim();
    if (!normalized)
        throw new Error('Informe o nome para finalizar o pedido.');
    return normalized;
};
export const normalizeSelectedItems = (selectedItems, selectedItemIds) => {
    const counts = new Map();
    for (const item of selectedItems ?? []) {
        if (typeof item?.itemId !== 'string' || !Number.isFinite(item.quantity) || item.quantity <= 0)
            continue;
        counts.set(item.itemId, (counts.get(item.itemId) ?? 0) + Math.trunc(item.quantity));
    }
    if (counts.size === 0) {
        for (const itemId of selectedItemIds ?? []) {
            counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
        }
    }
    return Array.from(counts.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
};
export const createBasePaymentSummary = (items, selectedItemIds, paymentStatus) => {
    let freeTotalCents = 0;
    let paidTotalCents = 0;
    const normalizedSelectedItems = Array.isArray(selectedItemIds) && typeof selectedItemIds[0] !== 'string'
        ? selectedItemIds
        : normalizeSelectedItems(undefined, selectedItemIds);
    const selectedQuantities = new Map(normalizedSelectedItems.map(item => [item.itemId, item.quantity]));
    for (const item of items) {
        const quantity = selectedQuantities.get(item.id) ?? 0;
        if (quantity <= 0)
            continue;
        const priceCents = normalizePriceCents(item.priceCents);
        if (priceCents > 0) {
            paidTotalCents += priceCents * quantity;
        }
        else {
            freeTotalCents += priceCents * quantity;
        }
    }
    return {
        freeTotalCents,
        paidTotalCents,
        currency: 'BRL',
        paymentStatus,
        provider: paidTotalCents > 0 ? 'stripe' : null,
        paymentMethod: null,
        providerPaymentId: null,
        refundedAt: null,
    };
};
export const validateSelection = (items, selectedItemIds, rules) => {
    const normalizedSelectedItems = Array.isArray(selectedItemIds) && typeof selectedItemIds[0] !== 'string'
        ? selectedItemIds
        : normalizeSelectedItems(undefined, selectedItemIds);
    const selectedQuantities = new Map(normalizedSelectedItems.map(item => [item.itemId, item.quantity]));
    const counts = new Map();
    for (const item of items) {
        const quantity = selectedQuantities.get(item.id) ?? 0;
        if (quantity <= 0)
            continue;
        counts.set(item.categoria, (counts.get(item.categoria) ?? 0) + quantity);
    }
    const groupedCounts = new Map();
    for (const rule of rules) {
        if (typeof rule.maxSelections !== 'number')
            continue;
        const categoryCount = counts.get(rule.category) ?? 0;
        if (!rule.sharedLimitGroupId && categoryCount > rule.maxSelections) {
            throw new Error(`A categoria ${rule.category} excedeu o limite permitido.`);
        }
        if (rule.sharedLimitGroupId) {
            groupedCounts.set(rule.sharedLimitGroupId, (groupedCounts.get(rule.sharedLimitGroupId) ?? 0) + categoryCount);
        }
    }
    for (const rule of rules) {
        if (typeof rule.maxSelections !== 'number' || !rule.sharedLimitGroupId)
            continue;
        if ((groupedCounts.get(rule.sharedLimitGroupId) ?? 0) > rule.maxSelections) {
            throw new Error(`O grupo compartilhado ${rule.sharedLimitGroupId} excedeu o limite permitido.`);
        }
    }
};
export const buildReturnUrl = (draftId, rawUrl, allowedOrigin) => {
    const normalizedUrl = rawUrl?.trim();
    if (!normalizedUrl)
        throw new Error('URL de retorno inválida.');
    const url = new URL(normalizedUrl);
    if (allowedOrigin) {
        const normalizedOrigin = allowedOrigin.trim().replace(/\/$/, '');
        if (normalizedOrigin && url.origin !== normalizedOrigin) {
            throw new Error('URL de retorno fora da origem permitida.');
        }
    }
    url.searchParams.set('draftId', draftId);
    if (!url.hash)
        url.hash = '#/enviado';
    return url.toString();
};
export const mapPaymentMethods = (types) => {
    const methods = new Set();
    for (const type of types ?? []) {
        if (type === 'pix')
            methods.add('pix');
        if (type === 'card')
            methods.add('card');
    }
    if (methods.size === 0)
        methods.add('card');
    return Array.from(methods);
};
export const isWinningOrderDraft = (order, draftId, providerPaymentId) => {
    if (!order)
        return false;
    if (order.sourceDraftId === draftId)
        return true;
    if (providerPaymentId && order.paymentSummary?.providerPaymentId === providerPaymentId)
        return true;
    return false;
};
export const canReplaceExistingOrderWithPaidDraft = (order) => {
    if (!order)
        return false;
    return (order.paymentSummary?.paidTotalCents ?? 0) === 0;
};
export const isDuplicatePaidDraft = (order, draftId, providerPaymentId) => {
    if (!order)
        return false;
    if (order.sourceDraftId === draftId)
        return false;
    if (providerPaymentId && order.paymentSummary?.providerPaymentId === providerPaymentId)
        return false;
    return true;
};
