import { Model } from '@nozbe/watermelondb'
import { field, date, relation } from '@nozbe/watermelondb/decorators'

export class AttendanceRecord extends Model {
  static table = 'attendance_records'
  static associations = {
    attendance_sessions: { type: 'belongs_to' as const, key: 'session_id' },
    class_members:       { type: 'belongs_to' as const, key: 'class_member_id' },
  }

  @field('server_id')       serverId!: string
  @field('session_id')      sessionId!: string
  @field('class_member_id') classMemberId!: string
  @field('roll_number')     rollNumber!: string
  @field('status')          status!: 'present' | 'absent'
  @field('sync_state')      syncState!: 'pending' | 'synced' | 'failed'
  @date('marked_at')        markedAt!: Date

  @relation('attendance_sessions', 'session_id')   session!: any
  @relation('class_members',       'class_member_id') member!: any
}