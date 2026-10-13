import { config } from '../config/env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[config.logLevel] ?? LEVELS.info;

// Strip values that look like secrets/OTPs/tokens before writing a log line.
const redact = (msg) =>
    String(msg)
        .replace(/(password|pass|secret|token|otp|signature)(["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1$2[redacted]');

const write = (level, msg) => {
    if (LEVELS[level] > current) return;
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${redact(msg)}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
};

export const logger = {
    error: (msg) => write('error', msg),
    warn: (msg) => write('warn', msg),
    info: (msg) => write('info', msg),
    debug: (msg) => write('debug', msg),
};
