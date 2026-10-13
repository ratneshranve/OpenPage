import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, Download, HelpCircle, Mail, Phone, Receipt } from 'lucide-react';
import Seo from '../components/layout/Seo';
import { Alert, Button, Input, Select, Textarea } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { post, errorMessage } from '../lib/api';

const schema = z
    .object({
        name: z.string().trim().min(1, 'Enter your name').max(120),
        email: z.string().trim().email('Enter a valid email address'),
        orderNumber: z.string().trim().max(20).optional(),
        category: z.enum(['download', 'payment', 'refund', 'account', 'product', 'other'], { errorMap: () => ({ message: 'Choose a topic' }) }),
        refundReason: z.string().optional(),
        subject: z.string().trim().max(200).optional(),
        message: z.string().trim().min(10, 'Please give us a little more detail (at least 10 characters)').max(5000),
    })
    .refine((v) => v.category !== 'refund' || v.orderNumber, { path: ['orderNumber'], message: 'Enter the order number for a refund request' });

const CATEGORIES = [
    { value: 'download', label: 'Download or file problem' },
    { value: 'payment', label: 'Payment question' },
    { value: 'refund', label: 'Refund request' },
    { value: 'account', label: 'Account and sign-in' },
    { value: 'product', label: 'Question about an eBook' },
    { value: 'other', label: 'Something else' },
];
const REFUND_REASONS = [
    { value: 'inaccessible_file', label: 'I cannot open or access the file' },
    { value: 'defective_file', label: 'The file is damaged or incomplete' },
    { value: 'duplicate_charge', label: 'I was charged more than once' },
    { value: 'not_as_described', label: 'The product is not as described' },
    { value: 'other', label: 'Other' },
];

export default function Support({ contact }) {
    const { user } = useAuth();
    const { config } = useConfig();
    const [sent, setSent] = useState(null);
    const [serverError, setServerError] = useState('');
    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm({ resolver: zodResolver(schema), defaultValues: { name: user?.name || '', email: user?.email || '', category: contact ? 'other' : 'download' } });
    const category = watch('category');
    const general = config?.general || {};
    const c = config?.contact || {};

    const onSubmit = async (values) => {
        setServerError('');
        try {
            const r = await post('/support', { ...values, refundReason: values.category === 'refund' ? values.refundReason || 'other' : undefined });
            setSent(r.data.ticketNumber);
            toast.success('Your message has been sent.');
            reset();
        } catch (err) {
            setServerError(errorMessage(err));
        }
    };

    return (
        <div className="container-page py-10">
            <Seo title={contact ? 'Contact us' : 'Support'} description={contact ? `Contact ${general.siteName || 'OpenPage'}.` : 'Get help with downloads, payments, refunds and your account.'} />
            <h1 className="text-3xl font-bold">{contact ? 'Contact us' : 'How can we help?'}</h1>
            <p className="mt-2 max-w-2xl text-muted">{contact ? c.intro : 'Most questions are answered below. If not, send us a message and we will get back to you.'}</p>

            {!contact && (
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    <Link to="/download" className="card flex gap-3 p-5 no-underline hover:border-accent">
                        <Download className="h-6 w-6 shrink-0 text-accent" />
                        <div>
                            <p className="font-semibold text-ink">Lost your download link?</p>
                            <p className="text-sm text-muted">Get fresh links emailed instantly.</p>
                        </div>
                    </Link>
                    <Link to="/faq" className="card flex gap-3 p-5 no-underline hover:border-accent">
                        <HelpCircle className="h-6 w-6 shrink-0 text-accent" />
                        <div>
                            <p className="font-semibold text-ink">Frequently asked questions</p>
                            <p className="text-sm text-muted">Payments, formats, delivery and more.</p>
                        </div>
                    </Link>
                    <Link to="/refund-policy" className="card flex gap-3 p-5 no-underline hover:border-accent">
                        <Receipt className="h-6 w-6 shrink-0 text-accent" />
                        <div>
                            <p className="font-semibold text-ink">Refund policy</p>
                            <p className="text-sm text-muted">How refund requests are reviewed.</p>
                        </div>
                    </Link>
                </div>
            )}

            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
                <section className="card p-6" aria-labelledby="contact-form">
                    <h2 id="contact-form" className="text-lg font-semibold">Send us a message</h2>
                    {sent ? (
                        <div className="py-8 text-center">
                            <CheckCircle2 className="mx-auto h-12 w-12 text-brand" />
                            <p className="mt-3 font-semibold">Thanks, we have received your message.</p>
                            <p className="mt-1 text-sm text-muted">Your reference is <strong className="text-ink">{sent}</strong>. A confirmation email is on its way. {general.responseTime}</p>
                            <Button variant="outline" className="mt-5" onClick={() => setSent(null)}>Send another message</Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
                            {serverError && <Alert tone="error" className="sm:col-span-2">{serverError}</Alert>}
                            <Input label="Name" autoComplete="name" {...register('name')} error={errors.name?.message} required />
                            <Input label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} required />
                            <Select label="Topic" options={CATEGORIES} {...register('category')} error={errors.category?.message} required />
                            <Input label={category === 'refund' ? 'Order number' : 'Order number (if relevant)'} placeholder="OP-XXXXXXXX" {...register('orderNumber')} error={errors.orderNumber?.message} required={category === 'refund'} />
                            {category === 'refund' && <Select className="sm:col-span-2" label="Reason for refund" options={REFUND_REASONS} {...register('refundReason')} />}
                            <Input className="sm:col-span-2" label="Subject" {...register('subject')} error={errors.subject?.message} />
                            <Textarea className="sm:col-span-2" label="Message" rows={6} {...register('message')} error={errors.message?.message} required hint={category === 'download' ? 'Tell us your device and reader app if a file will not open.' : undefined} />
                            <div className="sm:col-span-2">
                                <Button type="submit" loading={isSubmitting}>Send message</Button>
                                <p className="mt-2 text-xs text-muted">We use your details only to respond to your request. See our <Link to="/privacy">Privacy Policy</Link>.</p>
                            </div>
                        </form>
                    )}
                </section>
                <aside className="space-y-4">
                    <div className="card space-y-3 p-5 text-sm">
                        <h2 className="font-semibold">Other ways to reach us</h2>
                        {(c.email || general.supportEmail) && (
                            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-accent" /> <a href={`mailto:${c.email || general.supportEmail}`}>{c.email || general.supportEmail}</a></p>
                        )}
                        {(c.phone || general.contactPhone) && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-accent" /> {c.phone || general.contactPhone}</p>}
                        {general.supportHours && <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /> {general.supportHours}</p>}
                        {general.responseTime && <p className="text-muted">{general.responseTime}</p>}
                        {(c.address || general.businessAddress) && <p className="whitespace-pre-line text-muted">{c.address || general.businessAddress}</p>}
                    </div>
                </aside>
            </div>
        </div>
    );
}
