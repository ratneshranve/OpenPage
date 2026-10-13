import { Job } from '../models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Durable MongoDB-backed job queue. Jobs survive restarts; claiming is atomic so several
 * API instances can run workers safely. Handlers must be idempotent.
 */
const handlers = new Map();

export const registerJobHandler = (type, handler) => handlers.set(type, handler);

export const enqueueJob = async (type, payload, { dedupeKey, runAt, maxAttempts = 6 } = {}) => {
    try {
        return await Job.create({ type, payload, dedupeKey, runAt: runAt || new Date(), maxAttempts });
    } catch (err) {
        if (err.code === 11000 && dedupeKey) return Job.findOne({ dedupeKey });
        throw err;
    }
};

const backoffMs = (attempt) => Math.min(30 * 60 * 1000, 15000 * 2 ** (attempt - 1));

const runJob = async (job) => {
    const handler = handlers.get(job.type);
    if (!handler) {
        await Job.updateOne({ _id: job._id }, { $set: { status: 'failed', lastError: `No handler for ${job.type}`, finishedAt: new Date() } });
        return;
    }
    try {
        await handler(job.payload, job);
        await Job.updateOne({ _id: job._id }, { $set: { status: 'done', finishedAt: new Date(), lastError: null } });
    } catch (err) {
        const giveUp = job.attempts >= job.maxAttempts;
        await Job.updateOne(
            { _id: job._id },
            { $set: { status: giveUp ? 'failed' : 'queued', lastError: err.message, runAt: new Date(Date.now() + backoffMs(job.attempts)), ...(giveUp ? { finishedAt: new Date() } : {}) } }
        );
        logger.warn(`Job ${job.type} ${job._id} attempt ${job.attempts} failed: ${err.message}${giveUp ? ' — giving up' : ''}`);
    }
};

const claim = (filter = {}) =>
    Job.findOneAndUpdate(
        { status: 'queued', runAt: { $lte: new Date() }, ...filter },
        { $set: { status: 'running', lockedAt: new Date() }, $inc: { attempts: 1 } },
        { new: true, sort: { runAt: 1 } }
    );

/** Runs one specific job now (used to process webhooks immediately after acknowledging them). */
export const runJobNow = async (jobId) => {
    const job = await claim({ _id: jobId });
    if (job) await runJob(job);
};

let busy = false;
export const processJobs = async (batch = 10) => {
    if (busy) return;
    busy = true;
    try {
        await Job.updateMany({ status: 'running', lockedAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }, { $set: { status: 'queued' } });
        for (let i = 0; i < batch; i += 1) {
            const job = await claim();
            if (!job) break;
            await runJob(job);
        }
    } finally {
        busy = false;
    }
};
