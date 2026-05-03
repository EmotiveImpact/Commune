CREATE OR REPLACE FUNCTION public.is_group_member(
  target_group_id uuid,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = COALESCE(target_user_id, auth.uid())
      AND gm.status <> 'removed'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(
  target_group_id uuid,
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = COALESCE(target_user_id, auth.uid())
      AND gm.role = 'admin'
      AND gm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_group_with(
  target_user_id uuid,
  current_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm_target
    JOIN public.group_members gm_self
      ON gm_self.group_id = gm_target.group_id
    WHERE gm_target.user_id = target_user_id
      AND gm_target.status <> 'removed'
      AND gm_self.user_id = COALESCE(current_user_id, auth.uid())
      AND gm_self.status <> 'removed'
  );
$$;

DROP POLICY IF EXISTS "users_read_co_members" ON public.users;
CREATE POLICY "users_read_co_members"
  ON public.users FOR SELECT
  USING (public.shares_group_with(id));

DROP POLICY IF EXISTS "group_members_members_can_read" ON public.group_members;
CREATE POLICY "group_members_members_can_read"
  ON public.group_members FOR SELECT
  USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "group_members_admins_can_insert" ON public.group_members;
CREATE POLICY "group_members_admins_can_insert"
  ON public.group_members FOR INSERT
  WITH CHECK (public.is_group_admin(group_id));

DROP POLICY IF EXISTS "group_members_admins_can_update" ON public.group_members;
CREATE POLICY "group_members_admins_can_update"
  ON public.group_members FOR UPDATE
  USING (public.is_group_admin(group_id))
  WITH CHECK (public.is_group_admin(group_id));
