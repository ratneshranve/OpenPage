import { Link, useLocation } from 'react-router-dom';
import { Mail, ShieldCheck } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { Logo } from './Header';
import NewsletterForm from '../shop/NewsletterForm';

const isInternal = (href) => href?.startsWith('/');

export default function Footer() {
    const { config } = useConfig();
    const { pathname } = useLocation();
    const general = config?.general || {};
    const footer = config?.footer || {};
    const social = Object.entries(general.social || {}).filter(([, url]) => url);
    return (
        <footer className="mt-20 border-t border-line bg-surface">
            <div className="container-page grid gap-10 py-12 md:grid-cols-12">
                <div className="md:col-span-4">
                    <Logo />
                    <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{footer.about}</p>
                    {general.supportEmail && (
                        <a href={`mailto:${general.supportEmail}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
                            <Mail className="h-4 w-4" /> {general.supportEmail}
                        </a>
                    )}
                    {general.supportHours && <p className="mt-1 text-sm text-muted">{general.supportHours}</p>}
                    <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted">
                        <ShieldCheck className="h-4 w-4 text-brand" /> Secure payments by Razorpay
                    </p>
                </div>
                {(footer.columns || []).map((col) => (
                    <div key={col.title} className="md:col-span-2">
                        <h2 className="text-sm font-semibold text-ink">{col.title}</h2>
                        <ul className="mt-3 space-y-2">
                            {(col.links || []).map((l) => (
                                <li key={l.href + l.label}>
                                    {isInternal(l.href) ? (
                                        <Link to={l.href} className="text-sm text-muted no-underline hover:text-accent">
                                            {l.label}
                                        </Link>
                                    ) : (
                                        <a href={l.href} className="text-sm text-muted no-underline hover:text-accent" rel="noopener noreferrer" target="_blank">
                                            {l.label}
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
                {config?.features?.newsletter && pathname !== '/' && (
                    <div className="md:col-span-12 lg:col-span-12">
                        <div className="rounded-2xl border border-line bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
                            <div className="mb-3 sm:mb-0">
                                <p className="font-semibold">{config.homepage.newsletter?.title}</p>
                                <p className="text-sm text-muted">{config.homepage.newsletter?.text}</p>
                            </div>
                            <NewsletterForm source="footer" className="sm:w-[420px]" />
                        </div>
                    </div>
                )}
            </div>
            <div className="border-t border-line">
                <div className="container-page flex flex-col gap-3 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
                    <p>{footer.copyright || `© ${new Date().getFullYear()} ${general.businessName || general.siteName || 'OpenPage'}. All rights reserved.`}</p>
                    {social.length > 0 && (
                        <ul className="flex flex-wrap gap-4">
                            {social.map(([name, url]) => (
                                <li key={name}>
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="capitalize text-muted no-underline hover:text-accent">
                                        {name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </footer>
    );
}
