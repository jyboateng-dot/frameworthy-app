// Secret values normally injected by Secret Manager at deploy time. defineSecret's
// .value() reads these from process.env, so a plain env var stands in for it here.
process.env.PAYSTACK_SECRET_KEY = 'test-paystack-secret';
process.env.EMAILJS_PRIVATE_KEY = 'test-emailjs-private-key';
process.env.GEMINI_API_KEY = 'test-gemini-api-key';
