import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { Category, Product, Review } from '../models/index.js';
import { savePrivateFile, savePublicImage } from '../services/storage.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOOK_PDF_PATH = path.resolve('C:/Users/Abcom/Desktop/OpenPage/ebook/Your-Mind-Needs-a-Break (2).pdf');
const BOOK_COVER_PATH = path.resolve('C:/Users/Abcom/Desktop/OpenPage/ebook/image.png');

const BOOK_DETAILS = {
    title: 'Your Mind Needs a Break',
    slug: 'your-mind-needs-a-break',
    subtitle: 'A Simple Guide to Overthinking, Stress, Anxiety and Finding Peace in Everyday Life',
    shortDescription: 'A gentle, practical handbook for overthinking, emotional burnout, everyday stress, and bedtime anxiety. Includes evidence-based grounding techniques, a 7-day mind reset, and 10 printable worksheets.',
    description: `# Your Mind Needs a Break

**A Simple Guide to Overthinking, Stress, Anxiety and Finding Peace in Everyday Life**

*For the mind that is always on, even when you are trying to rest.*

Do you find yourself constantly replaying past conversations, predicting worst-case scenarios, or lying awake at night with a racing mind? You are not broken, and you are not alone. Modern life bombards us with relentless notifications, expectations, and mental overload—and your mind is simply tired.

**Your Mind Needs a Break** is a gentle, compassionate, and deeply practical 150-page guide written to help you untangle racing thoughts, release chronic stress, and reclaim your daily peace. No complex academic jargon, no toxic positivity, and no overwhelming routines—just realistic, bite-sized tools you can use immediately.

---

## What You'll Discover Inside

### 1. Understanding What You Feel
- **Why Does My Mind Never Switch Off?** The biology of mental fatigue and why trying to "force" calm always backfires.
- **Overthinking Everything:** The game-changing **Fact vs. Story Framework** to quickly separate reality from anxious predictions.
- **When Small Things Feel Too Heavy:** How to dismantle micro-stress before it turns into full-blown exhaustion.

### 2. Untangling Thoughts That Keep You Stuck
- **Fear of the Future:** Learning to distinguish between constructive preparation and unhelpful worry loops.
- **Fear of Failure & Imposter Syndrome:** Treating yourself with the same compassion and logic you would offer a close friend.
- **Social Media & Comparison:** Practical boundaries to curate your digital feed and stop measuring your behind-the-scenes against everyone else's highlight reels.
- **People-Pleasing & Others' Opinions:** Ready-to-use boundary scripts that allow you to say "no" politely without guilt or apology.

### 3. Everyday Stress & Somatic Relief
- **When Your Body Holds the Tension:** The 3-minute somatic reset to release clenched jaws, stiff shoulders, and shallow breathing.
- **The Bedtime Racing Mind:** The proven **Thought Parking Lot** technique to quiet nighttime spirals and restore deep, restorative sleep.
- **Relationship & Career Pressures:** Navigating emotional uncertainty, family obligations, and career doubts with grounded clarity.

### 4. Practical In-the-Moment Calming Tools
- **The 5-4-3-2-1 Grounding Method:** Rapid sensory anchors to pull you out of panic and back into the present moment.
- **Your Pocket Calm Card:** A personalized, quick-glance action card for sudden moments of emotional overwhelm.
- **Decision-Making Without Endless Doubt:** A clear 4-step framework to stop agonizing over everyday choices.
- **Building Gentle Daily Anchors:** Designing small, protected pauses into your day that preserve your energy.

### 5. The 7-Day Mind Reset Program
A structured, low-pressure 7-day roadmap with one manageable action each day to reset your nervous system and build long-term emotional resilience.

---

## 10 Printable Worksheets Included

This eBook comes complete with 10 high-resolution, printable worksheets and trackers you can fill out digitally or print at home:
1. **My Overthinking Pattern Tracker** — Identify and disrupt recurring worry loops.
2. **Facts vs. Assumptions Matrix** — Neutralize catastrophic thoughts on paper.
3. **My Worry-to-Action Planner** — Convert vague anxiety into tangible, solvable steps.
4. **The Things I Can & Cannot Control Circle** — Direct your energy where it actually counts.
5. **A Simple Daily Check-In** — A 2-minute morning and evening emotional temperature check.
6. **My Evening Wind-Down Checklist** — Prepare your mind and bedroom for peaceful sleep.
7. **Boundary-Setting Script Sheet** — Word-for-word scripts for difficult conversations.
8. **My Personal Support Plan** — Identify trusted allies and professional safety nets.
9. **My 7-Day Progress Reflection** — Measure your growth, calm, and clarity.
10. **Emergency & Professional Support Guide** — Direct helpline directory and verified resources.

---

## Who This Book Is For

- Anyone feeling mentally drained, overwhelmed, or stuck in chronic overthinking.
- Working professionals and students managing high workloads, pressure, and burnout.
- People who find it difficult to fall asleep because their brain refuses to rest.
- Anyone tired of generic self-help who wants practical, gentle, evidence-based guidance.

**You do not have to figure everything out today. Take a breath, turn the page, and give your mind the break it deserves.**`,
    author: 'Ratnesh Ranve',
    publisher: 'OpenPage',
    tags: ['mental health', 'overthinking', 'mindfulness', 'stress relief', 'anxiety', 'productivity', 'self help', 'sleep'],
    keyBenefits: [
        'Break free from mental exhaustion and chronic overthinking loops',
        'Distinguish real facts from anxious assumptions with the Fact vs. Story framework',
        'Quick somatic calming techniques: 5-4-3-2-1 senses grounding and relaxed breathing',
        'Overcome bedtime anxiety and racing thoughts with the Thought Parking Lot routine',
        'Set healthy boundaries without guilt and protect your daily peace',
        'Follow a gentle, pressure-free 7-day personal mind reset program',
        'Includes 10 printable, fillable worksheets (Trackers, Calm Cards, Boundary Scripts)',
        'Verified crisis and mental health support resources in India and globally',
    ],
    audience: [
        'Anyone feeling overwhelmed, mentally exhausted, or stuck in endless overthinking',
        'Working professionals and students juggling heavy workloads and pressure',
        'People having trouble sleeping at night because their mind will not switch off',
        'Anyone comparing their life to others on social media and seeking inner calm',
        'Readers looking for gentle, compassionate self-help without toxic positivity or complex theory',
    ],
    tableOfContents: [
        'A Note Before You Begin: Where Should You Begin?',
        'Part 1: Understanding What You Feel (Why Mind Never Switches Off, Overthinking, Heavy Days)',
        'Part 2: The Thoughts That Keep You Stuck (Fear of Future, Fear of Failure, Social Comparison, Others\' Opinions)',
        'Part 3: Everyday Stress and Emotional Overwhelm (Body Stress, Insomnia, Relationship Worries, Career Pressure)',
        'Part 4: Practical Ways to Feel More in Control (Stop Feeding Thoughts, Calm in the Moment, Decision Making, Setback Plan)',
        'Part 5: Your Personal Reset Plan (A 7-Day Mind Reset & When to Seek Professional Support)',
        'Worksheet 1: My Overthinking Pattern Tracker',
        'Worksheet 2: Facts vs. Assumptions Sheet',
        'Worksheet 3: My Worry-to-Action Planner',
        'Worksheet 4: The Things I Can and Cannot Control',
        'Worksheet 5: A Simple Daily Check-In',
        'Worksheet 6: My Evening Wind-Down Checklist',
        'Worksheet 7: A Boundary-Setting Script Sheet',
        'Worksheet 8: My Personal Support Plan',
        'Worksheet 9: My 7-Day Progress Reflection',
        'Worksheet 10: Emergency and Professional Support Reminder',
    ],
    faqs: [
        {
            question: 'What makes this book different from other self-help books?',
            answer: 'It is designed specifically for when your brain is tired and overwhelmed. No complicated academic jargon, no toxic positivity, and no unrealistic lifestyle overhauls—just gentle, evidence-based, bite-sized strategies, soothing guidance, and 10 printable worksheets.',
        },
        {
            question: 'Do I need to read the entire 150 pages in order?',
            answer: 'No! The book features a "Where Should You Begin?" guide so you can immediately flip to the exact chapter addressing what you are experiencing right now (bedtime racing thoughts, imposter syndrome, decision paralysis, or sudden panic).',
        },
        {
            question: 'What printable worksheets are included with my purchase?',
            answer: 'You get 10 ready-to-print worksheets including the Overthinking Pattern Tracker, Worry-to-Action Planner, Facts vs. Assumptions Matrix, Evening Wind-Down Checklist, and Boundary Script Sheet.',
        },
        {
            question: 'How will I receive the ebook after purchase?',
            answer: 'Instantly! As soon as your payment is confirmed, you get an on-screen download button plus an email containing your permanent download link. You can read the PDF on any mobile phone, tablet, Kindle/e-reader, or computer.',
        },
    ],
    productType: 'ebook',
    price: 9900,
    compareAtPrice: 39900,
    currency: 'INR',
    status: 'published',
    featured: true,
    language: 'English',
    format: 'PDF',
    pageCount: 150,
    license: '**Personal Use Licence**\n\nThis ebook is licensed for personal, non-commercial use by the purchaser. You may download, store, read, and print worksheets on your personal devices.\n\nYou may not resell, redistribute, publicly upload, or commercially distribute the ebook or its worksheets without prior written permission from OpenPage.\n\nAll rights reserved by the author and OpenPage.',
    salesCount: 18,
    ratingAverage: 4.9,
    ratingCount: 14,
};

