import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { dbSchema } from './schema'
import { User } from './models/User'
import { ClassGroup } from './models/ClassGroup'
import { ClassMember } from './models/ClassMember'
import { Subject } from './models/Subject'
import { LabBatch } from './models/LabBatch'
import { AttendanceSession } from './models/AttendanceSession'
import { AttendanceRecord } from './models/AttendanceRecord'
import { SyncLog } from './models/SyncLog'

import { logger } from '../utils/logger'

const adapter = new SQLiteAdapter({
  schema: dbSchema,
  dbName: 'attenza',
  jsi: true,               // faster JS interface
  onSetUpError: (error) => {
      logger.error('WatermelonDB setup error:', error)
  }
})

export const database = new Database({
  adapter,
  modelClasses: [
    User,
    ClassGroup,
    ClassMember,
    Subject,
    LabBatch,
    AttendanceSession,
    AttendanceRecord,
    SyncLog,
  ]
})