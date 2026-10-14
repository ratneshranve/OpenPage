import mongoose from 'mongoose';

const consentSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ['marketing_email', 'notifications', 'analytics', 'advertising', 'terms'], required: true },
        granted: { type: Boolean, required: true },
        source: { type: String, default: 'account' },
        policyVersion: String,
        at: { type: Date, default: Date.now },
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        name: { type: String, trim: true, maxlength: 120 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        phoneNumber: { type: String, trim: true, maxlength: 20 },
        emailVerified: { type: Boolean, default: false },
        emailVerifiedAt: Date,
        passwordHash: { type: String, select: false },
        role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
        status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
        suspendedReason: String,
        // Incremented to invalidate every access token issued before the change.
        tokenVersion: { type: Number, default: 0 },
        marketingEmails: { type: Boolean, default: false },
        notificationsEnabled: { type: Boolean, default: false },
        consents: [consentSchema],
        lastLoginAt: Date,
        failedLoginCount: { type: Number, default: 0 },
        lockedUntil: Date,
        passwordChangedAt: Date,
    },
    { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        phoneNumber: this.phoneNumber,
        emailVerified: this.emailVerified,
        role: this.role,
        status: this.status,
        marketingEmails: this.marketingEmails,
        notificationsEnabled: this.notificationsEnabled,
        createdAt: this.createdAt,
    };
};

export const User = mongoose.model('User', userSchema);
