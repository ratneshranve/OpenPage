import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export const connectDB = async () => {
    await mongoose.connect(config.mongodbUri, {
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 20,
    });
    logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    mongoose.connection.on('error', (err) => logger.error(`MongoDB error: ${err.message}`));
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
};

export const disconnectDB = async () => {
    await mongoose.connection.close();
};
