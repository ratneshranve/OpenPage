import { Product, Category, Review, Order, Entitlement, AuditLog } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, paginated, parsePagination, slugify } from '../../utils/helpers.js';
import { audit } from '../../services/audit.service.js';
import { savePrivateFile, savePublicImage, sniff, EBOOK_TYPES } from '../../services/storage.service.js';

const ensureUniqueSlug = async (Model, base, excludeId) => {
    const root = slugify(base) || 'item';
    let slug = root;
    for (let i = 2; await Model.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); i += 1) slug = `${root}-${i}`;
    return slug;
};

// ---- Products ----
export const listProducts = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.q) {
        const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 100)), 'i');
        filter.$or = [{ title: rx }, { slug: rx }, { author: rx }, { tags: rx }];
    }
    const [items, total] = await Promise.all([
        Product.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('category', 'name').select('-description -fileHistory -faqs -tableOfContents').lean(),
        Product.countDocuments(filter),
    ]);
    ok(res, paginated(items, total, { page, limit }));
});

export const getProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id).populate('category', 'name slug').lean();
    if (!product) throw ApiError.notFound('Product not found');
    const [sales] = await Order.aggregate([
        { $match: { status: { $in: ['paid', 'partially_refunded', 'refunded'] }, 'items.product': product._id } },
        { $unwind: '$items' },
        { $match: { 'items.product': product._id } },
        { $group: { _id: null, units: { $sum: 1 }, revenue: { $sum: '$items.total' } } },
    ]);
    const history = await AuditLog.find({ targetType: 'Product', targetId: String(product._id) }).sort({ createdAt: -1 }).limit(50).lean();
    const entitlementVersions = await Entitlement.aggregate([{ $match: { product: product._id } }, { $group: { _id: '$fileVersion', count: { $sum: 1 } } }]);
    ok(res, { product, sales: sales || { units: 0, revenue: 0 }, history, entitlementVersions });
});

export const createProduct = asyncHandler(async (req, res) => {
    const data = req.body;
    data.slug = await ensureUniqueSlug(Product, data.slug || data.title);
    if (data.status === 'published') throw ApiError.badRequest('Save the product as a draft and upload the eBook file before publishing.');
    const product = await Product.create(data);
    await audit(req, 'product.create', { targetType: 'Product', targetId: product._id, details: { title: product.title } });
    created(res, product, 'Product saved successfully.');
});

export const updateProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    const data = { ...req.body };
    // Status changes go through the dedicated endpoint so publishing rules are enforced.
    delete data.status;
    if (data.slug && data.slug !== product.slug) data.slug = await ensureUniqueSlug(Product, data.slug, product._id);
    const before = { price: product.price, compareAtPrice: product.compareAtPrice, slug: product.slug, title: product.title };
    product.set(data);
    if (data.compareAtPrice === null) product.compareAtPrice = undefined;
    await product.save();
    const changed = Object.keys(data);
    await audit(req, 'product.update', { targetType: 'Product', targetId: product._id, details: { changed, before } });
    ok(res, product, 'Product saved successfully.');
});

export const setProductStatus = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    const { status } = req.body;
    if (status === 'published') {
        const missing = [];
        if (!product.file?.key) missing.push('eBook file');
        if (!product.coverImage?.url) missing.push('cover image');
        if (!product.shortDescription) missing.push('short description');
        if (!product.price || product.price < 100) missing.push('price of at least ₹1');
        if (missing.length) throw ApiError.badRequest(`Cannot publish yet. Missing: ${missing.join(', ')}.`);
        if (!product.publishedAt) product.publishedAt = new Date();
    }
    const from = product.status;
    product.status = status;
    await product.save();
    // Unpublishing or archiving blocks new purchases only; existing entitlements are untouched.
    await audit(req, `product.${status}`, { targetType: 'Product', targetId: product._id, details: { from, to: status } });
    ok(res, product, `Product ${status}.`);
});

export const uploadEbook = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    if (!req.file) throw ApiError.badRequest('Choose a file to upload.');
    const version = String(req.body.version || '').trim();
    if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$/.test(version)) throw ApiError.badRequest('Enter a version label such as 1.0 or 2024.1');
    if (product.fileHistory.some((f) => f.version === version) || product.file?.version === version) throw ApiError.conflict(`Version ${version} already exists. Use a new version label.`);

    const stored = await savePrivateFile(req.file.buffer, { productId: product._id, version });
    const fileDoc = { ...stored, originalName: req.file.originalname?.slice(0, 200), version, notes: req.body.notes?.slice(0, 500), uploadedAt: new Date(), uploadedBy: req.user._id };
    if (product.file?.key) product.fileHistory.push(product.file);
    product.file = fileDoc;
    product.format = stored.format;
    await product.save();

    // Existing purchases keep the version they bought unless the admin explicitly chooses otherwise.
    let updatedEntitlements = 0;
    if (req.body.applyToExistingPurchases === 'true') {
        const r = await Entitlement.updateMany(
            { product: product._id, status: 'active' },
            { $set: { fileKey: stored.key, fileVersion: version, fileName: `${product.slug}-v${version}.${stored.key.split('.').pop()}` } }
        );
        updatedEntitlements = r.modifiedCount;
    }
    await audit(req, 'product.file_upload', { targetType: 'Product', targetId: product._id, details: { version, size: stored.size, format: stored.format, sha256: stored.sha256, appliedToExistingPurchases: updatedEntitlements } });
    ok(res, { file: { ...fileDoc, key: undefined }, updatedEntitlements }, `Version ${version} uploaded.`);
});

