import { getPrintQualityJpegUrl } from '../services/storage';
import { formatDimensions } from '../data/constants';

// Shared human-readable labels — kept here so the cart/checkout description
// string and the admin fulfillment view (OrderDetailModal) never drift out
// of sync with each other.
// Shared human-readable labels — kept here so the cart/checkout description
// string and the admin fulfillment view (OrderDetailModal) never drift out
// of sync with each other.
export const GLASS_LABELS = {
    standard: 'Shatterproof Perspex',
    'non-glare': 'Non-Glare Acrylic',
    museum: 'Museum Glazing',
    'canvas-traditional': 'Traditional Canvas',
    'canvas-floater': 'Floater Canvas',
};

export const PRODIGI_GLAZE_LABELS = {
    'Acrylic / Perspex': 'Shatterproof Perspex',
    'Float glass': 'Float Glazing',
    Motheye: 'Moth-eye Anti-Reflective',
};

export const HARDWARE_LABELS = {
    wire: 'Wire Hanging',
    sawtooth: 'Sawtooth Hanger',
    'cobra-hook': 'Cobra Hook',
    'built-in-rear-hanger': 'Built-in Rear Hanger',
    'french-cleat': 'French Cleat',
    easel: 'Tabletop Easel',
};
export const MAT_WIDTH_LABELS = { none: 'No Mount', narrow: 'Narrow Mount', standard: 'Standard Mount', wide: 'Wide Mount' };

// matWidth used to be one of the three fixed presets above; orders placed
// since the mat-width slider replaced them (see CustomizeFramePage.jsx and
// matting.js) instead store the customer's own numeric width in inches.
// This formats either shape, so order history from before the change keeps
// reading correctly forever alongside new orders.
export const matWidthLabel = (matWidth) => {
    if (matWidth == null || matWidth === 'none') return 'No Mount';
    if (MAT_WIDTH_LABELS[matWidth]) return MAT_WIDTH_LABELS[matWidth];
    const inches = Number(matWidth);
    return Number.isFinite(inches) ? `${inches}" Mount` : `${matWidth} Mount`;
};

/**
 * Checks whether an item represents a canvas product (stretched canvas or float framed canvas).
 * Canvas items never have glazing or mat boards.
 */
export const isCanvasProduct = (item) => {
    if (!item) return false;
    return Boolean(
        item.isCanvas ||
        item.selectedFrame?.id === 'frame-canvas' ||
        item.selectedFrame?.prodigiProduct === 'stretched-canvas' ||
        item.selectedFrame?.prodigiProduct === 'canvas-float' ||
        item.selectedFrame?.prodigiProduct?.startsWith('canvas') ||
        item.prodigi?.productFamily?.includes('canvas') ||
        item.prodigi?.productFamily === 'stretched-canvas' ||
        item.prodigi?.productFamily === 'canvas-float' ||
        item.prodigi?.sku?.includes('-CAN-') ||
        item.prodigi?.sku?.includes('-FRA-CAN-') ||
        item.glassType === 'canvas-traditional' ||
        item.glassType === 'canvas-floater'
    );
};

/**
 * Clean primary title for the item in cart and checkout cards (e.g. "Custom Framed Print",
 * "Custom Floater Canvas", or specific poster title).
 */
export const getItemTitle = (item) => {
    if (!item) return 'Custom Artwork';
    if ((item.isAlbumPoster || item.isMoviePosterPrint) && item.posterMeta?.title) {
        return `${item.posterMeta.title} Poster`;
    }
    if (item.presetTitle) {
        return item.presetTitle;
    }
    if (isCanvasProduct(item)) {
        const isFloater = Boolean(
            item.selectedFrame?.prodigiProduct === 'canvas-float' ||
            item.prodigi?.productFamily?.includes('float') ||
            item.selectedFrame?.name?.toLowerCase().includes('float') ||
            item.glassType === 'canvas-floater'
        );
        return isFloater ? 'Custom Floater Canvas' : 'Custom Canvas Print';
    }
    return 'Custom Framed Print';
};

/**
 * Subtitle for the item in cart and checkout cards (e.g. "Classic · Black",
 * "Float Canvas · Antique Gold", or frame style name).
 */
