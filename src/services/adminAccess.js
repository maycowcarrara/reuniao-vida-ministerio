export const normalizeAccessEmail = (value) => String(value || '').trim().toLowerCase();

export const getConfiguredDataOwnerUid = () => String(import.meta.env.VITE_ADMIN_UID || '').trim();

export const getConfiguredOwnerUid = () => String(
    import.meta.env.VITE_OWNER_UID || import.meta.env.VITE_ADMIN_UID || ''
).trim();

export const getConfiguredOwnerEmail = () => normalizeAccessEmail(import.meta.env.VITE_OWNER_EMAIL);

export const resolveDataOwnerUid = (user) => {
    const userUid = String(user?.uid || '').trim();
    return getConfiguredDataOwnerUid() || userUid;
};

export const isConfiguredOwner = (user) => {
    const ownerUid = getConfiguredOwnerUid();
    return Boolean(ownerUid && user?.uid === ownerUid);
};
