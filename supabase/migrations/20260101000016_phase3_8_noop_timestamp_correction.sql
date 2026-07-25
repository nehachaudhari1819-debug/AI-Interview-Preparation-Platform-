-- Migration 16: Phase 3.8 No-op Timestamp Correction

DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON public.user_preferences;

CREATE TRIGGER set_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    WHEN (
        NEW.locale IS DISTINCT FROM OLD.locale OR
        NEW.time_zone IS DISTINCT FROM OLD.time_zone OR
        NEW.practice_reminders_enabled IS DISTINCT FROM OLD.practice_reminders_enabled OR
        NEW.weekly_progress_summary_enabled IS DISTINCT FROM OLD.weekly_progress_summary_enabled OR
        NEW.product_updates_enabled IS DISTINCT FROM OLD.product_updates_enabled
    )
    EXECUTE FUNCTION private.set_updated_at();
