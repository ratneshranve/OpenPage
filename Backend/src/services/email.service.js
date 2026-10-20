import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { EmailMessage, EmailTemplate, Suppression } from '../models/index.js';
import { DEFAULT_TEMPLATES } from '../emails/defaultTemplates.js';
import { render, htmlToText } from '../emails/renderer.js';
import { wrapEmail } from '../emails/layout.js';
import { getSettings } from './settings.service.js';
import { logger } from '../utils/logger.js';
import { hmac, normalizeEmail, safeEqual } from '../utils/helpers.js';
import { buildEmailContext } from './emailContext.service.js';

let transporter = null;
const smtpConfigured = () => Boolean(config.brevoApiKey || (config.smtp.host && config.smtp.fromEmail));

const getTransport = () => {
    if (transporter) return transporter;
    if (!smtpConfigured()) {
        // Development fallback: render messages to the log instead of sending.
        transporter = nodemailer.createTransport({ jsonTransport: true });
        return transporter;
    }
    transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
        pool: false,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });
    return transporter;
};

export const verifySmtp = async () => {
    if (config.brevoApiKey) {
        try {
            const res = await fetch('https://api.brevo.com/v3/account', {
                headers: { 'api-key': config.brevoApiKey, accept: 'application/json' },
            });
            if (res.ok) {
                const acc = await res.json();
                return { configured: true, ok: true, provider: 'brevo', email: acc.email, companyName: acc.companyName };
            }
            return { configured: true, ok: false, provider: 'brevo', error: `Brevo API returned status ${res.status}` };
        } catch (err) {
            return { configured: true, ok: false, provider: 'brevo', error: err.message };
        }
    }
    if (!smtpConfigured()) return { configured: false, ok: false, error: 'BREVO_API_KEY or SMTP_HOST / SMTP_FROM_EMAIL not set' };
    try {
        await getTransport().verify();
        return { configured: true, ok: true, host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, from: config.smtp.fromEmail, user: config.smtp.user ? `${config.smtp.user.slice(0, 2)}***` : null };
    } catch (err) {
        return { configured: true, ok: false, host: config.smtp.host, port: config.smtp.port, error: err.message };
    }
};

// ---- Unsubscribe links (stateless, signed) ----
export const unsubscribeUrl = (email) => {
    const e = Buffer.from(normalizeEmail(email)).toString('base64url');
    return `${config.frontendUrl}/unsubscribe?e=${e}&s=${hmac(config.sessionSecret, `unsub:${normalizeEmail(email)}`).slice(0, 32)}`;
};
export const verifyUnsubscribe = (e, s) => {
    try {
        const email = Buffer.from(String(e), 'base64url').toString('utf8');
        const expected = hmac(config.sessionSecret, `unsub:${normalizeEmail(email)}`).slice(0, 32);
        return safeEqual(expected, String(s)) ? normalizeEmail(email) : null;
    } catch {
        return null;
    }
};

export const isSuppressed = async (email) => Boolean(await Suppression.exists({ email: normalizeEmail(email) }));

// ---- Templates ----
export const getTemplate = async (key) => {
    const doc = await EmailTemplate.findOne({ key }).lean();
    if (doc) return doc;
    return DEFAULT_TEMPLATES.find((t) => t.key === key) || null;
};

export const ensureDefaultTemplates = async () => {
    for (const tpl of DEFAULT_TEMPLATES) {
        await EmailTemplate.updateOne({ key: tpl.key }, { $setOnInsert: { ...tpl, isSystem: true } }, { upsert: true });
    }
};

const baseContext = async (to) => {
    const general = await getSettings('general');
    return {
        siteName: general.siteName,
        siteUrl: config.frontendUrl,
        supportEmail: general.supportEmail || config.smtp.replyTo || config.smtp.fromEmail,
        logoUrl: general.logoUrl,
        year: new Date().getFullYear(),
        recipientEmail: to,
    };
};

/** Renders subject/html/text for a template + data without sending. */
export const renderEmail = async ({ template, to, data = {}, category }) => {
    const base = await baseContext(to);
    const ctx = { ...base, ...data };
    const isMarketing = (category || template.category) === 'marketing';
    const body = render(template.html, ctx);
    const html = wrapEmail({
        body,
        preheader: render(template.preheader || '', ctx),
        siteName: base.siteName,
        siteUrl: base.siteUrl,
        supportEmail: base.supportEmail,
        logoUrl: base.logoUrl,
        year: base.year,
        unsubscribeUrl: isMarketing ? unsubscribeUrl(to) : null,
    });
    const subject = render(template.subject, ctx).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    return { subject, html, text: htmlToText(html), isMarketing };
};

