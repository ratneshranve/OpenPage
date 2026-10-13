/**
 * Minimal, safe template engine for admin-editable emails.
 *   {{path.to.value}}     HTML-escaped value
 *   {{{path}}}            raw value (only for trusted, server-built HTML)
 *   {{#if path}}..{{else}}..{{/if}}
 *   {{#each path}}..{{this.field}}..{{/each}}
 * Unknown variables render as empty strings.
 */
const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const lookup = (ctx, path) => {
    const parts = path.trim().split('.');
    let value = parts[0] === 'this' ? ctx.this : ctx[parts[0]] ?? ctx.this?.[parts[0]];
    const start = parts[0] === 'this' ? 1 : 1;
    for (let i = start; i < parts.length; i += 1) {
        if (value == null) return undefined;
        value = value[parts[i]];
    }
    return value;
};

// Find the matching closing tag for a block, accounting for nesting of the same block type.
const findBlockEnd = (tpl, from, name) => {
    const open = new RegExp(`{{#${name}\\b`, 'g');
    const close = new RegExp(`{{/${name}}}`, 'g');
    let depth = 1;
    let pos = from;
    while (depth > 0) {
        open.lastIndex = pos;
        close.lastIndex = pos;
        const o = open.exec(tpl);
        const c = close.exec(tpl);
        if (!c) return -1;
        if (o && o.index < c.index) {
            depth += 1;
            pos = o.index + o[0].length;
        } else {
            depth -= 1;
            pos = c.index + c[0].length;
            if (depth === 0) return c.index;
        }
    }
    return -1;
};

const splitElse = (body) => {
    let depth = 0;
    const re = /{{#if\b[^}]*}}|{{\/if}}|{{else}}/g;
    let m;
    while ((m = re.exec(body))) {
        if (m[0].startsWith('{{#if')) depth += 1;
        else if (m[0] === '{{/if}}') depth -= 1;
        else if (depth === 0) return [body.slice(0, m.index), body.slice(m.index + m[0].length)];
    }
    return [body, ''];
};

export const render = (tpl, ctx) => {
    let out = '';
    let i = 0;
    const blockRe = /{{#(if|each)\s+([^}]+)}}/g;
    while (i < tpl.length) {
        blockRe.lastIndex = i;
        const m = blockRe.exec(tpl);
        if (!m) {
            out += renderVars(tpl.slice(i), ctx);
            break;
        }
        out += renderVars(tpl.slice(i, m.index), ctx);
        const [, kind, path] = m;
        const bodyStart = m.index + m[0].length;
        const end = findBlockEnd(tpl, bodyStart, kind);
        if (end === -1) {
            out += renderVars(tpl.slice(m.index), ctx);
            break;
        }
        const body = tpl.slice(bodyStart, end);
        const value = lookup(ctx, path);
        if (kind === 'if') {
            const [yes, no] = splitElse(body);
            const truthy = Array.isArray(value) ? value.length > 0 : Boolean(value);
            out += render(truthy ? yes : no, ctx);
        } else if (Array.isArray(value)) {
            value.forEach((item, index) => {
                out += render(body, { ...ctx, this: item, '@index': index });
            });
        }
        i = end + `{{/${kind}}}`.length;
    }
    return out;
};

const renderVars = (text, ctx) =>
    text
        .replace(/{{{\s*([\w.@]+)\s*}}}/g, (_, p) => String(lookup(ctx, p) ?? ''))
        .replace(/{{\s*([\w.@]+)\s*}}/g, (_, p) => escapeHtml(lookup(ctx, p)));

export const htmlToText = (html) =>
    String(html)
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();

export { escapeHtml };
