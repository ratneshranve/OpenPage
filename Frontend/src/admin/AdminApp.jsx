import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    BarChart3, Bell, BookOpen, Boxes, ClipboardList, CreditCard, FileText, FolderTree, Gauge, Globe, Home, LifeBuoy, LogOut, Mail, MailCheck, Megaphone, Menu,
    Plug, Receipt, RotateCcw, Search, Settings, ShieldCheck, Star, Tags, Users, Workflow, X,
} from 'lucide-react';
import Seo from '../components/layout/Seo';
import { Alert, Button, Input, PageLoader, cn } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';

const Overview = lazy(() => import('./pages/Overview'));
const Products = lazy(() => import('./pages/Products'));
const ProductEdit = lazy(() => import('./pages/ProductEdit'));
const CatalogAdmin = lazy(() => import('./pages/CatalogAdmin'));
const Orders = lazy(() => import('./pages/Orders'));
const People = lazy(() => import('./pages/People'));
const Offers = lazy(() => import('./pages/Offers'));
const Email = lazy(() => import('./pages/Email'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Site = lazy(() => import('./pages/Site'));
const SupportAdmin = lazy(() => import('./pages/SupportAdmin'));

export const NAV = [
    { group: 'Store', items: [
        { to: '/admin', label: 'Overview', icon: Gauge, end: true },
        { to: '/admin/products', label: 'Products', icon: BookOpen },
        { to: '/admin/categories', label: 'Categories', icon: FolderTree },
        { to: '/admin/reviews', label: 'Reviews', icon: Star },
    ] },
    { group: 'Sales', items: [
        { to: '/admin/orders', label: 'Orders', icon: Receipt },
        { to: '/admin/payments', label: 'Payments', icon: CreditCard },
        { to: '/admin/refunds', label: 'Manual refunds', icon: RotateCcw },
        { to: '/admin/customers', label: 'Customers', icon: Users },
        { to: '/admin/offers', label: 'Coupons & offers', icon: Tags },
    ] },
    { group: 'Marketing', items: [
        { to: '/admin/email-templates', label: 'Email templates', icon: Mail },
        { to: '/admin/automations', label: 'Email automation', icon: Workflow },
        { to: '/admin/email-logs', label: 'Email logs', icon: MailCheck },
        { to: '/admin/subscribers', label: 'Newsletter subscribers', icon: ClipboardList },
        { to: '/admin/notifications', label: 'Notifications', icon: Bell },
        { to: '/admin/campaigns', label: 'Marketing campaigns', icon: Megaphone },
        { to: '/admin/analytics', label: 'Analytics & reports', icon: BarChart3 },
    ] },
    { group: 'Website', items: [
        { to: '/admin/seo', label: 'SEO manager', icon: Search },
        { to: '/admin/content', label: 'Homepage & content', icon: Home },
        { to: '/admin/legal-pages', label: 'Legal pages', icon: FileText },
        { to: '/admin/support', label: 'Support', icon: LifeBuoy },
        { to: '/admin/integrations', label: 'Integrations', icon: Plug },
        { to: '/admin/settings', label: 'Website settings', icon: Settings },
        { to: '/admin/account', label: 'Admin account & audit', icon: ShieldCheck },
    ] },
];

function AdminLogin() {
    const { login, user } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        if (user?.role === 'admin') navigate('/admin', { replace: true });
    }, [user, navigate]);
    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password, { admin: true });
            toast.success('Welcome back.');
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-4">
            <Seo title="Admin sign in" noindex />
            <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7" noValidate>
                <div className="text-center">
                    <Boxes className="mx-auto h-9 w-9 text-accent" />
                    <h1 className="mt-2 text-xl font-bold">OpenPage admin</h1>
                    <p className="text-sm text-muted">Administrator access only</p>
                </div>
                {error && <Alert tone="error">{error}</Alert>}
                <Input label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
                <Link to="/" className="block text-center text-sm">← Back to store</Link>
            </form>
        </div>
    );
}

