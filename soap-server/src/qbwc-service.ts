// QBWC SOAP service — implements the methods that QuickBooks Web Connector calls.
// Each sync cycle: authenticate → sendRequestXML (loop) → receiveResponseXML (loop) → closeConnection

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import {
  parseExpenseResponse,
  parseVendorAddResponse,
  parseAccountQueryResponse,
  parseClassQueryResponse,
  parseVendorQueryResponse,
} from './qbxml.js';

// ---------------------------------------------------------------------------
// Supabase client (service_role — bypasses RLS)
// ---------------------------------------------------------------------------
let supabaseClient: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// ---------------------------------------------------------------------------
// Session tracking — maps ticket → company_id for the duration of a sync cycle
// ---------------------------------------------------------------------------
interface Session {
  companyId: string;
  currentQueueId: string | null; // tracks which queue item we last sent
  lastError: string;
}

const sessions = new Map<string, Session>();

// ---------------------------------------------------------------------------
// QBWC Service methods (called by the soap npm package)
// ---------------------------------------------------------------------------

export const qbwcService = {
  QBWebConnectorSvc: {
    QBWebConnectorSvcSoap: {
      // -----------------------------------------------------------------------
      // serverVersion — QBWC asks for our version string
      // -----------------------------------------------------------------------
      serverVersion() {
        return { serverVersionResult: '1.0.0' };
      },

      // -----------------------------------------------------------------------
      // clientVersion — QBWC tells us its version; we can reject old versions
      // -----------------------------------------------------------------------
      clientVersion(_args: { strVersion: string }) {
        // Return empty string = accept any version
        return { clientVersionResult: '' };
      },

      // -----------------------------------------------------------------------
      // authenticate — validate QBWC connection with shared password
      // Returns [ticket, status] where status is:
      //   "" = has work, "none" = no work, "nvu" = invalid user
      // -----------------------------------------------------------------------
      async authenticate(args: { strUserName: string; strPassword: string }) {
        const { strUserName, strPassword } = args;
        const ticket = crypto.randomUUID();
        console.log(`[QBWC] authenticate: user=${strUserName}`);

        try {
          const sb = getSupabase();
          const { data: conn, error } = await sb
            .from('qbd_connection')
            .select('*')
            .eq('company_id', strUserName)
            .eq('is_active', true)
            .single();

          if (error || !conn) {
            console.log(`[QBWC] authenticate: no active connection for ${strUserName}`);
            return { authenticateResult: { string: [ticket, 'nvu'] } };
          }

          // Verify password
          const valid = await bcrypt.compare(strPassword, conn.soap_password_hash);
          if (!valid) {
            console.log(`[QBWC] authenticate: invalid password for ${strUserName}`);
            return { authenticateResult: { string: [ticket, 'nvu'] } };
          }

          // Check if there's pending work in the queue
          const { count } = await sb
            .from('qbd_sync_queue')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', strUserName)
            .in('status', ['pending', 'sent']);

          sessions.set(ticket, {
            companyId: strUserName,
            currentQueueId: null,
            lastError: '',
          });

          if (!count || count === 0) {
            console.log(`[QBWC] authenticate: no pending work for ${strUserName}`);
            return { authenticateResult: { string: [ticket, 'none'] } };
          }

          console.log(`[QBWC] authenticate: ${count} pending items for ${strUserName}`);
          // Return empty string = company file doesn't matter, just process
          return { authenticateResult: { string: [ticket, ''] } };
        } catch (err) {
          console.error('[QBWC] authenticate error:', err);
          return { authenticateResult: { string: [ticket, 'nvu'] } };
        }
      },

      // -----------------------------------------------------------------------
      // sendRequestXML — return the next pending QBXML request from the queue
      // Called repeatedly until we return empty string (no more work)
      // -----------------------------------------------------------------------
      async sendRequestXML(args: { ticket: string }) {
        const session = sessions.get(args.ticket);
        if (!session) {
          console.log('[QBWC] sendRequestXML: no session for ticket');
          return { sendRequestXMLResult: '' };
        }

        try {
          const sb = getSupabase();

          // Get next pending queue item
          const { data: item, error } = await sb
            .from('qbd_sync_queue')
            .select('*')
            .eq('company_id', session.companyId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          if (error || !item) {
            console.log('[QBWC] sendRequestXML: no more pending items');
            return { sendRequestXMLResult: '' };
          }

          // Mark as sent
          await sb
            .from('qbd_sync_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', item.id);

          session.currentQueueId = item.id;
          console.log(`[QBWC] sendRequestXML: sending queue item ${item.id} (${item.request_type})`);

          return { sendRequestXMLResult: item.qbxml_request };
        } catch (err) {
          console.error('[QBWC] sendRequestXML error:', err);
          session.lastError = String(err);
          return { sendRequestXMLResult: '' };
        }
      },

      // -----------------------------------------------------------------------
      // receiveResponseXML — QBD sends back its response to our QBXML request
      // Return positive int = % complete, negative = error, 100 = done
      // -----------------------------------------------------------------------
      async receiveResponseXML(args: { ticket: string; response: string; hresult: string; message: string }) {
        const session = sessions.get(args.ticket);
        if (!session || !session.currentQueueId) {
          return { receiveResponseXMLResult: 100 };
        }

        const queueId = session.currentQueueId;
        session.currentQueueId = null;

        try {
          const sb = getSupabase();

          // Get the queue item to know its type
          const { data: item } = await sb
            .from('qbd_sync_queue')
            .select('*')
            .eq('id', queueId)
            .single();

          if (!item) {
            return { receiveResponseXMLResult: 100 };
          }

          // Check for QBWC-level error
          if (args.hresult) {
            console.error(`[QBWC] receiveResponseXML: hresult=${args.hresult} message=${args.message}`);
            await sb
              .from('qbd_sync_queue')
              .update({
                status: 'failed',
                error_message: `QBWC error: ${args.message || args.hresult}`,
                completed_at: new Date().toISOString(),
              })
              .eq('id', queueId);

            // Update expense if this was a submit
            if (item.request_type === 'expense_submit' && item.related_id) {
              await sb.from('expenses').update({
                qbo_error: `QBWC error: ${args.message || args.hresult}`,
                qbo_sync_attempts: (item as any).sync_attempts ?? 1,
                qbd_sync_status: 'failed',
              }).eq('id', item.related_id);
            }

            return { receiveResponseXMLResult: -1 };
          }

          // Parse response based on request type
          await processResponse(sb, item, args.response);

          // Check remaining pending items for progress
          const { count } = await sb
            .from('qbd_sync_queue')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', session.companyId)
            .in('status', ['pending']);

          if (!count || count === 0) {
            return { receiveResponseXMLResult: 100 };
          }

          // Return a percentage (approximate)
          return { receiveResponseXMLResult: 50 };
        } catch (err) {
          console.error('[QBWC] receiveResponseXML error:', err);
          session.lastError = String(err);
          return { receiveResponseXMLResult: -1 };
        }
      },

      // -----------------------------------------------------------------------
      // getLastError — QBWC asks for error details after negative response
      // -----------------------------------------------------------------------
      getLastError(args: { ticket: string }) {
        const session = sessions.get(args.ticket);
        return { getLastErrorResult: session?.lastError || 'Unknown error' };
      },

      // -----------------------------------------------------------------------
      // connectionError — QBWC reports a connection-level error
      // -----------------------------------------------------------------------
      connectionError(args: { ticket: string; hresult: string; message: string }) {
        console.error(`[QBWC] connectionError: hresult=${args.hresult} message=${args.message}`);
        return { connectionErrorResult: 'done' };
      },

      // -----------------------------------------------------------------------
      // closeConnection — sync cycle complete
      // -----------------------------------------------------------------------
      async closeConnection(args: { ticket: string }) {
        const session = sessions.get(args.ticket);
        if (session) {
          console.log(`[QBWC] closeConnection: company=${session.companyId}`);

          // Update last_sync_at
          try {
            const sb = getSupabase();
            await sb
              .from('qbd_connection')
              .update({ last_sync_at: new Date().toISOString() })
              .eq('company_id', session.companyId);
          } catch (err) {
            console.error('[QBWC] closeConnection: failed to update last_sync_at:', err);
          }

          sessions.delete(args.ticket);
        }
        return { closeConnectionResult: 'OK' };
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Response processors — update DB based on QBXML response content
// ---------------------------------------------------------------------------

async function processResponse(sb: SupabaseClient, item: any, responseXml: string) {
  const now = new Date().toISOString();

  switch (item.request_type) {
    case 'expense_submit': {
      const result = parseExpenseResponse(responseXml);
      if (result.error) {
        await sb.from('qbd_sync_queue').update({
          status: 'failed',
          qbxml_response: responseXml,
          error_message: result.error,
          completed_at: now,
        }).eq('id', item.id);

        if (item.related_id) {
          await sb.from('expenses').update({
            qbo_error: result.error,
            qbd_sync_status: 'failed',
          }).eq('id', item.related_id);
        }
      } else {
        await sb.from('qbd_sync_queue').update({
          status: 'completed',
          qbxml_response: responseXml,
          completed_at: now,
        }).eq('id', item.id);

        if (item.related_id) {
          await sb.from('expenses').update({
            qbo_purchase_id: result.txnId,
            qbo_pushed_at: now,
            qbo_error: null,
            qbd_sync_status: 'synced',
          }).eq('id', item.related_id);
        }
      }
      break;
    }

    case 'vendor_create': {
      const result = parseVendorAddResponse(responseXml);
      await sb.from('qbd_sync_queue').update({
        status: result.error ? 'failed' : 'completed',
        qbxml_response: responseXml,
        error_message: result.error,
        completed_at: now,
      }).eq('id', item.id);
      break;
    }

    case 'entity_sync': {
      // Parse based on what entity was queried (encoded in related_id)
      const entityType = item.related_id; // 'accounts', 'classes', or 'vendors'
      const companyId = item.company_id;

      if (entityType === 'accounts') {
        const accounts = parseAccountQueryResponse(responseXml);
        // Upsert into cache table
        for (const acc of accounts) {
          await sb.from('qbo_entity_accounts').upsert({
            realm_id: companyId,
            qbo_id: acc.listId,
            name: acc.name,
            fully_qualified_name: acc.fullName,
            account_type: acc.accountType,
            is_active: acc.isActive,
            synced_at: now,
          }, { onConflict: 'realm_id,qbo_id' });
        }
      } else if (entityType === 'classes') {
        const classes = parseClassQueryResponse(responseXml);
        for (const cls of classes) {
          await sb.from('qbo_entity_classes').upsert({
            realm_id: companyId,
            qbo_id: cls.listId,
            name: cls.name,
            fully_qualified_name: cls.fullName,
            is_active: cls.isActive,
            synced_at: now,
          }, { onConflict: 'realm_id,qbo_id' });
        }
      } else if (entityType === 'vendors') {
        const vendors = parseVendorQueryResponse(responseXml);
        for (const v of vendors) {
          await sb.from('qbo_entity_vendors').upsert({
            realm_id: companyId,
            qbo_id: v.listId,
            display_name: v.name,
            is_active: v.isActive,
            synced_at: now,
          }, { onConflict: 'realm_id,qbo_id' });
        }
      }

      await sb.from('qbd_sync_queue').update({
        status: 'completed',
        qbxml_response: responseXml,
        completed_at: now,
      }).eq('id', item.id);
      break;
    }

    default:
      console.warn(`[QBWC] Unknown request_type: ${item.request_type}`);
      await sb.from('qbd_sync_queue').update({
        status: 'completed',
        qbxml_response: responseXml,
        completed_at: now,
      }).eq('id', item.id);
  }
}
