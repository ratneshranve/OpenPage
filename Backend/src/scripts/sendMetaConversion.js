import crypto from 'crypto';

const ACCESS_TOKEN = 'EAAfpWpO3dkMBS9YR4ZCxEgHHgRcGzJKQmYUSlUPeybOPYYS76uWzVrJmdG4UQuzU4YofIomJY5W2pw0cXwEAMWy2RHgJmA4qhjeJTTTkLjeo95bZCjXPfQK8yK5KKOvh5zrbNZAZAJc1F7XTA8UtG4TZBrLzp8TJZAezSKw4bBVTRIYKWDoZByVbbFApSNp6AZDZD';
const PIXEL_ID = '1483481040551645';

function sha256(val) {
    return crypto.createHash('sha256').update(String(val).trim().toLowerCase()).digest('hex');
}

async function main() {
    const eventTime = Math.floor(Date.now() / 1000);

    const payload = {
        data: [
            {
                event_name: 'Purchase',
                event_time: eventTime,
                event_id: 'OP-YK65ZQG3',
                event_source_url: 'https://open-page-pi.vercel.app/order/OP-YK65ZQG3',
                action_source: 'website',
                user_data: {
                    em: [sha256('amahadik@gmail.com')],
                    fn: [sha256('amit')],
                    ln: [sha256('mahadik')],
                    country: [sha256('in')],
                },
                custom_data: {
                    currency: 'INR',
                    value: 99.0,
                    content_name: 'Code Faster With AI',
                    content_ids: ['6aceef8d35e41b925a12573e'],
                    content_type: 'product',
                    num_items: 1,
                },
            },
        ],
    };

    console.log('Sending Purchase event to Meta Graph API...');
    const url = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (data.events_received) {
        console.log('\nSUCCESS! Meta received the event successfully!');
    }
}

main().catch(console.error);
