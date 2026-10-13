/**
 * Creates or promotes an administrator. Admin access can only be granted from the server,
 * never through public registration.
 *
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 *
 * The password is read from the ADMIN_PASSWORD environment variable, or prompted for.
 */
import readline from 'readline';
import { connectDB, disconnectDB } from '../config/db.js';
import { config } from '../config/env.js';
import { User } from '../models/index.js';
import { hashPassword, revokeAllSessions } from '../services/auth.service.js';
import { normalizeEmail } from '../utils/helpers.js';

const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
};

const prompt = (q) =>
    new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(q, (answer) => {
            rl.close();
            resolve(answer);
        });
    });

const main = async () => {
    if (!config.mongodbUri) throw new Error('MONGODB_URI is not set');
    const email = normalizeEmail(arg('email') || (await prompt('Admin email: ')));
    const name = arg('name') || 'Administrator';
    const password = process.env.ADMIN_PASSWORD || (await prompt('Admin password (min 12 chars, letters and numbers): '));
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Invalid email');
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error('Password must be at least 12 characters and include letters and numbers');

    await connectDB();
    const user = (await User.findOne({ email })) || new User({ email });
    user.name = user.name || name;
    user.role = 'admin';
    user.status = 'active';
    user.emailVerified = true;
    user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    user.passwordHash = await hashPassword(password);
    await user.save();
    await revokeAllSessions(user._id);
    console.log(`Administrator ready: ${email}`);
    await disconnectDB();
};

main().catch(async (err) => {
    console.error(`create-admin failed: ${err.message}`);
    await disconnectDB().catch(() => {});
    process.exit(1);
});
