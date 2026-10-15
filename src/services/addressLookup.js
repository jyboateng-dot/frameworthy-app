import { isValidDeliveryPostalCode, normalizePostalCode } from '../utils/deliveryAddress';

// This is a browser lookup key, never an account management key. Restrict it
// to the app's domains and set spending limits in the provider dashboard.
export const getAddressLookupProvider = () => import.meta.env.VITE_ADDRESS_LOOKUP_PROVIDER || 'ideal';
const providerKey = (provider) => provider === 'ideal'
    ? import.meta.env.VITE_IDEAL_POSTCODES_API_KEY
    : import.meta.env.VITE_GEOAPIFY_API_KEY;
export const isAddressLookupConfigured = () => ['geoapify', 'ideal'].includes(getAddressLookupProvider()) && Boolean(providerKey(getAddressLookupProvider()));

export async function lookupDeliveryAddresses(query, countryCode, { signal, provider = getAddressLookupProvider(), apiKey = providerKey(provider), fetchImpl = fetch } = {}) {
    if (!['GB', 'JE'].includes(countryCode)) throw new Error('Choose United Kingdom or Jersey for delivery.');
    if (provider === 'geoapify') return lookupGeoapify(query, countryCode, { signal, apiKey, fetchImpl });
    if (provider !== 'ideal') throw new Error('Address search is unavailable. Please enter your address manually.');
    const postcode = query;
    const normalized = normalizePostalCode(postcode);
    if (!isValidDeliveryPostalCode(countryCode, normalized)) throw new Error('Enter a postcode for your selected country.');
    if (!apiKey) throw new Error('Address search is unavailable. Please enter your address manually.');
    const response = await fetchImpl(`https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(normalized.replace(/ /g, ''))}`, {
        signal,
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Address search is unavailable. Please enter your address manually.');
    const data = await response.json();
    if (data.code !== 2000 || !Array.isArray(data.result)) throw new Error('Address search is unavailable. Please enter your address manually.');
    return data.result.filter(address => isValidDeliveryPostalCode(countryCode, address.postcode)).map((address, index) => ({
        id: String(address.udprn || address.id || index),
        line1: address.line_1 || '',
        // Preserve the third PAF address line rather than silently dropping it.
        line2: [address.line_2, address.line_3].filter(Boolean).join(', '),
        city: address.post_town || '',
        stateOrCounty: address.county || '',
        postalOrZipCode: normalizePostalCode(address.postcode),
        countryCode,
    })).filter(address => address.line1 && address.city);
}

async function lookupGeoapify(query, countryCode, { signal, apiKey, fetchImpl }) {
    const text = query.trim();
    if (text.length < 3 || text.length > 200) throw new Error('Enter a house name, street or postcode to search.');
    if (!apiKey) throw new Error('Address search is unavailable. Please enter your address manually.');
    const params = new URLSearchParams({
        text, filter: `countrycode:${countryCode.toLowerCase()}`, lang: 'en', limit: '8', format: 'json', apiKey,
    });
    const response = await fetchImpl(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, { signal });
    if (!response.ok) throw new Error('Address search is unavailable. Please enter your address manually.');
    const data = await response.json();
    if (!Array.isArray(data.results)) throw new Error('Address search is unavailable. Please enter your address manually.');
    return data.results.filter(address =>
        address.country_code?.toUpperCase() === countryCode
        && ['building', 'amenity', 'street'].includes(address.result_type)
        && (!address.postcode || isValidDeliveryPostalCode(countryCode, address.postcode))
    ).map((address, index) => {
        const postalOrZipCode = normalizePostalCode(address.postcode || '');
        // Display locality can differ from the administrative city (e.g.
        // London vs City of Westminster). Prefer it only when unambiguous.
        const displayLocality = address.postcode && address.address_line2?.includes(address.postcode)
            ? address.address_line2.split(address.postcode)[0].replace(/[,\s]+$/, '').trim()
            : '';
        const city = (displayLocality && !displayLocality.includes(',') ? displayLocality : '')
            || address.city || address.town || address.village || (countryCode === 'JE' ? 'Jersey' : '');
        const premise = address.housenumber || (address.result_type === 'building' && address.name);
        return {
            id: String(address.place_id || index),
            label: address.formatted || address.address_line1,
            line1: address.address_line1 || [address.housenumber, address.street].filter(Boolean).join(' '),
            // Map neighbourhoods are not reliable postal address lines. The
            // customer can add a flat/building/locality in the editable form.
            line2: '',
            city,
            stateOrCounty: address.county || '',
            postalOrZipCode,
            countryCode,
            // A mapped street/POI is not evidence of a deliverable premise.
            requiresCompletion: !premise || !city || !postalOrZipCode,
            attribution: address.datasource?.attribution || '',
        };
    }).filter(address => address.line1);
}
