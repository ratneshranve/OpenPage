/**
 * Shared email wrapper. Inline styles only, table-free single column for broad
 * client support. Colours follow the site theme: navy text, green primary, blue links.
 */
export const wrapEmail = ({ body, preheader = '', siteName, siteUrl, supportEmail, unsubscribeUrl, logoUrl, year }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${siteName}</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1f3d;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
  <div style="padding:8px 0 20px;">
    <a href="${siteUrl}" style="text-decoration:none;color:#0f1f3d;font-size:22px;font-weight:700;">
      ${logoUrl ? `<img src="${logoUrl}" alt="${siteName}" height="32" style="vertical-align:middle;border:0;">` : `<span style="color:#16a34a;">Open</span><span style="color:#2563eb;">Page</span>`}
    </a>
  </div>
  <div style="background:#ffffff;border:1px solid #e5e9f0;border-radius:12px;padding:28px 24px;line-height:1.6;font-size:15px;">
    ${body}
  </div>
  <div style="padding:20px 4px;font-size:12px;color:#5b6b86;line-height:1.6;">
    <p style="margin:0 0 6px;">Need help? Contact <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a> or visit <a href="${siteUrl}/support" style="color:#2563eb;">our support page</a>.</p>
    ${unsubscribeUrl ? `<p style="margin:0 0 6px;">You are receiving this because you opted in to updates from ${siteName}. <a href="${unsubscribeUrl}" style="color:#2563eb;">Unsubscribe</a>.</p>` : ''}
    <p style="margin:0;">&copy; ${year} ${siteName}</p>
  </div>
</div>
</body></html>`;

export const button = (href, label) =>
    `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">${label}</a></p>`;
