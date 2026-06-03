import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACTIVITY_TYPE, AUDIT_ACTION, STATUS_USER } from '@prisma/client';
import { compareHash, hashValue } from '../common/utils/hash.util';
import { isNumericId, requireUuidOrNumeric } from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  JWT_REFRESH_SECRET,
  REFRESH_TOKEN_EXPIRES_IN_DAYS,
} from './constants/auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { comparePassword, hashPassword } from './utils/password.util';
import {
  buildJwtPayload,
  signAccessToken,
  signRefreshToken,
} from './utils/token.util';

type RequestContext = {
  deviceInfo?: string | string[];
  ipAddress?: string;
};

type TokenPair = {
  access_token: string;
  refresh_token: string;
  expires_in: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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
        status: STATUS_USER.PENDING,
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
        working_location: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    const localApprover = workingLocationId
      ? await this.prisma.branch_managers.findFirst({
          where: { working_location_id: workingLocationId, is_active: true },
          select: { user_id: true },
        })
      : null;

    // Create notification for the local manager when available; otherwise HQ admins receive it.
    // For registration, we don't know the manager's UUID yet easily here without a query,
    // but the notification bell in frontend can handle mapping relative paths.
    // However, to be safe and consistent with the user's request:
    await this.prisma.notifications.create({
      data: {
        uuid: generateUUID(),
        user_id: localApprover?.user_id ?? null,
        title: 'New User Registration',
        message: `${user.first_name} ${user.last_name} has registered and is pending approval.`,
        type: 'REGISTRATION_REQUEST',
        reference_id: user.uuid,
        metadata: {
          redirect: 'users', // Use relative or tokenized paths
          level: localApprover ? 'MANAGER' : 'ADMIN',
        },
      },
    });

    return {
      message:
        'Registration successful. Administrators will approve your registration and grant permission to you to operate on the system. Come back after 72hrs if not yet then contact this email {admin@regpay.local}. Thank you for registering on the system.',
      user,
    };
  }

  async login(dto: LoginDto, context: RequestContext = {}) {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone_number: dto.identifier }],
        deleted_at: null,
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Incorrect email or phone number');
    }

    const passwordIsValid = await comparePassword(
      dto.password,
      user.password_hash,
    );

    if (!passwordIsValid) {
      await this.writeLoginAudit(user.id, context.ipAddress, false);
      throw new UnauthorizedException('Incorrect password.');
    }

    if (user.status === STATUS_USER.SUSPENDED) {
      throw new UnauthorizedException(
        'Account is suspended. Contact an administrator.',
      );
    }

    if (user.status === STATUS_USER.REJECTED) {
      throw new UnauthorizedException(
        'Your registration was rejected. Contact an administrator if you believe this is an error.',
      );
    }

    const payload = await this.buildPayload(user.id);
    const tokens = await this.createTokenPair(payload);

    await this.prisma.$transaction([
      this.prisma.user_sessions.create({
        data: {
          uuid: generateUUID(),
          user_id: user.id,
          refresh_token_hash: await hashValue(tokens.refresh_token),
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

    const roles = user.roles.map((r) => r.role.name);

    let rolePath = 'users';
    if (roles.includes('SUPER_ADMIN')) {
      rolePath = 'super_admin';
    } else if (
      roles.includes('BRANCH_MANAGER') ||
      roles.includes('MANAGER') ||
      roles.includes('ON_MANAGER')
    ) {
      rolePath = 'manager';
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

    if (user.status === STATUS_USER.PENDING) {
      redirectUrl = `/auth/pending/${user.uuid}`;
    }

    return { ...tokens, redirectUrl, uuid: user.uuid, status: user.status };
  }

  async forgotPassword(emailOrPhone: string) {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [{ email: emailOrPhone }, { phone_number: emailOrPhone }],
        deleted_at: null,
      },
    });

    if (!user) {
      // For security, don't reveal if user exists
      return {
        message: 'If an account exists, a reset token has been generated.',
      };
    }

    const token = generateUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiry

    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        reset_password_token: token,
        reset_password_expires: expires,
      },
    });

    // In a real app, send an email/SMS here. For now, we return the token as requested for the "small page" flow.
    return {
      message: 'Reset token generated.',
      reset_token: token,
      user_name: `${user.first_name} ${user.last_name}`,
    };
  }

  async resetPassword(token: string, dto: any) {
    const user = await this.prisma.users.findFirst({
      where: {
        reset_password_token: token,
        reset_password_expires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token.');
    }

    if (dto.password !== dto.confirmPassword) {
      throw new ConflictException('Passwords do not match.');
    }

    // Password regex: minimum 5, two digits, one capital, one small, one symbol
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{5,}$/;
    if (!passwordRegex.test(dto.password)) {
      throw new ConflictException(
        'Password does not meet security requirements.',
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

    return { message: 'Password has been reset successfully.' };
  }

  async refresh(refreshToken: string, context: RequestContext = {}) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const userId = BigInt(payload.sub);
    const session = await this.findMatchingActiveSession(userId, refreshToken);

    if (!session) {
      throw new UnauthorizedException('Refresh token has been revoked.');
    }

    const freshPayload = await this.buildPayload(userId);
    const tokens = await this.createTokenPair(freshPayload);

    await this.prisma.$transaction([
      this.prisma.user_sessions.update({
        where: { id: session.id },
        data: { is_revoked: true },
      }),
      this.prisma.user_sessions.create({
        data: {
          uuid: generateUUID(),
          user_id: userId,
          refresh_token_hash: await hashValue(tokens.refresh_token),
          device_info:
            this.normalizeDeviceInfo(context.deviceInfo) ?? session.device_info,
          ip_address: context.ipAddress ?? session.ip_address,
          expires_at: this.getRefreshExpiryDate(),
        },
      }),
    ]);

    return tokens;
  }

  async logout(userId: string, refreshToken: string) {
    const session = await this.findMatchingActiveSession(
      BigInt(userId),
      refreshToken,
    );

    if (session) {
      await this.prisma.user_sessions.update({
        where: { id: session.id },
        data: { is_revoked: true },
      });
    }

    return { message: 'Session logged out successfully.' };
  }

  async logoutAll(userId: string) {
    await this.prisma.user_sessions.updateMany({
      where: {
        user_id: BigInt(userId),
        is_revoked: false,
      },
      data: { is_revoked: true },
    });

    return { message: 'All sessions revoked successfully.' };
  }

  async me(userId: string) {
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id: BigInt(userId) },
      include: {
        working_location: true,
        department: true,
        user_permissions: { include: { permission: true, grantedBy: true } },
        permission_overrides: { include: { permission: true } },
        roles: {
          include: {
            role: {
              include: {
                role_permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    const admins = await this.prisma.users.findMany({
      where: {
        deleted_at: null,
        status: STATUS_USER.ACTIVE,
        roles: {
          some: {
            role: {
              name: { in: ['SUPER_ADMIN', 'ADMIN'] },
            },
          },
        },
      },
      select: {
        uuid: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
      },
      orderBy: { created_at: 'asc' },
    });
    const activityHistory = await this.prisma.audit_logs.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return {
      profile: {
        uuid: user.uuid,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        gender: user.gender,
        status: user.status,
        avatar_url: user.avatar_url,
        working_location: user.working_location
          ? {
              uuid: user.working_location.uuid,
              name: user.working_location.name,
              type: user.working_location.type,
            }
          : null,
        department: user.department
          ? {
              uuid: user.department.uuid,
              name: user.department.name,
              code: user.department.code,
            }
          : null,
        roles: user.roles.map((userRole) => userRole.role.name),
        permissions: this.serializeEffectivePermissions(user),
      },
      admin_contacts: admins,
      activity_history: activityHistory.map((log) => ({
        id: log.id.toString(),
        module_name: log.module_name,
        activity_type: log.activity_type,
        activity_description: log.activity_description,
        action: log.action,
        created_at: log.created_at,
      })),
    };
  }

  private async buildPayload(userId: bigint): Promise<JwtPayload> {
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
    });
    const rbac = await this.loadUserRbac(userId);

    return buildJwtPayload(user, rbac.roles, rbac.permissions);
  }

  private serializeEffectivePermissions(user: Record<string, any>) {
    const permissionMap = new Map<string, Record<string, any>>();

    for (const userRole of user.roles ?? []) {
      for (const rolePermission of userRole.role?.role_permissions ?? []) {
        const permission = rolePermission.permission;
        permissionMap.set(permission.permission_key, {
          uuid: permission.uuid,
          key: permission.permission_key,
          name: permission.name,
          module_name: permission.module_name,
          source: 'role',
          granted_at: userRole.created_at,
          granted_by: null,
        });
      }
    }

    for (const userPermission of user.user_permissions ?? []) {
      permissionMap.set(userPermission.permission.permission_key, {
        uuid: userPermission.permission.uuid,
        key: userPermission.permission.permission_key,
        name: userPermission.permission.name,
        module_name: userPermission.permission.module_name,
        source: 'direct',
        granted_at: userPermission.created_at,
        granted_by: userPermission.grantedBy
          ? {
              uuid: userPermission.grantedBy.uuid,
              email: userPermission.grantedBy.email,
              phone_number: userPermission.grantedBy.phone_number,
            }
          : null,
      });
    }

    for (const override of user.permission_overrides ?? []) {
      const permissionKey = override.permission?.permission_key;
      if (!permissionKey) continue;

      if (override.is_allowed) {
        permissionMap.set(permissionKey, {
          uuid: override.permission.uuid,
          key: permissionKey,
          name: override.permission.name,
          module_name: override.permission.module_name,
          source: 'override',
          granted_at: override.updated_at,
          granted_by: null,
        });
      } else {
        permissionMap.delete(permissionKey);
      }
    }

    return Array.from(permissionMap.values());
  }

  private async loadUserRbac(userId: bigint) {
    const [
      user,
      userRoles,
      userPermissions,
      permissionOverrides,
      activeBranchManager,
    ] = await Promise.all([
      this.prisma.users.findUnique({ where: { id: userId } }),
      this.prisma.user_roles.findMany({
        where: { user_id: userId },
        include: {
          role: {
            include: {
              role_permissions: {
                include: { permission: true },
              },
            },
          },
        },
      }),
      this.prisma.user_permissions.findMany({
        where: { user_id: userId },
        include: { permission: true },
      }),
      this.prisma.user_permission_overrides.findMany({
        where: { user_id: userId },
        include: { permission: true },
      }),
      this.prisma.branch_managers.findFirst({
        where: { user_id: userId, is_active: true },
        select: { id: true },
      }),
    ]);

    const roles = userRoles.map((userRole) => userRole.role.name);
    const permissions = new Set<string>();

    if (activeBranchManager && !roles.includes('BRANCH_MANAGER')) {
      roles.push('BRANCH_MANAGER');
    }
    if (user?.status !== STATUS_USER.ACTIVE) {
      return { roles, permissions: [] };
    }

    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.role_permissions) {
        permissions.add(rolePermission.permission.permission_key);
      }
    }
    for (const userPermission of userPermissions) {
      permissions.add(userPermission.permission.permission_key);
    }
    for (const override of permissionOverrides) {
      if (override.is_allowed) {
        permissions.add(override.permission.permission_key);
      } else {
        permissions.delete(override.permission.permission_key);
      }
    }

    return {
      roles,
      permissions: Array.from(permissions),
    };
  }

  private async createTokenPair(payload: JwtPayload): Promise<TokenPair> {
    return {
      access_token: signAccessToken(this.jwtService, payload),
      refresh_token: signRefreshToken(this.jwtService, payload),
      expires_in: '15 minutes',
    };
  }

  private async findMatchingActiveSession(
    userId: bigint,
    refreshToken: string,
  ) {
    const sessions = await this.prisma.user_sessions.findMany({
      where: {
        user_id: userId,
        is_revoked: false,
        expires_at: { gt: new Date() },
      },
    });

    for (const session of sessions) {
      const matches = await compareHash(
        refreshToken,
        session.refresh_token_hash,
      );

      if (matches) return session;
    }

    return null;
  }

  private getRefreshExpiryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
    return date;
  }

  private normalizeDeviceInfo(
    deviceInfo?: string | string[],
  ): string | undefined {
    return Array.isArray(deviceInfo) ? deviceInfo.join(', ') : deviceInfo;
  }

  private async resolveWorkingLocationId(value: string) {
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
    workingLocationId: bigint | null,
  ) {
    requireUuidOrNumeric(value, 'department_id');
    const department = await this.prisma.departments.findFirst({
      where: {
        ...(isNumericId(value) ? { id: BigInt(value) } : { uuid: value }),
        ...(workingLocationId
          ? { working_location_id: workingLocationId }
          : {}),
      },
      select: { id: true },
    });

    if (!department) {
      throw new ConflictException('Department does not exist.');
    }
    return department.id;
  }

  private async writeLoginAudit(
    userId: bigint,
    ipAddress: string | undefined,
    success: boolean,
  ) {
    await this.prisma.audit_logs.create({
      data: {
        user_id: userId,
        entity_table: 'users',
        entity_id: userId,
        module_name: 'AUTH',
        activity_type: success
          ? ACTIVITY_TYPE.LOGIN
          : ACTIVITY_TYPE.FAILED_LOGIN,
        activity_description: success
          ? 'User logged in.'
          : 'Failed login attempt.',
        action: success ? AUDIT_ACTION.LOGIN : AUDIT_ACTION.DENIED,
        ip_address: ipAddress,
      },
    });
  }
}