export const getItemSubtitle = (item) => {
    if (!item) return '';
    if (item.selectedFrame?.name) {
        return item.selectedFrame.name;
    }
    if (isCanvasProduct(item)) {
        return 'Stretched Canvas (38mm)';
    }
    return '';
};

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

    const isCanvas = isCanvasProduct(item);

    // Canvas wrap for canvas items
    if (isCanvas && item.prodigi?.attributes?.wrap) {
        const wrapLabels = {
            ImageWrap: 'Image Wrap',
            Black: 'Black Edge Wrap',
            White: 'White Edge Wrap',
            MirrorWrap: 'Mirror Wrap',
        };
        specs.push(wrapLabels[item.prodigi.attributes.wrap] || `${item.prodigi.attributes.wrap} Wrap`);
    }

    // Matting (combine width and color into one string e.g. "Narrow Polar White Mat" or "2\" Snow white Mount")
    const isProdigiMounted = Boolean(item.prodigi?.attributes?.mount && !/^no mount/i.test(item.prodigi.attributes.mount));
    if (isProdigiMounted && !isCanvas) {
        const mountColor = item.prodigi.attributes.mountColor || item.matColor?.name || 'Snow white';
        const width = item.prodigi.mountWidthIn || (item.matWidth !== 'none' ? item.matWidth : null);
        const widthStr = width ? `${width}"` : '';
        specs.push(`${widthStr ? `${widthStr} ` : ''}${mountColor} Mount`.trim());
    } else if (item.matWidth && item.matWidth !== 'none' && !isCanvas) {
        let widthStr = matWidthLabel(item.matWidth);
        // Strip " Mount" suffix if present so we can inject the colour before it.
        if (widthStr.endsWith(' Mount')) {
            widthStr = widthStr.substring(0, widthStr.length - 6);
        }
        
        if (item.matColor?.name) {
            specs.push(`${widthStr} ${item.matColor.name} Mount`);
        } else {
            specs.push(`${widthStr} Mount`);
        }
    }

    // Glazing (only for framed prints with glaze; NEVER for canvas)
    if (!isCanvas) {
        if (item.prodigi?.attributes?.glaze) {
            const glaze = item.prodigi.attributes.glaze;
            const label = PRODIGI_GLAZE_LABELS[glaze] || (glaze === 'standard' ? 'Shatterproof Perspex' : glaze);
            specs.push(/glazing$/i.test(label) ? label : `${label} Glazing`);
        } else if (item.glassType && !item.glassType.startsWith('canvas')) {
            const label = item.glassType === 'standard' ? 'Shatterproof Perspex' : (GLASS_LABELS[item.glassType] || item.glassType);
            specs.push(/glazing$/i.test(label) ? label : `${label} Glazing`);
        }
    }

    // Hardware
    if (item.hardwareType && item.hardwareType !== 'none') {
        specs.push(`${HARDWARE_LABELS[item.hardwareType] || item.hardwareType} Hardware`);
    }

    if (specs.length > 0) {
        return `${baseName} - ${specs.join(', ')}`;
    }
    return baseName;
};

/**
 * Returns structured specification pills matching the user's customizer
 * selections and what is sent to Prodigi for production.
 * By default, excludes the frame name since that is displayed as the card subtitle.
 */
