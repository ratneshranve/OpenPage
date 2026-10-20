import { connectDB } from '../config/db.js';
import { Product, Order, Entitlement } from '../models/index.js';
import { humanRef } from '../utils/helpers.js';

async function main() {
    await connectDB();

    const product = await Product.findOne({ slug: 'code-faster-with-ai' });
    if (!product) {
        console.error('Product "code-faster-with-ai" not found!');
        process.exit(1);
    }

    // Generate unique order number
    let orderNumber;
    for (let i = 0; i < 5; i++) {
        const candidate = humanRef('OP', 8);
        if (!(await Order.exists({ orderNumber: candidate }))) {
            orderNumber = candidate;
            break;
        }
    }
    if (!orderNumber) {
        orderNumber = `OP-${Date.now().toString().slice(-8)}`;
    }

    const price = product.price || 9900;
    const compareAtPrice = product.compareAtPrice || 39900;

    const orderData = {
        orderNumber,
        email: 'amahadik@gmail.com',
        customerName: 'Amit Mahadik',
        items: [
            {
                product: product._id,
                title: product.title,
                slug: product.slug,
                coverImage: product.coverImage?.url || '',
                format: 'PDF',
                fileVersion: product.file?.version || '1.0',
                unitPrice: price,
                compareAtPrice: compareAtPrice,
                discount: 0,
                total: price,
            },
        ],
        currency: 'INR',
        subtotal: price,
        discountTotal: 0,
        total: price,
        status: 'paid',
        paymentStatus: 'paid',
        deliveryStatus: 'sent', // User manually emailed the PDF
        paymentMethod: 'manual_upi',
        manualPayment: {
            upiId: '9203677060@ibl',
            submittedAt: new Date(),
            approvedAt: new Date(),
        },
        paidAt: new Date(),
        termsAcceptedAt: new Date(),
        attribution: {
            source: 'meta',
            medium: 'cpc',
            campaign: 'facebook_ads',
        },
        conversionTrackedAt: null, // Keep null so Meta Pixel tracks it on order page visit
    };

    const order = await Order.create(orderData);
    console.log(`Order created: ${order.orderNumber} (ID: ${order._id})`);

    // Create Entitlement so Amit has official access to downloads/library
    await Entitlement.updateOne(
        { order: order._id, product: product._id },
        {
            $setOnInsert: {
                email: 'amahadik@gmail.com',
                productTitle: product.title,
                fileKey: product.file?.key,
                fileVersion: product.file?.version || '1.0',
                fileName: product.file ? `${product.slug}-v${product.file.version}.${product.file.key.split('.').pop()}` : `${product.slug}.pdf`,
                grantedAt: new Date(),
                status: 'active',
            },
        },
        { upsert: true }
    );
    console.log(`Entitlement granted for ${order.email}`);

    // Increment sales count on product
    await Product.updateOne({ _id: product._id }, { $inc: { salesCount: 1 } });
    console.log(`Product salesCount incremented for "${product.title}"`);

    console.log('\n--- SUCCESS ---');
    console.log(`Order Number: ${order.orderNumber}`);
    console.log(`Amount: ₹${price / 100}`);
    console.log(`Customer: Amit Mahadik (amahadik@gmail.com)`);
    console.log(`Status: PAID`);
    console.log(`Order Status URL: /order-status/${order.orderNumber}`);

    process.exit(0);
}

main().catch((err) => {
    console.error('Error creating order:', err);
    process.exit(1);
});
