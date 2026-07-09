-- ============================================================
--  ATTENZA — Admin RPC Functions
--  Run this in Supabase SQL Editor
-- ============================================================

-- ─── get_dashboard_stats ─────────────────────────────────────

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'total_users',       (SELECT COUNT(*) FROM public.users),
        'total_classes',     (SELECT COUNT(*) FROM public.class_groups),
        'total_members',     (SELECT COUNT(*) FROM public.class_members),
        'sessions_today',    (SELECT COUNT(*) FROM public.attendance_sessions WHERE date_selected = CURRENT_DATE),
        'pending_sync',      (SELECT COUNT(*) FROM public.sync_logs WHERE status = 'pending'),
        'pending_transfers', (SELECT COUNT(*) FROM public.role_transfers WHERE status = 'pending')
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── admin_get_all_users ──────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS TABLE (
    id            uuid,
    email         text,
    name          text,
    role_global   text,
    mobile_number text,
    created_at    timestamptz
) AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    RETURN QUERY
    SELECT u.id, u.email, u.name, u.role_global::text, u.mobile_number, u.created_at
    FROM public.users u
    ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── admin_get_all_classes ────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_all_classes()
RETURNS TABLE (
    id           uuid,
    branch       text,
    year         int,
    semester     int,
    section      text,
    start_roll   text,
    end_roll     text,
    created_at   timestamptz,
    member_count bigint,
    joined_count bigint
) AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    RETURN QUERY
    SELECT
        cg.id, cg.branch, cg.year, cg.semester, cg.section,
        cg.start_roll, cg.end_roll, cg.created_at,
        COUNT(cm.id) AS member_count,
        COUNT(cm.user_id) AS joined_count
    FROM public.class_groups cg
    LEFT JOIN public.class_members cm ON cm.class_id = cg.id
    GROUP BY cg.id
    ORDER BY cg.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── admin_get_class_members ──────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_class_members(p_class_id uuid)
RETURNS TABLE (
    id          uuid,
    user_id     uuid,
    roll_number text,
    name        text,
    role        text,
    status      text
) AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    RETURN QUERY
    SELECT cm.id, cm.user_id, cm.roll_number, cm.name, cm.role::text, cm.status::text
    FROM public.class_members cm
    WHERE cm.class_id = p_class_id
    ORDER BY cm.roll_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── admin_get_class_subjects ─────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_class_subjects(p_class_id uuid)
RETURNS TABLE (
    id           uuid,
    name         text,
    faculty_name text,
    type         text,
    created_at   timestamptz
) AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    RETURN QUERY
    SELECT s.id, s.name, s.faculty_name, s.type::text, s.created_at
    FROM public.subjects s
    WHERE s.class_id = p_class_id
    ORDER BY s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── admin_get_class_sessions ─────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_class_sessions(p_class_id uuid)
RETURNS TABLE (
    id            uuid,
    date_selected date,
    batch_name    text,
    is_edited     boolean,
    created_at    timestamptz,
    subject_name  text,
    subject_type  text,
    record_count  bigint,
    present_count bigint
) AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    RETURN QUERY
    SELECT
        a.id, a.date_selected, a.batch_name, a.is_edited, a.created_at,
        s.name AS subject_name, s.type::text AS subject_type,
        COUNT(ar.id) AS record_count,
        COUNT(ar.id) FILTER (WHERE ar.status = 'present') AS present_count
    FROM public.attendance_sessions a
    JOIN public.subjects s ON s.id = a.subject_id
    LEFT JOIN public.attendance_records ar ON ar.session_id = a.id
    WHERE a.class_id = p_class_id
    GROUP BY a.id, s.name, s.type
    ORDER BY a.date_selected DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── admin_get_all_transfers ──────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_all_transfers()