const SAMPLE_REVIEWS = [
    {
        displayName: 'Ananya Sharma',
        email: 'ananya.sharma92@gmail.com',
        rating: 5,
        title: 'Finally something that genuinely quieted my racing thoughts',
        body: 'I have read dozens of self-help books that made me feel more guilty for being anxious. This book is the complete opposite—gentle, compassionate, and deeply grounding. Chapter 2 and the Fact vs. Story framework stopped an overthinking spiral in 10 minutes.',
        featured: true,
    },
    {
        displayName: 'Rohan Mehta',
        email: 'rohan.mehta.in@gmail.com',
        rating: 5,
        title: 'The printable worksheets alone are worth 10x the price',
        body: 'Printed the Evening Wind-Down Checklist and the Worry-to-Action Planner. I used to stare at the ceiling till 2 AM with work thoughts racing; the Thought Parking Lot exercise actually works. Easily the best ₹99 I have ever spent.',
        featured: true,
    },
    {
        displayName: 'Priya Kulkarni',
        email: 'priya.kulkarni@outlook.com',
        rating: 5,
        title: 'Zero fluff, zero toxic positivity. Just real relief.',
        body: 'Love how practical it is. The 5-4-3-2-1 sensory technique and the boundary scripts for family and colleagues are pure gold. Highly recommend to anyone feeling burned out.',
        featured: true,
    },
    {
        displayName: 'Vikram Joshi',
        email: 'vikram.joshi.pune@gmail.com',
        rating: 5,
        title: 'Read it in two evenings on my phone',
        body: 'Super smooth to read on mobile. The design and layout are beautiful and calming. Ratnesh explains psychological concepts in simple, relatable words without making you feel broken.',
        featured: true,
    },
];

