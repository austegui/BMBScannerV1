-- Clean up stale/duplicate queue items that are blocking new expense submissions.
-- Old entity_sync and sent items from lost sessions clog the queue.

-- Delete old entity_sync items that are still pending (duplicates from repeated clicks)
DELETE FROM qbd_sync_queue
WHERE request_type = 'entity_sync'
  AND status = 'pending'
  AND created_at < NOW() - INTERVAL '1 hour';

-- Reset stuck 'sent' items back to pending (from lost SOAP server sessions after redeploy)
UPDATE qbd_sync_queue
SET status = 'failed', error_message = 'Stale: SOAP server session lost'
WHERE status = 'sent'
  AND sent_at < NOW() - INTERVAL '30 minutes';
