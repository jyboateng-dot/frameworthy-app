import React from 'react';
import LegalPageLayout, { LegalSection } from '../components/LegalPageLayout';

const RefundPolicyPage = ({ navigate }) => (
    <LegalPageLayout
        navigate={navigate}
        title="Refund &amp; Return Policy"
        metaDescription="FrameWorthy's policy on refunds, returns, and reprints for custom-framed orders."
        effectiveDate="15 July 2026"
    >
        <LegalSection title="1. Overview">
            <p>
                Every FrameWorthy order is custom-produced to your exact specifications — your
                uploaded image, chosen frame, mat, size, and orientation. Because of this, most orders
                can't be resold to another customer once production starts, which shapes the policy
                below.
            </p>
        </LegalSection>

        <LegalSection title="2. Order Cancellations">
            <p>
                You can cancel an order for a full refund any time before its status changes to
                "Processing" in your order history. Once production has started, the order can no
                longer be cancelled or modified. To cancel, contact us as soon as possible with your
                order ID.
            </p>
        </LegalSection>

        <LegalSection title="3. Damaged or Defective Items">
            <p>
                If your order arrives damaged, defective, or noticeably different from what you
                ordered, contact us within 72 hours of delivery with your order ID and photos of the
                issue. We'll arrange a free replacement or a full refund, whichever you prefer.
            </p>
        </LegalSection>

        <LegalSection title="4. Non-Refundable Items">
            <p>
                Because each piece is made to order, we can't accept returns or offer refunds for
                items that were produced correctly to the specifications you selected at checkout —
                including cases of buyer's remorse, a change of mind about frame style or size, or
                dissatisfaction with a low-resolution source photo you uploaded.
            </p>
        </LegalSection>

        <LegalSection title="5. Delivery Issues">
            <p>
                If your order is significantly delayed or marked delivered but never arrives, let us
                know and we'll investigate with our delivery partner and make it right — with a
                reshipment or refund as appropriate.
            </p>
        </LegalSection>

        <LegalSection title="6. How to Request a Refund or Replacement">
            <p>
                Email{' '}
                <a href="mailto:admin@frameworthyco.com" className="font-bold underline hover:text-stone-900">admin@frameworthyco.com</a>{' '}
                or call 0261 549 517 / 0501 648 227 with your order ID, a description of the issue,
                and photos if applicable.
            </p>
        </LegalSection>

        <LegalSection title="7. Refund Processing Time">
            <p>
                Approved refunds are issued back to your original payment method via Paystack.
                Depending on your bank or mobile money provider, it can take a few business days for
                the refund to reflect after we process it.
            </p>
        </LegalSection>

        <LegalSection title="8. Contact Us">
            <p>
                Questions about this policy? Reach us at{' '}
                <a href="mailto:admin@frameworthyco.com" className="font-bold underline hover:text-stone-900">admin@frameworthyco.com</a>{' '}
                or 0261 549 517 / 0501 648 227.
            </p>
        </LegalSection>
    </LegalPageLayout>
);

export default RefundPolicyPage;
