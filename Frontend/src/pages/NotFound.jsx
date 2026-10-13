import { Link } from 'react-router-dom';
import { BookX } from 'lucide-react';
import Seo from '../components/layout/Seo';
import { Button } from '../components/ui';

export default function NotFound({ title = 'Page not found', message = 'The page you are looking for does not exist or has moved.' }) {
    return (
        <div className="container-page flex flex-col items-center py-24 text-center">
            <Seo title={title} noindex />
            <BookX className="h-14 w-14 text-muted" aria-hidden />
            <h1 className="mt-4 text-3xl font-bold">{title}</h1>
            <p className="mt-2 max-w-md text-muted">{message}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button as={Link} to="/ebooks">
                    Browse eBooks
                </Button>
                <Button as={Link} to="/support" variant="outline">
                    Contact support
                </Button>
            </div>
        </div>
    );
}
