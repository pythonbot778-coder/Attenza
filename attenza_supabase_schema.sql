-- ============================================================
--  ATTENZA — Final Database Schema
--  Source of truth: Actual Supabase schema (Document 2)
--  Cross-verified with: Antigravity schema (Document 1)
--  App by Vyndra | Run this in Supabase SQL Editor
-- ============================================================


-- ==========================================
-- 1. ENUMS
-- ==========================================

CREATE TYPE global_role AS ENUM ('admin', 'user');
CREATE TYPE member_role AS ENUM ('CR', 'LR', 'STUDENT');
CREATE TYPE member_status AS ENUM ('active', 'inactive');
CREATE TYPE subject_type AS ENUM ('CLASS', 'LAB');
CREATE TYPE attendance_status AS ENUM ('present', 'absent');
CREATE TYPE transfer_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed');
CREATE TYPE sync_operation AS ENUM ('create', 'update', 'delete');


-- ==========================================
-- 2. EXTENSIONS
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ==========================================
-- 3. TABLES
-- ==========================================

-- USERS
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4() REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    mobile_number TEXT,
    name TEXT,
    role_global global_role NOT NULL DEFAULT 'user',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ALLOWED EMAIL DOMAINS
CREATE TABLE public.allowed_email_domains (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CLASS GROUPS
CREATE TABLE public.class_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1 AND year <= 4),
    semester INTEGER NOT NULL CHECK (semester = ANY (ARRAY[1, 2])),
    section TEXT NOT NULL CHECK (section = ANY (ARRAY['A','B','C','D','E','F','G','H','I','J','K'])),
    start_roll TEXT NOT NULL,
    end_roll TEXT NOT NULL,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CLASS MEMBERS
CREATE TABLE public.class_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    roll_number TEXT NOT NULL,
    name TEXT,
    role member_role NOT NULL DEFAULT 'STUDENT',
    status member_status NOT NULL DEFAULT 'active',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(class_id, roll_number)
);

-- SUBJECTS
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    faculty_name TEXT NOT NULL,
    type subject_type NOT NULL DEFAULT 'CLASS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LAB BATCHES
CREATE TABLE public.lab_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    batch_name TEXT NOT NULL,
    start_roll TEXT NOT NULL,
    end_roll TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(subject_id, batch_name)
);

-- LAB BATCH MEMBERS
CREATE TABLE public.lab_batch_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_batch_id UUID NOT NULL REFERENCES public.lab_batches(id) ON DELETE CASCADE,
    class_member_id UUID NOT NULL REFERENCES public.class_members(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ATTENDANCE SESSIONS
CREATE TABLE public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    local_id TEXT UNIQUE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
    batch_name TEXT,
    date_selected DATE NOT NULL,
    taken_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    taken_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_edited BOOLEAN NOT NULL DEFAULT false,
    edited_at TIMESTAMPTZ,
    semester_label TEXT,
    sync_status sync_status NOT NULL DEFAULT 'pending'
);

-- ATTENDANCE RECORDS
CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    class_member_id UUID NOT NULL REFERENCES public.class_members(id) ON DELETE CASCADE,
    status attendance_status NOT NULL,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, class_member_id)
);

-- ROLE TRANSFERS
CREATE TABLE public.role_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES public.users(id),
    to_user_id UUID NOT NULL REFERENCES public.users(id),
    role member_role NOT NULL CHECK (role = ANY (ARRAY['CR'::member_role, 'LR'::member_role])),
    status transfer_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ
);

-- SYNC LOGS
CREATE TABLE public.sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation sync_operation NOT NULL,
    payload JSONB NOT NULL,
    status sync_status NOT NULL DEFAULT 'pending',
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ
);

-- ADMIN LOGS
CREATE TABLE public.admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES public.users(id),
    action_type TEXT NOT NULL,
    target_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PUSH TOKENS
CREATE TABLE public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform = ANY (ARRAY['ios','android'])),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
    sent_by UUID REFERENCES auth.users(id),
    type TEXT NOT NULL DEFAULT 'attendance' CHECK (type = ANY (ARRAY['attendance','broadcast','promotion'])),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SUPPORT REQUESTS
CREATE TABLE public.support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    class_id UUID REFERENCES public.class_groups(id),
    name TEXT,
    email TEXT,
    role TEXT,
    type TEXT NOT NULL CHECK (type = ANY (ARRAY['support','suggestion'])),
    priority TEXT CHECK (priority = ANY (ARRAY['low','medium','high'])),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status = ANY (ARRAY['open','in_progress','resolved'])),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ==========================================
-- 4. INDEXES
-- ==========================================

CREATE INDEX idx_class_members_class_id ON public.class_members(class_id);
CREATE INDEX idx_class_members_user_id ON public.class_members(user_id);
CREATE INDEX idx_class_members_roll ON public.class_members(roll_number);
CREATE INDEX idx_subjects_class_id ON public.subjects(class_id);
CREATE INDEX idx_sessions_class_id ON public.attendance_sessions(class_id);
CREATE INDEX idx_sessions_subject_id ON public.attendance_sessions(subject_id);
CREATE INDEX idx_sessions_date ON public.attendance_sessions(date_selected);
CREATE INDEX idx_records_session_id ON public.attendance_records(session_id);
CREATE INDEX idx_records_member_id ON public.attendance_records(class_member_id);
CREATE INDEX idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX idx_role_transfers_to_user ON public.role_transfers(to_user_id);
CREATE INDEX idx_role_transfers_status ON public.role_transfers(status);

