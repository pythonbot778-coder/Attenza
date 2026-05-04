🧱 1. FRONTEND ARCHITECTURE (KEEP IT CLEAN)

Use this structure (React / Next.js recommended):

/src
 ├── pages
 │    ├── dashboard
 │    ├── users
 │    ├── classes
 │    ├── attendance
 │    ├── sync
 │    ├── logs
 │
 ├── components
 │    ├── DataTable
 │    ├── Modal
 │    ├── Sidebar
 │    ├── Filters
 │
 ├── services
 │    ├── adminApi.js   👈 ALL RPC CALLS HERE
 │
 ├── hooks
 │    ├── useDashboard.js
 │    ├── useClasses.js
 │
 ├── lib
 │    ├── supabaseClient.js

👉 Rule:
UI NEVER directly calls Supabase → only through adminApi.js

⚙️ 2. SUPABASE CLIENT
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
🔌 3. ADMIN API LAYER (MOST IMPORTANT)

Create:

/services/adminApi.js
📊 Dashboard
export async function getDashboardStats() {
  const { data, error } = await supabase.rpc('get_dashboard_stats')

  if (error) throw error
  return data
}
👥 Change CR/LR
export async function changeClassRole(classId, memberId, role) {
  const { error } = await supabase.rpc('change_class_role', {
    p_class_id: classId,
    p_member_id: memberId,
    p_new_role: role
  })

  if (error) throw error
}
🏫 Update Class
export async function updateClass(payload) {
  const { error } = await supabase.rpc('update_class', {
    p_class_id: payload.id,
    p_branch: payload.branch,
    p_year: payload.year,
    p_semester: payload.semester,
    p_section: payload.section
  })

  if (error) throw error
}
📊 Edit Attendance
export async function editAttendance(sessionId, memberId, status) {
  const { error } = await supabase.rpc('edit_attendance_record', {
    p_session_id: sessionId,
    p_member_id: memberId,
    p_status: status
  })

  if (error) throw error
}
❌ Delete Session
export async function deleteSession(sessionId) {
  const { error } = await supabase.rpc('delete_attendance_session', {
    p_session_id: sessionId
  })

  if (error) throw error
}
🔄 Approve Transfer
export async function approveTransfer(id) {
  const { error } = await supabase.rpc('approve_role_transfer', {
    p_transfer_id: id
  })

  if (error) throw error
}
📡 Retry Sync
export async function retrySync(id) {
  const { error } = await supabase.rpc('retry_sync', {
    p_sync_id: id
  })

  if (error) throw error
}
🧠 4. HOOK EXAMPLE (CLEAN STATE MANAGEMENT)
📊 useDashboard.js
import { useEffect, useState } from 'react'
import { getDashboardStats } from '@/services/adminApi'

export function useDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const res = await getDashboardStats()
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, refresh: load }
}
🖥️ 5. PAGE CONNECTION EXAMPLE
📊 Dashboard Page
import { useDashboard } from '@/hooks/useDashboard'

export default function Dashboard() {
  const { data, loading } = useDashboard()

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Total Users: {data.total_users}</p>
      <p>Total Classes: {data.total_classes}</p>
      <p>Sessions Today: {data.sessions_today}</p>
    </div>
  )
}
👥 CR/LR Change Button
<button
  onClick={async () => {
    await changeClassRole(classId, memberId, 'CR')
    alert('CR Updated')
  }}
>
  Make CR
</button>
⚡ 6. UX PATTERNS YOU MUST FOLLOW
✅ Always show loading
Buttons → disabled while action running
Tables → skeleton or spinner
✅ Always show feedback
Success → toast
Error → toast
✅ Always confirm destructive actions

Example:

Delete session
Remove user
🔐 7. AUTH PROTECTION (IMPORTANT)

Protect admin routes:

const { data: user } = await supabase.auth.getUser()

// fetch user profile
// check role_global === 'admin'

👉 If not admin → redirect

🚀 8. WHAT YOU NOW HAVE

You now built:

👉 Clean backend (RPC)
👉 Clean frontend API layer
👉 Scalable architecture

This is production-level structure.