RETURNS TABLE (
    id           uuid,
    role         text,
    status       text,
    requested_at timestamptz,
    accepted_at  timestamptz,
    class_id     uuid,
    branch       text,
    year         int,
    semester     int,
    section      text,
    from_name    text,
    from_email   text,
    to_name      text,
    to_email     text
) AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    RETURN QUERY
    SELECT
        rt.id, rt.role::text, rt.status::text,
        rt.requested_at, rt.accepted_at,
        cg.id, cg.branch, cg.year, cg.semester, cg.section,
        fu.name, fu.email,
        tu.name, tu.email
    FROM public.role_transfers rt
    JOIN public.class_groups cg ON cg.id = rt.class_id
    JOIN public.users fu ON fu.id = rt.from_user_id
    JOIN public.users tu ON tu.id = rt.to_user_id
    ORDER BY rt.requested_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── admin_get_logs ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_logs(p_limit int DEFAULT 200)
RETURNS TABLE (
    id          uuid,
    action_type text,
    description text,
    created_at  timestamptz,
    target_id   uuid,
    admin_name  text,
    admin_email text
) AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    RETURN QUERY
    SELECT
        al.id, al.action_type, al.description, al.created_at, al.target_id,
        u.name, u.email
    FROM public.admin_logs al
    JOIN public.users u ON u.id = al.admin_id
    ORDER BY al.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── check_role_conflict ──────────────────────────────────────

