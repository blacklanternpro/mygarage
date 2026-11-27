-- Stage 2: Row-Level Security for AWS Sydney (ap-southeast-2) Postgres.
-- Not applied in Stage 1 (PGlite runs as the table owner). Apply after the Drizzle migrations
-- with a non-owner application role. The app sets the tenant per transaction:
--   SET LOCAL app.workshop_id = '<uuid>';
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'households','customers','vehicles','service_records','inspection_reports','findings',
    'mod_quote_requests','fixed_quotes','quotes_and_approvals','bookings','messages','reminders',
    'wallet_passes','payments','ingestion_jobs','media_assets','nevdis_lookups','adapter_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (workshop_id = current_setting(''app.workshop_id'')::uuid) '
      'WITH CHECK (workshop_id = current_setting(''app.workshop_id'')::uuid)', t);
  END LOOP;
END $$;

-- Workshops: a session may only see its own row.
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
CREATE POLICY workshop_self ON workshops USING (id = current_setting('app.workshop_id')::uuid);
