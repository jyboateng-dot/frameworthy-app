import React from 'react';
import LegalPageLayout, { LegalSection } from '../components/LegalPageLayout';

const PrivacyPage = ({ navigate }) => (
    <LegalPageLayout
        navigate={navigate}
        title="Privacy Policy"
        metaDescription="How FrameWorthy collects, uses, and protects your personal information and uploaded photos."
        effectiveDate="15 July 2026"
    >
        <LegalSection title="1. Introduction">
            <p>
                This Privacy Policy explains what information Frameworthy&amp;co ("FrameWorthy",
                "we", "us") collects when you use this site, and how we use, store, and protect it.
            </p>
        </LegalSection>

        <LegalSection title="2. Information We Collect">
            <p><strong>Account information</strong> — name, email address, and (if you sign in with Google) your Google profile name and email.</p>
            <p><strong>Order &amp; delivery information</strong> — full name, phone number, and delivery address for each order.</p>
            <p><strong>Content you upload</strong> — photos and images you upload to customize a frame.</p>
            <p><strong>Cloud imports</strong> — if you choose an image from Google Drive, Google Picker lets you select the specific file to share with FrameWorthy. We access only that selected image to customize and fulfill your order. We do not browse, edit, or delete other files in your Google Drive.</p>
            <p><strong>Order &amp; payment history</strong> — the products, customizations, and amounts of orders you place. We do not receive or store your full card number, CVV, or mobile money PIN — those are handled directly by Paystack.</p>
            <p><strong>Local device data</strong> — your cart and wishlist are stored in your browser's local storage so they persist between visits, even before you sign in.</p>
        </LegalSection>

        <LegalSection title="3. How We Use Your Information">
            <p>
                We use your information to process and fulfill orders, communicate order updates and
                confirmations, provide customer support, maintain your account, and improve our
                products and service. We do not sell your personal information to third parties.
            </p>
        </LegalSection>

        <LegalSection title="4. Third-Party Services We Use">
            <p>
                To operate FrameWorthy, we rely on a small number of trusted service providers, each
                of which processes a limited slice of your data on our behalf:
            </p>
            <p><strong>Firebase (Google)</strong> — account authentication and our order/customer database.</p>
            <p><strong>Paystack</strong> — secure payment processing for card and mobile money transactions.</p>
            <p><strong>ImageKit and Cloudinary</strong> — hosting for the photos you upload, the production files used to print your order, and our image catalogue.</p>
            <p><strong>EmailJS</strong> — sending order confirmations, password resets, and related transactional emails.</p>
            <p>
                Each of these providers has its own privacy practices governing the data they process
                on our behalf.
            </p>
        </LegalSection>

        <LegalSection title="5. Cookies &amp; Local Storage">
            <p>
                We use your browser's local storage (not third-party tracking cookies) to remember
                your cart, wishlist, and a few display preferences. You can clear this at any time
                through your browser settings, though doing so will empty your saved cart and
                wishlist.
            </p>
        </LegalSection>

        <LegalSection title="6. Data Retention">
            <p>
                We keep account and order information for as long as your account is active, and as
                needed to comply with tax, accounting, or other legal obligations after that. We
                delete uploaded originals, production files, and previews within 90 days after an
                order is delivered. Unordered uploads are deleted within 30 days. If a reprint,
                complaint, or support case is open, we retain the relevant files until it is resolved
                and delete them within 30 days afterward. Customer artwork is not retained for future
                reorders unless the customer separately asks us to store it.
            </p>
        </LegalSection>

        <LegalSection title="7. Data Sharing &amp; Disclosure">
            <p>
                We share your information only with the service providers listed above, as necessary
                to fulfill your order, or where required by law. We do not sell or rent your personal
                data to advertisers or other third parties.
            </p>
        </LegalSection>

        <LegalSection title="8. Your Rights">
            <p>
                You can ask us to access, correct, or delete the personal information we hold about
                you at any time by emailing{' '}
                <a href="mailto:admin@frameworthyco.com" className="font-bold underline hover:text-stone-900">admin@frameworthyco.com</a>.
            </p>
        </LegalSection>

        <LegalSection title="9. Children's Privacy">
            <p>
                FrameWorthy is not directed at children, and we don't knowingly collect personal
                information from anyone under 18.
            </p>
        </LegalSection>

        <LegalSection title="10. Security">
            <p>
                We use industry-standard practices — including secure authentication and encrypted
                connections — to protect your information, though no online service can guarantee
                perfect security.
            </p>
        </LegalSection>

        <LegalSection title="11. Changes to This Policy">
            <p>
                We may update this Privacy Policy from time to time. Continued use of the site after
                changes are posted constitutes acceptance of the revised policy.
            </p>
        </LegalSection>

        <LegalSection title="12. Contact Us">
            <p>
                Questions about this policy or your data? Reach us at{' '}
                <a href="mailto:admin@frameworthyco.com" className="font-bold underline hover:text-stone-900">admin@frameworthyco.com</a>{' '}
                or +44 7797 789598.
            </p>
            <p className="mt-2 text-xs text-stone-500">
                Frameworthy&amp;co, Liberty Wharf Apartments, Esplanade, St Helier, Jersey, JE2 3AS.
            </p>
        </LegalSection>
    </LegalPageLayout>
);

export default PrivacyPage;
