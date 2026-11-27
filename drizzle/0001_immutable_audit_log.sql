-- ACL / AAAA compliance vault: quotes_and_approvals is append-only.
-- UPDATE and DELETE are rejected for every role; demo reset uses TRUNCATE.
CREATE OR REPLACE FUNCTION forbid_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'quotes_and_approvals is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER quotes_and_approvals_immutable
  BEFORE UPDATE OR DELETE ON quotes_and_approvals
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();
