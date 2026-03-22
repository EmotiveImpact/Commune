-- ─── F38: Couple Mode — Linked Members ──────────────────────────────────────
-- Adds linked_partner_id to group_members so two members can be linked as a
-- couple. Each member references the other's group_members row, creating a
-- bidirectional link. When linked, their net balances are combined for
-- settlement calculations.

ALTER TABLE group_members
ADD COLUMN linked_partner_id uuid REFERENCES group_members(id) ON DELETE SET NULL;

-- Index for efficient partner lookups
CREATE INDEX idx_group_members_linked_partner
ON group_members(linked_partner_id)
WHERE linked_partner_id IS NOT NULL;

-- Ensure a member can only be linked to one partner (the column is already
-- single-valued, but this constraint prevents two different members from
-- pointing to the same partner within the same group).
CREATE UNIQUE INDEX idx_group_members_unique_partner
ON group_members(linked_partner_id)
WHERE linked_partner_id IS NOT NULL;

-- ─── Auto-link couple groups ────────────────────────────────────────────────
-- When a group of type 'couple' has exactly 2 active members and neither is
-- linked, automatically link them.

CREATE OR REPLACE FUNCTION auto_link_couple_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group_type text;
  v_active_count int;
  v_member_a uuid;
  v_member_b uuid;
BEGIN
  -- Only act on active members
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Check if this is a couple group
  SELECT type INTO v_group_type
  FROM groups
  WHERE id = NEW.group_id;

  IF v_group_type != 'couple' THEN
    RETURN NEW;
  END IF;

  -- Count active members in this group
  SELECT count(*) INTO v_active_count
  FROM group_members
  WHERE group_id = NEW.group_id
    AND status = 'active';

  -- Only auto-link when there are exactly 2 active members
  IF v_active_count != 2 THEN
    RETURN NEW;
  END IF;

  -- Get the two member IDs
  SELECT id INTO v_member_a
  FROM group_members
  WHERE group_id = NEW.group_id
    AND status = 'active'
  ORDER BY joined_at ASC
  LIMIT 1;

  SELECT id INTO v_member_b
  FROM group_members
  WHERE group_id = NEW.group_id
    AND status = 'active'
    AND id != v_member_a
  ORDER BY joined_at ASC
  LIMIT 1;

  -- Only link if neither is already linked
  IF EXISTS (
    SELECT 1 FROM group_members
    WHERE id IN (v_member_a, v_member_b)
      AND linked_partner_id IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  -- Create bidirectional link
  UPDATE group_members SET linked_partner_id = v_member_b WHERE id = v_member_a;
  UPDATE group_members SET linked_partner_id = v_member_a WHERE id = v_member_b;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_link_couple_group
AFTER INSERT OR UPDATE OF status ON group_members
FOR EACH ROW
EXECUTE FUNCTION auto_link_couple_group();

-- ─── RLS: members can update their own linked_partner_id ────────────────────
-- The existing group_members policies should cover reads. For updates to
-- linked_partner_id specifically, admins and the members themselves can act.
-- This relies on the existing RLS policies for group_members updates.
