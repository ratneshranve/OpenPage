import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingCart, User, X, LayoutDashboard } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { cn } from '../ui';

export const Logo = ({ className }) => {
    const { config } = useConfig();
    const logo = config?.general?.logoUrl;
    return (
        <Link to="/" className={cn('flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink no-underline hover:text-ink', className)} aria-label={`${config?.general?.siteName || 'OpenPage'} home`}>
            {logo ? (
                <img src={logo} alt="" className="h-8 w-auto" />
            ) : (
                <>
                    <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
                        <path d="M12 16c8-2 14 0 20 4v30c-6-4-12-6-20-4z" fill="#16a34a" />
                        <path d="M52 16c-8-2-14 0-20 4v30c6-4 12-6 20-4z" fill="#2563eb" />
                    </svg>
                    <span>
                        <span className="text-brand">Open</span>
                        <span className="text-accent">Page</span>
                    </span>
                </>
            )}
        </Link>
    );
};

const NAV = [
    { to: '/ebooks', label: 'All eBooks' },
    { to: '/categories', label: 'Categories' },
    { to: '/support', label: 'Support' },
];

function SearchBox({ onDone, className }) {
    const navigate = useNavigate();
    const { search } = useLocation();
    const [q, setQ] = useState(() => new URLSearchParams(search).get('q') || '');
    return (
        <form
            role="search"
            className={cn('relative', className)}
            onSubmit={(e) => {
                e.preventDefault();
                navigate(q.trim() ? `/ebooks?q=${encodeURIComponent(q.trim())}` : '/ebooks');
                onDone?.();
            }}
        >
            <label htmlFor="site-search" className="sr-only">
                Search eBooks
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="site-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search eBooks, topics, authors…" className="input h-10 rounded-full pl-9 text-sm" />
        </form>
    );
}

export default function Header() {
    const { count } = useCart();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const { pathname } = useLocation();

    useEffect(() => setOpen(false), [pathname]);

    return (
        <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
                Skip to content
            </a>
            <div className="container-page flex h-16 items-center gap-4">
                <Logo />
                <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
                    {NAV.map((n) => (
                        <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('rounded-lg px-3 py-2 text-sm font-medium no-underline', isActive ? 'bg-accent-pale text-accent' : 'text-ink-soft hover:bg-surface hover:text-ink')}>
                            {n.label}
                        </NavLink>
                    ))}
                </nav>
                <SearchBox className="ml-auto hidden w-full max-w-xs lg:block" />
                <div className="ml-auto flex items-center gap-1 lg:ml-2">
                    {user?.role === 'admin' && (
                        <Link to="/admin" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft no-underline hover:bg-surface sm:flex">
                            <LayoutDashboard className="h-4 w-4" /> Admin
                        </Link>
                    )}
                    <Link to={user ? '/account' : '/login'} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft no-underline hover:bg-surface hover:text-ink" aria-label={user ? 'My account' : 'Sign in'}>
                        <User className="h-5 w-5" />
                        <span className="hidden sm:inline">{user ? 'Account' : 'Sign in'}</span>
                    </Link>
                    <Link to="/cart" className="relative flex items-center rounded-lg p-2 text-ink-soft no-underline hover:bg-surface hover:text-ink" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
                        <ShoppingCart className="h-5 w-5" />
                        {count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{count}</span>}
                    </Link>
                    <button type="button" className="rounded-lg p-2 text-ink-soft hover:bg-surface md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu">
                        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>
            <div className="container-page pb-3 lg:hidden">
                <SearchBox />
            </div>
            {open && (
                <nav id="mobile-nav" className="border-t border-line bg-white md:hidden" aria-label="Mobile">
                    <div className="container-page flex flex-col py-2">
                        {NAV.map((n) => (
                            <NavLink key={n.to} to={n.to} className="rounded-lg px-3 py-3 text-base font-medium text-ink no-underline hover:bg-surface">
                                {n.label}
                            </NavLink>
                        ))}
                        {user?.role === 'admin' && (
                            <NavLink to="/admin" className="rounded-lg px-3 py-3 text-base font-medium text-ink no-underline hover:bg-surface">
                                Admin dashboard
                            </NavLink>
                        )}
                    </div>
                </nav>
            )}
        </header>
    );
}
