import { useCallback } from 'react'
import { useAuthStore }          from '../store/authStore'
import { getClassPushTokens }    from '../api/notificationApi'
import { sendPushNotifications } from '../utils/notificationUtils'
export function useSendAttendanceNotification() {
  const { classId, name: takenByName, role } = useAuthStore()

  return useCallback(async (params: {
    subjectName:  string
    presentCount: number
    absentCount:  number
    totalCount:   number
    dateSelected: string
    batchName?:   string | null
  }) => {
    if (!classId) return
    const { subjectName, presentCount, totalCount, dateSelected, batchName } = params
    const pct    = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0
    const label  = batchName ? `${subjectName} (${batchName})` : subjectName
    const [y, m, d] = dateSelected.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const dateFmt = `${d} ${months[parseInt(m,10)-1]} ${y}`

    try {
      const tokens = await getClassPushTokens(classId)
      if (tokens.length === 0) return
      await sendPushNotifications({
        title:   `📋 Attendance Marked — ${label}`,
        body:    `${dateFmt} · ${presentCount}/${totalCount} present (${pct}%) · ${takenByName ?? role}`,
        tokens,  classId, type: 'attendance',
        data:    { type: 'attendance', subjectName, dateSelected },
      })
    } catch (e) {
      console.log('[AttendanceNotification] Failed silently:', e)
    }
  }, [classId, takenByName, role])
}