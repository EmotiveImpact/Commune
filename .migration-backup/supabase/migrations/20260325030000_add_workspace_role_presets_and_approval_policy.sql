-- Workspace approval configuration and responsibility labels
-- Keep the shared member role model, but add optional workspace-specific labels
-- and policy metadata on the group itself.

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS approval_policy jsonb;

ALTER TABLE groups
  ADD CONSTRAINT groups_approval_policy_object_check
  CHECK (
    approval_policy IS NULL
    OR jsonb_typeof(approval_policy) = 'object'
  );

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS responsibility_label text;

CREATE INDEX IF NOT EXISTS idx_group_members_group_responsibility_label
  ON group_members (group_id, responsibility_label);

-- Backfill workspace groups with a default policy shape so the UI can start
-- reasoning about presets without waiting for a separate edit flow.
UPDATE groups
SET approval_policy = jsonb_build_object(
  'threshold', approval_threshold,
  'allowed_roles', jsonb_build_array('admin'),
  'allowed_labels', '[]'::jsonb,
  'role_presets', jsonb_build_array(
    jsonb_build_object(
      'key', 'owner',
      'label', 'Owner',
      'description', 'Final approver and group owner',
      'responsibility_label', 'owner',
      'can_approve', true,
      'is_default', true
    ),
    jsonb_build_object(
      'key', 'finance',
      'label', 'Finance',
      'description', 'Billing, invoice, and spend review owner',
      'responsibility_label', 'finance',
      'can_approve', true,
      'is_default', false
    ),
    jsonb_build_object(
      'key', 'operations',
      'label', 'Operations',
      'description', 'Workspace operations and vendor owner',
      'responsibility_label', 'operations',
      'can_approve', true,
      'is_default', false
    )
  )
)
WHERE type = 'workspace'
  AND approval_policy IS NULL;

UPDATE group_members gm
SET responsibility_label = 'owner'
FROM groups g
WHERE g.id = gm.group_id
  AND g.type = 'workspace'
  AND g.owner_id = gm.user_id
  AND gm.responsibility_label IS NULL;
