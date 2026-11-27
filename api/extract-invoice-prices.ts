import {
  extractInvoicePricesFromBase64,
  InvoiceExtractionHttpError,
} from '../server/extractInvoicePrices.ts';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    return;
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    const result = await extractInvoicePricesFromBase64({
      fileName: body.fileName,
      mimeType: body.mimeType,
      dataBase64: body.dataBase64,
    });

    res.status(200).json(result);
  } catch (err: any) {
    console.error('[api/extract-invoice-prices] Error:', err);
    if (err instanceof InvoiceExtractionHttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({
      error: String(err?.message || 'Erreur lors de la lecture de la facture.'),
    });
  }
}
