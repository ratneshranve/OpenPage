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
    const password = process.env.ADMIN_PASSWORD || arg('password') || (await prompt('Admin password: '));
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Invalid email');
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

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
