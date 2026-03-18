-- Seed script: Create client's real accounts + vendor in the test QB sample company.
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/lgodlepuythshpzayzba/sql)
--
-- IMPORTANT: Run the cleanup query first if you had previous failed attempts:
--   DELETE FROM qbd_sync_queue WHERE request_type IN ('account_create','vendor_create')
--     AND related_id IN ('Ameris Business Visa','Computer and IT Services','Expense-Warehouse',
--       'Meals and Entertainment','Postage','Supplies-Office','Vehicle Fuel','Vehicle Maintenance','Ameris Pcard');

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

  RAISE NOTICE 'Using company_id: %', v_company_id;

  -- 1. Credit Card Account: Ameris Business Visa (2010)
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (v_company_id, 'account_create',
'<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
<QBXMLMsgsRq onError="stopOnError">
<AccountAddRq>
<AccountAdd>
<Name>Ameris Business Visa</Name>
<AccountType>CreditCard</AccountType>
<AccountNumber>2010</AccountNumber>
</AccountAdd>
</AccountAddRq>
</QBXMLMsgsRq>
</QBXML>',
  'Ameris Business Visa', 'pending');

  -- 2. Computer and IT Services (6050)
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (v_company_id, 'account_create',
'<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
<QBXMLMsgsRq onError="stopOnError">
<AccountAddRq>
<AccountAdd>
<Name>Computer and IT Services</Name>
<AccountType>Expense</AccountType>
<AccountNumber>6050</AccountNumber>
</AccountAdd>
</AccountAddRq>
</QBXMLMsgsRq>
</QBXML>',
  'Computer and IT Services', 'pending');

  -- 3. Expense-Warehouse (6520)
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (v_company_id, 'account_create',
'<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
<QBXMLMsgsRq onError="stopOnError">
<AccountAddRq>
<AccountAdd>
<Name>Expense-Warehouse</Name>
<AccountType>Expense</AccountType>
<AccountNumber>6520</AccountNumber>
</AccountAdd>
</AccountAddRq>
</QBXMLMsgsRq>
</QBXML>',
  'Expense-Warehouse', 'pending');

  -- 4. Meals and Entertainment (6710)
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (v_company_id, 'account_create',
'<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
<QBXMLMsgsRq onError="stopOnError">
<AccountAddRq>
<AccountAdd>
<Name>Meals and Entertainment</Name>
<AccountType>Expense</AccountType>
<AccountNumber>6710</AccountNumber>
</AccountAdd>
</AccountAddRq>
</QBXMLMsgsRq>
</QBXML>',
  'Meals and Entertainment', 'pending');

  -- 5. Postage (6350)
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (v_company_id, 'account_create',
'<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
<QBXMLMsgsRq onError="stopOnError">
<AccountAddRq>
<AccountAdd>
<Name>Postage</Name>
<AccountType>Expense</AccountType>
<AccountNumber>6350</AccountNumber>
</AccountAdd>
</AccountAddRq>
</QBXMLMsgsRq>
</QBXML>',
  'Postage', 'pending');

  -- 6. Supplies-Office (6500)
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (v_company_id, 'account_create',
'<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
<QBXMLMsgsRq onError="stopOnError">
<AccountAddRq>
<AccountAdd>
<Name>Supplies-Office</Name>
<AccountType>Expense</AccountType>
<AccountNumber>6500</AccountNumber>
</AccountAdd>
</AccountAddRq>
</QBXMLMsgsRq>
</QBXML>',
  'Supplies-Office', 'pending');

  -- 7. Vehicle Fuel (6910)
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (v_company_id, 'account_create',
'<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
<QBXMLMsgsRq onError="stopOnError">
<AccountAddRq>
<AccountAdd>
<Name>Vehicle Fuel</Name>
<AccountType>Expense</AccountType>
<AccountNumber>6910</AccountNumber>
</AccountAdd>
</AccountAddRq>
</QBXMLMsgsRq>
</QBXML>',
  'Vehicle Fuel', 'pending');

  -- 8. Vehicle Maintenance (6953)
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (v_company_id, 'account_create',
'<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
<QBXMLMsgsRq onError="stopOnError">
<AccountAddRq>
<AccountAdd>
<Name>Vehicle Maintenance</Name>
<AccountType>Expense</AccountType>
<AccountNumber>6953</AccountNumber>
</AccountAdd>
</AccountAddRq>
</QBXMLMsgsRq>
</QBXML>',
  'Vehicle Maintenance', 'pending');

  -- 9. Vendor: Ameris Pcard
  INSERT INTO qbd_sync_queue (company_id, request_type, qbxml_request, related_id, status)
  VALUES (v_company_id, 'vendor_create',
'<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
<QBXMLMsgsRq onError="stopOnError">
<VendorAddRq>
<VendorAdd>
<Name>Ameris Pcard</Name>
</VendorAdd>
</VendorAddRq>
</QBXMLMsgsRq>
</QBXML>',
  'Ameris Pcard', 'pending');

  RAISE NOTICE 'Queued 9 items (1 CC account + 7 expense accounts + 1 vendor).';
END $$;
