-- Compatibility placeholder for a migration version that already exists in the
-- linked remote project's migration history.
--
-- The final dashboard summary stats shape is defined by
-- 20260328150000_extend_dashboard_summary_with_stats.sql. Keeping this file in
-- the local migrations directory preserves migration-history alignment so
-- future `supabase db push` runs can proceed cleanly against environments
-- where 20260328143000 was already applied.

select 1;
