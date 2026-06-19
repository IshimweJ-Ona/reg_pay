import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Token pair returned by login and refresh
export class TokenPairEntity {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Short-lived JWT access token. Include in Authorization header as: Bearer <token>. ' +
      'Express in 15 minutes.',
  })
  access_token!: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Long-lived refresh token. Use POST /auth/refresh to obtain a new access token ' +
      'without re-entering credentials. Expires in 7 days.',
  })
  refresh_token!: string;

  @ApiProperty({ example: '15 minutes', description: 'Access token lifetime.' })
  expires_in!: string;
}

//Login response with token pair and redirect metadata
export class LoginResponseEntity extends TokenPairEntity {
  @ApiProperty({
    example: '/manager/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      "Frontend redirect path computed from the user's role. " +
      'Possible prefixes: /super_admin, /manager, /hr, /finance, /attendant, /users. ' +
      'If the account is still `PENDING`, returns `/auth/pendind/<uuid>.`',
  })
  redirectUrl!: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: "The authenticated user's UUID.",
  })
  uuid: string;

  @ApiProperty({
    enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'REJECTED'],
    example: 'ACTIVE',
    description: 'Current account status at time of login.',
  })
  status!: string;
}

// Register response with usersnapshot and pending message
class RegisteredUserSnapshot {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  uuid!: string;

  @ApiProperty({ example: 'Jean' })
  first_name!: string;

  @ApiProperty({ example: 'Mugisha' })
  last_name!: string;

  @ApiProperty({ example: 'jean.mugisha1@gmail.com' })
  email!: string;

  @ApiProperty({ example: '+250788123456' })
  phone_number!: string;

  @ApiProperty({ enum: ['PENDING'], example: 'PENDING' })
  status!: string;

  @ApiProperty({ example: '2024-06-01T10:00:00.000Z' })
  created_at!: Date;

  @ApiPropertyOptional({ example: { name: 'REG Musanze Branch' } })
  working_location!: { name: string } | null;

  @ApiPropertyOptional({ example: { name: 'Administration' } })
  department!: { name: string } | null;
}

export class RegisterResponseEntity {
  @ApiProperty({
    example:
      'Registration successful. Administrators will approve your registration ' +
      'and grant permission to you to operate on the system. Come back after 72hrs ' +
      'if not yet then contact this email {admin@reg.rw}. Thank you for registring.',
  })
  message!: string;

  @ApiProperty({ type: RegisteredUserSnapshot })
  user!: RegisteredUserSnapshot;
}

// GET /auth/me
class PermissionEntry {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  uuid!: string;

  @ApiProperty({ example: 'employees.create' })
  key!: string;

  @ApiProperty({ example: 'Create Employees' })
  name!: string;

  @ApiProperty({ example: 'EMPLOYEES' })
  module_name!: string;

  @ApiProperty({
    enum: ['role', 'direct', 'override'],
    example: 'role',
    description: 'How this permission was granted to the user.',
  })
  source!: string;

  @ApiProperty({ example: '2024-01-10T08:00:00.000Z' })
  granted_at!: Date;

  @ApiPropertyOptional({ description: 'Populated when source is "direct".' })
  granted_by!: { uuid: string; email: string; phone_number: string } | null;
}

class UserProfile {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  uuid!: string;

  @ApiProperty({ example: 'Jean' })
  first_name!: string;

  @ApiProperty({ example: 'Mugisha' })
  last_name!: string;

  @ApiProperty({ example: 'jean.mugisha1@gmail.com' })
  email!: string;

  @ApiProperty({ example: '+250788123456' })
  phone_number!: string;

  @ApiProperty({ enum: ['MALE', 'FEMALE'], example: 'MALE' })
  gender!: string;

  @ApiProperty({
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'REJECTED'],
    example: 'ACTIVE',
  })
  status!: string;

  @ApiPropertyOptional({
    example: 'https://randomuser.me/api/portraits/men/1.jpg',
  })
  avatar_url!: string | null;

  @ApiPropertyOptional()
  working_location!: { uuid: string; name: string; type: string } | null;

  @ApiPropertyOptional()
  department!: { uuid: string; name: string; code: string } | null;

  @ApiProperty({
    type: [String],
    example: ['BRANCH_MANAGER'],
    description: 'All roles assigned to this user.',
  })
  roles!: string[];

  @ApiProperty({
    type: [PermissionEntry],
    description:
      'Effective permissions after merging role permissions, direct grants, ' +
      'and overrides. This is what the guards actually check.',
  })
  permissions!: PermissionEntry[];
}

class AdminContact {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  uuid!: string;

  @ApiProperty({ example: 'System' })
  first_name!: string;

  @ApiProperty({ example: 'Administrator' })
  last_name!: string;

  @ApiProperty({ example: 'admin@reg.rw' })
  email!: string;

  @ApiProperty({ example: '+250788000000' })
  phone_number!: string;
}

class ActivityLogEntry {
  @ApiProperty({ example: '42' })
  id!: string;

  @ApiProperty({ example: 'AUTH' })
  module_name!: string;

  @ApiProperty({
    enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'FAILED_LOGIN'],
  })
  activity_type!: string;

  @ApiProperty({ example: 'User logged in.' })
  activity_description!: string;

  @ApiProperty({
    enum: [
      'CREATED',
      'UPDATED',
      'DELETED',
      'LOGIN',
      'LOGOUT',
      'APPROVED',
      'DENIED',
    ],
  })
  action!: string;

  @ApiProperty({ example: '2024-06-01T10:30:00.000Z' })
  created_at!: Date;
}

export class MeResponseEntity {
  @ApiProperty({ type: UserProfile })
  profile!: UserProfile;

  @ApiProperty({
    type: [AdminContact],
    description:
      'All active SUPER_ADMIN users shown for `PENDING` users to know who to contact.',
  })
  admin_contacts!: AdminContact[];

  @ApiProperty({
    type: [ActivityLogEntry],
    description: 'Last 100 audit lo entries for this user.',
  })
  activity_history!: ActivityLogEntry[];
}

//Forgot password response
export class ForgotPasswordResponseEntity {
  @ApiProperty({ example: 'Reset token generated.' })
  message!: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'Development mode only — this field is returned because email ' +
      'delivery is not yet configured. In production this field will be removed ' +
      'and the token will be sent via email.',
  })
  reset_token!: string;

  @ApiPropertyOptional({
    example: 'Jean Mugisha',
    description: 'Full name of the user the token was generated for.',
  })
  user_name!: string;
}

// eneric message response — logout, reset-password
export class MessageResponseEntity {
  @ApiProperty({ example: 'Operation completed successfully.' })
  message!: string;
}
