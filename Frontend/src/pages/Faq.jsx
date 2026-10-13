import { Link } from 'react-router-dom';
import Seo from '../components/layout/Seo';
import { Button } from '../components/ui';
import { useConfig } from '../context/ConfigContext';

export default function Faq() {
    const { config } = useConfig();
    const faqs = config?.homepage?.faqs || [];
    const ld = faqs.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) } : null;
    return (
        <div className="container-page max-w-3xl py-10">
            <Seo title="Frequently asked questions" description="Answers about buying, downloading and using OpenPage eBooks." jsonLd={ld} />
            <h1 className="text-3xl font-bold">Frequently asked questions</h1>
            <div className="mt-8 divide-y divide-line rounded-2xl border border-line">
                {faqs.map((f) => (
                    <details key={f.question} className="group p-5" open={faqs.length <= 3}>
                        <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                            {f.question}
                            <span className="text-xl text-muted transition group-open:rotate-45" aria-hidden>+</span>
                        </summary>
                        <p className="mt-3 text-[15px] leading-7 text-ink-soft">{f.answer}</p>
                    </details>
                ))}
            </div>
            <div className="mt-10 rounded-2xl bg-accent-pale p-6 text-center">
                <p className="font-semibold">Still have a question?</p>
                <Button as={Link} to="/support" variant="secondary" className="mt-3">Contact support</Button>
            </div>
        </div>
    );
}
