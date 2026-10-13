import { AuditLog } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { clientIp } from '../utils/helpers.js';

/** Records a sensitive administrative action. Never throws into the caller. */
export const audit = async (req, action, { targetType, targetId, details, outcome = 'success' } = {}) => {
    try {
        await AuditLog.create({
            actor: req?.user?._id,
            actorEmail: req?.user?.email,
            action,
            targetType,
            targetId: targetId ? String(targetId) : undefined,
            outcome,
            details,
            ip: req ? clientIp(req) : undefined,
            userAgent: req?.get?.('user-agent'),
        });
    } catch (err) {
        logger.error(`Audit log write failed for ${action}: ${err.message}`);
    }
};
