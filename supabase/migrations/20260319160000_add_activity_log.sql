-- ============================================================================
-- Activity Log / Audit Trail
-- ============================================================================

-- ─── Table ─────────────────────────────────────────────────────────────────

CREATE TABLE activity_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid        NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users (id),
  action      text        NOT NULL,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_group_created
  ON activity_log (group_id, created_at DESC);

-- ─── Row-Level Security ────────────────────────────────────────────────────

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_members_can_read"
  ON activity_log FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

CREATE POLICY "activity_log_members_can_insert"
  ON activity_log FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- ─── Trigger Functions ─────────────────────────────────────────────────────

-- Log expense creation
CREATE OR REPLACE FUNCTION fn_log_expense_insert()
RETURNS trigger AS $$
BEGIN
  INSERT INTO activity_log (group_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    NEW.group_id,
    NEW.created_by,
    'expense_created',
    'expense',
    NEW.id,
    jsonb_build_object('title', NEW.title, 'amount', NEW.amount, 'currency', NEW.currency)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_expense_insert
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_expense_insert();

-- Log expense deletion (soft-delete via is_active = false)
CREATE OR REPLACE FUNCTION fn_log_expense_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false THEN
    INSERT INTO activity_log (group_id, user_id, action, entity_type, entity_id, metadata)
    VALUES (
      NEW.group_id,
      auth.uid(),
      'expense_deleted',
      'expense',
      NEW.id,
      jsonb_build_object('title', NEW.title)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_expense_delete
  AFTER UPDATE ON expenses
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false)
  EXECUTE FUNCTION fn_log_expense_delete();

-- Log payment status changes
CREATE OR REPLACE FUNCTION fn_log_payment_update()
RETURNS trigger AS $$
DECLARE
  v_group_id uuid;
  v_expense_title text;
  v_action text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT e.group_id, e.title INTO v_group_id, v_expense_title
    FROM expenses e
    WHERE e.id = NEW.expense_id;

    IF NEW.status = 'paid' THEN
      v_action := 'payment_marked';
    ELSIF NEW.status = 'confirmed' THEN
      v_action := 'payment_confirmed';
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO activity_log (group_id, user_id, action, entity_type, entity_id, metadata)
    VALUES (
      v_group_id,
      COALESCE(auth.uid(), NEW.user_id),
      v_action,
      'payment',
      NEW.id,
      jsonb_build_object('expense_title', v_expense_title, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_payment_update
  AFTER UPDATE ON payment_records
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_log_payment_update();

-- Log member insert (invited or joined)
CREATE OR REPLACE FUNCTION fn_log_member_insert()
RETURNS trigger AS $$
DECLARE
  v_member_name text;
  v_action text;
BEGIN
  SELECT u.name INTO v_member_name
  FROM users u
  WHERE u.id = NEW.user_id;

  IF NEW.status = 'invited' THEN
    v_action := 'member_invited';
  ELSE
    v_action := 'member_joined';
  END IF;

  INSERT INTO activity_log (group_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    NEW.group_id,
    COALESCE(auth.uid(), NEW.user_id),
    v_action,
    'member',
    NEW.id,
    jsonb_build_object('member_name', COALESCE(v_member_name, ''))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_member_insert
  AFTER INSERT ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_member_insert();
