import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  audit_logs_activity_type as ACTIVITY_TYPE,
  audit_logs_action as AUDIT_ACTION,
} from '@prisma/client';
import { compareHash, hashValue, hashToken } from '../common/utils/hash.util';
import {
  isNumericId,
  isUuid,
  requireUuidOrNumeric,
} from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  JWT_REFRESH_SECRET,
  REFRESH_TOKEN_EXPIRES_IN_DAYS,
} from './constants/auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { comparePassword, hashPassword } from './utils/password.util';
import {
  buildJwtPayload,
  signAccessToken,
  signRefreshToken,
} from './utils/token.util';
import {
  IMPLIED_PERMISSIONS,
  PERMISSION_MODULES,
} from '../common/constants/permissions.constants';


type RequestContext = {
  deviceInfo?: string | string[];
  ipAddress?: string;
};

type TokenPair = {
  access_token: string;
  refresh_token: string;
  expires_in: string;
};

type UpdateProfileDto = {
  first_name?: string;
  last_name?: string;
  email?: string;
  password?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private normalizeDeviceInfo(info: string | string[] | undefined): string {
    if (!info) return '';
    return Array.isArray(info) ? info.join(', ') : info;
  }

  private getRefreshExpiryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
    return date;
  }

  private async resolveWorkingLocationId(value: string): Promise<bigint> {
    requireUuidOrNumeric(value, 'working_location_id');
    const workingLocation = await this.prisma.working_locations.findFirst({
      where: isNumericId(value)
        ? { id: BigInt(value), deleted_at: null }
        : { uuid: value, deleted_at: null },
      select: { id: true },
    });
    if (!workingLocation) {
      throw new ConflictException('Working location does not exist.');
    }
    return workingLocation.id;
  }

  private async resolveDepartmentId(
    value: string,
    workingLocationId?: bigint | null,
  ): Promise<bigint> {
    requireUuidOrNumeric(value, 'department_id');
    const department = await this.prisma.departments.findFirst({
      where: {
        ...(isNumericId(value) ? { id: BigInt(value) } : { uuid: value }),
        ...(workingLocationId ? { working_location_id: workingLocationId } : {}),
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!department) {
      throw new ConflictException(
        'Department does not exist for the selected working location.',
      );
    }
    return department.id;
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.users.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone_number: dto.phone_number }],
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email or phone already exists.',
      );
    }

    const workingLocationId = dto.working_location_id
      ? await this.resolveWorkingLocationId(dto.working_location_id)
      : null;
    const departmentId = dto.department_id
      ? await this.resolveDepartmentId(dto.department_id, workingLocationId)
      : null;

    const user = await this.prisma.users.create({
      data: {
        uuid: generateUUID(),
        first_name: dto.first_name,
        last_name: dto.last_name,
        email: dto.email,
        phone_number: dto.phone_number,
        gender: dto.gender,
        password_hash: await hashPassword(dto.password),
        department_id: departmentId,
        working_location_id: workingLocationId,
        status: 'PENDING',
        updated_at: new Date(),
      },
      select: {
        id: true,
        uuid: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        status: true,
        created_at: true,
        working_locations_users_working_location_idToworking_locations: { select: { name: true } },
        departments: { select: { name: true } },
      },
    });

    // Route notification to branch_manager of the working_location via
    // the notifications service so SSE broadcast fires immediately.
    if (workingLocationId) {
      await this.notificationsService.notifyBranchManager(
        workingLocationId,
        {
          senderId: undefined,
          title: 'New User Registration',
          message: `${user.first_name} ${user.last_name} has registered and is pending approval.`,
          type: 'REGISTRATION_REQUEST',
          referenceId: user.uuid,
          metadata: { redirect: 'users', level: 'BRANCH_MANAGER' },
        },
      );
    } else {
      await this.notificationsService.notifyAdmins({
        senderId: undefined,
        title: 'New User Registration',
        message: `${user.first_name} ${user.last_name} has registered and is pending approval.`,
        type: 'REGISTRATION_REQUEST',
        referenceId: user.uuid,
        metadata: { redirect: 'users', level: 'SUPER_ADMIN' },
      });
    }

    return {
      message:
        'Registration successful. Administrators will approve your registration and grant permission to you to operate on the system.',
      user,
    };
  }

  async login(dto: LoginDto, context: RequestContext = {}) {
    try {
      const user = await this.prisma.users.findFirst({
        where: {
          OR: [{ email: dto.identifier }, { phone_number: dto.identifier }],
          deleted_at: null,
        },
        include: {
          user_roles: { include: { roles: true } },
          user_permissions: true,
          user_permission_overrides: true,
          working_locations_users_working_location_idToworking_locations: true,
          departments: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException(
          'Incorrect email or phone number. Please check your credentials and try again.',
        );
      }

      const passwordIsValid = await comparePassword(
        dto.password,
        user.password_hash,
      );

      if (!passwordIsValid) {
        await this.writeLoginAudit(user.id, context.ipAddress, false);
        throw new UnauthorizedException(
          'Incorrect password. Please try again or reset your password if you forgotten it.',
        );
      }

      if (user.status === 'SUSPENDED') {
        throw new UnauthorizedException(
          'Your account has been suspended. Please contact the system administrator for assistance.',
        );
      }

      if (user.status === 'REJECTED') {
        throw new UnauthorizedException(
          'Your registration request was rejected. Please contact support if you believe this is an error.',
        );
      }

      const payload = await this.buildPayload(user.id);
      const tokens = await this.createTokenPair(payload);

      await this.prisma.$transaction([
        this.prisma.user_sessions.create({
          data: {
            uuid: generateUUID(),
            user_id: user.id,
            refresh_token_hash: hashToken(tokens.refresh_token),
            device_info: this.normalizeDeviceInfo(context.deviceInfo),
            ip_address: context.ipAddress,
            expires_at: this.getRefreshExpiryDate(),
          },
        }),
        this.prisma.users.update({
          where: { id: user.id },
          data: { last_login_at: new Date() },
        }),
      ]);

      await this.writeLoginAudit(user.id, context.ipAddress, true);

      const roles = user.user_roles.map((r) => r.roles.name);
      let rolePath = 'users';
      if (roles.includes('SUPER_ADMIN')) {
        rolePath = 'super_admin';
      } else if (roles.includes('BRANCH_MANAGER')) {
        rolePath = 'branch_manager';
      } else if (
        roles.includes('HR') ||
        roles.includes('HR_MANAGER') ||
        roles.includes('HR_ADMIN')
      ) {
        rolePath = 'hr';
      } else if (roles.includes('ACCOUNTANT') || roles.includes('FINANCE')) {
        rolePath = 'finance';
      } else if (roles.includes('ATTENDANT')) {
        rolePath = 'attendant';
      }

      let redirectUrl = `/${rolePath}/${user.uuid}`;
      if (user.status === 'PENDING') {
        redirectUrl = `/auth/pending/${user.uuid}`;
      }

      return { ...tokens, redirectUrl, uuid: user.uuid, status: user.status };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      console.error('Login error:', error);
      throw new Error(
        `An unexpected error occurred during login. ${(error as any).message || ''}`,
      );
    }
  }

  async me(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: BigInt(userId) },
      include: {
        user_roles: { include: { roles: true } },
        user_permissions: true,
        user_permission_overrides: true,
        working_locations_users_working_location_idToworking_locations: true,
        departments: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const effectivePermissions = await this.buildEffectivePermissions(user);

    const roles = user.user_roles.map((ur) => ur.roles.name);
    const isSuperAdmin = roles.includes('SUPER_ADMIN');
    let adminContacts: Array<{
      name: string;
      email: string;
      phone_number: string;
    }> = [];

    if (!isSuperAdmin && user.working_location_id) {
      const branchManager = await this.prisma.branch_managers.findFirst({
        where: {
          working_location_id: user.working_location_id,
          is_active: true,
        },
        select: {
          users_branch_managers_user_idTousers: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
            },
          },
        },
      });
      if (branchManager) {
        const bm = branchManager as any;
        adminContacts.push({
          name: `${bm.users_branch_managers_user_idTousers?.first_name ?? ''} ${bm.users_branch_managers_user_idTousers?.last_name ?? ''}`.trim(),
          email: bm.users_branch_managers_user_idTousers?.email ?? '',
          phone_number: bm.users_branch_managers_user_idTousers?.phone_number ?? '',
        });
      }
    }

    if (!isSuperAdmin && adminContacts.length === 0) {
      const superAdminRole = await this.prisma.roles.findFirst({
        where: { name: 'SUPER_ADMIN' },
        select: { id: true },
      });
      if (superAdminRole) {
        const superAdminUsers = await this.prisma.user_roles.findMany({
          where: { role_id: superAdminRole.id },
          include: {
            users: {
              select: {
                first_name: true,
                last_name: true,
                email: true,
                phone_number: true,
              },
            },
          },
        });
        for (const sa of superAdminUsers) {
          adminContacts.push({
            name: `${(sa as any).users?.first_name ?? ''} ${(sa as any).users?.last_name ?? ''}`.trim(),
            email: (sa as any).users?.email ?? '',
            phone_number: (sa as any).users?.phone_number ?? '',
          });
        }
      }
    }

    const last100AuditLogs = await this.prisma.audit_logs.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return {
      profile: {
        ...user,
        id: user.id.toString(),
        roles: roles.map((role) => ({
          key: role,
          name: role,
        })),
        permissions: effectivePermissions.map((key) => ({ key })),
        working_location: (user as any).working_locations_users_working_location_idToworking_locations
          ? {
              ...(user as any).working_locations_users_working_location_idToworking_locations,
              id: (user as any).working_locations_users_working_location_idToworking_locations.id.toString(),
              created_by: (user as any).working_locations_users_working_location_idToworking_locations.created_by?.toString() ?? null,
              updated_by: (user as any).working_locations_users_working_location_idToworking_locations.updated_by?.toString() ?? null,
              deleted_by: (user as any).working_locations_users_working_location_idToworking_locations.deleted_by?.toString() ?? null,
            }
          : null,
        department: (user as any).departments
          ? {
              ...(user as any).departments,
              id: (user as any).departments.id.toString(),
              working_location_id:
                (user as any).departments.working_location_id.toString(),
            }
          : null,
        permission_overrides: ((user as any).user_permission_overrides ?? []).map((o: any) => ({
          id: o.id.toString(),
          permission_key: o.permission_key,
          is_allowed: o.is_allowed,
          reason: o.reason,
        })),
      },
      admin_contacts: adminContacts,
      audit_logs: last100AuditLogs.map((log) => ({
        ...log,
        id: log.id.toString(),
        user_id: log.user_id.toString(),
        employee_id: log.employee_id?.toString() ?? null,
        entity_id: log.entity_id.toString(),
      })),
    };
  }

  async refresh(
    refreshToken: string,
    context?: RequestContext,
  ): Promise<TokenPair & { redirectUrl: string }> {
    const tokenHash = hashToken(refreshToken);

    const session = await this.prisma.user_sessions.findFirst({
      where: { refresh_token_hash: tokenHash },
      include: {
        users: {
          include: { user_roles: { include: { roles: true } } },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or revoked refresh token.');
    }

    if (new Date() > session.expires_at) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    // Atomically "claim" this session before doing anything else. Two
    // requests can arrive with the same refresh token nearly simultaneously
    // (duplicate tabs, or the refresh timer racing an axios 401 retry). A
    // plain findFirst + later update leaves a gap where both requests can
    // read is_revoked: false before either commits, so both would try to
    // rotate the same token. This conditional updateMany only succeeds for
    // whichever request gets there first; the loser gets count === 0 and
    // fails cleanly instead of corrupting session state.
    const claim = await this.prisma.user_sessions.updateMany({
      where: { id: session.id, is_revoked: false },
      data: { is_revoked: true },
    });

    if (claim.count === 0) {
      throw new UnauthorizedException('Invalid or revoked refresh token.');
    }

    const payload = await this.buildPayload((session as any).users.id);
    const tokens = await this.createTokenPair(payload);

    await this.prisma.user_sessions.create({
      data: {
        uuid: generateUUID(),
        user_id: (session as any).users.id,
        refresh_token_hash: hashToken(tokens.refresh_token),
        device_info: this.normalizeDeviceInfo(context?.deviceInfo),
        ip_address: context?.ipAddress,
        expires_at: this.getRefreshExpiryDate(),
      },
    });

    const roles = (session as any).users.user_roles.map((ur: any) => ur.roles.name);
    let rolePath = 'users';
    if (roles.includes('SUPER_ADMIN')) rolePath = 'super_admin';
    else if (roles.includes('BRANCH_MANAGER')) rolePath = 'branch_manager';
    else if (roles.includes('HR') || roles.includes('HR_MANAGER')) rolePath = 'hr';
    else if (roles.includes('ACCOUNTANT') || roles.includes('FINANCE')) rolePath = 'finance';
    else if (roles.includes('ATTENDANT')) rolePath = 'attendant';

    return {
      ...tokens,
      redirectUrl: `/${rolePath}/${(session as any).users.uuid}`,
    };
  }

  async logout(userId: string, refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.user_sessions.updateMany({
      where: { user_id: BigInt(userId), refresh_token_hash: tokenHash },
      data: { is_revoked: true },
    });
    return { message: 'Session revoked successfully.' };
  }

  async logoutAll(userId: string) {
    await this.prisma.user_sessions.updateMany({
      where: { user_id: BigInt(userId), is_revoked: false },
      data: { is_revoked: true },
    });
    return { message: 'All sessions revoked successfully.' };
  }

  async forgotPassword(identifier: string) {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [{ email: identifier }, { phone_number: identifier }],
        deleted_at: null,
      },
    });

    if (!user) {
      return {
        message: 'If an account exists, a reset token has been generated.',
      };
    }

    const token = generateUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        reset_password_token: token,
        reset_password_expires: expires,
      },
    });

    return {
      message: 'Reset token generated.',
      reset_token: token,
      expires_at: expires.toISOString(),
    };
  }

  async resetPassword(token: string, dto: ResetPasswordDto) {
    const user = await this.prisma.users.findFirst({
      where: {
        reset_password_token: token,
        reset_password_expires: { gte: new Date() },
        deleted_at: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Reset token is invalid or has expired. Tokens expire after 1 hour.',
      );
    }

    if (dto.password !== dto.confirmPassword) {
      throw new UnauthorizedException('Passwords do not match.');
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d.*\d)(?=.*[@$!%*?&]).{5,}$/;
    if (!passwordRegex.test(dto.password)) {
      throw new UnauthorizedException(
        'Password must be at least 5 characters, include one uppercase, one lowercase, two digits, and one special character (@$!%*?&).',
      );
    }

    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: await hashPassword(dto.password),
        reset_password_token: null,
        reset_password_expires: null,
      },
    });

    return { message: 'Password reset successfully.' };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ) {
    const updateData: Record<string, any> = {};

    if (dto.first_name !== undefined) updateData.first_name = dto.first_name;
    if (dto.last_name !== undefined) updateData.last_name = dto.last_name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.password) {
      updateData.password_hash = await hashPassword(dto.password);
    }

    await this.prisma.users.update({
      where: { id: BigInt(userId) },
      data: updateData,
    });

    return { message: 'Profile updated successfully.' };
  }

  // ── Private helpers ──

  private async buildPayload(userId: bigint): Promise<JwtPayload> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: {
        user_roles: { include: { roles: true } },
        user_permissions: true,
        user_permission_overrides: true,
      },
    });

    if (!user) throw new UnauthorizedException('User not found.');

    const permissionKeys = await this.buildEffectivePermissions(user);

    return {
      sub: user.id.toString(),
      uuid: user.uuid,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number,
      roles: user.user_roles.map((r) => r.roles.name),
      permissions: permissionKeys,
      status: user.status,
      department_id: user.department_id?.toString() ?? null,
      working_location_id: user.working_location_id?.toString() ?? null,
      // Include BOTH allow and deny overrides here. PermissionsGuard reads
      // this array straight off the JWT and does effective.add(...) for
      // is_allowed true / effective.delete(...) for is_allowed false. The
      // previous `.filter((o) => o.is_allowed)` silently dropped every deny
      // override before it ever reached the guard, so revoking a specific
      // permission from a user (while their role still grants it) never
      // actually took effect until they logged out and back in, and even
      // then only via /auth/me's separate buildEffectivePermissions() path
      // — the JWT-based guard never saw it.
      permission_overrides: (user.user_permission_overrides ?? []).map((o) => ({
        permission_key: o.permission_key,
        is_allowed: o.is_allowed,
      })),
    };
  }

  private async createTokenPair(
    payload: JwtPayload,
  ): Promise<TokenPair> {
    const access_token = signAccessToken(this.jwtService, payload);
    const refresh_token = signRefreshToken(this.jwtService, payload);

    return {
      access_token,
      refresh_token,
      expires_in: '15m',
    };
  }

  private async buildEffectivePermissions(user: any): Promise<string[]> {
    const permissionSet = new Set<string>();

    // Collect from roles
    for (const userRole of user.user_roles ?? []) {
      const keys = (userRole.roles?.permission_keys as string[]) ?? [];
      for (const key of keys) {
        permissionSet.add(key);
      }
    }

    // Collect direct permissions
    for (const up of user.user_permissions ?? []) {
      permissionSet.add(up.permission_key);
    }

    // Expand implied permissions
    const initial = Array.from(permissionSet);
    for (const key of initial) {
      for (const implied of IMPLIED_PERMISSIONS[key] ?? []) {
        permissionSet.add(implied);
      }
    }

    // Apply overrides
    for (const override of user.user_permission_overrides ?? []) {
      if (override.is_allowed) {
        permissionSet.add(override.permission_key);
      } else {
        permissionSet.delete(override.permission_key);
      }
    }

    return Array.from(permissionSet);
  }

  private async writeLoginAudit(
    userId: bigint,
    ipAddress?: string,
    success: boolean = true,
  ) {
    try {
      await this.prisma.audit_logs.create({
        data: {
          user_id: userId,
          entity_table: 'users',
          entity_id: userId,
          module_name: 'AUTH',
          activity_type: success
            ? ('LOGIN' as any)
            : ('FAILED_LOGIN' as any),
          activity_description: success
            ? 'User logged in successfully.'
            : 'Failed login attempt.',
          action: success
            ? ('LOGIN' as any)
            : ('DENIED' as any),
          ip_address: ipAddress,
        },
      });
    } catch (err) {
      console.error('Failed to write login audit:', err);
    }
  }
}