export const uploadSample = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    if (!req.file) throw ApiError.badRequest('Choose a PDF sample to upload.');
    const type = await sniff(req.file.buffer, { pdf: EBOOK_TYPES.pdf });
    const stored = await savePrivateFile(req.file.buffer, { productId: `${product._id}/sample`, version: 'sample' });
    product.sampleFile = { key: stored.key, originalName: req.file.originalname, size: stored.size };
    await product.save();
    await audit(req, 'product.sample_upload', { targetType: 'Product', targetId: product._id, details: { size: stored.size, type: type.ext } });
    ok(res, { hasSample: true }, 'Sample uploaded.');
});

export const uploadImages = asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw ApiError.badRequest('Choose at least one image.');
    const folder = ['covers', 'previews', 'banners', 'categories', 'site', 'social'].includes(req.body.folder) ? req.body.folder : 'images';
    const out = [];
    for (const f of files) out.push(await savePublicImage(f.buffer, folder));
    await audit(req, 'media.upload', { details: { count: out.length, folder } });
    ok(res, out.map((o) => ({ url: o.url })), 'Image uploaded.');
});

export const productSales = asyncHandler(async (req, res) => {
    const id = (await Product.findById(req.params.id).select('_id').lean())?._id;
    if (!id) throw ApiError.notFound('Product not found');
    const byDay = await Order.aggregate([
        { $match: { status: { $in: ['paid', 'partially_refunded', 'refunded'] }, 'items.product': id } },
        { $unwind: '$items' },
        { $match: { 'items.product': id } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Kolkata' } }, units: { $sum: 1 }, revenue: { $sum: '$items.total' } } },
        { $sort: { _id: -1 } },
        { $limit: 90 },
    ]);
    ok(res, byDay);
});

// ---- Categories ----
export const listCategories = asyncHandler(async (_req, res) => {
    const cats = await Category.find({}).sort({ order: 1, name: 1 }).lean();
    const counts = await Product.aggregate([{ $group: { _id: '$category', total: { $sum: 1 }, published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } } } }]);
    const byId = Object.fromEntries(counts.map((c) => [String(c._id), c]));
    ok(res, cats.map((c) => ({ ...c, productCount: byId[String(c._id)]?.total || 0, publishedCount: byId[String(c._id)]?.published || 0 })));
});

export const createCategory = asyncHandler(async (req, res) => {
    const data = { ...req.body, slug: await ensureUniqueSlug(Category, req.body.slug || req.body.name) };
    const cat = await Category.create(data);
    await audit(req, 'category.create', { targetType: 'Category', targetId: cat._id, details: { name: cat.name } });
    created(res, cat, 'Category saved.');
});

export const updateCategory = asyncHandler(async (req, res) => {
    const cat = await Category.findById(req.params.id);
    if (!cat) throw ApiError.notFound('Category not found');
    const data = { ...req.body };
    if (data.slug && data.slug !== cat.slug) data.slug = await ensureUniqueSlug(Category, data.slug, cat._id);
    cat.set(data);
    await cat.save();
    await audit(req, 'category.update', { targetType: 'Category', targetId: cat._id, details: { changed: Object.keys(data) } });
    ok(res, cat, 'Category saved.');
});

export const deleteCategory = asyncHandler(async (req, res) => {
    const inUse = await Product.countDocuments({ category: req.params.id });
    if (inUse) throw ApiError.conflict(`This category has ${inUse} product(s). Move them to another category first, or hide the category instead.`);
    await Category.deleteOne({ _id: req.params.id });
    await audit(req, 'category.delete', { targetType: 'Category', targetId: req.params.id });
    ok(res, null, 'Category deleted.');
});

export const reorderCategories = asyncHandler(async (req, res) => {
    await Category.bulkWrite(req.body.ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })));
    ok(res, null, 'Order saved.');
});

export const assignProducts = asyncHandler(async (req, res) => {
    const cat = await Category.findById(req.params.id);
    if (!cat) throw ApiError.notFound('Category not found');
    const r = await Product.updateMany({ _id: { $in: req.body.productIds } }, { $set: { category: cat._id } });
    await audit(req, 'category.assign_products', { targetType: 'Category', targetId: cat._id, details: { count: r.modifiedCount } });
    ok(res, { updated: r.modifiedCount }, 'Products assigned.');
});

// ---- Reviews moderation ----
const recomputeRating = async (productId) => {
    const [agg] = await Review.aggregate([{ $match: { product: productId, status: 'approved' } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]);
    await Product.updateOne({ _id: productId }, { $set: { ratingAverage: agg?.avg || 0, ratingCount: agg?.count || 0 } });
};

export const listReviews = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = req.query.status ? { status: req.query.status } : {};
    const [items, total] = await Promise.all([Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('product', 'title slug').lean(), Review.countDocuments(filter)]);
    ok(res, paginated(items, total, { page, limit }));
});

export const moderateReview = asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);
    if (!review) throw ApiError.notFound('Review not found');
    if (req.body.status) review.status = req.body.status;
    if (req.body.featured !== undefined) review.featured = req.body.featured && review.status === 'approved';
    await review.save();
    await recomputeRating(review.product);
    await audit(req, 'review.moderate', { targetType: 'Review', targetId: review._id, details: req.body });
    ok(res, review, 'Review updated.');
});
