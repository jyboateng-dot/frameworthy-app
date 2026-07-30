// Single source of truth for who has admin rights in the app. Keep this in
// sync with firestore.rules' isAdmin() — that's the real enforcement point
// (Firestore security rules), this is only for client-side UI gating.
export const ADMIN_EMAILS = ['admin@frameworthyco.com', 'info@frameworthyco.com'];

export const isAdminEmail = (email) => !!email && ADMIN_EMAILS.includes(email);
