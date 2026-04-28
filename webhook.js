const { createMollieClient } = require('@mollie/api-client');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).end();

    const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

    const { id } = req.body;

    if (!id) return res.status(400).end();

    try {
        const payment = await mollie.payments.get(id);

        if (payment.status === 'paid') {
            // Betaling geslaagd — log de info
            console.log('✅ Betaling ontvangen:', {
                id: payment.id,
                bedrag: payment.amount,
                klant: payment.metadata?.klant_naam,
                email: payment.metadata?.klant_email,
                bestelling: payment.metadata?.bestelling
            });

            // TODO: Hier kan je later een e-mail sturen via bijv. Resend of SendGrid
        }

        res.status(200).end();

    } catch (err) {
        console.error('Webhook fout:', err);
        res.status(500).end();
    }
};
