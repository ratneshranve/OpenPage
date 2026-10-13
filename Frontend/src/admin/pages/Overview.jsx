import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, IndianRupee, Mail, Receipt, RotateCcw, ShoppingCart, TrendingUp, XCircle } from 'lucide-react';
import { Alert, PageLoader, StatusBadge } from '../../components/ui';
import { DataTable, PageHeader, Panel, StatCard, useAdminData } from '../components/kit';
import { date, dateTime, money } from '../../lib/format';

export const RangePicker = ({ range, onChange }) => {
    const presets = [
        { label: '7 days', days: 7 },
        { label: '30 days', days: 30 },
        { label: '90 days', days: 90 },
        { label: '12 months', days: 365 },
    ];
    const iso = (d) => d.toISOString().slice(0, 10);
    return (
        <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
                <button
                    key={p.days}
                    type="button"
                    onClick={() => onChange({ from: iso(new Date(Date.now() - (p.days - 1) * 86400000)), to: iso(new Date()) })}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:bg-surface"
                >
                    {p.label}
                </button>
            ))}
            <label className="sr-only" htmlFor="from">From</label>
            <input id="from" type="date" value={range.from} onChange={(e) => onChange({ ...range, from: e.target.value })} className="input h-9 w-auto text-sm" />
            <span className="text-muted">to</span>
            <label className="sr-only" htmlFor="to">To</label>
            <input id="to" type="date" value={range.to} onChange={(e) => onChange({ ...range, to: e.target.value })} className="input h-9 w-auto text-sm" />
        </div>
    );
};

export const defaultRange = () => ({ from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) });

