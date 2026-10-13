/**
 * Starting content for the mandatory legal and informational pages (Markdown).
 * Every page is editable from Admin → Legal pages. The text is a professional starting point
 * and must be reviewed by a qualified lawyer for the jurisdictions OpenPage operates in.
 */
export const LEGAL_PAGES = [
    {
        slug: 'terms',
        title: 'Terms and Conditions',
        type: 'legal',
        seo: { title: 'Terms and Conditions', description: 'The terms that apply when you browse OpenPage and buy digital products from us.' },
        body: `_Last updated: October 2026_

These Terms and Conditions ("Terms") govern your use of the OpenPage website and your purchase of digital products from us. By using the website or placing an order, you agree to these Terms.

## 1. About us
OpenPage ("we", "us", "our") operates this website and sells digital products, primarily eBooks. You can contact us through our [Support page](/support) or at the email address shown in the website footer.

## 2. Eligibility
You must be at least 18 years old, or have the consent of a parent or guardian, and be able to enter into a binding contract to buy from us.

## 3. Digital products
Our products are digital files (for example PDF eBooks). Product pages describe each product, including its format, language and, where applicable, page count. Screenshots and previews are for illustration. We may update a product's content over time; your purchase gives you access to the version described in your order.

## 4. Prices and payment
Prices are shown in Indian Rupees (INR) unless stated otherwise, and include applicable taxes where indicated at checkout. Discounts are shown only when genuinely available and are calculated by our system at checkout. Payments are processed securely by Razorpay. We do not receive or store your full card or bank details.

## 5. Email verification and order confirmation
To protect your purchase, we ask you to verify your email address with a one-time code before payment. An order is confirmed only when our system has verified your payment with the payment provider. We will then email your order confirmation and download instructions to your verified email address.

## 6. Digital delivery
Download links are sent by email and, if you have an account, are also available in your library. Links are time-limited and usage-limited for security; you can request a fresh link at any time from our download page or your library. You are responsible for providing a correct, accessible email address.

## 7. Licence and permitted use
When you buy a product, we grant you a personal, non-exclusive, non-transferable licence to download, store and read it for your own personal or internal business use. Unless the product page states otherwise, you may not:

- share, resell, sublicense, publish or distribute the file or its contents;
- upload it to file-sharing services or public websites;
- remove copyright notices or watermarks; or
- use the content to create competing products.

See our [Licensing](/licensing) page for details.

## 8. Intellectual property
All content on this website and in our products is owned by OpenPage or its licensors and is protected by copyright and other intellectual property laws. Except for the licence above, no rights are transferred to you.

## 9. Prohibited conduct
You agree not to misuse the website, including by attempting to gain unauthorised access, interfering with its operation, using automated means to scrape content, or using it for unlawful purposes.

## 10. Accounts
Creating an account is optional. If you create one, you are responsible for keeping your password confidential and for activity under your account. We may suspend accounts that breach these Terms.

## 11. Product availability
We may change, withdraw or stop selling any product. Withdrawing a product does not remove access for customers who have already bought it.

## 12. Refunds
Refund requests are reviewed individually under our [Refund and Cancellation Policy](/refund-policy).

## 13. Limitation of liability
To the extent permitted by law, our total liability for any claim relating to a product is limited to the amount you paid for it. We are not liable for indirect or consequential losses. Nothing in these Terms limits liability that cannot be limited under applicable law, or your statutory rights as a consumer.

## 14. Disputes and governing law
If you have a concern, please contact us first so we can try to resolve it. These Terms are governed by the laws of India, and the courts of competent jurisdiction in India will have jurisdiction, subject to any mandatory consumer protection rules that apply to you.

## 15. Changes to these Terms
We may update these Terms from time to time. The version in force when you place an order applies to that order. The "last updated" date above shows when they were last changed.`,
    },
    {
        slug: 'privacy',
        title: 'Privacy Policy',
        type: 'legal',
        seo: { title: 'Privacy Policy', description: 'How OpenPage collects, uses and protects your personal information.' },
        body: `_Last updated: October 2026_

This Privacy Policy explains how OpenPage collects and uses personal information when you use our website and buy our products.

## Information we collect
- **Contact details:** your email address (and name, if you provide it).
- **Order information:** products purchased, prices, discounts, order and payment references.
- **Account information:** if you create an account, your name, email and a securely hashed password.
- **Support requests:** the messages and details you send us.
- **Technical data:** IP address, browser type, and pages visited, used for security, fraud prevention and, with your consent, analytics.

## How we use it
- To verify your email address at checkout using a one-time code.
- To process your order and deliver your eBooks by email.
- To provide your account and library.
- To respond to support and refund requests.
- To prevent fraud and abuse, and keep the service secure.
- To send marketing emails or browser notifications **only if you have opted in**.

## Email verification
We send a six-digit code to confirm you control the email address used for your order. Codes are stored only in a protected (hashed) form and expire after a few minutes.

## Payments
Payments are processed by **Razorpay**. Razorpay collects and processes your payment details under its own privacy policy. We receive payment status and references, not your full card or bank details.

## Email delivery
We use an email service provider to send transactional emails (verification codes, receipts, download links) and, if you opt in, marketing emails. Transactional emails are sent regardless of marketing preferences because they are needed to deliver your purchase.

## Marketing consent
We do not add you to our mailing list just because you buy something. You can subscribe through our newsletter form or account settings, and unsubscribe at any time using the link in every marketing email.

## Cookies, analytics and advertising
We use essential cookies to run the store (for example, to keep you signed in and secure checkout). With your consent, we also use analytics and advertising technologies, including the **Meta Pixel** and **Google Ads** tags, to measure the performance of our advertising. If enabled, **Google AdSense** may show advertisements. Non-essential technologies load only after you consent, and you can change your choice at any time on our [Cookie preferences](/cookie-preferences) page.

## Browser notifications
If you allow browser notifications, we use **Firebase Cloud Messaging** (Google) to deliver them. We store a notification token for your browser. You can turn notifications off in your browser or account settings at any time.

## Data retention
We keep order and payment records for as long as required for accounting and legal obligations. Verification codes and security tokens are deleted automatically after they expire. Marketing data is kept until you unsubscribe, after which we keep only what is needed to respect your choice.

## Security
We use encrypted connections, hashed passwords and codes, time-limited download links, access controls and audit logs to protect your information. No system is completely secure, but we work to protect your data.

## Third-party processors
We share data only with providers that help us run the service, such as our payment processor (Razorpay), hosting and database providers, email delivery provider, file storage provider and, with your consent, analytics and advertising providers.

## Your rights
Depending on where you live, you may have the right to access, correct, delete or obtain a copy of your personal information, and to withdraw consent. To make a request, contact us through the [Support page](/support).

## Contact
For privacy questions or requests, contact us via the [Support page](/support) or the email address in the website footer.`,
    },
    {
        slug: 'refund-policy',
        title: 'Refund and Cancellation Policy',
        type: 'legal',
        seo: { title: 'Refund and Cancellation Policy', description: 'How refunds work for OpenPage digital products.' },
        body: `_Last updated: October 2026_

Because our products are digital and delivered instantly, they cannot be "returned" like physical goods. We still want you to be satisfied, and we review every refund request individually and fairly.

## When we will normally approve a refund
- **Duplicate charge:** you were charged more than once for the same order.
- **Inaccessible or defective file:** the file is corrupted or will not open, and our support team cannot provide a working copy within a reasonable time.
- **Not delivered:** your payment was confirmed but you did not receive access, and we cannot resolve it.
- **Materially not as described:** the product is substantially different from its description.

## When a refund may not be approved
- You changed your mind after downloading the product.
- The issue is caused by your device or software and the file works correctly on supported readers.
- There are signs of abuse, such as repeated purchase-and-refund requests or redistribution of the file.

These examples do not limit any rights you have under applicable consumer protection law.

## Payment failures
If a payment fails or is cancelled, no order is created for that attempt and you will not receive the product. If money was debited for a failed payment, it is normally reversed automatically by your bank or the payment provider. Contact us if it is not.

## How to request a refund
1. Open your order in your account and choose **Request a refund**, or contact us through the [Support page](/support) with your order number.
2. Tell us what went wrong. For file problems, include your device and reader app.
3. Our team reviews the request and replies by email, usually within 3 business days.

## How refunds are paid
Approved refunds are made to your original payment method through Razorpay. They typically reach your account within 5 to 7 business days after we process them, depending on your bank. If a refund is approved, access to the refunded product may be removed.

## Cancellations
As delivery is immediate, an order cannot be cancelled after payment is confirmed. If you made a mistake, contact us promptly.`,
    },
    {
        slug: 'licensing',
        title: 'Digital Product Licensing',
        type: 'legal',
        seo: { title: 'Digital Product Licensing', description: 'What you can and cannot do with OpenPage eBooks and digital products.' },
        body: `Every OpenPage product comes with a **personal licence** unless the product page says otherwise.

## You may
- Download the files and keep backup copies for yourself.
- Read the product on any of your own devices.
- Print copies for your own personal use.
- Apply the ideas, frameworks and checklists in your own work or business.
- Quote short passages with attribution, for example in a review.

## You may not
- Share the files, or your download links, with other people.
- Resell, sublicense, rent or give away the files.
- Upload the files to websites, file-sharing services, course platforms or shared drives accessible to others.
- Republish substantial parts of the content as your own.

## Team and business use
If you would like to share a product within a team or organisation, please [contact us](/support) about a team licence.

Questions? Visit our [Support page](/support).`,
    },
    {
        slug: 'about',
        title: 'About OpenPage',
        type: 'content',
        seo: { title: 'About OpenPage', description: 'OpenPage publishes practical eBooks on AI automation, business operations, marketing and productivity.' },
        body: `OpenPage publishes practical eBooks for people who want to work smarter: founders, operators, marketers and professionals.

Our guides focus on **AI automation, business operations, marketing and productivity**. Each one is written to be read in an evening and applied the next morning, with clear frameworks, worked examples and checklists.

## How we work
- **Practical first.** Every chapter ends with something you can do.
- **Honest marketing.** Prices, discounts and reviews on this site are real.
- **Your purchase, your library.** Buy once, and re-download whenever you need to.

Have a question or an idea for a guide? [Get in touch](/support).`,
    },
    {
        slug: 'accessibility',
        title: 'Accessibility',
        type: 'content',
        seo: { title: 'Accessibility', description: 'Our commitment to making OpenPage accessible.' },
        body: `We want everyone to be able to use OpenPage.

The website is designed to work with keyboards and screen readers, to adapt to different screen sizes, and to meet sufficient colour-contrast levels. Form fields have labels, and important messages are shown on the page as well as in pop-up notifications.

If you have difficulty using any part of the site, or need a product in a different format, please [contact us](/support) and we will do our best to help.`,
    },
];
