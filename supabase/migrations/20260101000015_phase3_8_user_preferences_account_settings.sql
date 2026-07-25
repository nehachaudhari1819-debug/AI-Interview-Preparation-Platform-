-- Migration 15: Phase 3.8 User Preferences and Account Settings

-- 1. Create public.user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    locale VARCHAR(35) NOT NULL DEFAULT 'en' CHECK (length(trim(locale)) > 0),
    time_zone VARCHAR(64) NOT NULL DEFAULT 'UTC' CHECK (length(trim(time_zone)) > 0),
    practice_reminders_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    weekly_progress_summary_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    product_updates_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_created_at ON public.user_preferences(created_at);

-- 3. Set updated_at trigger
CREATE TRIGGER set_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION private.set_updated_at();

-- 4. Audit trigger for USER_PREFERENCES_UPDATED
CREATE OR REPLACE FUNCTION private.audit_user_preferences_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_changed_fields text[];
    v_actor_id uuid;
    v_actor_type text;
BEGIN
    v_changed_fields := ARRAY[]::text[];

    IF NEW.locale IS DISTINCT FROM OLD.locale THEN
        v_changed_fields := array_append(v_changed_fields, 'locale');
    END IF;
    IF NEW.time_zone IS DISTINCT FROM OLD.time_zone THEN
        v_changed_fields := array_append(v_changed_fields, 'timeZone');
    END IF;
    IF NEW.practice_reminders_enabled IS DISTINCT FROM OLD.practice_reminders_enabled THEN
        v_changed_fields := array_append(v_changed_fields, 'practiceRemindersEnabled');
    END IF;
    IF NEW.weekly_progress_summary_enabled IS DISTINCT FROM OLD.weekly_progress_summary_enabled THEN
        v_changed_fields := array_append(v_changed_fields, 'weeklyProgressSummaryEnabled');
    END IF;
    IF NEW.product_updates_enabled IS DISTINCT FROM OLD.product_updates_enabled THEN
        v_changed_fields := array_append(v_changed_fields, 'productUpdatesEnabled');
    END IF;

    -- If no approved fields changed, do not audit
    IF array_length(v_changed_fields, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Sort the array
    SELECT array_agg(f ORDER BY f) INTO v_changed_fields
    FROM unnest(v_changed_fields) AS f;

    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        v_actor_type := 'user';
    ELSE
        v_actor_type := 'system';
    END IF;

    INSERT INTO public.audit_logs (
        actor_user_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        metadata
    ) VALUES (
        v_actor_id,
        v_actor_type,
        'USER_PREFERENCES_UPDATED',
        'user_preferences',
        NEW.user_id,
        jsonb_build_object('changedFields', to_jsonb(v_changed_fields))
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_user_preferences_update_trigger ON public.user_preferences;
CREATE TRIGGER audit_user_preferences_update_trigger
AFTER UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION private.audit_user_preferences_update();

REVOKE EXECUTE ON FUNCTION private.audit_user_preferences_update() FROM public, anon, authenticated;

-- 5. Existing-User Backfill
INSERT INTO public.user_preferences (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- 6. Future-User Provisioning
CREATE OR REPLACE FUNCTION private.provision_user_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.provision_user_preferences() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS on_public_user_created_provision_preferences ON public.users;
CREATE TRIGGER on_public_user_created_provision_preferences
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION private.provision_user_preferences();

-- 7. Row-Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own preferences if active"
ON public.user_preferences
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() AND
    private.is_active_user()
);

CREATE POLICY "Users can update own preferences if active"
ON public.user_preferences
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid() AND
    private.is_active_user()
);

-- 8. Privileges
REVOKE ALL ON public.user_preferences FROM anon, public, authenticated;
GRANT SELECT, UPDATE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
