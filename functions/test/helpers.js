// Wipes emulator state between tests via their REST admin endpoints — these
// tests hit real Firestore/Auth emulators (through the admin SDK, exactly as
// deployed functions do) rather than mocking them, so state must be reset
// explicitly instead of relying on per-test isolation.
const projectId = () => process.env.GCLOUD_PROJECT;

async function clearFirestore() {
    const host = process.env.FIRESTORE_EMULATOR_HOST;
    await fetch(`http://${host}/emulator/v1/projects/${projectId()}/databases/(default)/documents`, {
        method: 'DELETE',
    });
}

async function clearAuthUsers() {
    const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    await fetch(`http://${host}/emulator/v1/projects/${projectId()}/accounts`, {
        method: 'DELETE',
    });
}

module.exports = { clearFirestore, clearAuthUsers };
