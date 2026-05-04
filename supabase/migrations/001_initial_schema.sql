-- ============================================================
-- ATTENZA — Initial Database Schema
-- Version: 1.0.0
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE global_role AS ENUM ('admin', 'user');
CREATE TYPE member_role AS ENUM ('CR', 'LR', 'STUDENT');
CREATE TYPE member_status AS ENUM ('active', 'inactive');
CREATE TYPE subject_type AS ENUM ('CLASS', 'LAB');
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed');
CREATE TYPE transfer_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE attendance_status AS ENUM ('present', 'absent');
CREATE TYPE sync_operation AS ENUM ('create', 'update', 'delete');

-- ============================================================
-- TABLE 1: users
-- ============================================================

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          TEXT UNIQUE NOT NULL,
  mobile_number  TEXT,
  name           TEXT,
  role_global    global_role NOT NULL DEFAULT 'user',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE 2: class_groups
-- ============================================================

CREATE TABLE class_groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch      TEXT NOT NULL,
  year        INTEGER NOT NULL CHECK (year BETWEEN 1 AND 4),
  semester    INTEGER NOT NULL CHECK (semester IN (1, 2)),
  section     TEXT NOT NULL CHECK (section IN ('A','B','C','D','E','F','G','H','I','J','K')),
  start_roll  TEXT NOT NULL,
  end_roll    TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch, year, semester, section)
);

-- ============================================================
-- TABLE 3: class_members  ← CORE TABLE
-- ============================================================

CREATE TABLE class_members (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id     UUID NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,  -- nullable (student not joined yet)
  roll_number  TEXT NOT NULL,
  name         TEXT,
  role         member_role NOT NULL DEFAULT 'STUDENT',
  status       member_status NOT NULL DEFAULT 'active',
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, roll_number)
);

-- Only one CR per class
CREATE UNIQUE INDEX idx_one_cr_per_class
  ON class_members(class_id)
  WHERE role = 'CR' AND status = 'active';

-- Only one LR per class
CREATE UNIQUE INDEX idx_one_lr_per_class
  ON class_members(class_id)
  WHERE role = 'LR' AND status = 'active';

-- ============================================================
-- TABLE 4: subjects
-- ============================================================

CREATE TABLE subjects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id     UUID NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  faculty_name TEXT NOT NULL,
  type         subject_type NOT NULL DEFAULT 'CLASS',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE 5: lab_batches  (only for LAB subjects)
-- ============================================================

CREATE TABLE lab_batches (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  batch_name  TEXT NOT NULL,   -- 'Batch 1' or 'Batch 2'
  start_roll  TEXT NOT NULL,
  end_roll    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_id, batch_name)
);

-- ============================================================
-- TABLE 6: attendance_sessions
-- ============================================================

CREATE TABLE attendance_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id      TEXT UNIQUE,              -- device UUID (offline)
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id      UUID NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  batch_name    TEXT,                     -- NULL for CLASS, 'Batch 1'/'Batch 2' for LAB
  date_selected DATE NOT NULL,            -- academic date (what user selected)
  taken_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status   sync_status NOT NULL DEFAULT 'pending',
  UNIQUE(class_id, subject_id, date_selected, batch_name)
);

-- ============================================================
-- TABLE 7: attendance_records
-- ============================================================

CREATE TABLE attendance_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  class_member_id  UUID NOT NULL REFERENCES class_members(id) ON DELETE CASCADE,
  status           attendance_status NOT NULL,
  marked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, class_member_id)
);

-- ============================================================
-- TABLE 8: role_transfers
-- ============================================================

CREATE TABLE role_transfers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id      UUID NOT NULL REFERENCES class_groups(id) ON DELETE CASCADE,
  from_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          member_role NOT NULL CHECK (role IN ('CR', 'LR')),
  status        transfer_status NOT NULL DEFAULT 'pending',
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at   TIMESTAMPTZ
);

-- ============================================================
-- TABLE 9: sync_logs  (offline engine)
-- ============================================================

CREATE TABLE sync_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type      TEXT NOT NULL,         -- 'attendance_session', 'subject', etc.
  entity_id        TEXT NOT NULL,         -- local_id of the entity
  operation        sync_operation NOT NULL,
  payload          JSONB NOT NULL,
  status           sync_status NOT NULL DEFAULT 'pending',
  idempotency_key  TEXT UNIQUE NOT NULL,  -- prevents duplicate sync
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at        TIMESTAMPTZ
);

