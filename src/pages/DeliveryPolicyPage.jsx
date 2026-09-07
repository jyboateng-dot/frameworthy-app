import React from 'react';
import LegalPageLayout, { LegalSection } from '../components/LegalPageLayout';

const DeliveryPolicyPage = ({ navigate }) => (
    <LegalPageLayout
        navigate={navigate}
        title="Delivery Policy"
        metaDescription="Production timelines and delivery details for FrameWorthy orders across Ghana."
        effectiveDate="15 July 2026"
    >
        <LegalSection title="1. Overview">
            <p>
                At FrameWorthy, we take care to ensure your custom-framed items reach you safely and promptly. Because every order is made to your exact specifications, delivery timelines consist of both production time and shipping time.
            </p>
        </LegalSection>

        <LegalSection title="2. Production Timelines">
            <p>
                Since each frame is custom-made, please allow 3-5 business days for production after your order is confirmed and payment is processed. Production begins immediately once your order is placed.
            </p>
        </LegalSection>

        <LegalSection title="3. Delivery Locations and Costs">
            <p>
                We currently deliver across Ghana. Delivery fees are separate from the product cost paid at checkout.
            </p>
            <p>
                The estimated delivery cost will be communicated to you before dispatch. This fee is paid directly to our courier partner upon delivery of your item. Delivery costs vary depending on your location and the size/weight of your order.
            </p>
        </LegalSection>

        <LegalSection title="4. Shipping Timelines">
            <p>
                Once production is complete, your order will be dispatched. Delivery times typically range from 1-3 business days depending on your location within Ghana. Please note that these are estimates and not guarantees. 
            </p>
        </LegalSection>

        <LegalSection title="5. Order Status Updates">
            <p>
                You will receive a notification (via email or SMS) when your order has finished production and is handed over to our delivery partner. The courier will contact you directly to arrange the final drop-off.
            </p>
        </LegalSection>

        <LegalSection title="6. Damaged or Lost Orders">
            <p>
                While risk of loss passes to you once the item is handed to the courier, we are committed to your satisfaction. If your order is significantly delayed, lost, or arrives damaged, please contact us within 72 hours of the expected delivery date or actual delivery. Refer to our <a href="/refund-policy" className="font-bold underline hover:text-stone-900">Refund & Return Policy</a> for instructions on requesting a replacement or refund.
            </p>
        </LegalSection>

        <LegalSection title="7. Contact Us">
            <p>
                For any questions regarding your delivery, please reach us at{' '}
                <a href="mailto:admin@frameworthyco.com" className="font-bold underline hover:text-stone-900">admin@frameworthyco.com</a>{' '}
                or call us at 0261 549 517 / 0501 648 227.
            </p>
        </LegalSection>
    </LegalPageLayout>
);

export default DeliveryPolicyPage;
