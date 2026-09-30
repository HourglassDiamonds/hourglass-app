# Source Note revision privilege alignment

This change aligns Production with Preview and the checked-in Source Note SQL.
It removes direct table privileges from the `anon` and `authenticated` roles on
`public.continuum_source_note_revisions`. It does not change the table, its RLS
setting or policies, the Source Note mutation function, or Project Jobs.

The migration is safe to apply where those grants are already absent: PostgreSQL
`REVOKE` succeeds without changing anything when a targeted role has none of the
specified privileges. No deployment is performed by this repository change.

## Verification runbook

Before applying the migration, save the current grants:

```sql
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'continuum_source_note_revisions'
  and grantee in ('postgres', 'service_role', 'anon', 'authenticated')
order by grantee, privilege_type;
```

Apply only
`supabase/migrations/20260929211152_revoke_source_note_revision_client_privileges.sql`
through the normal reviewed migration process. Then run the query above again.
The `postgres` and `service_role` rows must be unchanged, and the following query
must return zero rows:

```sql
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'continuum_source_note_revisions'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
```

Finally, confirm that the existing RLS boundary is unchanged: RLS remains enabled
and there are still zero policies on the table.

```sql
select
  c.relrowsecurity as rls_enabled,
  count(p.policyname) as policy_count
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
left join pg_catalog.pg_policies as p
  on p.schemaname = n.nspname
 and p.tablename = c.relname
where n.nspname = 'public'
  and c.relname = 'continuum_source_note_revisions'
group by c.relrowsecurity;
```

Expected result: `rls_enabled = true` and `policy_count = 0`.
