import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Suspense } from 'react';
import { Library, LifeBuoy, LogOut, Receipt, Settings, User } from 'lucide-react';
import toast from 'react-hot-toast';
import Seo from '../../components/layout/Seo';
import { Alert, Button, PageLoader, cn } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { post, errorMessage } from '../../lib/api';

const NAV = [
    { to: '/account', label: 'Overview', icon: User, end: true },
    { to: '/account/library', label: 'My library', icon: Library },
    { to: '/account/orders', label: 'Orders', icon: Receipt },
    { to: '/account/preferences', label: 'Preferences', icon: Settings },
    { to: '/account/support', label: 'Support requests', icon: LifeBuoy },
];

export default function AccountLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const resend = async () => {
        try {
            const r = await post('/auth/resend-verification');
            toast.success(r.message);
        } catch (err) {
            toast.error(errorMessage(err));
        }
    };
    return (
        <div className="container-page py-8">
            <Seo title="My account" noindex />
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Hi{user.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
                    <p className="text-sm text-muted">{user.email}</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                        await logout();
                        toast.success('Signed out.');
                        navigate('/');
                    }}
                >
                    <LogOut className="h-4 w-4" /> Sign out
                </Button>
            </div>
            {!user.emailVerified && (
                <Alert tone="warning" className="mt-5" title="Please confirm your email address" action={<Button size="sm" variant="outline" onClick={resend}>Resend confirmation email</Button>}>
                    We sent a confirmation link to {user.email}. Confirming it connects purchases made with this email to your library.
                </Alert>
            )}
            <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
                <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:flex-col" aria-label="Account">
                    {NAV.map((n) => (
                        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium no-underline', isActive ? 'bg-accent-pale text-accent' : 'text-ink-soft hover:bg-surface hover:text-ink')}>
                            <n.icon className="h-4 w-4" /> {n.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="min-w-0">
                    <Suspense fallback={<PageLoader />}>
                        <Outlet />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
