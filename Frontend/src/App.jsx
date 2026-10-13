import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import { CookieBanner } from './components/layout/Extras';
import { PageLoader, Alert, Button } from './components/ui';
import { useAuth } from './context/AuthContext';
import { useConfig } from './context/ConfigContext';
import { trackPageView } from './lib/tracking';

import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Product from './pages/Product';
import Cart from './pages/Cart';
import NotFound from './pages/NotFound';

const Categories = lazy(() => import('./pages/Categories'));
const Checkout = lazy(() => import('./pages/Checkout'));
const CheckoutResume = lazy(() => import('./pages/CheckoutResume'));
const OrderStatus = lazy(() => import('./pages/OrderStatus'));
const Auth = lazy(() => import('./pages/Auth'));
const Download = lazy(() => import('./pages/Download'));
const Support = lazy(() => import('./pages/Support'));
const ContentPage = lazy(() => import('./pages/ContentPage'));
const Faq = lazy(() => import('./pages/Faq'));
const Utility = lazy(() => import('./pages/Utility'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout'));
const AccountPages = lazy(() => import('./pages/account/AccountPages'));
const AdminApp = lazy(() => import('./admin/AdminApp'));

function ScrollAndTrack() {
    const { pathname, search } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
        trackPageView();
    }, [pathname, search]);
    return null;
}

function SiteLayout() {
    const { error, reload } = useConfig();
    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main id="main" className="flex-1">
                {error && (
                    <div className="container-page pt-6">
                        <Alert tone="error" title="We are having trouble connecting" action={<Button size="sm" variant="outline" onClick={reload}>Try again</Button>}>
                            Some content could not be loaded. Please check your connection.
                        </Alert>
                    </div>
                )}
                <Suspense fallback={<PageLoader />}>
                    <Outlet />
                </Suspense>
            </main>
            <Footer />
            <CookieBanner />
        </div>
    );
}

export function RequireAuth({ children, admin }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <PageLoader />;
    if (!user) return <Navigate to={admin ? '/admin/login' : `/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
    return children;
}

export default function App() {
    return (
        <>
            <ScrollAndTrack />
            <Routes>
                <Route path="/admin/*" element={<Suspense fallback={<PageLoader label="Loading admin…" />}><AdminApp /></Suspense>} />
                <Route element={<SiteLayout />}>
                    <Route index element={<Home />} />
                    <Route path="ebooks" element={<Catalog />} />
                    <Route path="ebooks/:slug" element={<Product />} />
                    <Route path="category/:slug" element={<Catalog />} />
                    <Route path="categories" element={<Categories />} />
                    <Route path="cart" element={<Cart />} />
                    <Route path="checkout" element={<Checkout />} />
                    <Route path="checkout/resume" element={<CheckoutResume />} />
                    <Route path="order/:orderNumber" element={<OrderStatus />} />
                    <Route path="login" element={<Auth mode="login" />} />
                    <Route path="register" element={<Auth mode="register" />} />
                    <Route path="forgot-password" element={<Auth mode="forgot" />} />
                    <Route path="reset-password" element={<Auth mode="reset" />} />
                    <Route path="verify-email" element={<Auth mode="verify" />} />
                    <Route path="download" element={<Download />} />
                    <Route path="download/:token" element={<Download />} />
                    <Route path="support" element={<Support />} />
                    <Route path="contact" element={<Support contact />} />
                    <Route path="faq" element={<Faq />} />
                    <Route path="unsubscribe" element={<Utility kind="unsubscribe" />} />
                    <Route path="newsletter/confirm" element={<Utility kind="newsletter" />} />
                    <Route path="cookie-preferences" element={<Utility kind="cookies" />} />
                    <Route
                        path="account"
                        element={
                            <RequireAuth>
                                <AccountLayout />
                            </RequireAuth>
                        }
                    >
                        <Route index element={<AccountPages page="overview" />} />
                        <Route path="orders" element={<AccountPages page="orders" />} />
                        <Route path="orders/:orderNumber" element={<AccountPages page="order" />} />
                        <Route path="library" element={<AccountPages page="library" />} />
                        <Route path="preferences" element={<AccountPages page="preferences" />} />
                        <Route path="support" element={<AccountPages page="support" />} />
                    </Route>
                    <Route path=":slug" element={<ContentPage />} />
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </>
    );
}
