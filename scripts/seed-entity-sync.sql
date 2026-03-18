-- Entity sync: Queue account/vendor/class refresh to update the Supabase cache.
-- Run this AFTER the seed items have been processed by QBWC (all show 'completed' in queue).
-- Run in Supabase SQL Editor.

DO $$
DECLARE
  v_company_id TEXT;
BEGIN
  SELECT company_id INTO v_company_id
  FROM qbd_connection
  WHERE is_active = true
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No active QBD connection found.';
  END IF;

  -- Queue account sync
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (
    v_company_id,
    'entity_sync',
    '<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <AccountQueryRq>
      <ActiveStatus>ActiveOnly</ActiveStatus>
    </AccountQueryRq>
  </QBXMLMsgsRq>
</QBXML>',
    'accounts',
    'pending'
  );

  -- Queue vendor sync
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (
    v_company_id,
    'entity_sync',
    '<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <VendorQueryRq>
      <ActiveStatus>ActiveOnly</ActiveStatus>
    </VendorQueryRq>
  </QBXMLMsgsRq>
</QBXML>',
    'vendors',
    'pending'
  );

  RAISE NOTICE 'Queued 2 entity sync items (accounts + vendors). Wait for QBWC to sync.';
END $$;
