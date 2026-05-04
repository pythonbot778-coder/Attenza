import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const dbSchema = appSchema({
  version: 1,
  tables: [

    tableSchema({
      name: 'users',
      columns: [
        { name: 'server_id',     type: 'string', isOptional: true },
        { name: 'email',         type: 'string' },
        { name: 'name',          type: 'string', isOptional: true },
        { name: 'mobile_number', type: 'string', isOptional: true },
        { name: 'role_global',   type: 'string' }, // 'admin' | 'user'
        { name: 'created_at',    type: 'number' },
        { name: 'updated_at',    type: 'number' },
      ]
    }),

    tableSchema({
      name: 'class_groups',
      columns: [
        { name: 'server_id',  type: 'string', isOptional: true },
        { name: 'branch',     type: 'string' },
        { name: 'year',       type: 'number' },
        { name: 'semester',   type: 'number' },
        { name: 'section',    type: 'string' },
        { name: 'start_roll', type: 'string' },
        { name: 'end_roll',   type: 'string' },
        { name: 'created_by', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'sync_state', type: 'string' }, // 'pending' | 'synced' | 'failed'
      ]
    }),

    tableSchema({
      name: 'class_members',
      columns: [
        { name: 'server_id',    type: 'string', isOptional: true },
        { name: 'class_id',     type: 'string' },   // local WatermelonDB id
        { name: 'user_id',      type: 'string', isOptional: true },
        { name: 'roll_number',  type: 'string' },
        { name: 'name',         type: 'string', isOptional: true },
        { name: 'role',         type: 'string' },   // 'CR' | 'LR' | 'STUDENT'
        { name: 'status',       type: 'string' },   // 'active' | 'inactive'
        { name: 'joined_at',    type: 'number' },
        { name: 'updated_at',   type: 'number' },
        { name: 'sync_state',   type: 'string' },
      ]
    }),

    tableSchema({
      name: 'subjects',
      columns: [
        { name: 'server_id',     type: 'string', isOptional: true },
        { name: 'class_id',      type: 'string' },
        { name: 'name',          type: 'string' },
        { name: 'faculty_name',  type: 'string' },
        { name: 'type',          type: 'string' },  // 'CLASS' | 'LAB'
        { name: 'created_at',    type: 'number' },
        { name: 'updated_at',    type: 'number' },
        { name: 'sync_state',    type: 'string' },
      ]
    }),

    tableSchema({
      name: 'lab_batches',
      columns: [
        { name: 'server_id',   type: 'string', isOptional: true },
        { name: 'subject_id',  type: 'string' },
        { name: 'batch_name',  type: 'string' },  // 'Batch 1' | 'Batch 2'
        { name: 'start_roll',  type: 'string' },
        { name: 'end_roll',    type: 'string' },
        { name: 'created_at',  type: 'number' },
        { name: 'sync_state',  type: 'string' },
      ]
    }),

    tableSchema({
      name: 'attendance_sessions',
      columns: [
        { name: 'server_id',     type: 'string', isOptional: true },
        { name: 'local_id',      type: 'string' },  // device UUID
        { name: 'subject_id',    type: 'string' },
        { name: 'class_id',      type: 'string' },
        { name: 'batch_name',    type: 'string', isOptional: true },
        { name: 'date_selected', type: 'string' },  // 'YYYY-MM-DD'
        { name: 'taken_by',      type: 'string', isOptional: true },
        { name: 'created_at',    type: 'number' },
        { name: 'updated_at',    type: 'number' },
        { name: 'sync_state',    type: 'string' },
      ]
    }),

    tableSchema({
      name: 'attendance_records',
      columns: [
        { name: 'server_id',        type: 'string', isOptional: true },
        { name: 'session_id',       type: 'string' },
        { name: 'class_member_id',  type: 'string' },
        { name: 'roll_number',      type: 'string' },  // denormalized for fast lookup
        { name: 'status',           type: 'string' },  // 'present' | 'absent'
        { name: 'marked_at',        type: 'number' },
        { name: 'sync_state',       type: 'string' },
      ]
    }),

    tableSchema({
      name: 'sync_logs',
      columns: [
        { name: 'entity_type',      type: 'string' },  // 'attendance_session' etc.
        { name: 'entity_id',        type: 'string' },  // local_id
        { name: 'operation',        type: 'string' },  // 'create' | 'update' | 'delete'
        { name: 'payload',          type: 'string' },  // JSON stringified
        { name: 'status',           type: 'string' },  // 'pending' | 'synced' | 'failed'
        { name: 'idempotency_key',  type: 'string' },
        { name: 'created_at',       type: 'number' },
        { name: 'synced_at',        type: 'number', isOptional: true },
      ]
    }),

  ]
})