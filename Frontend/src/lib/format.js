export const money = (minor, currency = 'INR') =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format((minor || 0) / 100);

export const moneyExact = (minor, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((minor || 0) / 100);

export const date = (d, opts = { dateStyle: 'medium' }) => (d ? new Intl.DateTimeFormat('en-IN', opts).format(new Date(d)) : '—');

export const dateTime = (d) => date(d, { dateStyle: 'medium', timeStyle: 'short' });

export const percentOff = (original, final) => (original && final < original ? Math.round(((original - final) / original) * 100) : 0);

export const fileSize = (bytes) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i += 1;
    }
    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
};

export const relative = (d) => {
    if (!d) return '';
    const diff = (new Date(d).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs < 60) return rtf.format(Math.round(diff), 'second');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
};

export const toRupees = (minor) => (minor == null || minor === '' ? '' : (minor / 100).toString());
export const toPaise = (rupees) => (rupees === '' || rupees == null ? null : Math.round(Number(rupees) * 100));

export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