CREATE OR REPLACE FUNCTION check_role_conflict(p_class_id uuid, p_role text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.class_members
        WHERE class_id = p_class_id
          AND role = p_role::member_role
          AND status = 'active'
          AND user_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ─── claim_class_member_row ───────────────────────────────────

CREATE OR REPLACE FUNCTION claim_class_member_row(
    p_class_id   uuid,
    p_roll_number text,
    p_user_id    uuid,
    p_name       text,
    p_role       text
)
RETURNS void AS $$
BEGIN
    UPDATE public.class_members
    SET user_id = p_user_id, name = p_name, role = p_role::member_role, updated_at = now()
    WHERE class_id = p_class_id
      AND roll_number = p_roll_number
      AND user_id IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No unclaimed row found for roll number %', p_roll_number;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── change_class_role ────────────────────────────────────────

CREATE OR REPLACE FUNCTION change_class_role(
    p_class_id  uuid,
    p_member_id uuid,
    p_new_role  text
)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    UPDATE public.class_members
    SET role = p_new_role::member_role, updated_at = now()
    WHERE id = p_member_id AND class_id = p_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── admin_delete_class ───────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_delete_class(p_class_id uuid)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    DELETE FROM public.class_groups WHERE id = p_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── admin_delete_member ─────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_delete_member(p_member_id uuid)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    DELETE FROM public.class_members WHERE id = p_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── approve_role_transfer ────────────────────────────────────

CREATE OR REPLACE FUNCTION approve_role_transfer(p_transfer_id uuid)
RETURNS void AS $$
DECLARE
    v_transfer public.role_transfers%ROWTYPE;
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;

    SELECT * INTO v_transfer FROM public.role_transfers WHERE id = p_transfer_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;

    UPDATE public.class_members
    SET role = 'STUDENT'::member_role, updated_at = now()
    WHERE class_id = v_transfer.class_id AND user_id = v_transfer.from_user_id;

    UPDATE public.class_members
    SET role = v_transfer.role, updated_at = now()
    WHERE class_id = v_transfer.class_id AND user_id = v_transfer.to_user_id;

    UPDATE public.role_transfers
    SET status = 'accepted'::transfer_status, accepted_at = now()
    WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── edit_attendance_record ───────────────────────────────────

CREATE OR REPLACE FUNCTION edit_attendance_record(
    p_session_id uuid,
    p_member_id  uuid,
    p_status     text
)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    UPDATE public.attendance_records
    SET status = p_status::attendance_status, marked_at = now()
    WHERE session_id = p_session_id AND class_member_id = p_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── delete_attendance_session ────────────────────────────────

CREATE OR REPLACE FUNCTION delete_attendance_session(p_session_id uuid)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    DELETE FROM public.attendance_sessions WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── promote_class ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION promote_class(p_from_class_id uuid, p_admin_id uuid)
RETURNS json AS $$
DECLARE
    v_class public.class_groups%ROWTYPE;
    v_new_year int;
    v_new_sem  int;
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;

    SELECT * INTO v_class FROM public.class_groups WHERE id = p_from_class_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Class not found'; END IF;

    IF v_class.semester = 1 THEN
        v_new_year := v_class.year;
        v_new_sem  := 2;
    ELSE
        v_new_year := v_class.year + 1;
        v_new_sem  := 1;
    END IF;

    IF v_new_year > 4 THEN RAISE EXCEPTION 'Cannot promote beyond Year 4'; END IF;

    UPDATE public.class_groups
    SET year = v_new_year, semester = v_new_sem, updated_at = now()
    WHERE id = p_from_class_id;

    INSERT INTO public.admin_logs (admin_id, action_type, target_id, description)
    VALUES (p_admin_id, 'promote_class', p_from_class_id,
        format('Promoted class %s to Year %s Sem %s', p_from_class_id, v_new_year, v_new_sem));

    RETURN json_build_object(
        'class_id', p_from_class_id,
        'from_year', v_class.year, 'from_sem', v_class.semester,
        'to_year', v_new_year, 'to_sem', v_new_sem
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── demote_class ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION demote_class(p_from_class_id uuid, p_admin_id uuid)
RETURNS json AS $$
DECLARE
    v_class public.class_groups%ROWTYPE;
    v_new_year int;
    v_new_sem  int;
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;

    SELECT * INTO v_class FROM public.class_groups WHERE id = p_from_class_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Class not found'; END IF;

    IF v_class.semester = 2 THEN
        v_new_year := v_class.year;
        v_new_sem  := 1;
    ELSE
        v_new_year := v_class.year - 1;
        v_new_sem  := 2;
    END IF;

    IF v_new_year < 1 THEN RAISE EXCEPTION 'Cannot demote below Year 1'; END IF;

    UPDATE public.class_groups
    SET year = v_new_year, semester = v_new_sem, updated_at = now()
    WHERE id = p_from_class_id;

    INSERT INTO public.admin_logs (admin_id, action_type, target_id, description)
    VALUES (p_admin_id, 'demote_class', p_from_class_id,
        format('Demoted class %s to Year %s Sem %s', p_from_class_id, v_new_year, v_new_sem));

    RETURN json_build_object(
        'class_id', p_from_class_id,
        'from_year', v_class.year, 'from_sem', v_class.semester,
        'to_year', v_new_year, 'to_sem', v_new_sem
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── promote_year ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION promote_year(p_year int, p_admin_id uuid)
RETURNS json AS $$
DECLARE
    v_promoted int := 0;
    v_failed   int := 0;
    v_errors   json[] := '{}';
    v_class    public.class_groups%ROWTYPE;
    v_promoted_ids uuid[] := '{}';
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;

    FOR v_class IN SELECT * FROM public.class_groups WHERE year = p_year LOOP
        BEGIN
            PERFORM promote_class(v_class.id, p_admin_id);
            v_promoted := v_promoted + 1;
            v_promoted_ids := array_append(v_promoted_ids, v_class.id);
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            v_errors := array_append(v_errors, json_build_object('class_id', v_class.id, 'error', SQLERRM));
        END;
    END LOOP;

    RETURN json_build_object(
        'promoted', v_promoted,
        'failed', v_failed,
        'errors', v_errors,
        'promoted_class_ids', v_promoted_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── demote_year ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION demote_year(p_year int, p_admin_id uuid)
RETURNS json AS $$
DECLARE
    v_demoted  int := 0;
    v_failed   int := 0;
    v_errors   json[] := '{}';
    v_class    public.class_groups%ROWTYPE;
    v_demoted_ids uuid[] := '{}';
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;

    FOR v_class IN SELECT * FROM public.class_groups WHERE year = p_year LOOP
        BEGIN
            PERFORM demote_class(v_class.id, p_admin_id);
            v_demoted := v_demoted + 1;
            v_demoted_ids := array_append(v_demoted_ids, v_class.id);
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            v_errors := array_append(v_errors, json_build_object('class_id', v_class.id, 'error', SQLERRM));
        END;
    END LOOP;

    RETURN json_build_object(
        'demoted', v_demoted,
        'failed', v_failed,
        'errors', v_errors,
        'demoted_class_ids', v_demoted_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── edit_class_academic ─────────────────────────────────────

CREATE OR REPLACE FUNCTION edit_class_academic(
    p_class_id  uuid,
    p_year      int,
    p_semester  int,
    p_section   text,
    p_admin_id  uuid
)
RETURNS json AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;

    UPDATE public.class_groups
    SET year = p_year, semester = p_semester, section = p_section, updated_at = now()
    WHERE id = p_class_id;

    INSERT INTO public.admin_logs (admin_id, action_type, target_id, description)
    VALUES (p_admin_id, 'edit_class_academic', p_class_id,
        format('Edited class %s to Year %s Sem %s Section %s', p_class_id, p_year, p_semester, p_section));

    RETURN json_build_object(
        'class_id', p_class_id,
        'year', p_year,
        'semester', p_semester,
        'section', p_section
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── update_class ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_class(
    p_class_id  uuid,
    p_branch    text,
    p_year      int,
    p_semester  int,
    p_section   text
)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    UPDATE public.class_groups
    SET branch = p_branch, year = p_year, semester = p_semester, section = p_section, updated_at = now()
    WHERE id = p_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── retry_sync ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION retry_sync(p_sync_id uuid)
RETURNS void AS $$
BEGIN
    IF NOT is_admin() THEN RAISE EXCEPTION 'Access denied'; END IF;
    UPDATE public.sync_logs
    SET status = 'pending'::sync_status
    WHERE id = p_sync_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── accept_role_transfer ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_role_transfer(p_transfer_id uuid)
RETURNS void AS $$
DECLARE
    v_transfer public.role_transfers%ROWTYPE;
BEGIN
    SELECT * INTO v_transfer FROM public.role_transfers WHERE id = p_transfer_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;

    IF v_transfer.status <> 'pending' THEN
        RAISE EXCEPTION 'This transfer has already been resolved';
    END IF;

    IF v_transfer.to_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Access denied: you are not the recipient of this transfer';
    END IF;

    UPDATE public.class_members
    SET role = 'STUDENT'::member_role, updated_at = now()
    WHERE class_id = v_transfer.class_id AND user_id = v_transfer.from_user_id;

    UPDATE public.class_members
    SET role = v_transfer.role::member_role, updated_at = now()
    WHERE class_id = v_transfer.class_id AND user_id = v_transfer.to_user_id;

    UPDATE public.role_transfers
    SET status = 'accepted'::transfer_status, accepted_at = now()
    WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── reject_role_transfer ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_role_transfer(p_transfer_id uuid)
RETURNS void AS $$
DECLARE
    v_transfer public.role_transfers%ROWTYPE;
BEGIN
    SELECT * INTO v_transfer FROM public.role_transfers WHERE id = p_transfer_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;

    IF v_transfer.status <> 'pending' THEN
        RAISE EXCEPTION 'This transfer has already been resolved';
    END IF;

    IF v_transfer.to_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Access denied: you are not the recipient of this transfer';
    END IF;

    UPDATE public.role_transfers
    SET status = 'rejected'::transfer_status, accepted_at = now()
    WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── grants ───────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.accept_role_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_role_transfer(uuid) TO authenticated;

-- ============================================================
--  END OF RPC FUNCTIONS — ATTENZA by Vyndra
-- ============================================================
