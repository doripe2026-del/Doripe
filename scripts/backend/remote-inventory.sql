-- Doripe backend read-only inventory.
-- Run only with a read-only connection and capture the result before any remote migration.
-- This file intentionally contains SELECT statements only.

select 'migration_history' as section, coalesce(jsonb_agg(row_to_json(m) order by m.version), '[]'::jsonb) as value
from (
  select version, name
  from supabase_migrations.schema_migrations
) m;

select 'public_tables' as section, coalesce(jsonb_agg(row_to_json(t) order by t.table_name), '[]'::jsonb) as value
from (
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
) t;

select 'rls' as section, coalesce(jsonb_agg(row_to_json(t) order by t.tablename), '[]'::jsonb) as value
from (
  select tablename, rowsecurity, forcerowsecurity
  from pg_tables
  where schemaname = 'public'
) t;

select 'policies' as section, coalesce(jsonb_agg(row_to_json(p) order by p.tablename, p.policyname), '[]'::jsonb) as value
from (
  select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
  where schemaname in ('public', 'storage')
) p;

select 'grants' as section, coalesce(jsonb_agg(row_to_json(g) order by g.table_schema, g.table_name, g.grantee, g.privilege_type), '[]'::jsonb) as value
from (
  select table_schema, table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema in ('public', 'storage')
) g;

select 'storage_buckets' as section, coalesce(jsonb_agg(row_to_json(b) order by b.id), '[]'::jsonb) as value
from (
  select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
) b;

select 'row_estimates' as section, coalesce(jsonb_agg(row_to_json(r) order by r.table_name), '[]'::jsonb) as value
from (
  select relname as table_name, n_live_tup::bigint as estimated_rows
  from pg_stat_user_tables
  where schemaname = 'public'
) r;

select 'storage_object_counts' as section, coalesce(jsonb_agg(row_to_json(o) order by o.bucket_id), '[]'::jsonb) as value
from (
  select bucket_id, count(*)::bigint as object_count
  from storage.objects
  group by bucket_id
) o;
