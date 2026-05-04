import { Model } from '@nozbe/watermelondb'
import { field, date, relation, children } from '@nozbe/watermelondb/decorators'

export class AttendanceSession extends Model {
  static table = 'attendance_sessions'
  static associations = {
    subjects:            { type: 'belongs_to' as const, key: 'subject_id' },
    class_groups:        { type: 'belongs_to' as const, key: 'class_id' },
    attendance_records:  { type: 'has_many' as const,   foreignKey: 'session_id' },
  }

  @field('server_id')     serverId!: string
  @field('local_id')      localId!: string
  @field('subject_id')    subjectId!: string
  @field('class_id')      classId!: string
  @field('batch_name')    batchName!: string
  @field('date_selected') dateSelected!: string   // 'YYYY-MM-DD'
  @field('taken_by')      takenBy!: string
  @field('sync_state')    syncState!: 'pending' | 'synced' | 'failed'
  @date('created_at')     createdAt!: Date
  @date('updated_at')     updatedAt!: Date

  @relation('subjects',     'subject_id') subject!: any
  @relation('class_groups', 'class_id')   classGroup!: any
  @children('attendance_records')         records!: any
}