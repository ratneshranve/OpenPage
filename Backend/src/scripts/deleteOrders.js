import { connectDB, disconnectDB } from '../config/db.js';
import {
    Order,
    Payment,
    Entitlement,
    DownloadToken,
    DownloadEvent,
    CheckoutSession,
    Otp,
    OfferRedemption,
    RefundRequest,
    WebhookEvent,
    EmailMessage,
    AuditLog,
} from '../models/index.js';

async function run() {
    try {
        await connectDB();
        console.log('Connected to MongoDB. Preparing to delete orders and related transaction records...');

        // 1. Gather stats before deletion
        const before = {
            orders: await Order.countDocuments(),
            payments: await Payment.countDocuments(),
            entitlements: await Entitlement.countDocuments(),
            downloadTokens: await DownloadToken.countDocuments(),
            downloadEvents: await DownloadEvent.countDocuments(),
            checkoutSessions: await CheckoutSession.countDocuments(),
            otps: await Otp.countDocuments(),
            offerRedemptions: await OfferRedemption.countDocuments(),
            refundRequests: await RefundRequest.countDocuments(),
            webhookEvents: await WebhookEvent.countDocuments(),
            orderEmails: await EmailMessage.countDocuments({
                $or: [{ order: { $exists: true, $ne: null } }, { checkoutSession: { $exists: true, $ne: null } }],
            }),
            orderAuditLogs: await AuditLog.countDocuments({ targetType: 'Order' }),
        };

        console.log('Records before deletion:', JSON.stringify(before, null, 2));

        // 2. Perform deletions
        const resOrders = await Order.deleteMany({});
        const resPayments = await Payment.deleteMany({});
        const resEntitlements = await Entitlement.deleteMany({});
        const resDownloadTokens = await DownloadToken.deleteMany({});
        const resDownloadEvents = await DownloadEvent.deleteMany({});
        const resCheckoutSessions = await CheckoutSession.deleteMany({});
        const resOtps = await Otp.deleteMany({});
        const resOfferRedemptions = await OfferRedemption.deleteMany({});
        const resRefundRequests = await RefundRequest.deleteMany({});
        const resWebhookEvents = await WebhookEvent.deleteMany({});
        const resEmails = await EmailMessage.deleteMany({
            $or: [{ order: { $exists: true, $ne: null } }, { checkoutSession: { $exists: true, $ne: null } }],
        });
        const resAudit = await AuditLog.deleteMany({ targetType: 'Order' });

        const deletedSummary = {
            orders: resOrders.deletedCount,
            payments: resPayments.deletedCount,
            entitlements: resEntitlements.deletedCount,
            downloadTokens: resDownloadTokens.deletedCount,
            downloadEvents: resDownloadEvents.deletedCount,
            checkoutSessions: resCheckoutSessions.deletedCount,
            otps: resOtps.deletedCount,
            offerRedemptions: resOfferRedemptions.deletedCount,
            refundRequests: resRefundRequests.deletedCount,
            webhookEvents: resWebhookEvents.deletedCount,
            orderEmails: resEmails.deletedCount,
            orderAuditLogs: resAudit.deletedCount,
        };

        console.log('Deleted records summary:', JSON.stringify(deletedSummary, null, 2));

        // 3. Verify counts after deletion
        const after = {
            remainingOrders: await Order.countDocuments(),
            remainingPayments: await Payment.countDocuments(),
            remainingEntitlements: await Entitlement.countDocuments(),
            remainingDownloadTokens: await DownloadToken.countDocuments(),
            remainingDownloadEvents: await DownloadEvent.countDocuments(),
            remainingCheckoutSessions: await CheckoutSession.countDocuments(),
        };

        console.log('Records after deletion verification:', JSON.stringify(after, null, 2));
        console.log('All orders and transaction records successfully deleted.');
    } catch (err) {
        console.error('Error deleting orders and transactions:', err);
        process.exitCode = 1;
    } finally {
        await disconnectDB();
    }
}

run();
