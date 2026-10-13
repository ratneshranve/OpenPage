import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { randomToken } from '../utils/helpers.js';

/**
 * Providers: local disk (development), any S3-compatible private bucket, or Cloudinary.
 * Two kinds of objects:
 *  - private/...  eBook files and samples. Never publicly addressable; served only via
 *                 entitlement-checked download tokens.
 *  - public/...   cover and preview images.
 */
const { storage } = config;
const localRoot = path.resolve(process.cwd(), storage.localRoot);

let s3 = null;
const getS3 = () => {
    if (!s3) {
        s3 = new S3Client({
            region: storage.region || 'auto',
            endpoint: storage.endpoint || undefined,
            forcePathStyle: Boolean(storage.endpoint),
            credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
        });
    }
    return s3;
};

let cloudinaryReady = false;
const getCloudinary = () => {
    if (!cloudinaryReady) {
        cloudinary.config({ cloud_name: storage.cloudinary.cloudName, api_key: storage.cloudinary.apiKey, api_secret: storage.cloudinary.apiSecret, secure: true });
        cloudinaryReady = true;
    }
    return cloudinary;
};

/**
 * Cloudinary layout: eBooks are "raw" files with type "authenticated", so they can only be
 * fetched through a short-lived signed download URL. Images are normal public uploads.
 */
const cloudinaryTarget = (key) => {
    const isPrivate = key.startsWith('private/');
    const publicId = `${storage.cloudinary.folder}/${isPrivate ? key : key.replace(/\.[a-z0-9]+$/i, '')}`;
    return isPrivate ? { public_id: publicId, resource_type: 'raw', type: 'authenticated' } : { public_id: publicId, resource_type: 'image', type: 'upload' };
};

const cloudinaryUpload = (buffer, key) =>
    new Promise((resolve, reject) => {
        const stream = getCloudinary().uploader.upload_stream({ ...cloudinaryTarget(key), overwrite: false, unique_filename: false }, (err, result) =>
            err ? reject(new ApiError(502, `File storage upload failed: ${err.message}`)) : resolve(result)
        );
        stream.end(buffer);
    });

export const EBOOK_TYPES = {
    pdf: 'application/pdf',
    epub: 'application/epub+zip',
    zip: 'application/zip',
};
export const IMAGE_TYPES = {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
};

/** Detects the real type from file bytes, ignoring the client-supplied name and MIME type. */
export const sniff = async (buffer, allowed) => {
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !allowed[detected.ext]) {
        throw ApiError.badRequest(`Unsupported file content. Allowed types: ${Object.keys(allowed).join(', ').toUpperCase()}.`);
    }
    return { ext: detected.ext, mime: allowed[detected.ext] };
};

const safeKey = (key) => {
    const normalized = path.posix.normalize(key).replace(/^\/+/, '');
    if (normalized.startsWith('..') || normalized.includes('/../')) throw ApiError.badRequest('Invalid storage key');
    return normalized;
};

const putObject = async (key, buffer, contentType) => {
    key = safeKey(key);
    if (storage.provider === 'cloudinary') {
        const result = await cloudinaryUpload(buffer, key);
        return { key, url: result.secure_url };
    }
    if (storage.provider === 's3') {
        await getS3().send(new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: buffer, ContentType: contentType }));
    } else {
        const target = path.join(localRoot, key);
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.writeFile(target, buffer);
    }
    return { key };
};

export const deleteObject = async (key) => {
    if (!key) return;
    key = safeKey(key);
    if (storage.provider === 'cloudinary') {
        const { public_id: publicId, ...opts } = cloudinaryTarget(key);
        await getCloudinary().uploader.destroy(publicId, { ...opts, invalidate: true });
    } else if (storage.provider === 's3') {
        await getS3().send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
    } else {
        await fsp.rm(path.join(localRoot, key), { force: true });
    }
};

export const savePrivateFile = async (buffer, { productId, version }) => {
    const type = await sniff(buffer, EBOOK_TYPES);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const key = `private/ebooks/${productId}/${String(version).replace(/[^a-zA-Z0-9._-]/g, '_')}-${randomToken(8)}.${type.ext}`;
    await putObject(key, buffer, type.mime);
    return { key, mimeType: type.mime, format: type.ext.toUpperCase(), size: buffer.length, sha256 };
};

