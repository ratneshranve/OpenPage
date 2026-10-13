/**
 * Default email templates, seeded into MongoDB on first start and editable in the admin.
 * Common variables available to every template:
 *   siteName, siteUrl, supportEmail, year, recipientEmail, customerName
 */
const btn = (href, label) =>
    `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">${label}</a></p>`;

const itemsTable = `<table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0;">
{{#each items}}<tr><td style="padding:8px 0;border-bottom:1px solid #e5e9f0;">{{this.title}}</td><td style="padding:8px 0;border-bottom:1px solid #e5e9f0;text-align:right;white-space:nowrap;">{{this.totalFormatted}}</td></tr>{{/each}}
{{#if discountFormatted}}<tr><td style="padding:8px 0;color:#16a34a;">Discount</td><td style="padding:8px 0;text-align:right;color:#16a34a;">-{{discountFormatted}}</td></tr>{{/if}}
{{#if taxFormatted}}<tr><td style="padding:8px 0;color:#5b6b86;">{{taxLabel}}</td><td style="padding:8px 0;text-align:right;color:#5b6b86;">{{taxFormatted}}</td></tr>{{/if}}
<tr><td style="padding:10px 0;font-weight:700;">Total paid</td><td style="padding:10px 0;text-align:right;font-weight:700;">{{totalFormatted}}</td></tr>
</table>`;

const downloadsBlock = `{{#each downloads}}<div style="border:1px solid #e5e9f0;border-radius:10px;padding:14px 16px;margin:12px 0;">
<p style="margin:0 0 6px;font-weight:600;">{{this.title}}</p>
<p style="margin:0 0 10px;font-size:13px;color:#5b6b86;">{{this.format}} &middot; Version {{this.version}}</p>
<a href="{{this.url}}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;">Download</a>
</div>{{/each}}
<p style="font-size:13px;color:#5b6b86;">For your security, each link expires in {{linkTtlText}} and can be used a limited number of times. If a link has expired, request a new one at <a href="{{downloadHelpUrl}}" style="color:#2563eb;">{{downloadHelpUrl}}</a>{{#if hasAccount}} or open your <a href="{{libraryUrl}}" style="color:#2563eb;">library</a>{{/if}}.</p>`;

