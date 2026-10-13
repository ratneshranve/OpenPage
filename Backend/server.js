import http from 'http';
import { config } from './src/config/env.js';
import { validateConfig } from './src/config/validateEnv.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { logger } from './src/utils/logger.js';
import { startScheduler, stopScheduler } from './src/jobs/scheduler.js';
import { ensureSeedData } from './src/scripts/seedData.js';

let server = null;

const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    stopScheduler();
    if (!server) process.exit(0);
    server.close(async () => {
        await disconnectDB().catch(() => {});
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
};

const start = async () => {
    try {
        validateConfig();
    } catch (err) {
        console.error(`\n${err.message}\n`);
        process.exit(1);
    }
    try {
        const { default: app } = await import('./src/app.js');
        await connectDB();
        await ensureSeedData();
        startScheduler();
        server = http.createServer(app);
        server.listen(config.port, () => logger.info(`OpenPage API listening on port ${config.port} (${config.nodeEnv})`));
        server.on('error', (err) => {
            logger.error(err.code === 'EADDRINUSE' ? `Port ${config.port} is already in use.` : `Server error: ${err.message}`);
            process.exit(1);
        });
    } catch (err) {
        logger.error(`Startup failed: ${err.stack || err.message}`);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error(`Unhandled rejection: ${err?.stack || err}`));

start();