export default function Overview() {
    const [range, setRange] = useState(defaultRange);
    const navigate = useNavigate();
    const { data, error, loading } = useAdminData('/admin/dashboard', range);

    if (loading && !data) return <PageLoader />;
    if (error) return <Alert tone="error">{error}</Alert>;
    const t = data.totals;
    const emailFailed = data.emailStatus.failed || 0;

    return (
        <div className="space-y-6">
            <PageHeader title="Overview" description="Sales are first-party records from payments verified with Razorpay." actions={<RangePicker range={range} onChange={setRange} />} />
            {emailFailed > 0 && (
                <Alert tone="warning" title={`${emailFailed} email${emailFailed > 1 ? 's' : ''} failed in this period`} action={<Link to="/admin/email-logs?status=failed">Review email logs</Link>}>
                    Email could not be sent. Please review the email logs.
                </Alert>
            )}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Gross sales" value={money(t.gross)} icon={IndianRupee} tone="green" hint={`${t.paidOrders} paid orders`} />
                <StatCard label="Net after refunds" value={money(t.net)} icon={TrendingUp} tone="green" hint={`Refunded ${money(t.refunded)}`} />
                <StatCard label="Estimated net" value={money(t.estimatedNet)} hint={`After gateway fees of ${money(t.gatewayFees)}`} />
                <StatCard label="Average order value" value={money(t.averageOrderValue)} icon={Receipt} tone="blue" />
                <StatCard label="Successful payments" value={t.paidOrders} icon={CheckCircle2} tone="green" />
                <StatCard label="Failed payments" value={t.failedPayments} icon={XCircle} tone="red" />
                <StatCard label="Pending payments" value={t.pendingPayments} icon={Clock} tone="blue" />
                <StatCard label="Abandoned checkouts" value={t.abandonedCheckouts} icon={ShoppingCart} hint="Verified email, not paid" />
            </div>

            <Panel title="Sales by day" description={`${date(data.range.from)} to ${date(data.range.to)}`}>
                {data.salesByDay.length ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.salesByDay.map((d) => ({ day: d._id.slice(5), revenue: d.revenue / 100, orders: d.orders }))}>
                                <defs>
                                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f0" />
                                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} width={60} />
                                <Tooltip formatter={(v, n) => (n === 'revenue' ? `₹${v.toLocaleString('en-IN')}` : v)} />
                                <Area type="monotone" dataKey="revenue" stroke="#16a34a" fill="url(#rev)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="py-10 text-center text-sm text-muted">No paid orders in this period.</p>
                )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Top-selling products">
                    <DataTable
                        rows={data.topProducts}
                        rowKey={(r) => r._id}
                        empty="No sales yet."
                        columns={[
                            { key: 'title', label: 'Product' },
                            { key: 'units', label: 'Units', className: 'text-right' },
                            { key: 'revenue', label: 'Revenue', className: 'text-right', render: (r) => money(r.revenue) },
                        ]}
                    />
                </Panel>
                <Panel title="Coupon usage">
                    <DataTable
                        rows={data.couponUsage}
                        rowKey={(r) => r._id}
                        empty="No coupon or offer redemptions in this period."
                        columns={[
                            { key: 'name', label: 'Offer', render: (r) => <>{r.name}{r.code && <code className="ml-1 rounded bg-surface px-1 text-xs">{r.code}</code>}</> },
                            { key: 'uses', label: 'Uses', className: 'text-right' },
                            { key: 'discount', label: 'Discount given', className: 'text-right', render: (r) => money(r.discount) },
                        ]}
                    />
                </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Panel title="Recent orders" className="lg:col-span-2" actions={<Link to="/admin/orders" className="text-sm">All orders</Link>}>
                    <DataTable
                        rows={data.recentOrders}
                        onRowClick={(r) => navigate(`/admin/orders/${r._id}`)}
                        columns={[
                            { key: 'orderNumber', label: 'Order' },
                            { key: 'email', label: 'Email', className: 'max-w-[180px] truncate' },
                            { key: 'total', label: 'Total', render: (r) => money(r.total, r.currency) },
                            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                            { key: 'deliveryStatus', label: 'Delivery', render: (r) => <StatusBadge status={r.deliveryStatus} /> },
                            { key: 'createdAt', label: 'Date', render: (r) => dateTime(r.createdAt) },
                        ]}
                    />
                </Panel>
                <div className="space-y-6">
                    <Panel title="Email delivery" actions={<Mail className="h-4 w-4 text-muted" />}>
                        <ul className="space-y-1.5 text-sm">
                            {['sent', 'queued', 'sending', 'failed', 'suppressed', 'cancelled'].map((s) => (
                                <li key={s} className="flex justify-between"><StatusBadge status={s} /> <span className="font-medium">{data.emailStatus[s] || 0}</span></li>
                            ))}
                        </ul>
                    </Panel>
                    <Panel title="Recent refund activity" actions={<RotateCcw className="h-4 w-4 text-muted" />}>
                        {data.recentRefunds.length ? (
                            <ul className="space-y-2 text-sm">
                                {data.recentRefunds.map((r) => (
                                    <li key={r._id} className="flex items-center justify-between gap-2">
                                        <Link to={`/admin/refunds/${r._id}`}>{r.refundNumber}</Link>
                                        <StatusBadge status={r.status} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted">No refund requests.</p>
                        )}
                    </Panel>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Email campaigns" actions={<Link to="/admin/campaigns" className="text-sm">Manage</Link>}>
                    {data.campaigns.length ? (
                        <ul className="divide-y divide-line text-sm">
                            {data.campaigns.map((c) => (
                                <li key={c._id} className="flex justify-between py-2"><span>{c.name}</span><span className="text-muted">{c.stats.sent}/{c.stats.recipients} sent</span></li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-muted">No campaigns sent yet.</p>}
                </Panel>
                <Panel title="Notification campaigns" actions={<Link to="/admin/notifications" className="text-sm">Manage</Link>}>
                    {data.notifications.length ? (
                        <ul className="divide-y divide-line text-sm">
                            {data.notifications.map((c) => (
                                <li key={c._id} className="flex justify-between py-2"><span>{c.title}</span><span className="text-muted">{c.stats.delivered} delivered</span></li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-muted">No notifications sent yet.</p>}
                </Panel>
            </div>
            {t.pendingPayments > 0 && (
                <p className="flex items-center gap-2 text-xs text-muted"><AlertTriangle className="h-3.5 w-3.5" /> Pending payments are reconciled automatically with Razorpay every few minutes.</p>
            )}
        </div>
    );
}
