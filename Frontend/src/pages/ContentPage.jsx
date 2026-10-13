import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Seo, { breadcrumbLd } from '../components/layout/Seo';
import { AdSlot, Breadcrumbs, Markdown } from '../components/layout/Extras';
import { PageLoader } from '../components/ui';
import { get } from '../lib/api';
import { date } from '../lib/format';
import NotFound from './NotFound';

/** Admin-managed pages: Terms, Privacy, Refund Policy, Licensing, About, Accessibility and custom pages. */
export default function ContentPage() {
    const { slug } = useParams();
    const [page, setPage] = useState(null);
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        setPage(null);
        setMissing(false);
        get(`/pages/${slug}`)
            .then(setPage)
            .catch(() => setMissing(true));
    }, [slug]);

    if (missing) return <NotFound />;
    if (!page) return <PageLoader />;
    const crumbs = [{ name: 'Home', path: '/' }, { name: page.title, path: `/${page.slug}` }];
    return (
        <div className="container-page max-w-3xl py-10">
            <Seo title={page.seo?.title || page.title} description={page.seo?.description} noindex={page.seo?.noindex} jsonLd={breadcrumbLd(crumbs)} />
            <Breadcrumbs items={crumbs} />
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
            {page.type === 'legal' && <p className="mt-2 text-sm text-muted">Last updated {date(page.updatedAt)}</p>}
            <Markdown className="prose-openpage mt-6">{page.body}</Markdown>
            {page.type !== 'legal' && <AdSlot placement="content_bottom" />}
        </div>
    );
}
