CREATE POLICY "users_insert_own_profile"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());
