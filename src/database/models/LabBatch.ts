import { Model } from '@nozbe/watermelondb'
import { field, date, relation } from '@nozbe/watermelondb/decorators'

export class LabBatch extends Model {
  static table = 'lab_batches'
  static associations = {
    subjects: { type: 'belongs_to' as const, key: 'subject_id' },
  }

  @field('server_id')   serverId!: string
  @field('subject_id')  subjectId!: string
  @field('batch_name')  batchName!: string  // 'Batch 1' | 'Batch 2'
  @field('start_roll')  startRoll!: string
  @field('end_roll')    endRoll!: string
  @field('sync_state')  syncState!: 'pending' | 'synced' | 'failed'
  @date('created_at')   createdAt!: Date

  @relation('subjects', 'subject_id') subject!: any
}