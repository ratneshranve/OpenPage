import multer from 'multer';
import { config } from '../config/env.js';

// Files are held in memory, content-sniffed, then written to storage by the storage service.
export const ebookUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.storage.maxEbookUploadMb * 1024 * 1024, files: 1 },
});

export const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.storage.maxImageUploadMb * 1024 * 1024, files: 10 },
});
