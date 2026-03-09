// BMB QBWC SOAP Server
// Bridges the Supabase queue to QuickBooks Desktop via Web Connector.
// Deploy to Railway, Render, or any persistent Node.js host with HTTPS.

import 'dotenv/config';
import express from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import soap from 'soap';
import { qbwcService } from './qbwc-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8080', 10);

const app = express();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bmb-qbwc-soap-server' });
});

// .qwc file download endpoint (for client setup)
app.get('/qwc', (_req, res) => {
  const serverUrl = process.env.SOAP_SERVER_URL || `http://localhost:${PORT}`;
  const qwc = generateQwcFile(serverUrl);
  res.set('Content-Type', 'application/xml');
  res.set('Content-Disposition', 'attachment; filename="BMBReceiptScanner.qwc"');
  res.send(qwc);
});

// Start HTTP server, then mount SOAP service
const server = app.listen(PORT, () => {
  const wsdlPath = join(__dirname, 'qbwc.wsdl');
  const wsdlXml = readFileSync(wsdlPath, 'utf-8');

  const soapServer = soap.listen(app, '/qbwc', qbwcService, wsdlXml, () => {
    console.log(`[SOAP] QBWC SOAP server listening on port ${PORT}`);
    console.log(`[SOAP] WSDL: http://localhost:${PORT}/qbwc?wsdl`);
    console.log(`[SOAP] QWC file: http://localhost:${PORT}/qwc`);
    console.log(`[SOAP] Health: http://localhost:${PORT}/health`);
  });

  // Log all SOAP XML for debugging
  soapServer.log = (type: string, data: unknown) => {
    if (type === 'received' || type === 'replied') {
      const xml = typeof data === 'string' ? data : '';
      console.log(`[SOAP-${type}] ${xml.substring(0, 600)}`);
    }
  };
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SOAP] Received SIGTERM, shutting down...');
  server.close(() => process.exit(0));
});

// ---------------------------------------------------------------------------
// QWC file generator
// ---------------------------------------------------------------------------
function generateQwcFile(serverUrl: string): string {
  // Stable IDs — these must not change between downloads or QBWC will re-register
  return `<?xml version="1.0"?>
<QBWCXML>
  <AppName>BMB Receipt Scanner</AppName>
  <AppID>bmb-receipt-scanner-qbwc</AppID>
  <AppURL>${serverUrl}/qbwc</AppURL>
  <AppDescription>Syncs receipt expenses from BMB Scanner to QuickBooks Desktop</AppDescription>
  <AppSupport>${serverUrl}/health</AppSupport>
  <UserName>bmb-scanner</UserName>
  <OwnerID>{b4e5f6a7-1234-5678-9abc-def012345678}</OwnerID>
  <FileID>{c5f6a7b8-2345-6789-abcd-ef0123456789}</FileID>
  <QBType>QBFS</QBType>
  <Scheduler>
    <RunEveryNMinutes>5</RunEveryNMinutes>
  </Scheduler>
  <IsReadOnly>false</IsReadOnly>
</QBWCXML>`;
}
