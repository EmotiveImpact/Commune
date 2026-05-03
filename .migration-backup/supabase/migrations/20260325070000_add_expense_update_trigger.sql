-- Track expense edits in activity_log for trust/transparency
CREATE OR REPLACE FUNCTION fn_log_expense_update()
RETURNS trigger AS $$
DECLARE
  _changes jsonb := '{}'::jsonb;
BEGIN
  -- Skip if only is_active changed (that's a soft delete, already tracked)
  IF OLD.is_active IS DISTINCT FROM NEW.is_active
     AND OLD.amount = NEW.amount
     AND OLD.title = NEW.title
     AND OLD.category = NEW.category
     AND COALESCE(OLD.description, '') = COALESCE(NEW.description, '')
     AND OLD.due_date = NEW.due_date
     AND COALESCE(OLD.approval_status, 'approved') = COALESCE(NEW.approval_status, 'approved')
  THEN
    RETURN NEW;
  END IF;

  -- Don't log if nothing meaningful changed
  IF OLD.amount = NEW.amount
     AND OLD.title = NEW.title
     AND OLD.category = NEW.category
     AND COALESCE(OLD.description, '') = COALESCE(NEW.description, '')
     AND OLD.due_date = NEW.due_date
     AND COALESCE(OLD.approval_status, 'approved') = COALESCE(NEW.approval_status, 'approved')
  THEN
    RETURN NEW;
  END IF;

  -- Build a changes object showing what changed
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    _changes := _changes || jsonb_build_object('amount', jsonb_build_object('from', OLD.amount, 'to', NEW.amount));
  END IF;
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    _changes := _changes || jsonb_build_object('title', jsonb_build_object('from', OLD.title, 'to', NEW.title));
  END IF;
  IF OLD.category IS DISTINCT FROM NEW.category THEN
    _changes := _changes || jsonb_build_object('category', jsonb_build_object('from', OLD.category, 'to', NEW.category));
  END IF;
  IF COALESCE(OLD.description, '') IS DISTINCT FROM COALESCE(NEW.description, '') THEN
    _changes := _changes || jsonb_build_object('description', jsonb_build_object('from', COALESCE(OLD.description, ''), 'to', COALESCE(NEW.description, '')));
  END IF;
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    _changes := _changes || jsonb_build_object('due_date', jsonb_build_object('from', OLD.due_date, 'to', NEW.due_date));
  END IF;
  IF COALESCE(OLD.approval_status, 'approved') IS DISTINCT FROM COALESCE(NEW.approval_status, 'approved') THEN
    _changes := _changes || jsonb_build_object('approval_status', jsonb_build_object('from', COALESCE(OLD.approval_status, 'approved'), 'to', COALESCE(NEW.approval_status, 'approved')));
  END IF;

  INSERT INTO activity_log (group_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    NEW.group_id,
    auth.uid(),
    'expense_updated',
    'expense',
    NEW.id,
    jsonb_build_object(
      'title', NEW.title,
      'amount', NEW.amount,
      'changes', _changes
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_log_expense_update ON expenses;
CREATE TRIGGER trg_log_expense_update
  AFTER UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_expense_update();