const transmitViaBrevo = async ({ to, subject, html, text, headers }) => {
    const fromEmail = config.smtp.fromEmail || 'ratneshranve@gmail.com';
    const fromName = config.smtp.fromName || 'OpenPage';

    const payload = {
        sender: { name: fromName, email: fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text || undefined,
    };
    if (config.smtp.replyTo) {
        payload.replyTo = { email: config.smtp.replyTo };
    }
    if (headers && Object.keys(headers).length) {
        payload.headers = headers;
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'api-key': config.brevoApiKey,
            'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const errorMsg = data.message || `Brevo API error (${res.status})`;
        throw new Error(errorMsg);
    }
    return { messageId: data.messageId || `brevo-${Date.now()}`, response: JSON.stringify(data) };
};

const transmit = async ({ to, subject, html, text, isMarketing }) => {
    const headers = {};
    if (isMarketing) {
        const url = unsubscribeUrl(to);
        headers['List-Unsubscribe'] = `<${url}>`;
        headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    if (config.brevoApiKey) {
        return transmitViaBrevo({ to, subject, html, text, headers });
    }

    const info = await getTransport().sendMail({
        from: { name: config.smtp.fromName, address: config.smtp.fromEmail || 'no-reply@localhost' },
        replyTo: config.smtp.replyTo || undefined,
        to,
        subject,
        html,
        text,
        headers,
    });
    if (!smtpConfigured()) logger.info(`[email:dev] SMTP not configured. Would send "${subject}" to ${to}`);
    return info;
};

/**
 * Sends immediately (used for OTP codes, which must never be persisted in plaintext).
 * A log record is still written, without the sensitive data.
 */
export const sendNow = async ({ to, templateKey, data = {}, type, checkoutSession, logData = {} }) => {
    const template = await getTemplate(templateKey);
    if (!template) throw new Error(`Email template not found: ${templateKey}`);
    const log = await EmailMessage.create({
        to,
        templateKey,
        category: template.category,
        type: type || templateKey,
        status: 'sending',
        attempts: 1,
        maxAttempts: 1,
        sensitive: true,
        data: logData,
        checkoutSession,
    });
    try {
        const rendered = await renderEmail({ template, to, data });
        const info = await transmit({ to, ...rendered });
        await EmailMessage.updateOne(
            { _id: log._id },
            {
                $set: {
                    status: 'sent',
                    sentAt: new Date(),
                    subject: rendered.subject.replace(/\b\d{6}\b/g, '••••••'),
                    providerMessageId: info.messageId,
                    providerResponse: info.response?.slice?.(0, 300),
                    ...(templateKey === 'otp_verification' ? {} : { bodyHtml: rendered.html, bodyText: rendered.text }),
                },
            }
        );
        return { ok: true };
    } catch (err) {
        await EmailMessage.updateOne({ _id: log._id }, { $set: { status: 'failed', lastError: err.message }, $push: { errors: { at: new Date(), message: err.message } } });
        logger.error(`Immediate email (${templateKey}) to ${to} failed: ${err.message}`);
        return { ok: false, error: err.message };
    }
};

/**
 * Queues an email durably. `dedupeKey` makes the call idempotent: queuing the same
 * logical email twice (e.g. from a duplicate webhook) returns the existing record.
 */
export const queueEmail = async ({ to, templateKey, data = {}, type, dedupeKey, order, user, campaign, automation, checkoutSession, sendAt, subject, categoryOverride }) => {
    to = normalizeEmail(to);
    const template = await getTemplate(templateKey);
    if (!template) throw new Error(`Email template not found: ${templateKey}`);
    const category = categoryOverride || template.category;
    if (category === 'marketing' && (await isSuppressed(to))) {
        return EmailMessage.create({ to, templateKey, category, type: type || templateKey, status: 'suppressed', dedupeKey, order, campaign, automation, checkoutSession, user });
    }
    try {
        return await EmailMessage.create({
            to,
            user,
            templateKey,
            category,
            type: type || templateKey,
            subject,
            data,
            dedupeKey,
            order,
            campaign,
            automation,
            checkoutSession,
            maxAttempts: config.jobs.emailRetryLimit,
            nextAttemptAt: sendAt || new Date(),
        });
    } catch (err) {
        if (err.code === 11000 && dedupeKey) return EmailMessage.findOne({ dedupeKey });
        throw err;
    }
};

const backoffMs = (attempt) => config.jobs.emailRetryDelaySeconds * 1000 * 2 ** Math.max(0, attempt - 1);

const deliver = async (msg) => {
    const template = await getTemplate(msg.templateKey);
    if (!template) throw Object.assign(new Error(`Template ${msg.templateKey} missing`), { permanent: true });
    if (msg.category === 'marketing' && (await isSuppressed(msg.to))) return { suppressed: true };

    // Context builders create short-lived secrets (download links) at send time,
    // so nothing sensitive is stored in the queue.
    const dynamic = await buildEmailContext(msg);
    if (dynamic?.skip) return { skipped: dynamic.skip };
    const { __template, ...dynamicData } = dynamic || {};
    const data = { ...(msg.data || {}), ...dynamicData };
    // Clone so per-message overrides never leak into the shared default template objects.
    const tpl = { ...template, ...(msg.subject ? { subject: msg.subject } : {}), ...(__template || {}) };
    const rendered = await renderEmail({ template: tpl, to: msg.to, data, category: msg.category });
    const info = await transmit({ to: msg.to, ...rendered });
    return { info, subject: rendered.subject, html: rendered.html, text: rendered.text };
};

let workerBusy = false;
/** Claims and sends due messages. Safe to run on several instances: claiming is atomic. */
export const processEmailQueue = async (batch = 20) => {
    if (workerBusy) return 0;
    workerBusy = true;
    let processed = 0;
    try {
        // Recover messages stuck in "sending" (e.g. process crashed mid-send).
        await EmailMessage.updateMany({ status: 'sending', lockedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) }, sensitive: { $ne: true } }, { $set: { status: 'queued' } });
        for (let i = 0; i < batch; i += 1) {
            const msg = await EmailMessage.findOneAndUpdate(
                { status: 'queued', nextAttemptAt: { $lte: new Date() } },
                { $set: { status: 'sending', lockedAt: new Date() }, $inc: { attempts: 1 } },
                { new: true, sort: { nextAttemptAt: 1 } }
            ).select('+data');
            if (!msg) break;
            processed += 1;
            try {
                const result = await deliver(msg);
                if (result.suppressed) {
                    await EmailMessage.updateOne({ _id: msg._id }, { $set: { status: 'suppressed' }, $unset: { data: 1 } });
                } else if (result.skipped) {
                    await EmailMessage.updateOne({ _id: msg._id }, { $set: { status: 'cancelled', lastError: `Skipped: ${result.skipped}` } });
                } else {
                    await EmailMessage.updateOne(
                        { _id: msg._id },
                        {
                            $set: {
                                status: 'sent',
                                sentAt: new Date(),
                                subject: result.subject,
                                providerMessageId: result.info?.messageId,
                                providerResponse: String(result.info?.response || '').slice(0, 300),
                                ...(msg.sensitive ? {} : { bodyHtml: result.html, bodyText: result.text }),
                            },
                        }
                    );
                }
                await afterSend(msg, result.skipped || result.suppressed ? null : 'sent');
            } catch (err) {
                const permanent = err.permanent || err.responseCode >= 550;
                const giveUp = permanent || msg.attempts >= msg.maxAttempts;
                await EmailMessage.updateOne(
                    { _id: msg._id },
                    {
                        $set: { status: giveUp ? 'failed' : 'queued', lastError: err.message, nextAttemptAt: new Date(Date.now() + backoffMs(msg.attempts)) },
                        $push: { errors: { $each: [{ at: new Date(), message: err.message }], $slice: -10 } },
                    }
                );
                logger.warn(`Email ${msg._id} (${msg.type}) attempt ${msg.attempts} failed: ${err.message}${giveUp ? ' — giving up' : ''}`);
                if (giveUp) await afterSend(msg, 'failed');
            }
        }
    } finally {
        workerBusy = false;
    }
    return processed;
};

// Keeps order delivery status and campaign/automation counters in step with the queue.
const afterSend = async (msg, outcome) => {
    if (!outcome) return;
    const { Order, Automation, EmailCampaign } = await import('../models/index.js');
    if (msg.order && ['order_delivery', 'ebook_delivery'].includes(msg.type)) {
        if (outcome === 'sent') await Order.updateOne({ _id: msg.order }, { $set: { deliveryStatus: 'sent' } });
        else await Order.updateOne({ _id: msg.order, deliveryStatus: { $ne: 'sent' } }, { $set: { deliveryStatus: 'failed' } });
    }
    if (msg.automation) await Automation.updateOne({ _id: msg.automation }, { $inc: { [`stats.${outcome}`]: 1 } });
    if (msg.campaign) await EmailCampaign.updateOne({ _id: msg.campaign }, { $inc: { [`stats.${outcome}`]: 1 } });
};

export const isSmtpConfigured = smtpConfigured;
