import { useState } from 'react';
import toast from 'react-hot-toast';
import { post, errorMessage } from '../../lib/api';
import { Button, cn } from '../ui';

export default function NewsletterForm({ source = 'newsletter_form', className }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
        setLoading(true);
        try {
            const r = await post('/newsletter/subscribe', { email, source });
            setDone(true);
            toast.success(r.message);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    if (done) return <p className={cn('rounded-lg bg-brand-pale px-4 py-3 text-sm text-ink', className)} role="status">Almost there! Check your inbox and click the confirmation link.</p>;

    return (
        <form onSubmit={submit} className={className} noValidate>
            <div className="flex gap-2">
                <label htmlFor={`nl-${source}`} className="sr-only">
                    Email address
                </label>
                <input id={`nl-${source}`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={cn('input', error && 'input-error')} aria-invalid={Boolean(error)} />
                <Button type="submit" variant="secondary" loading={loading} className="shrink-0">
                    Subscribe
                </Button>
            </div>
            {error && <p className="mt-1.5 text-sm text-danger" role="alert">{error}</p>}
            <p className="mt-1.5 text-xs text-muted">We will send a confirmation email. Unsubscribe any time.</p>
        </form>
    );
}
