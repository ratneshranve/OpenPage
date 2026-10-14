import { config } from '../config/env.js';
import { processEmailQueue } from '../services/email.service.js';
import { runAutomations, runScheduledCampaigns } from '../services/automation.service.js';
import { runScheduledNotifications } from '../services/notification.service.js';
import { processWebhookEvent } from '../services/webhook.service.js';
import { registerJobHandler, processJobs } from './queue.js';
import { Order } from '../models/index.js';
import { reconcileOrder } from '../services/fulfillment.service.js';
import { logger } from '../utils/logger.js';

const timers = [];

const every = (ms, name, fn) => {
    const run = async () => {
        try {
            await fn();
        } catch (err) {
            logger.error(`[scheduler] ${name} failed: ${err.message}`);
        }
    };
    timers.push(setInterval(run, ms));
    setTimeout(run, 2000);
};

/**
 * Safety net for payments whose webhook never arrived and whose customer closed the browser:
 * asks Razorpay about orders that have been pending for a while.
 */
const reconcileStalePayments = async () => {
    const stale = await Order.find({
        status: 'pending',
        'razorpay.orderId': { $exists: true },
        createdAt: { $lte: new Date(Date.now() - 10 * 60 * 1000), $gte: new Date(Date.now() - 48 * 3600 * 1000) },
    })
        .limit(25)
        .sort({ createdAt: 1 });
    for (const order of stale) {
        try {
            await reconcileOrder(order, 'reconciliation');
        } catch (err) {
            logger.warn(`Stale reconcile ${order.orderNumber}: ${err.message}`);
        }
    }
    // Give up on very old unpaid orders so they do not linger as pending.
    await Order.updateMany({ status: 'pending', paymentStatus: { $in: ['created', 'attempted'] }, createdAt: { $lt: new Date(Date.now() - 48 * 3600 * 1000) } }, { $set: { status: 'cancelled', failureReason: 'Payment not completed' } });
};

export const startScheduler = () => {
    registerJobHandler('webhook.razorpay', processWebhookEvent);
    if (!config.jobs.workersEnabled) {
        logger.warn('JOB_WORKERS_ENABLED=false: background workers are not running on this instance.');
        return;
    }
    every(3000, 'jobs', () => processJobs());
    every(5000, 'email-queue', () => processEmailQueue());
    every(60 * 1000, 'scheduled-campaigns', async () => {
        await runScheduledCampaigns();
        await runScheduledNotifications();
    });
    every(5 * 60 * 1000, 'automations', () => runAutomations());
    every(5 * 60 * 1000, 'payment-reconcile', reconcileStalePayments);
    // Ping external health endpoint every 10 minutes to prevent Render free tier from idling out
    every(10 * 60 * 1000, 'keep-alive', async () => {
        if (!config.apiBaseUrl || config.apiBaseUrl.includes('localhost') || config.apiBaseUrl.includes('127.0.0.1')) return;
        try {
            const res = await fetch(`${config.apiBaseUrl}/health`, {
                headers: { 'User-Agent': 'OpenPage-KeepAlive/1.0' },
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) logger.warn(`[keep-alive] Self-ping returned status ${res.status}`);
        } catch (err) {
            logger.warn(`[keep-alive] Self-ping failed: ${err.message}`);
        }
    });
    logger.info('Background workers started (jobs, email queue, automations, campaigns, reconciliation, keep-alive)');
};

export const stopScheduler = () => timers.forEach(clearInterval);
