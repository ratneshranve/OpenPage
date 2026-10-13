import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ConfigProvider } from './context/ConfigContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ConsentProvider } from './context/ConsentContext';
import { captureAttribution } from './lib/attribution';
import './index.css';

// Server-rendered meta tags (for crawlers) are replaced by React-managed ones once the app runs.
document.querySelectorAll('[data-ssr-meta]').forEach((el) => el.remove());
captureAttribution();

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <ConfigProvider>
                <AuthProvider>
                    <ConsentProvider>
                        <CartProvider>
                            <App />
                            <Toaster
                                position="top-center"
                                toastOptions={{
                                    duration: 4000,
                                    style: { borderRadius: '12px', border: '1px solid #e5e9f0', color: '#0f1f3d', fontSize: '14px' },
                                    success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
                                    error: { duration: 6000, iconTheme: { primary: '#b91c1c', secondary: '#fff' } },
                                }}
                            />
                        </CartProvider>
                    </ConsentProvider>
                </AuthProvider>
            </ConfigProvider>
        </BrowserRouter>
    </StrictMode>
);