-- ============================================================
-- TABLE 10: admin_logs
-- ============================================================

CREATE TABLE admin_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type  TEXT NOT NULL,   -- 'convert_role', 'assign_cr', 'delete_class', etc.
  target_id    UUID,            -- user_id or class_id being acted upon
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES (for performance — no loading delays)
-- ============================================================

CREATE INDEX idx_class_members_class_id     ON class_members(class_id);
CREATE INDEX idx_class_members_roll         ON class_members(roll_number);
CREATE INDEX idx_class_members_user_id      ON class_members(user_id);
CREATE INDEX idx_subjects_class_id          ON subjects(class_id);
CREATE INDEX idx_sessions_class_id          ON attendance_sessions(class_id);
CREATE INDEX idx_sessions_subject_id        ON attendance_sessions(subject_id);
CREATE INDEX idx_sessions_date              ON attendance_sessions(date_selected);
CREATE INDEX idx_records_session_id         ON attendance_records(session_id);
CREATE INDEX idx_records_member_id          ON attendance_records(class_member_id);
CREATE INDEX idx_sync_logs_status           ON sync_logs(status);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_class_groups_updated_at
  BEFORE UPDATE ON class_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_class_members_updated_at
  BEFORE UPDATE ON class_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_batches          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_transfers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs           ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own record
CREATE POLICY "users_own" ON users
  FOR ALL USING (auth.uid() = id);

-- Class members can see their own class data
CREATE POLICY "class_groups_member_read" ON class_groups
  FOR SELECT USING (
    id IN (
      SELECT class_id FROM class_members
      WHERE user_id = auth.uid()
    )
  );

-- Class members can read members of their class
CREATE POLICY "class_members_read" ON class_members
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM class_members
      WHERE user_id = auth.uid()
    )
  );

-- Only CR/LR can insert/update class members
CREATE POLICY "class_members_write" ON class_members
  FOR ALL USING (
    class_id IN (
      SELECT class_id FROM class_members
      WHERE user_id = auth.uid() AND role IN ('CR', 'LR')
    )
  );

-- Subjects: read for all class members, write for CR/LR
CREATE POLICY "subjects_read" ON subjects
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM class_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "subjects_write" ON subjects
  FOR ALL USING (
    class_id IN (
      SELECT class_id FROM class_members
      WHERE user_id = auth.uid() AND role IN ('CR', 'LR')
    )
  );

-- Attendance: read for all class members, write for CR/LR
CREATE POLICY "attendance_sessions_read" ON attendance_sessions
  FOR SELECT USING (
    class_id IN (
      SELECT class_id FROM class_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "attendance_sessions_write" ON attendance_sessions
  FOR ALL USING (
    class_id IN (
      SELECT class_id FROM class_members
      WHERE user_id = auth.uid() AND role IN ('CR', 'LR')
    )
  );

CREATE POLICY "attendance_records_read" ON attendance_records
  FOR SELECT USING (
    session_id IN (
      SELECT s.id FROM attendance_sessions s
      JOIN class_members cm ON cm.class_id = s.class_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE POLICY "attendance_records_write" ON attendance_records
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM attendance_sessions s
      JOIN class_members cm ON cm.class_id = s.class_id
      WHERE cm.user_id = auth.uid() AND cm.role IN ('CR', 'LR')
    )
  );

-- Admin: full access to all tables
CREATE POLICY "admin_full_access_users"       ON users             FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role_global = 'admin'));
CREATE POLICY "admin_full_access_classes"     ON class_groups      FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role_global = 'admin'));
CREATE POLICY "admin_full_access_members"     ON class_members     FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role_global = 'admin'));
CREATE POLICY "admin_full_access_subjects"    ON subjects          FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role_global = 'admin'));
CREATE POLICY "admin_full_access_sessions"    ON attendance_sessions FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role_global = 'admin'));
CREATE POLICY "admin_full_access_records"     ON attendance_records  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role_global = 'admin'));
CREATE POLICY "admin_full_access_admin_logs"  ON admin_logs          FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role_global = 'admin'));
CREATE POLICY "sync_logs_own" ON sync_logs    FOR ALL USING (auth.uid() IS NOT NULL);