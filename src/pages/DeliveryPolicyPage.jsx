import React from 'react';
import LegalPageLayout, { LegalSection } from '../components/LegalPageLayout';

const DeliveryPolicyPage = ({ navigate }) => (
    <LegalPageLayout
        navigate={navigate}
        title="Delivery Policy"
        metaDescription="Production timelines and delivery details for FrameWorthy orders in the United Kingdom and Jersey."
        effectiveDate="15 July 2026"
    >
        <LegalSection title="1. Overview">
            <p>
                At FrameWorthy, we take care to ensure your custom-framed items reach you safely and promptly. Because every order is made to your exact specifications, delivery timelines consist of both production time and shipping time.
            </p>
        </LegalSection>

        <LegalSection title="2. Production Timelines">
            <p>
                Each product is made to order. The current production and delivery estimate is shown with the live quote for the selected product and destination.
            </p>
        </LegalSection>

        <LegalSection title="3. Delivery Locations and Costs">
            <p>
                The current collection is available for delivery in the United Kingdom and Jersey. Standard delivery and applicable tax are included in the live GBP quote.
            </p>
            <p>
                Any optional shipping upgrade will be shown before payment. No separate standard-delivery payment is due to the courier.
            </p>
        </LegalSection>

        <LegalSection title="4. Shipping Timelines">
            <p>
                Once production is complete, the order is dispatched using the shipping method shown in the quote. Delivery dates are estimates and are not guaranteed.
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
                or call us at +44 7797 789598.
            </p>
            <p className="mt-2 text-xs text-stone-500">
                Frameworthy&amp;co, Esplanade, St Helier, Jersey, JE2 3AS.
            </p>
        </LegalSection>
    </LegalPageLayout>
);

export default DeliveryPolicyPage;
