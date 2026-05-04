import { Model } from '@nozbe/watermelondb'
import { field, readonly, date } from '@nozbe/watermelondb/decorators'

export class User extends Model {
  static table = 'users'

  @field('server_id')     serverId!: string
  @field('email')         email!: string
  @field('name')          name!: string
  @field('mobile_number') mobileNumber!: string
  @field('role_global')   roleGlobal!: 'admin' | 'user'
  @readonly @date('created_at') createdAt!: Date
  @date('updated_at')           updatedAt!: Date
}