const GB_JE_POSTCODE = /^(GIR 0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/i;

export const normalizePostalCode = (value = '') => value.trim().toUpperCase().replace(/\s+/g, ' ');

export const isGbJerseyCountry = (countryCode) => countryCode === 'GB' || countryCode === 'JE';

export const isValidDeliveryPostalCode = (countryCode, value) => {
    const postalCode = normalizePostalCode(value);
    if (!postalCode) return false;
    return isGbJerseyCountry(countryCode) ? GB_JE_POSTCODE.test(postalCode) : postalCode.length <= 32;
};

export const deliveryCountryName = (countryCode) => {
    if (countryCode === 'GB') return 'United Kingdom';
    if (countryCode === 'JE') return 'Jersey';
    return countryCode;
};
