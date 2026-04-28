const { createMollieClient } = require('@mollie/api-client');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

    const { amount, orderData, cart } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Ongeldig bedrag' });
    }

    const baseUrl = `https://${req.headers.host}`;

    // Beschrijving van de bestelling
    const beschrijving = cart.map(i => `${i.qty}x ${i.name}`).join(', ');

    try {
        const payment = await mollie.payments.create({
            amount: {
                currency: 'EUR',
                value: parseFloat(amount).toFixed(2)
            },
            description: `Luma bestelling — ${beschrijving}`,
            redirectUrl: `${baseUrl}/bedankt.html`,
            webhookUrl: `${baseUrl}/api/webhook`,
            profileId: process.env.MOLLIE_PROFILE_ID,
            metadata: {
                klant_naam: `${orderData.fname} ${orderData.lname}`,
                klant_email: orderData.email,
                klant_telefoon: orderData.phone || '',
                klant_adres: `${orderData.address}, ${orderData.zip} ${orderData.city}`,
                klant_opmerking: orderData.note || '',
                bestelling: JSON.stringify(cart),
                totaal: `€${amount}`
            }
        });

        res.json({ checkoutUrl: payment._links.checkout.href });

    } catch (err) {
        console.error('Mollie fout:', err);
        res.status(500).json({ error: 'Betaling aanmaken mislukt. Probeer opnieuw.' });
    }
};
