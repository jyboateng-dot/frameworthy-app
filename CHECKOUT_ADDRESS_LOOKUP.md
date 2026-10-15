# Checkout address lookup

Ideal Postcodes is the default address provider for the United Kingdom and
Jersey. It supplies Royal Mail PAF delivery addresses through a postcode-first
checkout flow. Geoapify remains available as a deliberate fallback switch.
Neither provider is called automatically when the selected provider fails;
manual entry remains available throughout checkout.

## Enable Ideal Postcodes

1. Create a standard PAF lookup key. Do not use an account-management key in
   the browser.
2. Restrict the browser key to the app's production origins and set spending
   and notification limits before enabling paid credits.
3. Add `VITE_IDEAL_POSTCODES_API_KEY` to the ignored `.env.local` for local
   development. For deployment, add the same-named GitHub Actions repository
   secret. Set `VITE_ADDRESS_LOOKUP_PROVIDER=ideal` or omit it because Ideal is
   the default.
4. Restart the dev server or rebuild/deploy hosting.
5. Test numbered GB houses, flats, Jersey house names and rural addresses.
   As customers enter a valid postcode, the matching PAF addresses appear
   automatically in a dropdown so they can choose the complete delivery address.

A configured test key proves live coverage; fixture tests only prove the app's
request, mapping and fallback behaviour. Without a configured key, manual entry
and browser autofill remain available.

## Switch back to Geoapify

1. Set `VITE_GEOAPIFY_API_KEY` and
   `VITE_ADDRESS_LOOKUP_PROVIDER=geoapify` in the local build environment, or
   use the corresponding GitHub secret and provider variable for deployment.
2. Restart/rebuild. Checkout changes to free-text address search and displays
   Geoapify/OpenStreetMap attribution.
3. Geoapify street-only or incomplete matches always open the editable address
   form. Returned country and postcode values are checked before display.

Destination changes refresh all selected items' GBP quotes together. If any
quote fails, the previous destination and prices remain. No payment-gateway or
paid-order trigger changes are included.

Sources:
- https://docs.ideal-postcodes.co.uk/docs/data/paf-supported-territories/
- https://docs.ideal-postcodes.co.uk/docs/api/postcodes/
- https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/
