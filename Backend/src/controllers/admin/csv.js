const cell = (value) => {
    let s = value === null || value === undefined ? '' : String(value);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const sendCsv = (res, filename, rows) => {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'no-store');
    res.send(`﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`);
};
