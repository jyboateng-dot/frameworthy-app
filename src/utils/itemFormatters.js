import { getPrintQualityJpegUrl } from '../services/storage';

// Shared human-readable labels — kept here so the cart/checkout description
// string and the admin fulfillment view (OrderDetailModal) never drift out
// of sync with each other.
export const GLASS_LABELS = { standard: 'Standard Acrylic', 'non-glare': 'Non-Glare Acrylic', museum: 'Museum Glass' };
export const HARDWARE_LABELS = { wire: 'Wire Hanging', sawtooth: 'Sawtooth Hanger', 'french-cleat': 'French Cleat', easel: 'Tabletop Easel' };
export const MAT_WIDTH_LABELS = { none: 'No Mat', narrow: 'Narrow Mat', standard: 'Standard Mat', wide: 'Wide Mat' };

// Standard nomenclature for describing an order item, used everywhere one is
// shown (cart, wishlist-derived cart items, checkout, order confirmation
// email): image name, Frame style, Matting, Mat color, Glazing, Hardware.
// Orientation is intentionally excluded — it's shown alongside the
// dimension line instead, not in this description string.
export const generateItemDescription = (item) => {
    let baseName = "Custom Photo";

    if ((item.isAlbumPoster || item.isMoviePosterPrint) && item.posterMeta) {
        baseName = `${item.posterMeta.title} Poster`;
    } else if (item.presetTitle) {
        baseName = item.presetTitle;
    }

    const specs = [];

    // Frame style
    if (item.selectedFrame?.name) {
        specs.push(`${item.selectedFrame.name} Frame`);
    }

    // Matting (combine width and color into one string e.g. "Narrow Polar White Mat")
    if (item.matWidth && item.matWidth !== 'none') {
        let widthStr = MAT_WIDTH_LABELS[item.matWidth] || `${item.matWidth} Mat`;
        // Strip " Mat" suffix if present so we can inject the color before it
        if (widthStr.endsWith(' Mat')) {
            widthStr = widthStr.substring(0, widthStr.length - 4);
        }
        
        if (item.matColor?.name) {
            specs.push(`${widthStr} ${item.matColor.name} Mat`);
        } else {
            specs.push(`${widthStr} Mat`);
        }
    }

    // Glazing
    if (item.glassType) {
        specs.push(`${GLASS_LABELS[item.glassType] || item.glassType} Glazing`);
    }

    // Hardware
    if (item.hardwareType) {
        specs.push(`${HARDWARE_LABELS[item.hardwareType] || item.hardwareType} Hardware`);
    }

    if (specs.length > 0) {
        return `${baseName} - ${specs.join(', ')}`;
    }
    return baseName;
};

// Combines the dimension label with orientation on one line, matching the
// app's existing "{dimension}, {other attribute}" inline formatting.
export const formatDimensionWithOrientation = (dimensionText, orientation) => {
    const orientationLabel = orientation ? orientation.charAt(0).toUpperCase() + orientation.slice(1) : '';
    if (dimensionText && orientationLabel) return `${dimensionText}, ${orientationLabel}`;
    return dimensionText || orientationLabel || '';
};

// Generates a clean text block summarizing multiple orders for sharing via
// WhatsApp, Email, or clipboard.
export const formatOrdersForSharing = (orders) => {
    if (!orders || orders.length === 0) return '';
    
    return orders.map(order => {
        const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString() : 'Unknown Date';
        const customerEmail = order.userEmail || 'guest@frameworthy.com';
        
        let orderText = `*Order ${order.id.slice(0, 8).toUpperCase()}*\n`;
        orderText += `${orderDate}\n\n`;
        
        orderText += `*CUSTOMER*\n`;
        orderText += `${customerEmail}\n\n`;

        if (order.shippingAddress) {
            orderText += `*DELIVER TO*\n`;
            if (order.shippingAddress.address) orderText += `${order.shippingAddress.address}\n`;
            if (order.shippingAddress.apartment) orderText += `${order.shippingAddress.apartment}\n`;
            if (order.shippingAddress.city) orderText += `${order.shippingAddress.city}, ${order.shippingAddress.zip}\n`;
            if (order.shippingAddress.phone) orderText += `${order.shippingAddress.phone}\n`;
            orderText += `\n`;
        }

        const itemsCount = (order.items || []).reduce((acc, item) => acc + (item.quantity || 1), 0);
        orderText += `*ITEMS TO PRODUCE (${itemsCount})*\n`;
        
        (order.items || []).forEach((item) => {
            const sizeLabel = item.selectedSize?.label || item.size || 'Unknown Size';
            const itemDesc = generateItemDescription(item);
            
            orderText += `\n${itemDesc}\n`;
            
            if (item.selectedFrame?.name) {
                orderText += `Frame Style: ${item.selectedFrame.name}\n`;
            }
            
            orderText += `Size: ${sizeLabel}       Orientation: ${item.orientation || 'Portrait'}\n`;
            
            if (item.glassType) {
                orderText += `Glazing: ${GLASS_LABELS[item.glassType] || item.glassType}     Hardware: ${HARDWARE_LABELS[item.hardwareType] || item.hardwareType}\n`;
            }
            
            const matDesc = item.matWidth !== 'none' && item.matColor 
                ? `${item.matColor.name} (${MAT_WIDTH_LABELS[item.matWidth]})` 
                : 'No Mat';
                
            orderText += `Qty: ${item.quantity}                 Mat: ${matDesc}\n\n`;
            
            const printUrl = getPrintQualityJpegUrl(item.image, item);
            if (printUrl) {
                orderText += `Print-Ready JPEG: ${printUrl}\n`;
            }
        });
        
        return orderText;
    }).join('\n========================================\n\n');
};

// Generates a friendly, customer-facing text summary of a single order (no
// internal production jargon, mat/glazing/hardware specs, or print-file
// links) for admin to message a client directly via WhatsApp or email.
export const formatOrderForClient = (order) => {
    if (!order) return '';

    const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    }) : 'recently';
    const name = order.customerName || 'there';
    const statusLabel = order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Processing';

    let text = `Hi ${name}, this is FrameWorthy with an update on your order #${order.id.slice(0, 8).toUpperCase()} placed on ${orderDate}.\n\n`;
    text += `Status: ${statusLabel}\n\n`;
    text += `Items:\n`;

    (order.items || []).forEach((item) => {
        const sizeLabel = item.selectedSize?.label || item.size || 'Custom Size';
        const itemPrice = item.price ?? item.totalPrice ?? 0;
        text += `- ${item.quantity || 1}x ${generateItemDescription(item)} (${sizeLabel}) — GHS ${itemPrice.toFixed(2)}\n`;
    });

    text += `\nTotal: GHS ${(order.totalPrice ?? 0).toFixed(2)}\n\n`;
    text += `Thank you for choosing FrameWorthy!`;

    return text;
};
