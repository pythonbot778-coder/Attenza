import { Model } from '@nozbe/watermelondb'
import { field, date, relation, children } from '@nozbe/watermelondb/decorators'
import { AttendanceRecord } from './AttendanceRecord'

export class ClassMember extends Model {
  static table = 'class_members'
  static associations = {
    class_groups:       { type: 'belongs_to' as const, key: 'class_id' },
    attendance_records: { type: 'has_many' as const,   foreignKey: 'class_member_id' },
  }

  @field('server_id')   serverId!: string
  @field('class_id')    classId!: string
  @field('user_id')     userId!: string
  @field('roll_number') rollNumber!: string
  @field('name')        name!: string
  @field('role')        role!: 'CR' | 'LR' | 'STUDENT'
  @field('status')      status!: 'active' | 'inactive'
  @field('sync_state')  syncState!: 'pending' | 'synced' | 'failed'
  @date('joined_at')    joinedAt!: Date
  @date('updated_at')   updatedAt!: Date

  @relation('class_groups', 'class_id') classGroup!: any
  @children('attendance_records')       attendanceRecords!: any
}