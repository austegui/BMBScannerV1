// QBXML builder and parser utilities for QuickBooks Desktop integration.
// QBD uses XML messages (QBXML) instead of REST API calls.

const QBXML_HEADER = `<?xml version="1.0"?>\n<?qbxml version="16.0"?>`;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Expense submission QBXML
// ---------------------------------------------------------------------------

export interface ExpenseLineItem {
  accountFullName: string;
  amount: number;
  classFullName?: string;
  memo?: string;
}

export interface ExpenseSubmitData {
  paymentAccountFullName: string; // Credit card or bank account
  txnDate: string;               // YYYY-MM-DD
  vendorFullName: string;
  memo?: string;
  lines: ExpenseLineItem[];
  paymentType: 'credit_card' | 'check';
}

export function buildExpenseQbxml(data: ExpenseSubmitData): string {
  if (data.paymentType === 'credit_card') {
    return buildCreditCardChargeAdd(data);
  }
  return buildCheckAdd(data);
}

function buildCreditCardChargeAdd(data: ExpenseSubmitData): string {
  const lines = data.lines.map(line => `
        <ExpenseLineAdd>
          <AccountRef><FullName>${escapeXml(line.accountFullName)}</FullName></AccountRef>
          <Amount>${line.amount.toFixed(2)}</Amount>${
    line.classFullName ? `
          <ClassRef><FullName>${escapeXml(line.classFullName)}</FullName></ClassRef>` : ''
  }${
    line.memo ? `
          <Memo>${escapeXml(line.memo)}</Memo>` : ''
  }
        </ExpenseLineAdd>`).join('');

  return `${QBXML_HEADER}
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CreditCardChargeAddRq>
      <CreditCardChargeAdd>
        <AccountRef><FullName>${escapeXml(data.paymentAccountFullName)}</FullName></AccountRef>
        <TxnDate>${data.txnDate}</TxnDate>
        <EntityRef><FullName>${escapeXml(data.vendorFullName)}</FullName></EntityRef>${
    data.memo ? `
        <Memo>${escapeXml(data.memo)}</Memo>` : ''
  }${lines}
      </CreditCardChargeAdd>
    </CreditCardChargeAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

function buildCheckAdd(data: ExpenseSubmitData): string {
  const lines = data.lines.map(line => `
        <ExpenseLineAdd>
          <AccountRef><FullName>${escapeXml(line.accountFullName)}</FullName></AccountRef>
          <Amount>${line.amount.toFixed(2)}</Amount>${
    line.classFullName ? `
          <ClassRef><FullName>${escapeXml(line.classFullName)}</FullName></ClassRef>` : ''
  }${
    line.memo ? `
          <Memo>${escapeXml(line.memo)}</Memo>` : ''
  }
        </ExpenseLineAdd>`).join('');

  return `${QBXML_HEADER}
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CheckAddRq>
      <CheckAdd>
        <AccountRef><FullName>${escapeXml(data.paymentAccountFullName)}</FullName></AccountRef>
        <TxnDate>${data.txnDate}</TxnDate>
        <PayeeEntityRef><FullName>${escapeXml(data.vendorFullName)}</FullName></PayeeEntityRef>${
    data.memo ? `
        <Memo>${escapeXml(data.memo)}</Memo>` : ''
  }${lines}
      </CheckAdd>
    </CheckAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// ---------------------------------------------------------------------------
// Vendor QBXML
// ---------------------------------------------------------------------------

export function buildVendorAddQbxml(name: string): string {
  return `${QBXML_HEADER}
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <VendorAddRq>
      <VendorAdd>
        <Name>${escapeXml(name)}</Name>
      </VendorAdd>
    </VendorAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// ---------------------------------------------------------------------------
// Entity query QBXML (for syncing accounts, classes, vendors)
// ---------------------------------------------------------------------------

export function buildAccountQueryQbxml(): string {
  return `${QBXML_HEADER}
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <AccountQueryRq>
      <ActiveStatus>ActiveOnly</ActiveStatus>
    </AccountQueryRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

export function buildClassQueryQbxml(): string {
  return `${QBXML_HEADER}
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <ClassQueryRq>
      <ActiveStatus>ActiveOnly</ActiveStatus>
    </ClassQueryRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

export function buildVendorQueryQbxml(): string {
  return `${QBXML_HEADER}
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <VendorQueryRq>
      <ActiveStatus>ActiveOnly</ActiveStatus>
    </VendorQueryRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// ---------------------------------------------------------------------------
// Response parsers — extract data from QBXML responses
// ---------------------------------------------------------------------------

// Simple regex-based XML value extractor (avoids heavy DOM parser dependency)
function extractTagValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`);
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function extractAllBlocks(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}>[\\s\\S]*?</${tagName}>`, 'g');
  return xml.match(regex) || [];
}

export function extractStatusCode(xml: string): number {
  const match = xml.match(/statusCode="(\d+)"/);
  return match ? parseInt(match[1], 10) : -1;
}

export function extractStatusMessage(xml: string): string {
  const match = xml.match(/statusMessage="([^"]*)"/);
  return match ? match[1] : 'Unknown error';
}

// Parse CreditCardChargeAddRs or CheckAddRs — extract TxnID
export function parseExpenseResponse(xml: string): { txnId: string | null; error: string | null } {
  const statusCode = extractStatusCode(xml);
  if (statusCode !== 0) {
    return { txnId: null, error: extractStatusMessage(xml) };
  }
  const txnId = extractTagValue(xml, 'TxnID');
  return { txnId, error: null };
}

// Parse VendorAddRs
export function parseVendorAddResponse(xml: string): { listId: string | null; error: string | null } {
  const statusCode = extractStatusCode(xml);
  if (statusCode !== 0) {
    return { listId: null, error: extractStatusMessage(xml) };
  }
  const listId = extractTagValue(xml, 'ListID');
  return { listId, error: null };
}

// Parse AccountQueryRs
export interface QbdAccount {
  listId: string;
  name: string;
  fullName: string;
  accountType: string;
  isActive: boolean;
}

export function parseAccountQueryResponse(xml: string): QbdAccount[] {
  const blocks = extractAllBlocks(xml, 'AccountRet');
  return blocks.map(block => ({
    listId: extractTagValue(block, 'ListID') || '',
    name: extractTagValue(block, 'Name') || '',
    fullName: extractTagValue(block, 'FullName') || '',
    accountType: extractTagValue(block, 'AccountType') || '',
    isActive: extractTagValue(block, 'IsActive') !== 'false',
  }));
}

// Parse ClassQueryRs
export interface QbdClass {
  listId: string;
  name: string;
  fullName: string;
  isActive: boolean;
}

export function parseClassQueryResponse(xml: string): QbdClass[] {
  const blocks = extractAllBlocks(xml, 'ClassRet');
  return blocks.map(block => ({
    listId: extractTagValue(block, 'ListID') || '',
    name: extractTagValue(block, 'Name') || '',
    fullName: extractTagValue(block, 'FullName') || '',
    isActive: extractTagValue(block, 'IsActive') !== 'false',
  }));
}

// Parse VendorQueryRs
export interface QbdVendor {
  listId: string;
  name: string;
  isActive: boolean;
}

export function parseVendorQueryResponse(xml: string): QbdVendor[] {
  const blocks = extractAllBlocks(xml, 'VendorRet');
  return blocks.map(block => ({
    listId: extractTagValue(block, 'ListID') || '',
    name: extractTagValue(block, 'Name') || '',
    isActive: extractTagValue(block, 'IsActive') !== 'false',
  }));
}
