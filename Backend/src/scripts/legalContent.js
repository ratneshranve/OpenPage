/**
 * Starting content for the mandatory legal and informational pages (Markdown).
 * Tailored for OpenPage (operated by Ratnesh Ranve).
 */
export const LEGAL_PAGES = [
    {
        slug: 'terms',
        title: 'Terms and Conditions',
        type: 'legal',
        seo: { title: 'Terms and Conditions | OpenPage', description: 'Terms and conditions governing the purchase of eBooks and use of the OpenPage platform.' },
        body: `_Last updated: October 2026_

These Terms and Conditions ("Terms") govern your access to and use of the OpenPage website and the purchase of digital products from us. By browsing this website or completing a purchase, you agree to be bound by these Terms.

## 1. About Us & Merchant Identity
**OpenPage** ("we", "us", "our") is a digital publication platform operated by **Ratnesh Ranve** (Sole Proprietor / Individual), with operating address at:
- **Operating Address:** 47, Gram Barud, Post Barud, Tehsil Harsud, District Khandwa, Madhya Pradesh - 450116, India
- **Contact Email:** [ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com)
- **Customer Support Phone:** +91 9770133148
- **Operating Hours:** Monday to Saturday, 10:00 AM – 6:00 PM IST

## 2. Eligibility
By using this website, you represent that you are at least 18 years of age, or possess legal parental or guardian consent, and are fully able and competent to enter into the terms, conditions, obligations, and representations set forth herein.

## 3. Nature of Digital Products
All products offered on OpenPage are strictly digital files (primarily eBooks in PDF and EPUB formats). We do not manufacture or ship physical goods. Product descriptions, sample pages, and specifications (such as topic coverage and format) are clearly detailed on each eBook's product page.

## 4. Pricing and Payments
- All prices are quoted in **Indian Rupees (INR)** unless explicitly stated otherwise.
- Payments are processed securely via **Razorpay**, an authorized payment aggregator compliant with RBI guidelines and PCI-DSS standards.
- We accept payments via UPI, Credit/Debit Cards, Net Banking, and supported digital wallets.
- We do not collect, process, or store your credit/debit card numbers or bank account credentials. All transaction processing occurs on Razorpay's encrypted payment gateway.

## 5. Order Confirmation & Instant Digital Delivery
- Before payment, you must verify your email address via a One-Time Password (OTP) to ensure your download link reaches the intended recipient.
- Upon successful payment confirmation from Razorpay, your order is immediately processed and access to your eBook is granted.
- An email containing your purchase receipt and a secure, time-limited download link is automatically dispatched to your verified email within minutes.
- If you create or hold an account with OpenPage, all purchased eBooks are automatically archived in your personal digital library for anytime re-download.

## 6. License and Permitted Use
Upon full payment, OpenPage grants you a personal, revocable, non-exclusive, non-transferable, single-user license to download, read, and store the purchased digital material for personal, educational, or internal professional use.

**Under this license, you may NOT:**
- Resell, rent, sublicense, redistribute, publish, or publicly broadcast the files or any portion thereof.
- Upload purchased eBooks to peer-to-peer file-sharing networks, torrent sites, public web repositories, or shared cloud folders.
- Alter, remove, or obscure any copyright notices, proprietary markings, or digital watermarks.
- Use the content to create derivative works, resale packs, or competing commercial publications.

## 7. Intellectual Property Rights
All trademarks, content, text, graphics, designs, logos, and digital publications on this site are the intellectual property of OpenPage / Ratnesh Ranve or our licensed contributors, and are protected under the Indian Copyright Act, 1957, and international copyright conventions.

## 8. Refunds and Cancellations
Refunds are governed by our [Refund and Cancellation Policy](/refund-policy). Because digital delivery is instantaneous, orders cannot be cancelled once access is delivered. However, genuine refund requests for duplicate payments or corrupted files will be honored within 7 days of purchase.

## 9. Grievance Redressal
In accordance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020, the details of the designated Grievance Officer are:
- **Grievance Officer:** Ratnesh Ranve
- **Address:** 47, Gram Barud, Post Barud, Tehsil Harsud, District Khandwa, Madhya Pradesh - 450116, India
- **Email:** [ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com)
- **Phone:** +91 9770133148
- **Response Timeline:** We acknowledge grievances within 48 hours and resolve them within 30 days.

## 10. Governing Law and Jurisdiction
These Terms and any dispute or claim arising out of or in connection with your purchase shall be governed by and construed in accordance with the **laws of India**. Any legal action or proceeding shall be subject to the exclusive jurisdiction of the competent courts in **Khandwa, Madhya Pradesh, India**.

## 11. Contact Information
For any questions regarding these Terms, please reach out via our [Support page](/support) or directly email [ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com).`,
    },
    {
        slug: 'privacy',
        title: 'Privacy Policy',
        type: 'legal',
        seo: { title: 'Privacy Policy | OpenPage', description: 'Learn how OpenPage collects, protects, and handles your personal information.' },
        body: `_Last updated: October 2026_

OpenPage ("we", "us", "our"), operated by **Ratnesh Ranve**, values your trust and is committed to protecting your privacy. This Privacy Policy outlines our practices regarding the collection, use, and disclosure of your information when you visit our website or purchase digital products.

## 1. Information We Collect
We collect only the minimum information necessary to provide our digital publishing services:
- **Contact Details:** Your email address (verified via OTP at checkout) and name (if provided).
- **Transaction Details:** Purchased eBook titles, order ID, amount paid, date, and payment status reference received from our payment processor.
- **Account Details:** If you register an account, your name, email, and an encrypted (hashed) password.
- **Communications:** Messages, inquiries, or support requests submitted via our contact forms or email.
- **Technical & Log Data:** IP address, device type, browser specification, and session timestamps used solely for security, rate-limiting, and fraud prevention.

## 2. Payment Data Security (Razorpay)
All financial transactions on OpenPage are processed through **Razorpay** (PCI-DSS Level 1 certified payment gateway). We **never store or process** sensitive banking data, credit/debit card numbers, CVVs, or UPI PINs on our servers. Razorpay handles your financial details under its strict privacy and security protocols.

## 3. How We Use Your Information
We use your information exclusively for legitimate business purposes:
- To verify your email address before checkout to ensure genuine delivery.
- To generate and dispatch your eBook download link and payment receipts.
- To provide ongoing access to your purchased eBook library.
- To provide customer support, troubleshoot download issues, and process approved refunds.
- To protect against fraudulent transactions and maintain platform security.
- To send promotional emails **only if you explicitly opt in** to our newsletter. You can unsubscribe at any time via the link in any email.

## 4. Data Sharing & Third-Party Processors
We do not sell, rent, or trade your personal information to third parties. We share data only with trusted service providers essential to operating our storefront:
- **Payment Processing:** Razorpay Software Private Limited.
- **Email Delivery:** SMTP service provider for transactional emails (OTP, receipts, download links).
- **Cloud Infrastructure & Storage:** MongoDB Atlas (database) and Cloudinary (secure digital assets).

## 5. Cookies & Local Storage
We use essential cookies and local storage tokens strictly necessary for site functionality, such as keeping you logged in, maintaining cart state, and CSRF security validation. We do not use third-party tracking cookies without your explicit consent.

## 6. Data Retention
- Transaction and order records are retained as required by Indian taxation and legal statutes.
- Expired OTP verification codes and temporary tokens are automatically purged within minutes of expiration.
- Account information remains active until you request account deletion.

## 7. Your Legal Rights (DPDP Act)
Under applicable Indian data protection laws, including the Digital Personal Data Protection Act, 2023, you have the right to:
- Access and review the personal information we hold about you.
- Request correction or updating of inaccurate personal data.
- Request deletion of your personal account data (subject to legal recordkeeping obligations).
- Withdraw consent for marketing communications at any time.

To exercise any of these rights, please email [ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com) with your request.

## 8. Grievance Officer & Contact
If you have questions, concerns, or grievances regarding this Privacy Policy, please contact our Grievance Officer:
- **Name:** Ratnesh Ranve
- **Entity:** OpenPage
- **Address:** 47, Gram Barud, Post Barud, Tehsil Harsud, District Khandwa, Madhya Pradesh - 450116, India
- **Email:** [ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com)
- **Phone:** +91 9770133148`,
    },
    {
        slug: 'refund-policy',
        title: 'Refund and Cancellation Policy',
        type: 'legal',
        seo: { title: 'Refund and Cancellation Policy | OpenPage', description: 'Our policy regarding refunds, replacements, and cancellations for eBook purchases.' },
        body: `_Last updated: October 2026_

Thank you for shopping at **OpenPage** (operated by **Ratnesh Ranve**). We strive to provide high-quality, practical eBooks that help you work smarter. Please read our policy regarding cancellations and refunds carefully.

## 1. Nature of Digital Goods
All products sold on OpenPage are downloadable digital eBooks (primarily PDF format) that are made accessible immediately upon payment verification. Because digital files cannot be physically returned once delivered, our policy reflects the nature of non-tangible digital goods.

## 2. Cancellation Policy
Because download links and order confirmations are dispatched immediately and automatically upon payment confirmation, **orders cannot be cancelled once payment is processed**. Please ensure you review your cart items before completing payment.

## 3. When Refunds Are Granted
We stand behind the quality of our digital publications and review refund requests fairly. You are eligible for a full refund under the following circumstances:
1. **Duplicate Purchase / Double Deduction:** You were accidentally billed more than once for the same order, or you purchased identical copies of the same eBook in separate transactions by mistake.
2. **Defective or Corrupted File:** The downloaded file is damaged, missing pages, corrupted, or cannot be opened on standard PDF/EPUB readers, and our support team is unable to provide a functional replacement within 24 hours of being notified.
3. **Non-Delivery:** Your payment was successfully deducted by Razorpay, but our system failed to deliver the download link and email receipt, and our team cannot manually fulfill the order within 24 hours.
4. **Material Discrepancy:** The eBook content significantly deviates from the description, syllabus, or preview provided on the official product page.

## 4. When Refunds Are Not Granted
Refunds will generally **not** be approved if:
- You have already downloaded the eBook and simply changed your mind ("buyer's remorse").
- The file is functional, but you do not possess software capable of reading standard PDF documents (standard PDF readers are free and readily accessible on all modern devices).
- Multiple refund requests have been submitted suggesting misuse or abuse of our digital products.

## 5. How to Request a Refund
To request a refund, please contact us **within 7 days of purchase**:
1. Visit our [Support page](/support) or send an email to **[ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com)**.
2. Include your **Order ID** (e.g., \`OP-XXXXXXXX\`) and the email address used during checkout.
3. Provide a brief explanation of the issue (for file problems, please mention your device and reader application).
4. Our support team will review your request and respond **within 24 hours**.

## 6. Refund Processing Timeline
- Once your refund is approved, it will be initiated immediately through **Razorpay**.
- The refund amount will be credited back to your **original payment method** (UPI, credit/debit card, or bank account).
- Depending on your bank's processing cycle, the refund usually reflects in your account within **5 to 7 business days**.
- Upon issuance of a refund, your download access to the eBook will be deactivated and removed from your library.

## 7. Contact Us
For any questions regarding our refund policy, please contact us:
- **Entity:** OpenPage (Ratnesh Ranve)
- **Address:** 47, Gram Barud, Post Barud, Tehsil Harsud, District Khandwa, Madhya Pradesh - 450116, India
- **Email:** [ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com)
- **Phone:** +91 9770133148
- **Hours:** Monday to Saturday, 10:00 AM – 6:00 PM IST`,
    },
    {
        slug: 'licensing',
        title: 'Digital Product Licensing',
        type: 'legal',
        seo: { title: 'Digital Product Licensing | OpenPage', description: 'License terms and permitted usage for OpenPage digital eBooks.' },
        body: `Every eBook purchased from **OpenPage** comes with a **Single-User Personal License** unless expressly stated otherwise in writing.

## What You Are Permitted To Do:
- **Download & Read:** Download and store copies of the eBook across your personal devices (laptop, tablet, phone, e-reader).
- **Personal Backups:** Maintain personal offline backups to ensure you always have access.
- **Personal Printing:** Print a copy for your own personal reference and reading.
- **Apply the Knowledge:** Freely apply all concepts, templates, prompts, workflows, and code snippets in your personal or commercial business projects.
- **Short Quotations:** Quote brief excerpts for educational, commentary, or review purposes, provided clear attribution is given to OpenPage.

## What Is Strictly Prohibited:
- **Redistribution:** Sharing the files, download links, or access credentials with friends, colleagues, or online groups.
- **Commercial Resale:** Selling, renting, sublicensing, or bundling the eBooks with other paid commercial packages.
- **Public Uploads:** Uploading files to public websites, course portals, Telegram channels, Google Drive links, or torrent networks.
- **Plagiarism:** Copying substantial portions of text, claiming authorship, or creating derivative eBooks for sale.

## Team & Enterprise Licensing
If you wish to share OpenPage eBooks with your team, department, or company, please reach out via our [Support page](/support) or email [ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com) to arrange a multi-seat team license.`,
    },
    {
        slug: 'about',
        title: 'About OpenPage',
        type: 'content',
        seo: { title: 'About Us | OpenPage', description: 'Learn about OpenPage and our mission to provide practical eBooks on AI, automation, marketing, and productivity.' },
        body: `**OpenPage** publishes practical, actionable eBooks designed for modern professionals, founders, developers, and digital operators who want to work smarter.

We focus on four core pillars:
- **AI Automation:** Step-by-step guides and production-ready prompts to automate repetitive tasks and leverage modern AI workflows.
- **Business Operations:** Lean frameworks, systems, and standard operating procedures to scale smoothly.
- **Marketing & Growth:** Direct, data-backed strategies for customer acquisition, content creation, and revenue growth.
- **Productivity & Focus:** Clear systems and habits for deep work, effective execution, and personal leverage.

## Our Philosophy
1. **Zero Fluff, 100% Practical:** Every guide is written to be finished in an evening and put to work the next morning.
2. **Built by Practitioners:** We write about tools and systems tested in the real world.
3. **Lifetime Value:** When you buy an eBook on OpenPage, you receive instant email delivery and continuous library access.

## Founder & Business Identity
OpenPage is created and published by **Ratnesh Ranve**, based in Khandwa, Madhya Pradesh, India.

Have a suggestion, question, or want to collaborate?
- **Email:** [ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com)
- **Phone:** +91 9770133148
- **Address:** 47, Gram Barud, Post Barud, Tehsil Harsud, District Khandwa, Madhya Pradesh - 450116, India`,
    },
    {
        slug: 'accessibility',
        title: 'Accessibility Statement',
        type: 'content',
        seo: { title: 'Accessibility Statement | OpenPage', description: 'Our commitment to digital accessibility for all users.' },
        body: `At **OpenPage**, we believe digital knowledge should be accessible to everyone, including individuals with disabilities.

## Accessibility Features
- **Responsive Layout:** The website adapts seamlessly to all viewports, from mobile screens to large desktop monitors.
- **Contrast & Typography:** We use clean, legible typography and high-contrast color palettes adhering to WCAG 2.1 standards.
- **Keyboard Navigation:** Core user flows (browsing, search, checkout, and account access) are fully navigable using keyboard commands.
- **Digital eBook Formats:** Our PDF publications are formatted with structured headings, searchable text, and high readability across standard screen readers.

## Feedback and Support
If you encounter any accessibility barriers on our website, or require an eBook in an alternate accessible format, please contact us at **[ranveratnesh@gmail.com](mailto:ranveratnesh@gmail.com)** or call **+91 9770133148**. We will gladly assist you.`,
    },
];
