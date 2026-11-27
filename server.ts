import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Clé API Gemini introuvable côté serveur. Vérifiez la configuration dans Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.code;
      const msg = String(err?.message || '');
      const isRetryable =
        status === 429 ||
        status === 503 ||
        msg.includes('503') ||
        msg.includes('overloaded') ||
        msg.includes('UNAVAILABLE');
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 900 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

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
      const { fileName, mimeType, dataBase64 } = req.body as {
        fileName?: string;
        mimeType?: string;
        dataBase64?: string;
      };

      if (!dataBase64 || typeof dataBase64 !== 'string') {
        res.status(400).json({ error: 'Fichier manquant ou vide.' });
        return;
      }

      const normalizedMime = (mimeType || 'application/pdf').toLowerCase();
      if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        res.status(400).json({
          error: 'Format non pris en charge. Veuillez importer un fichier PDF ou une image (JPG, PNG, WEBP).',
        });
        return;
      }

      const cleanBase64 = dataBase64.includes(',')
        ? dataBase64.split(',').pop() || ''
        : dataBase64;

      const ai = getGeminiClient();

      const filePart = {
        inlineData: {
          mimeType: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime,
          data: cleanBase64,
        },
      };

      const promptPart = {
        text: `Tu es un expert en extraction de factures fournisseurs de pièces détachées d'engins lourds (Dubaï / Émirats Arabes Unis : CAT, Perkins, CTP, ITR, Komatsu, Donaldson, Volvo, etc.).
Analyse TOUTES les pages de ce document (${fileName || 'facture.pdf'}) et extrais chaque ligne de pièce détachée avec une précision maximale.

Règles strictes :
1. "partReference" : le numéro de référence exact de la pièce (Part No / Ref / Item Code / OEM, ex: 1R-0750, 326-1644, 6I-2501, 26560143). Ne jamais omettre les tirets ou lettres s'ils figurent dans la colonne Part No.
2. "description" : désignation de la pièce telle qu'indiquée sur la facture.
3. "brand" : marque / fabricant si indiqué sur la ligne ou dans l'en-tête (ex: CAT, CTP, ITR, ORIGINAL, DONALDSON, PERKINS). Laisser "" si non précisé.
4. "quantity" : quantité facturée (nombre positif, 1 par défaut si illisible).
5. "unitPrice" : le PRIX D'ACHAT UNITAIRE (Unit Price / Rate / Price). Si la facture indique un prix unitaire net après remise de ligne, utiliser le prix unitaire net. Si seul le montant total de la ligne est visible, calculer lineTotal / quantity. Conserver les décimales exactes (ex: 18.50, 125.75).
6. "lineTotal" : montant total de la ligne (nombre).
7. "currency" : devise de la facture normalisée en code ISO à 3 lettres ("AED" si AED / DHS / Dirham / Dhs / Dhs., "USD" si USD / $, "EUR" si EUR / €, "FCFA" si FCFA / XOF). Par défaut "AED" si ambigu sur une facture des Émirats.
8. Ne PAS inclure les lignes de sous-total, TVA/VAT, transport, fret, frais bancaires ou grand total dans "items".
9. Extrais TOUTES les lignes de pièces sur toutes les pages sans en sauter aucune.`,
      };

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: { parts: [filePart, promptPart] },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                supplierName: {
                  type: Type.STRING,
                  description: 'Nom du fournisseur sur la facture',
                },
                invoiceNumber: {
                  type: Type.STRING,
                  description: 'Numéro de facture fournisseur',
                },
                invoiceDate: {
                  type: Type.STRING,
                  description: 'Date de la facture (format YYYY-MM-DD si possible)',
                },
                currency: {
                  type: Type.STRING,
                  description: 'Devise normalisée (AED, USD, EUR, FCFA)',
                },
                items: {
                  type: Type.ARRAY,
                  description: 'Toutes les lignes de pièces extraites de la facture',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      partReference: {
                        type: Type.STRING,
                        description: 'Référence pièce exacte (Part No / OEM)',
                      },
                      description: {
                        type: Type.STRING,
                        description: 'Désignation de la pièce',
                      },
                      brand: {
                        type: Type.STRING,
                        description: 'Marque ou constructeur (ex: CAT, CTP, ITR) ou vide',
                      },
                      quantity: {
                        type: Type.NUMBER,
                        description: 'Quantité achetée',
                      },
                      unitPrice: {
                        type: Type.NUMBER,
                        description: "Prix d'achat unitaire exact",
                      },
                      lineTotal: {
                        type: Type.NUMBER,
                        description: 'Total de la ligne',
                      },
                    },
                    required: ['partReference', 'unitPrice'],
                  },
                },
              },
              required: ['currency', 'items'],
            },
          },
        })
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: "Aucune donnée n'a pu être extraite de ce document." });
        return;
      }

      const parsed = JSON.parse(rawText);
      const rawCurrency = String(parsed.currency || 'AED').trim().toUpperCase();
      const normalizedCurrency =
        rawCurrency === 'DHS' || rawCurrency === 'DIRHAM' || rawCurrency === 'DH'
          ? 'AED'
          : rawCurrency || 'AED';

      const items = Array.isArray(parsed.items)
        ? parsed.items
            .map((it: any) => {
              const qty = Math.max(0, Number(it?.quantity) || 1);
              let unitPrice = Math.max(0, Number(it?.unitPrice) || 0);
              const lineTotal = Math.max(0, Number(it?.lineTotal) || 0);
              if (unitPrice <= 0 && lineTotal > 0 && qty > 0) {
                unitPrice = Math.round((lineTotal / qty) * 100) / 100;
              } else {
                unitPrice = Math.round(unitPrice * 100) / 100;
              }
              return {
                partReference: String(it?.partReference || '').trim(),
                description: String(it?.description || '').trim(),
                brand: String(it?.brand || '').trim(),
                quantity: qty,
                unitPrice,
                lineTotal: lineTotal > 0 ? Math.round(lineTotal * 100) / 100 : Math.round(unitPrice * qty * 100) / 100,
              };
            })
            .filter((it: any) => it.partReference.length > 0 && it.unitPrice > 0)
        : [];

      res.json({
        supplierName: String(parsed.supplierName || '').trim(),
        invoiceNumber: String(parsed.invoiceNumber || '').trim(),
        invoiceDate: String(parsed.invoiceDate || '').trim(),
        currency: normalizedCurrency,
        items,
      });
    } catch (err: any) {
      console.error('[extract-invoice-prices] Error:', err);
      const msg = String(err?.message || 'Erreur lors de la lecture de la facture.');
      if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || err?.status === 403) {
        res.status(403).json({
          error:
            "Clé API Gemini invalide ou non autorisée. Vérifiez votre clé dans Settings > Secrets.",
        });
        return;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
        res.status(429).json({
          error:
            "Quota API temporairement atteint. Réessayez dans quelques secondes ou vérifiez votre clé dans Settings > Secrets.",
        });
        return;
      }
      res.status(500).json({ error: msg });
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
