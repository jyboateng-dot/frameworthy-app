import pricingPolicy from '../../functions/pricing-policy.json';

export const FRAME_GROSS_MARGIN_PERCENT = pricingPolicy.frameGrossMarginPercent;

export const frameRetailPrice = (supplierFrameCost, grossMarginPercent = FRAME_GROSS_MARGIN_PERCENT) => {
    const cost = Number(supplierFrameCost);
    const margin = Number(grossMarginPercent);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(margin) || margin < 0 || margin >= 100) return null;
    return Math.round((cost / (1 - margin / 100)) * 100) / 100;
};

export const configuredItemRetailPrice = ({ baseFrameCost, configuredItemCost, grossMarginPercent = FRAME_GROSS_MARGIN_PERCENT }) => {
    const baseRetail = frameRetailPrice(baseFrameCost, grossMarginPercent);
    const configured = Number(configuredItemCost);
    const base = Number(baseFrameCost);
    if (baseRetail === null || !Number.isFinite(configured) || configured < 0) return null;
    const customizationCost = Math.max(0, configured - base);
    return Math.round((baseRetail + customizationCost) * 100) / 100;
};
