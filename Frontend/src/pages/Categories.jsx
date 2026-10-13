import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import Seo from '../components/layout/Seo';
import { Skeleton } from '../components/ui';
import { get } from '../lib/api';

export default function Categories() {
    const [cats, setCats] = useState(null);
    useEffect(() => {
        get('/categories').then(setCats).catch(() => setCats([]));
    }, []);
    return (
        <div className="container-page py-10">
            <Seo title="Categories" description="Browse OpenPage eBooks by topic: AI automation, business operations, marketing, productivity and more." />
            <h1 className="text-3xl font-bold">Browse by topic</h1>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {!cats && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
                {cats?.map((c) => (
                    <Link key={c._id} to={`/category/${c.slug}`} className="card flex gap-4 p-6 no-underline transition hover:border-accent hover:bg-accent-pale">
                        {c.image ? <img src={c.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <BookOpen className="h-8 w-8 shrink-0 text-accent" />}
                        <div>
                            <h2 className="font-semibold text-ink">{c.name}</h2>
                            {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>}
                            <p className="mt-2 text-xs font-medium text-accent">{c.productCount} eBook{c.productCount === 1 ? '' : 's'}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
