import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export class SyncLog extends Model {
  static table = 'sync_logs'

  @field('entity_type')     entityType!: string
  @field('entity_id')       entityId!: string
  @field('operation')       operation!: 'create' | 'update' | 'delete'
  @field('payload')         payload!: string       // JSON.stringify(data)
  @field('status')          status!: 'pending' | 'synced' | 'failed'
  @field('idempotency_key') idempotencyKey!: string
  @date('created_at')       createdAt!: Date
  @date('synced_at')        syncedAt!: Date
}