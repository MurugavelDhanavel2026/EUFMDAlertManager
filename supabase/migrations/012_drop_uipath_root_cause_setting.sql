-- Remove the orphaned root-cause-analysis configuration.
-- The "Run Root Cause Analysis" feature (Alerts page button + Admin config
-- section) has been removed, so the seeded app_settings row is now unused.
DELETE FROM public.app_settings WHERE key = 'uipath_root_cause';
