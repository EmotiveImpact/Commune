-- Transfer group ownership RPC
-- Changes the group's owner_id to the new owner
-- Promotes new owner to admin if not already
-- Demotes old owner to member (but keeps them in group)

create or replace function fn_transfer_group_ownership(
  p_group_id uuid,
  p_new_owner_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_owner_id uuid;
begin
  select owner_id into v_current_owner_id
  from groups
  where id = p_group_id;

  if v_current_owner_id is null then
    raise exception 'Group not found';
  end if;

  if v_current_owner_id != auth.uid() then
    raise exception 'Only the group owner can transfer ownership';
  end if;

  if p_new_owner_id = v_current_owner_id then
    raise exception 'Cannot transfer ownership to the current owner';
  end if;

  if not exists (
    select 1 from group_members
    where group_id = p_group_id
    and user_id = p_new_owner_id
    and status = 'active'
  ) then
    raise exception 'New owner must be an active group member';
  end if;

  update groups set owner_id = p_new_owner_id where id = p_group_id;

  update group_members
  set role = 'admin'
  where group_id = p_group_id and user_id = p_new_owner_id;

  update group_members
  set role = 'member'
  where group_id = p_group_id and user_id = v_current_owner_id;
end;
$$;
