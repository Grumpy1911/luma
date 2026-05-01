const { createMollieClient } = require('@mollie/api-client');

const SUPABASE_URL = 'https://pgexambwfqchlkhlbywo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZXhhbWJ3ZnFjaGxraGxieXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjg4MTMsImV4cCI6MjA5MTk0NDgxM30.DjLTRsAUTf4r8XD3CgXt1cJRtzj4y8TnP2Y8lqNVp3U';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
    const { id } = req.body;
    if (!id) return res.status(400).end();

    try {
        const payment = await mollie.payments.get(id);

        if (payment.status === 'paid') {
            const meta = payment.metadata || {};
            let bestelling = [];
            try { bestelling = JSON.parse(meta.bestelling || '[]'); } catch(e) {}

            // ── 1. Sla bestelling op in Supabase ──────────────────────────────
            const sbKey = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
            try {
                await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': sbKey,
                        'Authorization': `Bearer ${sbKey}`,
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify({
                        id: payment.id,
                        status: 'nieuw',
                        klant_naam: meta.klant_naam || '',
                        klant_email: meta.klant_email || '',
                        klant_telefoon: meta.klant_telefoon || '',
                        klant_adres: meta.klant_adres || '',
                        klant_opmerking: meta.klant_opmerking || '',
                        bestelling: bestelling,
                        totaal: meta.totaal || '',
                        mollie_status: payment.status
                    })
                });
                console.log('✅ Bestelling opgeslagen in Supabase:', payment.id);
            } catch(e) {
                console.error('Supabase opslaan mislukt:', e);
            }

            // ── 2. Stuur e-mail naar info@luma-lights.be via SendGrid ────────
            if (process.env.SENDGRID_API_KEY) {
                try {
                    await fetch('https://api.sendgrid.com/v3/mail/send', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`
                        },
                        body: JSON.stringify({
                            personalizations: [{ to: [{ email: 'info@luma-lights.be' }] }],
                            from: { email: 'info@luma-lights.be', name: 'Luma Webshop' },
                            subject: `Nieuwe bestelling — ${meta.klant_naam} (${meta.totaal})`,
                            content: [{ type: 'text/html', value: buildEmailHTML(meta, bestelling) }]
                        })
                    });
                    console.log('✅ E-mail verstuurd naar info@luma-lights.be via SendGrid');
                } catch(e) {
                    console.error('E-mail versturen mislukt:', e);
                }
            } else {
                console.warn('⚠️ SENDGRID_API_KEY niet ingesteld — geen e-mail verstuurd');
            }
        }

        res.status(200).end();

    } catch (err) {
        console.error('Webhook fout:', err);
        res.status(500).end();
    }
};

function buildEmailHTML(meta, bestelling) {
    const rows = bestelling.map(i =>
        `<tr>
            <td style="padding:10px 12px;border-bottom:1px solid #f0ebe3">${i.qty}× ${i.name}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0ebe3;text-align:right;white-space:nowrap">€${(i.price * i.qty).toFixed(2)}</td>
        </tr>`
    ).join('');

    return `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#faf7f2;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.07)">
    <div style="background:#5C3D2E;padding:28px 32px">
        <div style="font-size:22px;color:#fff;font-weight:300;letter-spacing:4px">LUMA</div>
        <div style="color:rgba(255,255,255,.6);font-size:12px;letter-spacing:2px;margin-top:4px">LIGHTS</div>
    </div>
    <div style="padding:32px">
        <h2 style="color:#5C3D2E;font-size:18px;margin:0 0 24px 0;font-weight:500">🛒 Nieuwe bestelling ontvangen</h2>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <tr><td style="padding:6px 0;color:#888;font-size:13px;width:110px">Naam</td><td style="padding:6px 0;font-size:14px;color:#3D3330"><strong>${meta.klant_naam || '-'}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px">E-mail</td><td style="padding:6px 0;font-size:14px;color:#3D3330">${meta.klant_email || '-'}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px">Telefoon</td><td style="padding:6px 0;font-size:14px;color:#3D3330">${meta.klant_telefoon || '-'}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px">Adres</td><td style="padding:6px 0;font-size:14px;color:#3D3330">${meta.klant_adres || '-'}</td></tr>
            ${meta.klant_opmerking ? `<tr><td style="padding:6px 0;color:#888;font-size:13px">Opmerking</td><td style="padding:6px 0;font-size:14px;color:#3D3330">${meta.klant_opmerking}</td></tr>` : ''}
        </table>

        <h3 style="color:#5C3D2E;font-size:14px;font-weight:600;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:.5px">Bestelling</h3>
        <table style="width:100%;border-collapse:collapse;background:#faf7f2;border-radius:8px;overflow:hidden">
            ${rows}
            <tr style="background:#f0ebe3">
                <td style="padding:12px;font-weight:700;color:#5C3D2E">Totaal (incl. BTW)</td>
                <td style="padding:12px;font-weight:700;color:#5C3D2E;text-align:right">${meta.totaal || '-'}</td>
            </tr>
        </table>

        <div style="margin-top:28px;text-align:center">
            <a href="https://luma-deploy-flax.vercel.app/admin.html" style="background:#6B7C4E;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;font-size:14px;font-weight:600">Bekijk in beheerpaneel →</a>
        </div>
    </div>
    <div style="background:#f5f1ea;padding:16px 32px;text-align:center;font-size:11px;color:#a89e95">
        Luma — Thomas &amp; Olivier · Weynesbaan 23, 2820 Rijmenam · info@luma-lights.be
    </div>
</div>
</body></html>`;
}
