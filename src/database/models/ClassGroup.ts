import { Model } from '@nozbe/watermelondb'
import { field, date, children } from '@nozbe/watermelondb/decorators'
import { ClassMember } from './ClassMember'
import { Subject } from './Subject'

export class ClassGroup extends Model {
  static table = 'class_groups'
  static associations = {
    class_members: { type: 'has_many' as const, foreignKey: 'class_id' },
    subjects:      { type: 'has_many' as const, foreignKey: 'class_id' },
  }

  @field('server_id')   serverId!: string
  @field('branch')      branch!: string
  @field('year')        year!: number
  @field('semester')    semester!: number
  @field('section')     section!: string
  @field('start_roll')  startRoll!: string
  @field('end_roll')    endRoll!: string
  @field('created_by')  createdBy!: string
  @field('sync_state')  syncState!: 'pending' | 'synced' | 'failed'
  @date('created_at')   createdAt!: Date
  @date('updated_at')   updatedAt!: Date

  @children('class_members') members!: any
  @children('subjects')      subjects!: any
}