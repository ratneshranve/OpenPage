import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '../ui';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Uncaught runtime error caught by ErrorBoundary:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-danger shadow-inner mb-4">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-ink sm:text-3xl">Something unexpected happened</h1>
                    <p className="mt-2 max-w-md text-sm text-muted">
                        An error occurred while loading this section. You can refresh the page or return to the home page.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Button onClick={this.handleReload} size="md">
                            <RefreshCw className="h-4 w-4" /> Reload Page
                        </Button>
                        <Button onClick={this.handleGoHome} variant="outline" size="md">
                            <Home className="h-4 w-4" /> Go to Homepage
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
