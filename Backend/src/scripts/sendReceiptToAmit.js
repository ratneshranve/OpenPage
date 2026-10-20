import { config } from '../config/env.js';

async function sendReceiptEmail() {
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
            subject: 'Order Confirmed: Code Faster With AI eBook (Order #OP-YK65ZQG3)',
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; color: #1f2937;">
                    <div style="margin-bottom: 20px;">
                        <span style="font-size: 20px; font-weight: bold; color: #16a34a;">OpenPage</span>
                    </div>
                    <p style="font-size: 16px; font-weight: 600; color: #111827;">Payment Received & Order Confirmed!</p>
                    <p style="font-size: 15px; line-height: 1.5;">Hi Amit,</p>
                    <p style="font-size: 15px; line-height: 1.5;">We have successfully received and verified your UPI payment for <strong>Code Faster With AI (eBook PDF)</strong>.</p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
                        <h3 style="margin-top: 0; margin-bottom: 12px; color: #0f172a; font-size: 16px;">Order Summary</h3>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>Order Number:</strong> <span style="font-family: monospace; font-weight: bold; color: #16a34a;">OP-YK65ZQG3</span></p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>Product:</strong> Code Faster With AI (PDF)</p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>Amount Paid:</strong> ₹99.00</p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>Payment Method:</strong> UPI</p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>Status:</strong> <span style="background: #dcfce7; color: #15803d; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 13px;">PAID</span></p>
                    </div>

                    <p style="font-size: 15px; line-height: 1.5;">You can view and verify your official order receipt on the store here:</p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="https://open-page-pi.vercel.app/order/OP-YK65ZQG3" style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block; font-size: 15px;">
                            View Your Order & Receipt →
                        </a>
                    </div>

                    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                        Or copy-paste this link in your browser:<br/>
                        <a href="https://open-page-pi.vercel.app/order/OP-YK65ZQG3" style="color: #16a34a;">https://open-page-pi.vercel.app/order/OP-YK65ZQG3</a>
                    </p>

                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
                        Thank you for purchasing with OpenPage! If you need any assistance, feel free to reply to this email.<br/><br/>
                        Best regards,<br/>
                        <strong>Ratnesh Ranve</strong><br/>
                        OpenPage Support (<a href="mailto:ranveratnesh@gmail.com" style="color: #16a34a; text-decoration: none;">ranveratnesh@gmail.com</a>)
                    </p>
                </div>
            `,
            textContent: `Hi Amit,\n\nWe have received and confirmed your payment of ₹99 for Code Faster With AI (eBook PDF).\n\nOrder Number: OP-YK65ZQG3\nStatus: PAID\n\nYou can view your official order confirmation and receipt here:\nhttps://open-page-pi.vercel.app/order/OP-YK65ZQG3\n\nThank you for purchasing with OpenPage!\n\nBest regards,\nRatnesh Ranve\nOpenPage Support`
        }),
    });

    const result = await res.json().catch(() => ({}));
    console.log('STATUS:', res.status);
    console.log('RESULT:', JSON.stringify(result, null, 2));
}

sendReceiptEmail().catch(console.error);
