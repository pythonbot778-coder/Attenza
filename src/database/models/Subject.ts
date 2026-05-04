import { Model } from '@nozbe/watermelondb'
import { field, date, relation, children } from '@nozbe/watermelondb/decorators'

export class Subject extends Model {
  static table = 'subjects'
  static associations = {
    class_groups:        { type: 'belongs_to' as const, key: 'class_id' },
    lab_batches:         { type: 'has_many' as const,   foreignKey: 'subject_id' },
    attendance_sessions: { type: 'has_many' as const,   foreignKey: 'subject_id' },
  }

  @field('server_id')    serverId!: string
  @field('class_id')     classId!: string
  @field('name')         name!: string
  @field('faculty_name') facultyName!: string
  @field('type')         type!: 'CLASS' | 'LAB'
  @field('sync_state')   syncState!: 'pending' | 'synced' | 'failed'
  @date('created_at')    createdAt!: Date
  @date('updated_at')    updatedAt!: Date

  @relation('class_groups', 'class_id') classGroup!: any
  @children('lab_batches')              labBatches!: any
  @children('attendance_sessions')      sessions!: any
}