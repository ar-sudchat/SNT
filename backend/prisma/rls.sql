-- KruScan Row Level Security (defense-in-depth under the Prisma tenant extension).
-- Idempotent: safe to re-run after every `prisma db push` / migrate deploy.
-- GUCs are set per TRANSACTION by config/database.js (set_config(..., true)) — never per connection.
--   app.tenant_id  = current tenant id      (scoped request path)
--   app.bypass_rls = 'on'                   (withoutTenant()/platform paths only)
-- FORCE is required because the app role currently owns the tables (owner bypasses RLS otherwise).
-- Membership/Tenant/User are global (read during auth before a tenant is known) and are NOT covered.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['AcademicYear','Grade','Class','Student','Teacher','Subject','Task',
                           'QRCode','Submission','AiConversation','AiMessage','Invite','AuditLog',
                           'AssessmentTemplate','AssessmentRecord','AssessmentScore','TaskRoom']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("tenantId" = current_setting(''app.tenant_id'', true)) WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_bypass ON %I', t);
    EXECUTE format('CREATE POLICY tenant_bypass ON %I USING (current_setting(''app.bypass_rls'', true) = ''on'') WITH CHECK (current_setting(''app.bypass_rls'', true) = ''on'')', t);
  END LOOP;
END $$;
