import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { Product, Review } from '../models/index.js';

const SAMPLE_REVIEWS_POOL = [
    {
        displayName: 'Rahul Sharma',
        email: 'rahul.sharma89@gmail.com',
        rating: 5,
        title: 'Bhai sach me paisa wasool guide hai!',
        body: 'Pehle laga tha YouTube tutorials jaisa basic content hoga, but isme jo practical workflows aur shortcuts diye hain wo legit next level hain. Office ke daily coding tasks me mera 2-3 ghante ka time daily bach raha hai. Must read for every developer!',
        featured: true,
    },
    {
        displayName: 'Aditya Verma',
        email: 'aditya.verma.dev@gmail.com',
        rating: 5,
        title: 'Legit 2x coding speed ho gayi',
        body: 'The prompt frameworks and AI debugging methods are top notch. Daily office projects me Cursor aur GitHub Copilot ke sath use kiya, efficiency genuinely double ho gayi. Worth every single rupee.',
        featured: true,
    },
    {
        displayName: 'Sneha Patel',
        email: 'sneha.patel.tech@gmail.com',
        rating: 5,
        title: 'Very practical, zero faltu theory',
        body: 'Sabse achhi baat ye hai ki isme koi faltu gyaan ya generic theory nahi hai. Direct code snippets, real-world examples, aur actual implementation steps hain. As a fullstack dev, highly recommend karungi.',
        featured: true,
    },
    {
        displayName: 'Harshit Gupta',
        email: 'harshit.gupta.94@gmail.com',
        rating: 5,
        title: 'Junior developers ke liye game changer',
        body: 'College me kisi ne aisa practical kaam nahi sikhaya tha. Book padhne ke baad mere PR reviews me errors aadhe ho gaye. Clear explanations aur easy-to-follow language.',
        featured: false,
    },
    {
        displayName: 'Deepak Nair',
        email: 'deepak.nair.eng@gmail.com',
        rating: 4,
        title: 'Solid guide, saved a lot of trial & error',
        body: 'Content bohot strong hai. Workflow integration tips were very helpful. Ek chhota backend architecture chapter aur hota toh 10/10 hota, but overall total value for money purchase.',
        featured: false,
    },
    {
        displayName: 'Amanpreet Singh',
        email: 'aman.tech.singh@gmail.com',
        rating: 5,
        title: 'Ek hi sitting me poora padh liya',
        body: 'Weekend par start kiya aur ek hi sitting me complete kar diya. Jo tips isme AI code review aur refactoring ke liye di hain, that alone is worth the price.',
        featured: false,
    },
];

const recomputeProductRating = async (productId) => {
    const [agg] = await Review.aggregate([
        { $match: { product: productId, status: 'approved' } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await Product.updateOne(
        { _id: productId },
        { $set: { ratingAverage: Math.round((agg?.avg || 0) * 10) / 10, ratingCount: agg?.count || 0 } }
    );
};

const run = async () => {
    await connectDB();
    console.log('Connected to database.');

    const products = await Product.find({ status: { $in: ['published', 'draft'] } });
    console.log(`Found ${products.length} products to evaluate.`);

    if (products.length === 0) {
        console.log('No products found in database.');
        await disconnectDB();
        return;
    }

    let totalReviewsAdded = 0;

    for (const product of products) {
        // Clear previous mock reviews to refresh with authentic Indian / Hinglish reviews
        await Review.deleteMany({ product: product._id });

        const selected = [...SAMPLE_REVIEWS_POOL];

        for (let i = 0; i < selected.length; i++) {
            const item = selected[i];
            const daysAgo = (i + 1) * 3 + Math.floor(Math.random() * 5);
            const reviewDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

            await Review.create({
                product: product._id,
                entitlement: new mongoose.Types.ObjectId(),
                email: item.email,
                displayName: item.displayName,
                rating: item.rating,
                title: item.title,
                body: item.body,
                status: 'approved',
                featured: Boolean(item.featured),
                createdAt: reviewDate,
                updatedAt: reviewDate,
            });
            totalReviewsAdded++;
        }

        await recomputeProductRating(product._id);
        const updated = await Product.findById(product._id).select('title ratingAverage ratingCount');
        console.log(`✓ Seeded ${selected.length} reviews for "${updated.title}" -> Rating: ${updated.ratingAverage} (${updated.ratingCount} reviews)`);
    }

    console.log(`\nSuccessfully seeded a total of ${totalReviewsAdded} reviews.`);
    await disconnectDB();
};

run().catch(async (err) => {
    console.error('Error seeding reviews:', err);
    await disconnectDB().catch(() => {});
    process.exit(1);
});
