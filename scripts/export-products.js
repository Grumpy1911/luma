#!/usr/bin/env node
// Exports the live Luma product catalog from Supabase into marketing/products.json.
// Run locally (needs internet): `node scripts/export-products.js`
// Uses the public anon key already shipped in index.html — no secrets, read-only.

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://pgexambwfqchlkhlbywo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZXhhbWJ3ZnFjaGxraGxieXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNjg4MTMsImV4cCI6MjA5MTk0NDgxM30.DjLTRsAUTf4r8XD3CgXt1cJRtzj4y8TnP2Y8lqNVp3U';

async function main() {
  const url = `${SUPABASE_URL}/rest/v1/luma_data?key=eq.products&select=value`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`Supabase request failed: ${res.status} ${res.statusText}`);
  }

  const rows = await res.json();
  const products = rows[0] && rows[0].value;

  if (!products || !products.length) {
    console.error('No products found in Supabase (luma_data key="products"). Add products via admin.html first.');
    process.exit(1);
  }

  const outPath = path.join(__dirname, '..', 'marketing', 'products.json');
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2) + '\n');

  console.log(`Exported ${products.length} products to marketing/products.json\n`);
  for (const p of products) {
    const price = p.oldPrice ? `€${p.price} (was €${p.oldPrice})` : `€${p.price}`;
    console.log(`- ${p.name} [${p.category}] — ${price}`);
  }
}

main().catch((err) => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
