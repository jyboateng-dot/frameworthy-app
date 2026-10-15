const GB_JE_POSTCODE = /^(GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/i;

export const normalizePostalCode = (value = '') => {
    const compact = value.trim().toUpperCase().replace(/\s+/g, '');
    return GB_JE_POSTCODE.test(compact) ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};

export const isGbJerseyCountry = (countryCode) => countryCode === 'GB' || countryCode === 'JE';

export const isValidDeliveryPostalCode = (countryCode, value) => {
    const postalCode = normalizePostalCode(value);
    if (!postalCode) return false;
    if (countryCode === 'JE') return /^JE\d{1,2} \d[A-Z]{2}$/.test(postalCode);
    if (countryCode === 'GB') return GB_JE_POSTCODE.test(postalCode) && !/^(JE|GY|IM)/.test(postalCode);
    return postalCode.length <= 32;
};

export const deliveryCountryName = (countryCode) => {
    if (countryCode === 'GB') return 'United Kingdom';
    if (countryCode === 'JE') return 'Jersey';
    return countryCode;
};