function Shell() {
    const { user, loading, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();
    const navigate = useNavigate();
    useEffect(() => setOpen(false), [pathname]);
    if (loading) return <PageLoader label="Loading admin…" />;
    if (!user) return <Navigate to="/admin/login" replace />;
    if (user.role !== 'admin') return <Navigate to="/" replace />;

    const sidebar = (
        <nav className="flex h-full flex-col gap-5 overflow-y-auto p-4" aria-label="Admin">
            <Link to="/admin" className="flex items-center gap-2 px-2 text-lg font-extrabold text-ink no-underline">
                <span className="text-brand">Open</span><span className="-ml-2 text-accent">Page</span>
                <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Admin</span>
            </Link>
            {NAV.map((g) => (
                <div key={g.group}>
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.group}</p>
                    <ul className="mt-1.5 space-y-0.5">
                        {g.items.map((n) => (
                            <li key={n.to}>
                                <NavLink to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium no-underline', isActive ? 'bg-accent-pale text-accent' : 'text-ink-soft hover:bg-surface hover:text-ink')}>
                                    <n.icon className="h-4 w-4 shrink-0" /> {n.label}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            <div className="mt-auto space-y-1 border-t border-line pt-3">
                <Link to="/" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-soft no-underline hover:bg-surface"><Globe className="h-4 w-4" /> View store</Link>
                <button
                    type="button"
                    onClick={async () => {
                        await logout();
                        navigate('/admin/login');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-soft hover:bg-surface"
                >
                    <LogOut className="h-4 w-4" /> Sign out
                </button>
            </div>
        </nav>
    );

    return (
        <div className="min-h-screen bg-surface">
            <Seo title="Admin" noindex />
            <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">{sidebar}</aside>
            {open && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
                    <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
                        <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 hover:bg-surface" aria-label="Close menu"><X className="h-5 w-5" /></button>
                        {sidebar}
                    </aside>
                </div>
            )}
            <div className="lg:pl-64">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-8">
                    <button type="button" className="rounded-lg p-1.5 hover:bg-surface lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
                    <p className="text-sm text-muted">Signed in as <span className="font-medium text-ink">{user.email}</span></p>
                </header>
                <main id="main" className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
                    <Suspense fallback={<PageLoader />}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
}

export default function AdminApp() {
    return (
        <Routes>
            <Route path="login" element={<AdminLogin />} />
            <Route element={<Shell />}>
                <Route index element={<Overview />} />
                <Route path="products" element={<Products />} />
                <Route path="products/new" element={<ProductEdit />} />
                <Route path="products/:id" element={<ProductEdit />} />
                <Route path="categories" element={<CatalogAdmin view="categories" />} />
                <Route path="reviews" element={<CatalogAdmin view="reviews" />} />
                <Route path="orders" element={<Orders view="orders" />} />
                <Route path="orders/:id" element={<Orders view="order" />} />
                <Route path="payments" element={<Orders view="payments" />} />
                <Route path="refunds" element={<Orders view="refunds" />} />
                <Route path="refunds/:id" element={<Orders view="refund" />} />
                <Route path="customers" element={<People view="customers" />} />
                <Route path="customers/:id" element={<People view="customer" />} />
                <Route path="subscribers" element={<People view="subscribers" />} />
                <Route path="offers" element={<Offers />} />
                <Route path="email-templates" element={<Email view="templates" />} />
                <Route path="email-templates/:key" element={<Email view="template" />} />
                <Route path="automations" element={<Email view="automations" />} />
                <Route path="email-logs" element={<Email view="logs" />} />
                <Route path="campaigns" element={<Email view="campaigns" />} />
                <Route path="campaigns/:id" element={<Email view="campaign" />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="seo" element={<Site view="seo" />} />
                <Route path="content" element={<Site view="content" />} />
                <Route path="legal-pages" element={<Site view="pages" />} />
                <Route path="legal-pages/:id" element={<Site view="page" />} />
                <Route path="integrations" element={<Site view="integrations" />} />
                <Route path="settings" element={<Site view="settings" />} />
                <Route path="account" element={<Site view="account" />} />
                <Route path="support" element={<SupportAdmin />} />
                <Route path="support/:id" element={<SupportAdmin />} />
                <Route path="*" element={<Alert tone="info" title="Page not found">This admin page does not exist.</Alert>} />
            </Route>
        </Routes>
    );
}
