import { connectDB, disconnectDB } from '../config/db.js';
import { Page, Setting } from '../models/index.js';
import { LEGAL_PAGES } from './legalContent.js';

const main = async () => {
    console.log('Connecting to MongoDB...');
    await connectDB();

    console.log('Seeding genuine legal pages...');
    for (const p of LEGAL_PAGES) {
        await Page.updateOne(
            { slug: p.slug },
            { $set: { title: p.title, type: p.type, body: p.body, seo: p.seo, published: true } },
            { upsert: true }
        );
        console.log(`Updated page: ${p.title} (${p.slug})`);
    }

    console.log('Updating business and support settings in MongoDB...');
    const generalUpdate = {
        'value.supportEmail': 'ranveratnesh@gmail.com',
        'value.contactPhone': '+91 9770133148',
        'value.businessName': 'Ratnesh Ranve',
        'value.businessAddress': '47, Gram Barud, Post Barud, Tehsil Harsud, District Khandwa, Madhya Pradesh - 450116, India',
        'value.supportHours': 'Monday to Saturday, 10:00 AM – 6:00 PM IST',
        'value.responseTime': 'We usually reply within 24 hours.',
        'value.governingLaw': 'India',
        'value.siteName': 'OpenPage',
        'value.currency': 'INR',
        'value.timezone': 'Asia/Kolkata'
    };
    await Setting.updateOne({ key: 'general' }, { $set: generalUpdate }, { upsert: true });

    const contactUpdate = {
        'value.email': 'ranveratnesh@gmail.com',
        'value.phone': '+91 9770133148',
        'value.address': '47, Gram Barud, Post Barud, Tehsil Harsud, District Khandwa, Madhya Pradesh - 450116, India',
        'value.intro': 'Questions about an order, a download or a product? Send us a message and we will get back to you within 24 hours.'
    };
    await Setting.updateOne({ key: 'contact' }, { $set: contactUpdate }, { upsert: true });

    const downloadUpdate = {
        'value.libraryLinkTtlMinutes': 1440,
        'value.maxUsesPerLink': 20,
        'value.maxDownloadsPerEntitlementPerDay': 50
    };
    await Setting.updateOne({ key: 'downloads' }, { $set: downloadUpdate }, { upsert: true });

    console.log('All legal policies, support settings, and 24h download TTL successfully updated in MongoDB!');
    await disconnectDB();
};

main().catch(async (err) => {
    console.error('Failed to seed policies:', err);
    await disconnectDB().catch(() => {});
    process.exit(1);
});
