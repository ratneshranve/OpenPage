import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { Alert, Button, PageLoader, StatusBadge } from '../../components/ui';
import { DataTable, PageHeader, Panel, StatCard, downloadCsv, useAdminData } from '../components/kit';
import { RangePicker, defaultRange } from './Overview';
import { money } from '../../lib/format';

const pct = (v) => `${(v * 100).toFixed(1)}%`;

export default function Analytics() {
    const [range, setRange] = useState(defaultRange);
    const { data, error, loading } = useAdminData('/admin/analytics', range);
    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    const f = data.checkoutFunnel;
    return (
        <div className="space-y-6">
            <PageHeader
                title="Analytics and reports"
                description="Figures come from OpenPage's own order records. Advertising platforms (Meta, Google Ads) use their own attribution models, so their numbers may not match exactly."
                actions={
                    <>
                        <RangePicker range={range} onChange={setRange} />
                        <Button variant="outline" size="sm" onClick={() => downloadCsv('/admin/analytics/export', range, 'sales-by-product.csv')}><Download className="h-4 w-4" /> Export</Button>
                    </>
                }
            />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <StatCard label="Checkouts started" value={f.sessions} />
                <StatCard label="Emails verified" value={f.verified} hint={f.sessions ? pct(f.verified / f.sessions) : ''} />
                <StatCard label="Orders created" value={f.ordersCreated} />
                <StatCard label="Paid orders" value={f.paid} hint={`Conversion ${pct(f.conversionRate)}`} tone="green" />
                <StatCard label="Recovered by reminders" value={f.recovered} hint={`${f.reminded} reminded · ${pct(f.recoveryRate)}`} />
            </div>
            <Panel title="Revenue by product">
                {data.salesByProduct.length > 0 && (
                    <div className="mb-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.salesByProduct.slice(0, 10).map((p) => ({ name: p.title.length > 18 ? `${p.title.slice(0, 18)}…` : p.title, revenue: p.revenue / 100 }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 12 }} width={60} />
                                <Tooltip formatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
                                <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <DataTable
                    rows={data.salesByProduct}
                    rowKey={(r) => r._id}
                    empty="No sales in this period."
                    columns={[
                        { key: 'title', label: 'Product' },
                        { key: 'units', label: 'Units', className: 'text-right' },
                        { key: 'discounts', label: 'Discounts', className: 'text-right', render: (r) => money(r.discounts) },
                        { key: 'revenue', label: 'Revenue', className: 'text-right', render: (r) => money(r.revenue) },
                    ]}
                />
            </Panel>
            <Panel title="Traffic sources (first-party attribution)" description="Captured from UTM parameters, click IDs and referrers when the visitor arrived.">
                <DataTable
                    rows={data.bySource}
                    rowKey={(r) => JSON.stringify(r._id)}
                    empty="No attributed orders."
                    columns={[
                        { key: 'source', label: 'Source', render: (r) => r._id.source },
                        { key: 'medium', label: 'Medium', render: (r) => r._id.medium },
                        { key: 'campaign', label: 'Campaign', render: (r) => r._id.campaign || '—' },
                        { key: 'orders', label: 'Orders', className: 'text-right' },
                        { key: 'revenue', label: 'Revenue', className: 'text-right', render: (r) => money(r.revenue) },
                    ]}
                />
            </Panel>
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Email automations">
                    <DataTable
                        rows={data.automations}
                        columns={[
                            { key: 'name', label: 'Automation' },
                            { key: 'enabled', label: 'State', render: (r) => <StatusBadge status={r.enabled ? 'active' : 'paused'} /> },
                            { key: 'sent', label: 'Sent', className: 'text-right', render: (r) => r.stats?.sent || 0 },
                            { key: 'failed', label: 'Failed', className: 'text-right', render: (r) => r.stats?.failed || 0 },
                        ]}
                    />
                </Panel>
                <Panel title="Campaign results">
                    <DataTable
                        rows={[...data.emailCampaigns.map((c) => ({ ...c, kind: 'Email', label: c.name, delivered: c.stats.sent })), ...data.notificationCampaigns.map((c) => ({ ...c, kind: 'Push', label: c.title, delivered: c.stats.delivered }))]}
                        empty="No campaigns in this period."
                        columns={[
                            { key: 'kind', label: 'Type' },
                            { key: 'label', label: 'Campaign' },
                            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                            { key: 'delivered', label: 'Delivered', className: 'text-right' },
                        ]}
                    />
                </Panel>
            </div>
        </div>
    );
}