export const DEFAULT_TEMPLATES = [
    {
        key: 'otp_verification',
        name: 'Checkout email verification code',
        category: 'transactional',
        subject: '{{code}} is your {{siteName}} verification code',
        preheader: 'Use this code to verify your email and continue to payment.',
        variables: ['code', 'expiresInMinutes'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Verify your email</h1>
<p>Use this code to verify your email address and continue to secure payment:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f1f3d;background:#eff6ff;border-radius:10px;padding:14px 0;text-align:center;margin:20px 0;">{{code}}</p>
<p>This code expires in {{expiresInMinutes}} minutes and can only be used once.</p>
<p style="font-size:13px;color:#5b6b86;">If you did not start a checkout on {{siteName}}, you can ignore this email. Never share this code with anyone.</p>`,
    },
    {
        key: 'order_confirmation',
        name: 'Order confirmation and eBook delivery',
        category: 'transactional',
        subject: 'Your {{siteName}} order {{orderNumber}} is ready to download',
        preheader: 'Payment confirmed. Your download links are inside.',
        variables: ['orderNumber', 'items', 'downloads', 'totalFormatted', 'discountFormatted', 'taxFormatted', 'taxLabel', 'orderUrl', 'libraryUrl', 'hasAccount', 'linkTtlText', 'downloadHelpUrl', 'paidAt'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Thank you for your purchase{{#if customerName}}, {{customerName}}{{/if}}!</h1>
<p>Your payment for order <strong>{{orderNumber}}</strong> has been confirmed on {{paidAt}}.</p>
${itemsTable}
<h2 style="font-size:17px;margin:24px 0 8px;">Your downloads</h2>
${downloadsBlock}
<p style="font-size:13px;color:#5b6b86;">Your purchase is licensed for personal use as described in our <a href="{{siteUrl}}/licensing" style="color:#2563eb;">licensing terms</a>. Keep this email as your receipt.</p>`,
    },
    {
        key: 'ebook_delivery',
        name: 'eBook delivery (resend)',
        category: 'transactional',
        subject: 'Your download links for order {{orderNumber}}',
        preheader: 'Here are fresh download links for your eBooks.',
        variables: ['orderNumber', 'downloads', 'libraryUrl', 'hasAccount', 'linkTtlText', 'downloadHelpUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Your eBooks are ready</h1>
<p>Here are your download links for order <strong>{{orderNumber}}</strong>.</p>
${downloadsBlock}`,
    },
    {
        key: 'download_link_regenerated',
        name: 'Download link regenerated',
        category: 'transactional',
        subject: 'Your new download link from {{siteName}}',
        preheader: 'A fresh, secure download link as requested.',
        variables: ['orderNumber', 'downloads', 'linkTtlText', 'downloadHelpUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Here is your new download link</h1>
<p>You requested a fresh download link for order <strong>{{orderNumber}}</strong>. Previous links for these files have been replaced.</p>
${downloadsBlock}
<p style="font-size:13px;color:#5b6b86;">If you did not request this, no action is needed. Links only work for the purchased files.</p>`,
    },
    {
        key: 'payment_failed',
        name: 'Payment failed',
        category: 'transactional',
        subject: 'Your payment for order {{orderNumber}} did not go through',
        preheader: 'No money was taken for this attempt. You can try again.',
        variables: ['orderNumber', 'reason', 'retryUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Payment not completed</h1>
<p>We could not complete the payment for order <strong>{{orderNumber}}</strong>.{{#if reason}} The payment provider reported: {{reason}}.{{/if}}</p>
<p>If any amount was debited, it is usually reversed automatically by your bank or the payment provider. Contact us if you need help.</p>
${btn('{{retryUrl}}', 'Return to checkout')}`,
    },
    {
        key: 'payment_pending',
        name: 'Payment pending',
        category: 'transactional',
        subject: 'We are confirming your payment for order {{orderNumber}}',
        preheader: 'Your payment is being confirmed.',
        variables: ['orderNumber', 'statusUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Payment being confirmed</h1>
<p>We have received your payment attempt for order <strong>{{orderNumber}}</strong> and are waiting for final confirmation from the payment provider. This usually takes a few minutes.</p>
<p>As soon as it is confirmed, we will email your download links. Please do not pay again for the same order.</p>
${btn('{{statusUrl}}', 'Check order status')}`,
    },
    {
        key: 'refund_requested',
        name: 'Refund request acknowledgement',
        category: 'transactional',
        subject: 'We received your refund request {{refundNumber}}',
        preheader: 'Our team will review your request.',
        variables: ['refundNumber', 'orderNumber', 'reason'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Refund request received</h1>
<p>We have received your refund request <strong>{{refundNumber}}</strong> for order <strong>{{orderNumber}}</strong>.</p>
<p>Our team reviews every request individually under our <a href="{{siteUrl}}/refund-policy" style="color:#2563eb;">Refund Policy</a> and will update you by email.</p>`,
    },
    {
        key: 'refund_status',
        name: 'Refund status update',
        category: 'transactional',
        subject: 'Update on your refund request {{refundNumber}}',
        preheader: 'There is an update on your refund request.',
        variables: ['refundNumber', 'orderNumber', 'statusLabel', 'message', 'amountFormatted'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Refund update: {{statusLabel}}</h1>
<p>Your refund request <strong>{{refundNumber}}</strong> for order <strong>{{orderNumber}}</strong> has been updated.</p>
{{#if amountFormatted}}<p>Refund amount: <strong>{{amountFormatted}}</strong>. Refunds typically reach your original payment method within 5 to 7 business days, depending on your bank.</p>{{/if}}
{{#if message}}<p>{{message}}</p>{{/if}}`,
    },
    {
        key: 'welcome',
        name: 'Welcome email',
        category: 'transactional',
        subject: 'Welcome to {{siteName}}',
        preheader: 'Your account is ready.',
        variables: ['libraryUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Welcome{{#if customerName}}, {{customerName}}{{/if}}!</h1>
<p>Your {{siteName}} account is ready. Any purchases made with your verified email address will appear in your library.</p>
${btn('{{libraryUrl}}', 'Open my library')}`,
    },
    {
        key: 'account_verification',
        name: 'Account email verification',
        category: 'transactional',
        subject: 'Confirm your email for {{siteName}}',
        preheader: 'Confirm your email to activate your library.',
        variables: ['verifyUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Confirm your email address</h1>
<p>Please confirm your email address to finish setting up your account and connect previous purchases to your library.</p>
${btn('{{verifyUrl}}', 'Confirm email')}
<p style="font-size:13px;color:#5b6b86;">This link expires in 24 hours. If you did not create an account, ignore this email.</p>`,
    },
    {
        key: 'password_reset',
        name: 'Password reset',
        category: 'transactional',
        subject: 'Reset your {{siteName}} password',
        preheader: 'Use this link to choose a new password.',
        variables: ['resetUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Reset your password</h1>
<p>We received a request to reset the password for your account.</p>
${btn('{{resetUrl}}', 'Choose a new password')}
<p style="font-size:13px;color:#5b6b86;">This link expires in 1 hour and can be used once. If you did not request this, you can safely ignore this email; your password will not change.</p>`,
    },
    {
        key: 'newsletter_confirmation',
        name: 'Newsletter confirmation (double opt-in)',
        category: 'transactional',
        subject: 'Please confirm your subscription to {{siteName}}',
        preheader: 'One click to confirm.',
        variables: ['confirmUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Confirm your subscription</h1>
<p>Please confirm that you would like to receive occasional emails about new eBooks and genuine offers from {{siteName}}.</p>
${btn('{{confirmUrl}}', 'Yes, subscribe me')}
<p style="font-size:13px;color:#5b6b86;">If you did not sign up, ignore this email and you will not be subscribed.</p>`,
    },
    {
        key: 'support_acknowledgment',
        name: 'Support request acknowledgement',
        category: 'transactional',
        subject: 'We received your message [{{ticketNumber}}]',
        preheader: 'Our team will get back to you soon.',
        variables: ['ticketNumber', 'subject', 'responseTime'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Thanks for contacting us</h1>
<p>Your support request <strong>{{ticketNumber}}</strong>{{#if subject}} ("{{subject}}"){{/if}} has been received. {{responseTime}}</p>
<p>For download issues, you can also request a fresh link at <a href="{{siteUrl}}/download" style="color:#2563eb;">{{siteUrl}}/download</a>.</p>`,
    },
    {
        key: 'support_reply',
        name: 'Support reply',
        category: 'transactional',
        subject: 'Re: your support request [{{ticketNumber}}]',
        preheader: 'Our team replied to your request.',
        variables: ['ticketNumber', 'message'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Reply to your request {{ticketNumber}}</h1>
<div style="white-space:pre-line;">{{message}}</div>
<p style="font-size:13px;color:#5b6b86;">Reply to this email if you need anything else.</p>`,
    },
    {
        key: 'abandoned_checkout_1',
        name: 'Abandoned checkout: first reminder',
        category: 'marketing',
        subject: 'You left something in your cart',
        preheader: 'Your selected eBooks are still available.',
        variables: ['items', 'checkoutUrl', 'totalFormatted'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Still thinking it over?</h1>
<p>You started a checkout on {{siteName}} but did not complete payment. Your selection is saved:</p>
<ul>{{#each items}}<li>{{this.title}}</li>{{/each}}</ul>
${btn('{{checkoutUrl}}', 'Complete my purchase')}
<p style="font-size:13px;color:#5b6b86;">Prices are confirmed at checkout. If you already completed your purchase, please ignore this email.</p>`,
    },
    {
        key: 'abandoned_checkout_2',
        name: 'Abandoned checkout: second reminder',
        category: 'marketing',
        subject: 'Your eBooks are waiting for you',
        preheader: 'A final reminder about your saved cart.',
        variables: ['items', 'checkoutUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">A quick reminder</h1>
<p>Your cart on {{siteName}} is still saved. This is our last reminder about it.</p>
<ul>{{#each items}}<li>{{this.title}}</li>{{/each}}</ul>
${btn('{{checkoutUrl}}', 'Return to checkout')}`,
    },
    {
        key: 'post_purchase_getting_started',
        name: 'Post-purchase: getting started',
        category: 'marketing',
        subject: 'Getting the most from your new eBook',
        preheader: 'A few tips to put your eBook to work.',
        variables: ['items', 'libraryUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Make the most of your purchase</h1>
<p>A few tips for getting value from {{#each items}}<strong>{{this.title}}</strong> {{/each}}:</p>
<ul><li>Skim the table of contents first and pick the chapter that matches your current challenge.</li><li>Keep a notes file for actions you want to try this week.</li><li>Revisit the checklists after you implement a change.</li></ul>
<p>You can re-download your files from your library or by requesting a new link from our download page.</p>`,
    },
    {
        key: 'post_purchase_recommendations',
        name: 'Post-purchase: recommendations',
        category: 'marketing',
        subject: 'You might also like these eBooks',
        preheader: 'Hand-picked titles related to your purchase.',
        variables: ['recommendations'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">Recommended for you</h1>
<p>Based on your recent purchase, these titles may be useful:</p>
{{#each recommendations}}<p style="margin:10px 0;"><a href="{{this.url}}" style="color:#2563eb;font-weight:600;">{{this.title}}</a><br><span style="font-size:13px;color:#5b6b86;">{{this.shortDescription}}</span></p>{{/each}}`,
    },
    {
        key: 'review_request',
        name: 'Post-purchase: review request',
        category: 'marketing',
        subject: 'How are you finding your eBook?',
        preheader: 'Your honest feedback helps other readers.',
        variables: ['items', 'reviewUrl'],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">We would value your feedback</h1>
<p>If you have had a chance to read your purchase, an honest review helps other readers decide. Positive or critical, all genuine feedback is welcome.</p>
${btn('{{reviewUrl}}', 'Leave a review')}`,
    },
    {
        key: 'campaign_default',
        name: 'Marketing campaign base',
        category: 'marketing',
        subject: 'News from {{siteName}}',
        preheader: '',
        variables: ['content'],
        html: `{{{content}}}`,
    },
    {
        key: 'test_email',
        name: 'SMTP test email',
        category: 'transactional',
        subject: '{{siteName}} SMTP test',
        preheader: 'Your email settings are working.',
        variables: [],
        html: `<h1 style="font-size:20px;margin:0 0 12px;">SMTP is working</h1><p>This test email was sent from the {{siteName}} admin dashboard.</p>`,
    },
];