export const getItemCustomizerSpecs = (item, options = {}) => {
    if (!item) return [];
    const specs = [];
    const { includeFrame = false } = options;

    const isProdigi = Boolean(item.prodigi || item.currency === 'GBP' || item.selectedFrame?.prodigiProduct);
    const isCanvas = isCanvasProduct(item);

    // 1. Frame Style & Finish (only if explicitly requested)
    if (includeFrame && item.selectedFrame?.name) {
        specs.push({ label: 'Frame', value: item.selectedFrame.name });
    }

    // 2. Mount / Mat (only for framed prints, never canvas)
    if (!isCanvas) {
        const isProdigiMounted = Boolean(item.prodigi?.attributes?.mount && !/^no mount/i.test(item.prodigi.attributes.mount));
        if (isProdigiMounted) {
            const mountColor = item.prodigi.attributes.mountColor || 'Snow white';
            const width = item.prodigi.mountWidthIn ? `${item.prodigi.mountWidthIn}"` : '';
            specs.push({ label: 'Mount', value: `${width ? `${width} ` : ''}${mountColor}`.trim() });
        } else if (item.matWidth && item.matWidth !== 'none') {
            const width = matWidthLabel(item.matWidth);
            const color = item.matColor?.name ? ` (${item.matColor.name})` : '';
            specs.push({ label: 'Mount', value: `${width}${color}` });
        } else if (isProdigi) {
            specs.push({ label: 'Mount', value: 'No mount' });
        }
    }

    // 3. Glazing (NEVER for canvas items)
    if (!isCanvas) {
        if (item.prodigi?.attributes?.glaze) {
            const glaze = item.prodigi.attributes.glaze;
            const label = PRODIGI_GLAZE_LABELS[glaze] || (glaze === 'standard' ? 'Shatterproof Perspex' : glaze);
            specs.push({ label: 'Glazing', value: label });
        } else if (item.glassType && !item.glassType.startsWith('canvas')) {
            const label = item.glassType === 'standard' ? 'Shatterproof Perspex' : (GLASS_LABELS[item.glassType] || item.glassType);
            specs.push({ label: 'Glazing', value: label });
        }
    }

    // 4. Canvas Edge Finish (for canvas items)
    if (isCanvas) {
        const wrap = item.prodigi?.attributes?.wrap || item.canvasWrap;
        if (wrap) {
            const wrapLabels = {
                ImageWrap: 'Image Wrap',
                Black: 'Black Edge',
                White: 'White Edge',
                MirrorWrap: 'Mirror Wrap',
            };
            specs.push({ label: 'Edge Finish', value: wrapLabels[wrap] || wrap });
        }
    }

    // 5. Paper / Material substrate
    if (item.prodigi?.attributes?.paperType) {
        const paper = item.prodigi.attributes.paperType;
        const weight = item.prodigi.attributes.substrateWeight ? ` (${item.prodigi.attributes.substrateWeight})` : '';
        const paperLabel = paper === 'EMA'
            ? 'Enhanced Matte Art Paper'
            : paper === 'Standard canvas (SC)'
            ? 'Standard Cotton Canvas'
            : paper === 'Recycled canvas'
            ? 'Recycled Canvas'
            : paper;
        const labelName = isCanvas ? 'Material' : 'Paper';
        specs.push({ label: labelName, value: `${paperLabel}${weight}` });
    }

    // 6. Hanging Hardware
    if (item.prodigi?.hangingHardware?.label) {
        specs.push({
            label: 'Hardware',
            value: item.prodigi.hangingHardware.included
                ? `${item.prodigi.hangingHardware.label} (included)`
                : item.prodigi.hangingHardware.label
        });
    } else if (item.hardwareType && item.hardwareType !== 'none') {
        specs.push({ label: 'Hardware', value: HARDWARE_LABELS[item.hardwareType] || item.hardwareType });
    }

    return specs;
};

// Combines the dimension label with orientation on one line, matching the
// app's existing "{dimension}, {other attribute}" inline formatting.
export const formatDimensionWithOrientation = (dimensionText, orientation, unit) => {
    const orientationLabel = orientation ? orientation.charAt(0).toUpperCase() + orientation.slice(1) : '';
    const displayDimension = unit && dimensionText ? formatDimensions(dimensionText, unit, orientation) : dimensionText;
    if (displayDimension && orientationLabel) return `${displayDimension}, ${orientationLabel}`;
    return displayDimension || orientationLabel || '';
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
                ? `${item.matColor.name} (${matWidthLabel(item.matWidth)})`
                : 'No Mount';
                
            orderText += `Qty: ${item.quantity}                 Mount: ${matDesc}\n\n`;
            if (item.productionSpec?.version === 1 || item.productionSpec?.version === 2) {
                const spec = item.productionSpec;
                const unit = spec.units === 'cm' ? 'cm' : 'in';
                const precision = unit === 'cm' ? 2 : 3;
                orderText += `Print aperture: ${spec.apertureWidth.toFixed(precision)} x ${spec.apertureHeight.toFixed(precision)} ${unit}\n`;
                orderText += `Mount edges (top/bottom/left/right): ${['top', 'bottom', 'left', 'right'].map(edge => spec[edge].toFixed(precision)).join(' / ')} ${unit}\n`;
                orderText += `Finished frame: ${spec.outerWidth.toFixed(precision)} x ${spec.outerHeight.toFixed(precision)} ${unit}\n`;
            }
            
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
    const currencyLabel = order.currency === 'GBP' ? '£' : (order.currency || 'GHS');

    let text = `Hi ${name}, this is FrameWorthy with an update on your order #${order.id.slice(0, 8).toUpperCase()} placed on ${orderDate}.\n\n`;
    text += `Status: ${statusLabel}\n\n`;
    text += `Items:\n`;

    (order.items || []).forEach((item) => {
        const sizeLabel = item.selectedSize?.label || item.size || 'Custom Size';
        const itemPrice = item.price ?? item.totalPrice ?? 0;
        text += `- ${item.quantity || 1}x ${generateItemDescription(item)} (${sizeLabel}) — ${currencyLabel} ${itemPrice.toFixed(2)}\n`;
    });

    text += `\nTotal: ${currencyLabel} ${(order.totalPrice ?? 0).toFixed(2)}\n\n`;
    text += `Thank you for choosing FrameWorthy!`;

    return text;
};
