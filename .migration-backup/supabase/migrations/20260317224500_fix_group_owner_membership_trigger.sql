CREATE OR REPLACE FUNCTION fn_add_owner_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'admin', 'active')
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status;

  RETURN NEW;
END;
$$;
