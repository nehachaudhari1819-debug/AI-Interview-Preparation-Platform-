-- Migration 09: Phase 3 Authorization RLS Integration

-- 1. Create narrow account-access state resolver
CREATE OR REPLACE FUNCTION public.get_current_account_access_state()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_account_status text;
    v_deleted_at timestamptz;
BEGIN
    SELECT account_status, deleted_at INTO v_account_status, v_deleted_at
    FROM public.users
    WHERE id = (SELECT auth.uid());

    IF NOT FOUND THEN
        RETURN 'missing';
    END IF;

    IF v_deleted_at IS NOT NULL THEN
        RETURN 'deleted';
    END IF;

    IF v_account_status = 'active' THEN
        RETURN 'active';
    END IF;

    IF v_account_status = 'suspended' THEN
        RETURN 'disabled';
    END IF;

    IF v_account_status IN ('deletion_pending', 'deleted') THEN
        RETURN 'deleted';
    END IF;

    -- Fail closed for unknown status
    RETURN 'missing';
END;
$$;

-- Secure execution privileges
REVOKE EXECUTE ON FUNCTION public.get_current_account_access_state() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_current_account_access_state() TO authenticated;

-- 2. Update users table SELECT policy
DROP POLICY IF EXISTS users_owner_select ON public.users;
CREATE POLICY users_owner_select ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND account_status = 'active'
    AND deleted_at IS NULL
  );

-- 3. Update users table UPDATE policy
DROP POLICY IF EXISTS users_owner_update ON public.users;
CREATE POLICY users_owner_update ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    AND account_status = 'active'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    AND account_status = 'active'
    AND deleted_at IS NULL
  );

-- 4. Refine Column Grants
-- Revoke broad table-level UPDATE
REVOKE UPDATE ON public.users FROM authenticated;
-- Grant UPDATE only on safe fields
GRANT UPDATE(full_name, college, branch, graduation_year, experience_level, preferred_roles, bio, avatar_url)
ON public.users TO authenticated;
