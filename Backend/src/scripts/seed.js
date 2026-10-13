/**
 * Seeds default templates, automations, categories and legal pages.
 *   npm run seed            -> defaults only (also runs automatically at startup)
 *   npm run seed -- --demo  -> plus four demo eBooks with a generated placeholder PDF,
 *                              so checkout and delivery can be tested end to end locally.
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { Category, Product } from '../models/index.js';
import { ensureSeedData } from './seedData.js';
import { savePrivateFile } from '../services/storage.service.js';

const demoPdf = (title) => {
    const text = `${title} - OpenPage demo file`.replace(/[()\\]/g, '');
    const stream = `BT /F1 20 Tf 72 720 Td (${text}) Tj ET`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let body = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((obj, i) => {
        offsets.push(body.length);
        body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = body.length;
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(body, 'latin1');
};

const DEMO = [
    { title: 'The AI Automation Playbook', slug: 'ai-automation-playbook', category: 'ai-automation', price: 49900, compareAtPrice: 79900, featured: true, tags: ['ai', 'automation', 'workflows'], shortDescription: 'Automate repetitive work with practical AI workflows you can set up in an afternoon.' },
    { title: 'Lean Operations Handbook', slug: 'lean-operations-handbook', category: 'business-operations', price: 39900, tags: ['operations', 'sop', 'systems'], shortDescription: 'Build simple systems and SOPs that keep a small business running smoothly.' },
    { title: 'Content Marketing That Converts', slug: 'content-marketing-that-converts', category: 'marketing', price: 34900, featured: true, tags: ['marketing', 'content', 'seo'], shortDescription: 'Plan, write and distribute content that brings in qualified customers.' },
    { title: 'Deep Work Planner', slug: 'deep-work-planner', category: 'productivity', price: 19900, tags: ['productivity', 'focus', 'planning'], shortDescription: 'A weekly planning system for protecting focus and finishing important work.' },
];

const main = async () => {
    await connectDB();
    await ensureSeedData();
    if (process.argv.includes('--demo')) {
        for (const d of DEMO) {
            if (await Product.exists({ slug: d.slug })) continue;
            const category = await Category.findOne({ slug: d.category });
            const product = await Product.create({
                ...d,
                category: category?._id,
                author: 'OpenPage Editorial',
                description: `${d.shortDescription}\n\nThis is demo content created by the seed script. Replace it in Admin → Products.`,
                keyBenefits: ['Step-by-step frameworks', 'Ready-to-use checklists', 'Real-world examples'],
                audience: ['Founders and small-business owners', 'Team leads and operators'],
                tableOfContents: ['Introduction', 'Core framework', 'Implementation checklist', 'Next steps'],
                language: 'English',
                pageCount: 1,
                license: 'Personal licence. See the Licensing page for details.',
                status: 'draft',
            });
            const stored = await savePrivateFile(demoPdf(d.title), { productId: product._id, version: '1.0' });
            product.file = { ...stored, version: '1.0', originalName: `${d.slug}.pdf` };
            product.format = 'PDF';
            product.status = 'published';
            product.publishedAt = new Date();
            await product.save();
            console.log(`Demo product created: ${d.title}`);
        }
    }
    console.log('Seed complete');
    await disconnectDB();
};

main().catch(async (err) => {
    console.error(`Seed failed: ${err.stack || err.message}`);
    await disconnectDB().catch(() => {});
    process.exit(1);
});
