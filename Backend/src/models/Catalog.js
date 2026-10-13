import mongoose from 'mongoose';

const seoSchema = new mongoose.Schema(
    {
        title: { type: String, maxlength: 70 },
        description: { type: String, maxlength: 170 },
        primaryKeyword: String,
        keywords: [String],
        canonicalUrl: String,
        ogTitle: String,
        ogDescription: String,
        ogImage: String,
        noindex: { type: Boolean, default: false },
    },
    { _id: false }
);

const categorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 80 },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        description: { type: String, maxlength: 5000 },
        image: String,
        icon: String,
        order: { type: Number, default: 0 },
        visible: { type: Boolean, default: true },
        seo: { type: seoSchema, default: () => ({}) },
    },
    { timestamps: true }
);

const fileSchema = new mongoose.Schema(
    {
        key: { type: String, required: true },
        originalName: String,
        mimeType: String,
        format: String,
        size: Number,
        sha256: String,
        version: { type: String, required: true },
        notes: String,
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { _id: false }
);

const faqSchema = new mongoose.Schema({ question: String, answer: String }, { _id: false });
const imageSchema = new mongoose.Schema({ url: String, alt: String }, { _id: false });

const productSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 200 },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        subtitle: { type: String, maxlength: 200 },
        shortDescription: { type: String, maxlength: 400 },
        description: { type: String, maxlength: 50000 },
        author: { type: String, trim: true, maxlength: 120 },
        publisher: { type: String, trim: true, maxlength: 120, default: 'OpenPage' },
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
        tags: [{ type: String, lowercase: true, trim: true }],
        keyBenefits: [String],
        audience: [String],
        tableOfContents: [String],
        faqs: [faqSchema],
        coverImage: imageSchema,
        previewImages: [imageSchema],
        sampleFile: { key: String, originalName: String, size: Number },
        file: fileSchema,
        fileHistory: [fileSchema],
        productType: { type: String, enum: ['ebook', 'template', 'checklist', 'guide', 'other'], default: 'ebook' },
        // Prices are integers in the minor unit (paise for INR).
        price: { type: Number, required: true, min: 0 },
        compareAtPrice: { type: Number, min: 0 },
        currency: { type: String, default: 'INR', uppercase: true },
        status: { type: String, enum: ['draft', 'published', 'unpublished', 'archived'], default: 'draft', index: true },
        featured: { type: Boolean, default: false, index: true },
        language: { type: String, default: 'English' },
        format: { type: String, default: 'PDF' },
        pageCount: Number,
        license: { type: String, maxlength: 5000 },
        publishedAt: Date,
        seo: { type: seoSchema, default: () => ({}) },
        // Maintained from verified paid orders only.
        salesCount: { type: Number, default: 0 },
        ratingAverage: { type: Number, default: 0 },
        ratingCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

productSchema.index({ title: 'text', shortDescription: 'text', author: 'text', tags: 'text', 'seo.keywords': 'text' }, { weights: { title: 10, tags: 5, author: 4 } });
productSchema.index({ status: 1, publishedAt: -1 });
productSchema.index({ status: 1, salesCount: -1 });

productSchema.pre('validate', function validatePrices(next) {
    if (this.compareAtPrice != null && this.compareAtPrice <= this.price) {
        // A "was" price must be genuinely higher than the current price, otherwise drop it.
        this.compareAtPrice = undefined;
    }
    next();
});

const reviewSchema = new mongoose.Schema(
    {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
        entitlement: { type: mongoose.Schema.Types.ObjectId, ref: 'Entitlement', required: true, unique: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        email: { type: String, required: true },
        displayName: { type: String, maxlength: 60 },
        rating: { type: Number, required: true, min: 1, max: 5 },
        title: { type: String, maxlength: 120 },
        body: { type: String, maxlength: 3000 },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
        featured: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const Category = mongoose.model('Category', categorySchema);
export const Product = mongoose.model('Product', productSchema);
export const Review = mongoose.model('Review', reviewSchema);
