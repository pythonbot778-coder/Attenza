-- ============================================================
-- Migration: Add accept_role_transfer and reject_role_transfer RPCs
-- ============================================================

-- 1. accept_role_transfer
CREATE OR REPLACE FUNCTION public.accept_role_transfer(p_transfer_id uuid)
RETURNS void AS $$
DECLARE
    v_transfer public.role_transfers%ROWTYPE;
BEGIN
    -- Fetch the transfer record
    SELECT * INTO v_transfer FROM public.role_transfers WHERE id = p_transfer_id;
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Transfer not found'; 
    END IF;

    -- Verify status is pending
    IF v_transfer.status <> 'pending' THEN
        RAISE EXCEPTION 'This transfer has already been resolved';
    END IF;

    -- Verify recipient is the current authenticated user
    IF v_transfer.to_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Access denied: you are not the recipient of this transfer';
    END IF;

    -- Demote the sender to STUDENT in class_members
    UPDATE public.class_members
    SET role = 'STUDENT'::member_role, updated_at = now()
    WHERE class_id = v_transfer.class_id AND user_id = v_transfer.from_user_id;

    -- Promote the recipient to the new role in class_members
    UPDATE public.class_members
    SET role = v_transfer.role::member_role, updated_at = now()
    WHERE class_id = v_transfer.class_id AND user_id = v_transfer.to_user_id;

    -- Mark the transfer as accepted
    UPDATE public.role_transfers
    SET status = 'accepted'::transfer_status, accepted_at = now()
    WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. reject_role_transfer
CREATE OR REPLACE FUNCTION public.reject_role_transfer(p_transfer_id uuid)
RETURNS void AS $$
DECLARE
    v_transfer public.role_transfers%ROWTYPE;
BEGIN
    -- Fetch the transfer record
    SELECT * INTO v_transfer FROM public.role_transfers WHERE id = p_transfer_id;
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Transfer not found'; 
    END IF;

    -- Verify status is pending
    IF v_transfer.status <> 'pending' THEN
        RAISE EXCEPTION 'This transfer has already been resolved';
    END IF;

    -- Verify recipient is the current authenticated user
    IF v_transfer.to_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Access denied: you are not the recipient of this transfer';
    END IF;

    -- Mark the transfer as rejected
    UPDATE public.role_transfers
    SET status = 'rejected'::transfer_status, accepted_at = now()
    WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grants
GRANT EXECUTE ON FUNCTION public.accept_role_transfer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_role_transfer(uuid) TO authenticated;