export const savePublicImage = async (buffer, folder = 'images') => {
    const type = await sniff(buffer, IMAGE_TYPES);
    const key = `public/${folder}/${Date.now()}-${randomToken(8)}.${type.ext}`;
    const stored = await putObject(key, buffer, type.mime);
    return { key, url: stored.url || publicUrl(key) };
};

/** Public image URL. Only keys under public/ are ever turned into URLs. */
export const publicUrl = (key) => {
    if (!key || !key.startsWith('public/')) return '';
    if (storage.provider === 's3' && storage.publicAssetsBaseUrl) return `${storage.publicAssetsBaseUrl}/${key}`;
    return `${config.apiBaseUrl}/media/${key.slice('public/'.length)}`;
};

/** Express handler for /media/* when images are not on a CDN. Refuses anything outside public/. */
export const serveMedia = async (req, res, next) => {
    try {
        const rel = safeKey(`public/${req.params[0] || ''}`);
        if (!rel.startsWith('public/')) return res.status(404).end();
        if (storage.provider === 's3') {
            const url = await getSignedUrl(getS3(), new GetObjectCommand({ Bucket: storage.bucket, Key: rel }), { expiresIn: 3600 });
            res.set('Cache-Control', 'public, max-age=3000');
            return res.redirect(302, url);
        }
        const file = path.join(localRoot, rel);
        if (!file.startsWith(path.join(localRoot, 'public'))) return res.status(404).end();
        res.sendFile(file, { maxAge: config.isProduction ? '30d' : 0, dotfiles: 'deny' }, (err) => {
            if (err && !res.headersSent) res.status(404).end();
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Streams a private file to the response, or redirects to a 60-second presigned URL
 * for object storage. The permanent storage location is never exposed.
 */
export const sendPrivateFile = async (res, key, downloadName, mimeType = 'application/octet-stream') => {
    key = safeKey(key);
    if (!key.startsWith('private/')) throw ApiError.forbidden();
    const disposition = `attachment; filename="${downloadName.replace(/[^\w.\- ]/g, '_')}"`;
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    if (storage.provider === 'cloudinary') {
        // Fetch through a 60-second signed URL and stream it, so the customer never sees a
        // storage URL and the file keeps our download name.
        const { public_id: publicId, ...opts } = cloudinaryTarget(key);
        const url = getCloudinary().utils.private_download_url(publicId, '', { ...opts, expires_at: Math.floor(Date.now() / 1000) + 60 });
        const upstream = await fetch(url);
        if (!upstream.ok || !upstream.body) throw ApiError.notFound('The file for this product is currently unavailable. Please contact support.');
        res.set('Content-Type', mimeType);
        res.set('Content-Disposition', disposition);
        if (upstream.headers.get('content-length')) res.set('Content-Length', upstream.headers.get('content-length'));
        return new Promise((resolve, reject) => {
            const body = Readable.fromWeb(upstream.body);
            body.on('error', reject);
            body.on('end', resolve);
            body.pipe(res);
        });
    }
    if (storage.provider === 's3') {
        const url = await getSignedUrl(
            getS3(),
            new GetObjectCommand({ Bucket: storage.bucket, Key: key, ResponseContentDisposition: disposition, ResponseContentType: mimeType }),
            { expiresIn: 60 }
        );
        return res.redirect(302, url);
    }
    const file = path.join(localRoot, key);
    if (!fs.existsSync(file)) throw ApiError.notFound('The file for this product is currently unavailable. Please contact support.');
    res.set('Content-Type', mimeType);
    res.set('Content-Disposition', disposition);
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(file);
        stream.on('error', reject);
        stream.on('end', resolve);
        stream.pipe(res);
    });
};

export const storageStatus = async () => {
    const status = { provider: storage.provider, bucket: storage.bucket || null, publicAssetsBaseUrl: storage.publicAssetsBaseUrl || null, ok: false, error: null };
    try {
        if (storage.provider === 'cloudinary') {
            await getCloudinary().api.ping();
            status.bucket = storage.cloudinary.cloudName;
        } else if (storage.provider === 's3') {
            await getS3().send(new HeadBucketCommand({ Bucket: storage.bucket }));
        } else {
            await fsp.mkdir(path.join(localRoot, 'private'), { recursive: true });
            await fsp.access(localRoot, fs.constants.W_OK);
        }
        status.ok = true;
    } catch (err) {
        status.error = err.message;
    }
    return status;
};
