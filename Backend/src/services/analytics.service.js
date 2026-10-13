import { Order, Payment, RefundRequest, CheckoutSession, EmailMessage, OfferRedemption, NotificationCampaign, EmailCampaign, Automation } from '../models/index.js';

/** Revenue figures are first-party records from verified payments only. */
const PAID = ['paid', 'partially_refunded', 'refunded'];

export const parseRange = (query) => {
    const to = query.to ? new Date(query.to) : new Date();
    if (query.to && query.to.length <= 10) to.setHours(23, 59, 59, 999);
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 29 * 24 * 3600 * 1000);
    if (!query.from) from.setHours(0, 0, 0, 0);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return parseRange({});
    return { from, to };
};

export const dashboard = async ({ from, to }) => {
    const paidMatch = { status: { $in: PAID }, paidAt: { $gte: from, $lte: to } };
    const [sales] = await Order.aggregate([
        { $match: paidMatch },
        { $group: { _id: null, gross: { $sum: '$total' }, orders: { $sum: 1 }, refunded: { $sum: '$refundedAmount' }, discounts: { $sum: '$discountTotal' }, tax: { $sum: { $ifNull: ['$tax.amount', 0] } } } },
    ]);
    const [fees] = await Payment.aggregate([
        { $match: { status: { $in: ['captured', 'refunded'] }, capturedAt: { $gte: from, $lte: to } } },
        { $group: { _id: null, fee: { $sum: { $ifNull: ['$fee', 0] } } } },
    ]);
    const statusCounts = await Order.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const counts = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
    const [failedPayments, pendingPayments] = await Promise.all([
        Payment.countDocuments({ status: 'failed', updatedAt: { $gte: from, $lte: to } }),
        Order.countDocuments({ status: 'pending', paymentStatus: { $in: ['attempted', 'pending'] }, createdAt: { $gte: from, $lte: to } }),
    ]);

    const topProducts = await Order.aggregate([
        { $match: paidMatch },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', title: { $first: '$items.title' }, units: { $sum: 1 }, revenue: { $sum: '$items.total' } } },
        { $sort: { revenue: -1 } },
        { $limit: 8 },
    ]);

    const salesByDay = await Order.aggregate([
        { $match: paidMatch },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Kolkata' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
    ]);

    const couponUsage = await OfferRedemption.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$offer', uses: { $sum: 1 }, discount: { $sum: '$discount' }, revenue: { $sum: '$orderTotal' } } },
        { $lookup: { from: 'offers', localField: '_id', foreignField: '_id', as: 'offer' } },
        { $project: { uses: 1, discount: 1, revenue: 1, name: { $first: '$offer.name' }, code: { $first: '$offer.couponCode' } } },
        { $sort: { uses: -1 } },
        { $limit: 10 },
    ]);

    const abandoned = await CheckoutSession.countDocuments({ emailVerifiedAt: { $ne: null }, status: { $in: ['active', 'payment_pending'] }, lastActivityAt: { $gte: from, $lte: new Date(Math.min(to.getTime(), Date.now() - 3600 * 1000)) } });
    const emailStatus = await EmailMessage.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const recentOrders = await Order.find({}).sort({ createdAt: -1 }).limit(8).select('orderNumber email total currency status deliveryStatus createdAt').lean();
    const recentRefunds = await RefundRequest.find({}).sort({ updatedAt: -1 }).limit(6).populate('order', 'orderNumber').select('refundNumber status amount updatedAt order').lean();
    const campaigns = await EmailCampaign.find({ status: { $in: ['sent', 'sending'] } }).sort({ startedAt: -1 }).limit(5).select('name stats startedAt').lean();
    const notifications = await NotificationCampaign.find({ status: 'sent' }).sort({ sentAt: -1 }).limit(5).select('title stats sentAt').lean();

    const gross = sales?.gross || 0;
    const refunded = sales?.refunded || 0;
    const gatewayFees = fees?.fee || 0;
    return {
        range: { from, to },
        totals: {
            gross,
            refunded,
            net: gross - refunded,
            gatewayFees,
            estimatedNet: gross - refunded - gatewayFees,
            discounts: sales?.discounts || 0,
            tax: sales?.tax || 0,
            paidOrders: sales?.orders || 0,
            averageOrderValue: sales?.orders ? Math.round(gross / sales.orders) : 0,
            totalOrders: Object.values(counts).reduce((a, b) => a + b, 0),
            failedPayments,
            pendingPayments,
            abandonedCheckouts: abandoned,
        },
        orderStatus: counts,
        topProducts,
        salesByDay,
        couponUsage,
        emailStatus: Object.fromEntries(emailStatus.map((e) => [e._id, e.count])),
        recentOrders,
        recentRefunds,
        campaigns,
        notifications,
    };
};

export const reports = async ({ from, to }) => {
    const paidMatch = { status: { $in: PAID }, paidAt: { $gte: from, $lte: to } };
    const [salesByProduct, bySource, checkoutFunnel, automations, emailCampaigns, notificationCampaigns] = await Promise.all([
        Order.aggregate([
            { $match: paidMatch },
            { $unwind: '$items' },
            { $group: { _id: '$items.product', title: { $first: '$items.title' }, units: { $sum: 1 }, revenue: { $sum: '$items.total' }, discounts: { $sum: '$items.discount' } } },
            { $sort: { revenue: -1 } },
        ]),
        Order.aggregate([
            { $match: paidMatch },
            { $group: { _id: { source: { $ifNull: ['$attribution.source', '(direct)'] }, medium: { $ifNull: ['$attribution.medium', '(none)'] }, campaign: '$attribution.campaign' }, orders: { $sum: 1 }, revenue: { $sum: '$total' } } },
            { $sort: { revenue: -1 } },
            { $limit: 50 },
        ]),
        (async () => {
            const range = { createdAt: { $gte: from, $lte: to } };
            const [sessions, verified, ordersCreated, paid] = await Promise.all([
                CheckoutSession.countDocuments(range),
                CheckoutSession.countDocuments({ ...range, emailVerifiedAt: { $ne: null } }),
                Order.countDocuments(range),
                Order.countDocuments({ ...range, status: { $in: PAID } }),
            ]);
            const recovered = await CheckoutSession.countDocuments({ ...range, status: 'converted', remindersSent: { $gt: 0 } });
            const reminded = await CheckoutSession.countDocuments({ ...range, remindersSent: { $gt: 0 } });
            return { sessions, verified, ordersCreated, paid, conversionRate: sessions ? paid / sessions : 0, reminded, recovered, recoveryRate: reminded ? recovered / reminded : 0 };
        })(),
        Automation.find({}).select('name key trigger enabled stats lastRunAt').lean(),
        EmailCampaign.find({ createdAt: { $gte: from, $lte: to } }).select('name status stats startedAt').lean(),
        NotificationCampaign.find({ createdAt: { $gte: from, $lte: to } }).select('title status stats sentAt').lean(),
    ]);
    return { range: { from, to }, salesByProduct, bySource, checkoutFunnel, automations, emailCampaigns, notificationCampaigns };
};
