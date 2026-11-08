const normalizeStage = (stage) => String(stage || '').trim().toLowerCase().replace(/[_\s-]+/g, '');

export const getProdigiShipments = (order) => (
    Array.isArray(order?.prodigi?.shipments)
        ? order.prodigi.shipments.filter(Boolean)
        : []
);

export const getProdigiTrackingLinks = (order) => getProdigiShipments(order)
    .map((shipment) => ({
        ...shipment,
        trackingUrl: shipment.trackingUrl || shipment.tracking?.url || null,
        trackingNumber: shipment.trackingNumber || shipment.tracking?.number || null,
    }))
    .filter((shipment) => shipment.trackingUrl || shipment.trackingNumber);

// Prodigi v4 reports InProgress/Complete while the newer API reports
// in_production/shipped/completed. Map both into the customer journey without
// changing the existing admin-controlled order status field.
export const getCustomerFulfilmentStatus = (order) => {
    const stage = normalizeStage(order?.prodigi?.stage || order?.prodigi?.status);
    const shipments = getProdigiShipments(order);
    if (stage === 'cancelled' || stage === 'failed') return 'cancelled';
    if (stage === 'complete' || stage === 'completed') return 'delivered';
    if (stage === 'shipped' || stage === 'partiallyshipped' || shipments.some((shipment) => normalizeStage(shipment.status) === 'shipped')) return 'shipped';
    if (stage === 'inprogress' || stage === 'inproduction' || stage === 'submitted' || stage === 'pendingsubmission') return 'processing';
    return order?.status || 'pending';
};
