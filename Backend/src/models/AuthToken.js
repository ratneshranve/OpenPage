import mongoose from 'mongoose';

/** Refresh sessions. Only the SHA-256 of the refresh token is stored. */
const refreshSessionSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        tokenHash: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
        revokedAt: Date,
        replacedBy: String,
        userAgent: String,
        ip: String,
        lastUsedAt: Date,
    },
    { timestamps: true }
);
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

/** Single-use tokens for email verification and password reset. */
const actionTokenSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        purpose: { type: String, enum: ['verify_email', 'reset_password'], required: true },
        tokenHash: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
        usedAt: Date,
    },
    { timestamps: true }
);
actionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 3600 });

export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
export const ActionToken = mongoose.model('ActionToken', actionTokenSchema);