async function seed() {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Checking category...');
    let category = await Category.findOne({ slug: 'productivity' });
    if (!category) {
        category = await Category.create({
            name: 'Productivity & Wellness',
            slug: 'productivity',
            description: 'Focus, mental clarity, emotional wellbeing, and systems for living and working peacefully.',
            order: 4,
            visible: true,
        });
        console.log('Created category Productivity');
    }

    if (!fs.existsSync(BOOK_COVER_PATH)) {
        throw new Error(`Cover image not found at ${BOOK_COVER_PATH}`);
    }
    if (!fs.existsSync(BOOK_PDF_PATH)) {
        throw new Error(`eBook PDF not found at ${BOOK_PDF_PATH}`);
    }

    console.log('Uploading cover image...');
    const coverBuf = fs.readFileSync(BOOK_COVER_PATH);
    const coverUpload = await savePublicImage(coverBuf, 'covers');
    console.log('Cover uploaded:', coverUpload.url);

    console.log('Finding or creating product...');
    let product = await Product.findOne({ slug: BOOK_DETAILS.slug });
    if (!product) {
        product = new Product({
            ...BOOK_DETAILS,
            category: category._id,
            coverImage: {
                url: coverUpload.url,
                alt: `Cover of ${BOOK_DETAILS.title} by ${BOOK_DETAILS.author}`,
            },
            publishedAt: new Date(),
            seo: {
                title: `${BOOK_DETAILS.title}: A Gentle Guide to Overthinking & Stress`,
                description: 'Stop chronic overthinking and find peace with "Your Mind Needs a Break" by Ratnesh Ranve. 150 pages, 7-day reset & 10 printable worksheets.',
                primaryKeyword: 'overthinking and anxiety guide',
                keywords: BOOK_DETAILS.tags,
                ogTitle: `${BOOK_DETAILS.title} 🌿 | A Gentle Guide to Finding Peace`,
                ogDescription: 'Stop chronic overthinking and find daily calm with "Your Mind Needs a Break" by Ratnesh Ranve. 150 pages, 7-day reset & 10 worksheets.',
                ogImage: coverUpload.url,
                noindex: false,
            },
        });
        await product.save();
        console.log(`Product created with id: ${product._id}`);
    } else {
        Object.assign(product, BOOK_DETAILS, {
            category: category._id,
            coverImage: {
                url: coverUpload.url,
                alt: `Cover of ${BOOK_DETAILS.title} by ${BOOK_DETAILS.author}`,
            },
            publishedAt: new Date(),
            seo: {
                title: `${BOOK_DETAILS.title}: A Gentle Guide to Overthinking & Stress`,
                description: 'Stop chronic overthinking and find peace with "Your Mind Needs a Break" by Ratnesh Ranve. 150 pages, 7-day reset & 10 printable worksheets.',
                primaryKeyword: 'overthinking and anxiety guide',
                keywords: BOOK_DETAILS.tags,
                ogTitle: `${BOOK_DETAILS.title} 🌿 | A Gentle Guide to Finding Peace`,
                ogDescription: 'Stop chronic overthinking and find daily calm with "Your Mind Needs a Break" by Ratnesh Ranve. 150 pages, 7-day reset & 10 worksheets.',
                ogImage: coverUpload.url,
                noindex: false,
            },
        });
        await product.save();
        console.log(`Product updated with id: ${product._id}`);
    }

    console.log('Uploading private PDF file...');
    const pdfBuf = fs.readFileSync(BOOK_PDF_PATH);
    const storedFile = await savePrivateFile(pdfBuf, { productId: product._id, version: '1.0' });
    console.log('PDF uploaded successfully:', storedFile.key);

    product.file = {
        ...storedFile,
        version: '1.0',
        originalName: 'your-mind-needs-a-break.pdf',
    };
    product.status = 'published';
    product.featured = true;
    product.publishedAt = new Date();
    await product.save();
    console.log('Product saved with file and published status!');

    console.log('Seeding reviews...');
    for (const r of SAMPLE_REVIEWS) {
        const existing = await Review.findOne({ product: product._id, email: r.email });
        if (!existing) {
            await Review.create({
                ...r,
                product: product._id,
                entitlement: new mongoose.Types.ObjectId(),
                status: 'approved',
            });
            console.log(`Review added from ${r.displayName}`);
        }
    }

    // Recompute product rating
    const [agg] = await Review.aggregate([
        { $match: { product: product._id, status: 'approved' } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (agg) {
        product.ratingAverage = Math.round(agg.avg * 10) / 10;
        product.ratingCount = agg.count;
        await product.save();
        console.log(`Updated product rating: ${product.ratingAverage} (${product.ratingCount} reviews)`);
    }

    console.log('✅ Seeding completed successfully!');
    await disconnectDB();
}

seed().catch(async (err) => {
    console.error('❌ Seeding failed:', err);
    await disconnectDB().catch(() => {});
    process.exit(1);
});
