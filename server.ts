import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractInvoicePricesFromBase64,
  InvoiceExtractionHttpError,
} from './server/extractInvoicePrices.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Support large PDF invoices encoded as base64
  app.use(express.json({ limit: '25mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Extract part references & purchase prices (AED) from a supplier PDF or image invoice
  app.post('/api/extract-invoice-prices', async (req, res) => {
    try {
      const result = await extractInvoicePricesFromBase64({
        fileName: req.body?.fileName,
        mimeType: req.body?.mimeType,
        dataBase64: req.body?.dataBase64,
      });
      res.json(result);
    } catch (err: any) {
      console.error('[extract-invoice-prices] Error:', err);
      if (err instanceof InvoiceExtractionHttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({
        error: String(err?.message || 'Erreur lors de la lecture de la facture.'),
      });
    }
  });

  // Mount Vite in dev, or serve static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
