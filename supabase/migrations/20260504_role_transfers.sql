-- ============================================================
-- Migration: Role Transfer system + RLS grants
-- ============================================================

-- 1. Add mobile_number to users table (if not exists)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- 2. Create role_transfers table
CREATE TABLE IF NOT EXISTS public.role_transfers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  from_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('CR', 'LR')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_role_transfers_to_user   ON public.role_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_role_transfers_class      ON public.role_transfers(class_id);
CREATE INDEX IF NOT EXISTS idx_role_transfers_status     ON public.role_transfers(status);

-- 4. Grant full access to authenticated users via RLS (use service role bypass or enable RLS + policies)
-- For simplicity, grant to authenticated role:
GRANT SELECT, INSERT, UPDATE ON public.role_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.role_transfers TO anon;
GRANT ALL ON public.role_transfers TO service_role;

-- 5. Grant INSERT/UPDATE on users and class_members to authenticated (needed for profile + claim)
GRANT INSERT, UPDATE ON public.users TO authenticated;
GRANT INSERT, UPDATE ON public.class_members TO authenticated;
GRANT INSERT ON public.class_groups TO authenticated;
GRANT INSERT ON public.class_members TO authenticated;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
