# Prodigi integration

FrameWorthy uses Prodigi Print API v4. The browser never receives the API key. Firebase Functions retrieves live quotes, while the customer experience displays GBP totals for the current United Kingdom and Jersey collection.

## Configuration

Start with Prodigi's sandbox key:

```sh
firebase functions:secrets:set PRODIGI_API_KEY
firebase functions:secrets:set PRODIGI_CALLBACK_TOKEN
```

Set these server environment values for the Firebase project:

```dotenv
PRODIGI_ENVIRONMENT=sandbox
PRODIGI_GHS_PER_GBP=0
PRODIGI_GHS_PER_EUR=0
PRODIGI_GHS_PER_USD=0
PRODIGI_RETAIL_MARKUP_PERCENT=35
PRODIGI_CALLBACK_URL=https://YOUR_HOST/api/prodigi-callback?token=YOUR_CALLBACK_TOKEN
```

Replace the zero exchange rates with approved operating rates. Until the rate for the supplier currency is positive, the catalogue can show a live wholesale quote but checkout stays disabled for that product.

The callback token in `PRODIGI_CALLBACK_URL` must exactly match the `PRODIGI_CALLBACK_TOKEN` secret. Prodigi callbacks are verified by fetching the referenced order from Prodigi before FrameWorthy updates Firestore.

## Flow

1. The catalogue requests a live quote from `getProdigiQuote`.
2. The function returns the live item, delivery, tax, currency, and shipping method.
3. The customer configures artwork in the Frame Studio; the displayed GBP total includes live delivery and tax.
4. Cart and checkout preserve GBP as the order currency. GBP payment and order submission remain disabled until the payment gateway is connected and validated.
5. The existing paid-order trigger and callback code remain parked for later activation after sandbox validation.

Keep `PRODIGI_ENVIRONMENT=sandbox` until quote, payment and fulfilment tests pass using sandbox orders. Switching to `live` creates chargeable production orders.
