-- ============================================================================
-- Commune: Initial Database Schema
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE group_type AS ENUM ('home', 'couple', 'workspace', 'project', 'trip', 'other');
CREATE TYPE member_role AS ENUM ('admin', 'member');
CREATE TYPE member_status AS ENUM ('invited', 'active', 'inactive', 'removed');
CREATE TYPE expense_category AS ENUM ('rent', 'utilities', 'internet', 'cleaning', 'groceries', 'entertainment', 'household_supplies', 'transport', 'work_tools', 'miscellaneous');
CREATE TYPE recurrence_type AS ENUM ('none', 'weekly', 'monthly');
CREATE TYPE split_method AS ENUM ('equal', 'percentage', 'custom');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'confirmed');
CREATE TYPE subscription_plan AS ENUM ('standard', 'pro', 'agency');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

-- ─── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id         uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name       text        NOT NULL,
  email      text        NOT NULL UNIQUE,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  type        group_type  NOT NULL,
  description text,
  owner_id    uuid        NOT NULL REFERENCES users (id),
  cycle_date  int         NOT NULL DEFAULT 1 CHECK (cycle_date >= 1 AND cycle_date <= 28),
  currency    text        NOT NULL DEFAULT 'GBP',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  id        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  uuid          NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id   uuid          NOT NULL REFERENCES users (id),
  role      member_role   NOT NULL DEFAULT 'member',
  status    member_status NOT NULL DEFAULT 'invited',
  joined_at timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE expenses (
  id                  uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            uuid             NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  title               text             NOT NULL,
  description         text,
  category            expense_category NOT NULL,
  amount              numeric(12, 2)   NOT NULL CHECK (amount > 0),
  currency            text             NOT NULL DEFAULT 'GBP',
  due_date            date             NOT NULL,
  recurrence_type     recurrence_type  NOT NULL DEFAULT 'none',
  recurrence_interval int              NOT NULL DEFAULT 1,
  paid_by_user_id     uuid             REFERENCES users (id),
  split_method        split_method     NOT NULL DEFAULT 'equal',
  is_active           boolean          NOT NULL DEFAULT true,
  created_by          uuid             NOT NULL REFERENCES users (id),
  created_at          timestamptz      NOT NULL DEFAULT now(),
  updated_at          timestamptz      NOT NULL DEFAULT now()
);

CREATE TABLE expense_participants (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id       uuid           NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  user_id          uuid           NOT NULL REFERENCES users (id),
  share_amount     numeric(12, 2) NOT NULL,
  share_percentage numeric(5, 2),
  created_at       timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (expense_id, user_id)
);

CREATE TABLE payment_records (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id   uuid           NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  user_id      uuid           NOT NULL REFERENCES users (id),
  amount       numeric(12, 2) NOT NULL,
  status       payment_status NOT NULL DEFAULT 'unpaid',
  paid_at      timestamptz,
  confirmed_by uuid           REFERENCES users (id),
  note         text,
  created_at   timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (expense_id, user_id)
);

CREATE TABLE subscriptions (
  id                      uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid                NOT NULL UNIQUE REFERENCES users (id),
  stripe_customer_id      text                NOT NULL,
  stripe_subscription_id  text                NOT NULL,
  plan                    subscription_plan   NOT NULL DEFAULT 'standard',
  status                  subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at           timestamptz         NOT NULL,
  current_period_start    timestamptz         NOT NULL,
  current_period_end      timestamptz         NOT NULL,
  created_at              timestamptz         NOT NULL DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX idx_group_members_group_id ON group_members (group_id);
CREATE INDEX idx_group_members_user_id  ON group_members (user_id);

CREATE INDEX idx_expenses_group_id ON expenses (group_id);
CREATE INDEX idx_expenses_due_date ON expenses (due_date);

CREATE INDEX idx_expense_participants_expense_id ON expense_participants (expense_id);
CREATE INDEX idx_expense_participants_user_id    ON expense_participants (user_id);

CREATE INDEX idx_payment_records_expense_id ON payment_records (expense_id);
CREATE INDEX idx_payment_records_user_id    ON payment_records (user_id);
CREATE INDEX idx_payment_records_status     ON payment_records (status);

-- ─── Functions & Triggers ───────────────────────────────────────────────────

-- 1. Auto-update updated_at on expenses
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_timestamp();

-- 2. Auto-create payment record when an expense participant is inserted
CREATE OR REPLACE FUNCTION fn_create_payment_record()
RETURNS trigger AS $$
BEGIN
  INSERT INTO payment_records (expense_id, user_id, amount, status)
  VALUES (NEW.expense_id, NEW.user_id, NEW.share_amount, 'unpaid')
  ON CONFLICT (expense_id, user_id)
  DO UPDATE SET amount = EXCLUDED.amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_payment_record
  AFTER INSERT ON expense_participants
  FOR EACH ROW
  EXECUTE FUNCTION fn_create_payment_record();

-- 3. Auto-create public.users profile when a new auth.users row is inserted
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION fn_handle_new_user();

-- 4. Auto-add the group owner as an admin member
CREATE OR REPLACE FUNCTION fn_add_owner_as_admin()
RETURNS trigger AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'admin', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_add_owner_as_admin
  AFTER INSERT ON groups
  FOR EACH ROW
  EXECUTE FUNCTION fn_add_owner_as_admin();

-- ─── Row-Level Security ─────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions        ENABLE ROW LEVEL SECURITY;

-- ── users ──

CREATE POLICY "users_read_own_profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_read_co_members"
  ON users FOR SELECT
  USING (
    id IN (
      SELECT gm.user_id FROM group_members gm
      WHERE gm.group_id IN (
        SELECT gm2.group_id FROM group_members gm2
        WHERE gm2.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "users_update_own_profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── groups ──

CREATE POLICY "groups_members_can_read"
  ON groups FOR SELECT
  USING (
    id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "groups_auth_users_can_create"
  ON groups FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "groups_admins_can_update"
  ON groups FOR UPDATE
  USING (
    id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "groups_owner_can_delete"
  ON groups FOR DELETE
  USING (owner_id = auth.uid());

-- ── group_members ──

CREATE POLICY "group_members_members_can_read"
  ON group_members FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "group_members_admins_can_insert"
  ON group_members FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "group_members_admins_can_update"
  ON group_members FOR UPDATE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- ── expenses ──

CREATE POLICY "expenses_active_members_can_read"
  ON expenses FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

CREATE POLICY "expenses_admins_can_create"
  ON expenses FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

CREATE POLICY "expenses_admins_can_update"
  ON expenses FOR UPDATE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
    )
  );

-- ── expense_participants ──

CREATE POLICY "expense_participants_members_can_read"
  ON expense_participants FOR SELECT
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "expense_participants_admins_can_insert"
  ON expense_participants FOR INSERT
  WITH CHECK (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
      )
    )
  );

CREATE POLICY "expense_participants_admins_can_update"
  ON expense_participants FOR UPDATE
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
      )
    )
  )
  WITH CHECK (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
      )
    )
  );

CREATE POLICY "expense_participants_admins_can_delete"
  ON expense_participants FOR DELETE
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
      )
    )
  );

-- ── payment_records ──

CREATE POLICY "payment_records_members_can_read"
  ON payment_records FOR SELECT
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "payment_records_user_can_update_own"
  ON payment_records FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "payment_records_admins_can_update"
  ON payment_records FOR UPDATE
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
      )
    )
  )
  WITH CHECK (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
      )
    )
  );

-- ── subscriptions ──

CREATE POLICY "subscriptions_user_can_read_own"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());
