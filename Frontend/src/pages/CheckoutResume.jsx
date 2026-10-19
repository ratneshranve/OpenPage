import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Seo from '../components/layout/Seo';
import { Alert, Button, PageLoader } from '../components/ui';
import { useCart } from '../context/CartContext';
import { api, errorMessage } from '../lib/api';
import { setSessionToken } from '../lib/checkout';

/** Opens a saved checkout from a reminder email. The customer verifies their email again. */
export default function CheckoutResume() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { replace } = useCart();
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const couponCode = params.get('coupon') || undefined;
                const r = (await api.post('/checkout/sessions/resume', { sid: params.get('sid'), sig: params.get('sig'), couponCode })).data.data;
                setSessionToken(r.sessionToken);
                const items = r.quote.items.map((i) => ({ id: String(i.product), title: i.title, slug: i.slug, coverImage: i.coverImage, price: i.total, currency: r.quote.currency }));
                replace(items);
                if (!items.length) {
                    setError('The items from this checkout are no longer available.');
                    return;
                }
                navigate('/checkout', { replace: true });
            } catch (err) {
                setError(errorMessage(err));
            }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="container-page max-w-xl py-14">
            <Seo title="Resume checkout" noindex />
            {error ? (
                <Alert tone="info" title="We could not restore this checkout" action={<Button as={Link} to="/ebooks" size="sm">Browse eBooks</Button>}>
                    {error}
                </Alert>
            ) : (
                <PageLoader label="Restoring your cart…" />
            )}
        </div>
    );
}