-- One active CR and one active LR per class
CREATE UNIQUE INDEX idx_one_cr_per_class ON public.class_members(class_id)
    WHERE (role = 'CR' AND status = 'active');

CREATE UNIQUE INDEX idx_one_lr_per_class ON public.class_members(class_id)
    WHERE (role = 'LR' AND status = 'active');


-- ==========================================
-- 5. is_admin() FUNCTION (SECURITY DEFINER)
-- ==========================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (
        SELECT role_global = 'admin'
        FROM public.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ==========================================
-- 6. EMAIL DOMAIN TRIGGER FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION enforce_allowed_email_domain()
RETURNS TRIGGER AS $$
DECLARE
    email_domain TEXT;
BEGIN
    email_domain := split_part(NEW.email, '@', 2);
    IF NOT EXISTS (
        SELECT 1 FROM public.allowed_email_domains
        WHERE domain = email_domain AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Only approved college email domains are allowed.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_enforce_email_domain
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION enforce_allowed_email_domain();


-- ==========================================
-- 7. updated_at TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_class_groups_updated_at
    BEFORE UPDATE ON public.class_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_class_members_updated_at
    BEFORE UPDATE ON public.class_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_subjects_updated_at
    BEFORE UPDATE ON public.subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON public.attendance_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_support_requests_updated_at
    BEFORE UPDATE ON public.support_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_push_tokens_updated_at
    BEFORE UPDATE ON public.push_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ==========================================
-- 8. ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_batch_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY users_own_select ON public.users
    FOR SELECT USING (auth.uid() = id OR is_admin());

CREATE POLICY users_own_update ON public.users
    FOR UPDATE USING (auth.uid() = id OR is_admin());

CREATE POLICY users_own_insert ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY users_admin_delete ON public.users
    FOR DELETE USING (is_admin());

-- ALLOWED EMAIL DOMAINS (admin only)
CREATE POLICY domains_admin_only ON public.allowed_email_domains
    FOR ALL USING (is_admin());

-- CLASS GROUPS
CREATE POLICY class_groups_select ON public.class_groups
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY class_groups_insert ON public.class_groups
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY class_groups_update ON public.class_groups
    FOR UPDATE USING (auth.uid() = created_by OR is_admin());

CREATE POLICY class_groups_delete ON public.class_groups
    FOR DELETE USING (is_admin());

-- CLASS MEMBERS
CREATE POLICY class_members_select ON public.class_members
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY class_members_insert ON public.class_members
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY class_members_update ON public.class_members
    FOR UPDATE USING (auth.uid() = user_id OR is_admin());

CREATE POLICY class_members_delete ON public.class_members
    FOR DELETE USING (is_admin());

-- SUBJECTS
CREATE POLICY subjects_select ON public.subjects
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY subjects_admin_manage ON public.subjects
    FOR ALL USING (is_admin());

-- LAB BATCHES
CREATE POLICY lab_batches_select ON public.lab_batches
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY lab_batches_admin_manage ON public.lab_batches
    FOR ALL USING (is_admin());

-- LAB BATCH MEMBERS
CREATE POLICY lab_batch_members_select ON public.lab_batch_members
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY lab_batch_members_admin_manage ON public.lab_batch_members
    FOR ALL USING (is_admin());

-- ATTENDANCE SESSIONS
CREATE POLICY sessions_select ON public.attendance_sessions
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY sessions_insert ON public.attendance_sessions
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY sessions_update ON public.attendance_sessions
    FOR UPDATE USING (auth.uid() = taken_by OR is_admin());

CREATE POLICY sessions_delete ON public.attendance_sessions
    FOR DELETE USING (is_admin());

-- ATTENDANCE RECORDS
CREATE POLICY records_select ON public.attendance_records
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY records_insert ON public.attendance_records
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY records_update ON public.attendance_records
    FOR UPDATE USING (is_admin());

CREATE POLICY records_delete ON public.attendance_records
    FOR DELETE USING (is_admin());

-- ROLE TRANSFERS
CREATE POLICY role_transfers_select ON public.role_transfers
    FOR SELECT USING (
        auth.uid() = from_user_id OR
        auth.uid() = to_user_id OR
        is_admin()
    );

CREATE POLICY role_transfers_insert ON public.role_transfers
    FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY role_transfers_update ON public.role_transfers
    FOR UPDATE USING (auth.uid() = to_user_id OR is_admin());

-- SYNC LOGS
CREATE POLICY sync_logs_own ON public.sync_logs
    FOR ALL USING (is_admin());

-- ADMIN LOGS
CREATE POLICY admin_logs_admin_only ON public.admin_logs
    FOR ALL USING (is_admin());

-- PUSH TOKENS
CREATE POLICY push_tokens_own ON public.push_tokens
    FOR ALL USING (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE POLICY notifications_select ON public.notifications
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY notifications_admin_manage ON public.notifications
    FOR ALL USING (is_admin());

-- SUPPORT REQUESTS
CREATE POLICY support_requests_own ON public.support_requests
    FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY support_requests_insert ON public.support_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY support_requests_admin_manage ON public.support_requests
    FOR ALL USING (is_admin());


-- ==========================================
-- 9. SEED — Allowed Email Domain
-- ==========================================

INSERT INTO public.allowed_email_domains (domain, is_active)
VALUES ('svce.edu.in', true);


-- ============================================================
--  END OF SCHEMA — ATTENZA by Vyndra
-- ============================================================