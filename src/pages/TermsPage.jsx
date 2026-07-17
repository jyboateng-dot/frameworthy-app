import React from 'react';
import LegalPageLayout, { LegalSection } from '../components/LegalPageLayout';

const TermsPage = ({ navigate }) => (
    <LegalPageLayout navigate={navigate} title="Terms of Service" effectiveDate="15 July 2026">
        <LegalSection title="1. Introduction">
            <p>
                These Terms of Service ("Terms") govern your use of the FrameWorthy website and the
                purchase of custom-framed products through it. By creating an account, placing an
                order, or otherwise using this site, you agree to these Terms.
            </p>
        </LegalSection>

        <LegalSection title="2. Who We Are">
            <p>
                FrameWorthy is operated by Frameworthy&amp;co, No. 17A, Cashew Street, Adjiringanor,
                Accra, Ghana (TIN: GHA-724653368-8).
            </p>
        </LegalSection>

        <LegalSection title="3. Accounts">
            <p>
                You may browse and order as a guest, or create an account for order history and
                faster checkout. You're responsible for keeping your login credentials confidential
                and for all activity under your account. Notify us immediately if you suspect
                unauthorized access.
            </p>
        </LegalSection>

        <LegalSection title="4. Orders, Pricing &amp; Payment">
            <p>
                All prices are listed in Ghanaian Cedis (GHS) and are subject to change without
                notice until an order is placed. Payments are processed securely through Paystack via
                card or mobile money — we never see or store your full card number or mobile money
                PIN. An order is only confirmed once payment has been verified.
            </p>
            <p>
                We reserve the right to refuse or cancel any order, including in cases of suspected
                fraud, pricing errors, or unavailability of materials, in which case any payment
                already made will be refunded in full.
            </p>
        </LegalSection>

        <LegalSection title="5. Custom &amp; Made-to-Order Products">
            <p>
                Every FrameWorthy product is custom-produced from the image, frame style, size, and
                other options you select at checkout. Because production begins shortly after an
                order is placed, please review your customization carefully before confirming — see
                our <a href="/refund-policy" className="font-bold underline hover:text-stone-900">Refund &amp; Return Policy</a> for
                details on cancellations, damage claims, and what is and isn't refundable.
            </p>
        </LegalSection>

        <LegalSection title="6. Your Uploaded Content">
            <p>
                You retain full ownership of any photo or image you upload. By uploading it, you grant
                us a limited license to reproduce, print, and store that image solely to produce and
                fulfill your order. You confirm that you own or have the necessary rights to any image
                you upload, and that it doesn't infringe on anyone else's copyright or other rights.
            </p>
        </LegalSection>

        <LegalSection title="7. Delivery">
            <p>
                The price you pay at checkout covers your order only. Delivery is not included and is
                billed separately — the delivery fee is paid directly to the courier when your order
                arrives.
            </p>
            <p>
                Delivery timeframes shown at checkout are estimates, not guarantees. Risk of loss
                passes to you once an order is handed to our delivery partner, though we'll work with
                you in good faith to resolve delivery issues — see our{' '}
                <a href="/refund-policy" className="font-bold underline hover:text-stone-900">Refund &amp; Return Policy</a>.
            </p>
        </LegalSection>

        <LegalSection title="8. Acceptable Use">
            <p>
                You agree not to use this site to upload unlawful, infringing, or offensive content,
                to attempt to disrupt or gain unauthorized access to our systems, or to use the
                service for any purpose other than ordering framed products for yourself or as a
                gift.
            </p>
        </LegalSection>

        <LegalSection title="9. Limitation of Liability">
            <p>
                To the fullest extent permitted by law, FrameWorthy's liability for any claim relating
                to an order is limited to the amount you paid for that order. We aren't liable for
                indirect or consequential losses arising from use of this site or our products.
            </p>
        </LegalSection>

        <LegalSection title="10. Governing Law">
            <p>
                These Terms are governed by the laws of Ghana. Any disputes will be subject to the
                exclusive jurisdiction of the courts of Ghana.
            </p>
        </LegalSection>

        <LegalSection title="11. Changes to These Terms">
            <p>
                We may update these Terms from time to time. Continued use of the site after changes
                are posted constitutes acceptance of the revised Terms.
            </p>
        </LegalSection>

        <LegalSection title="12. Contact Us">
            <p>
                Questions about these Terms? Reach us at{' '}
                <a href="mailto:admin@frameworthyco.com" className="font-bold underline hover:text-stone-900">admin@frameworthyco.com</a>{' '}
                or 0261 549 517 / 0501 648 227.
            </p>
        </LegalSection>
    </LegalPageLayout>
);

export default TermsPage;
