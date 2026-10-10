// Secret values normally injected by Secret Manager at deploy time. defineSecret's
// .value() reads these from process.env, so a plain env var stands in for it here.
process.env.PAYSTACK_SECRET_KEY = 'test-paystack-secret';
process.env.EMAILJS_PRIVATE_KEY = 'test-emailjs-private-key';
process.env.GEMINI_API_KEY = 'test-gemini-api-key';
// Matches the literal value redeemTesterPin.test.js's "master PIN (JYB187)"
// tests hardcode and assert against — this isn't a real secret value, just
// standing in for whatever the real MASTER_TESTER_PIN secret is in production.
process.env.MASTER_TESTER_PIN = 'JYB187';
process.env.IMAGEKIT_PRIVATE_KEY = 'test-imagekit-private-key';
process.env.PRODIGI_API_KEY = 'test-prodigi-api-key';
