const OPTION_ATTRIBUTE_KEYS = ['color', 'glaze', 'mount', 'mountColor', 'substrateWeight', 'wrap'];

export const prodigiAttributesForProduct = (product) => ({
    ...(product?.frame ? { frame: product.frame } : {}),
    ...Object.fromEntries(
        OPTION_ATTRIBUTE_KEYS
            .filter((key) => product?.options?.[key])
            .map((key) => [key, product.options[key]])
    ),
    ...(product?.options?.paper ? { paperType: product.options.paper } : {}),
});

export const getProdigiQuote = async ({ product, baseProduct = product, destinationCountryCode, shippingMethod = 'Standard' }) => {
    // Lazy imports keep catalogue rendering and its unit tests independent of
    // Firebase configuration until the customer actually asks for a live quote.
    const [{ httpsCallable }, { functions }] = await Promise.all([
        import('firebase/functions'),
        import('./firebase'),
    ]);
    const quoteCallable = httpsCallable(functions, 'getProdigiQuote');
    const response = await quoteCallable({
        destinationCountryCode,
        shippingMethod,
        items: [{
            sku: product.sku,
            copies: 1,
            attributes: prodigiAttributesForProduct(product),
        }],
        baseItem: {
            sku: baseProduct.sku,
            copies: 1,
            attributes: prodigiAttributesForProduct(baseProduct),
        },
    });
    return response.data;
};
