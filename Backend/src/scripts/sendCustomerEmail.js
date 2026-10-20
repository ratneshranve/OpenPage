import { config } from '../config/env.js';

async function main() {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'api-key': config.brevoApiKey,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            sender: { name: 'OpenPage', email: 'ranveratnesh@gmail.com' },
            to: [{ email: 'amahadik@gmail.com', name: 'Amit Mahadik' }],
            replyTo: { email: 'ranveratnesh@gmail.com', name: 'Ratnesh Ranve' },
            subject: 'Re: purchase - Code Faster With AI eBook Payment Details',
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; color: #1f2937;">
                    <div style="margin-bottom: 20px;">
                        <span style="font-size: 20px; font-weight: bold; color: #16a34a;">OpenPage</span>
                    </div>
                    <p style="font-size: 15px; line-height: 1.5;">Hi Amit,</p>
                    <p style="font-size: 15px; line-height: 1.5;">Thank you for reaching out! We apologize for the technical issue with the session security token on checkout. We have identified and fixed the issue on the platform.</p>
                    <p style="font-size: 15px; line-height: 1.5;">You can proceed with purchasing <strong>Code Faster With AI (eBook PDF)</strong> directly using the UPI payment details below:</p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
                        <h3 style="margin-top: 0; margin-bottom: 12px; color: #0f172a; font-size: 16px;">Direct Payment Details</h3>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>Product:</strong> Code Faster With AI (PDF)</p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>Amount to Pay:</strong> ₹99 <span style="text-decoration: line-through; color: #94a3b8; font-size: 13px;">₹399</span></p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>UPI ID:</strong> <span style="font-family: monospace; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-size: 15px; font-weight: bold;">9203677060@ibl</span></p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>Account Name:</strong> Bhavnesh Ranve</p>
                    </div>

                    <h4 style="margin-bottom: 8px; font-size: 15px; color: #0f172a;">How to complete your order:</h4>
                    <ol style="padding-left: 20px; line-height: 1.7; font-size: 14px;">
                        <li>Open any UPI App (Google Pay, PhonePe, Paytm, or BHIM).</li>
                        <li>Send <strong>₹99</strong> to the UPI ID: <strong>9203677060@ibl</strong></li>
                        <li>Reply directly to this email with the screenshot or the 12-digit UPI Reference / UTR Number.</li>
                    </ol>
                    <p style="font-size: 15px; line-height: 1.5;">As soon as you reply with the UTR or screenshot, we will immediately send the full PDF download access link to your email.</p>

                    <p style="font-size: 14px; color: #475569; line-height: 1.5; margin-top: 16px;">
                        <em>(Note: We also fixed the checkout issue on the website, so you can also refresh and buy directly on the store if you prefer.)</em>
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
                        Best regards,<br/>
                        <strong>Ratnesh Ranve</strong><br/>
                        OpenPage Support (<a href="mailto:ranveratnesh@gmail.com" style="color: #16a34a; text-decoration: none;">ranveratnesh@gmail.com</a>)
                    </p>
                </div>
            `,
            textContent: `Hi Amit,\n\nThank you for reaching out! We apologize for the technical issue with the security token on checkout. We have fixed the issue.\n\nYou can proceed with purchasing Code Faster With AI (PDF) directly using the UPI payment details below:\n\nAmount: ₹99\nUPI ID: 9203677060@ibl\nAccount Holder: Bhavnesh Ranve\n\nSteps to complete:\n1. Open Google Pay, PhonePe, Paytm, or BHIM.\n2. Send ₹99 to UPI ID: 9203677060@ibl\n3. Reply to this email with the screenshot or 12-digit UPI UTR number.\n\nWe will send your eBook PDF download link immediately upon receiving your reply.\n\nBest regards,\nRatnesh Ranve\nOpenPage Support (ranveratnesh@gmail.com)`
        }),
    });

    const result = await res.json().catch(() => ({}));
    console.log('STATUS:', res.status);
    console.log('RESULT:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
