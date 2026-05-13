import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { 
  ACTIVITY_TYPE, 
  AUDIT_ACTION, 
  STATUS_USER ,
} from '@prisma/client';
import { compareHash, hashValue } from '../common/utils/hash.util';
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
      throw new ConflictException('A user with this email or phone already exists.');
    }

    const user = await this.prisma.users.create({
      data: {
        uuid: generateUUID(),
        first_name: dto.first_name,
        last_name: dto.last_name,
        email: dto.email,
        phone_number: dto.phone_number,
        gender: dto.gender,
        password_hash: await hashPassword(dto.password),
        department_id: dto.department_id ? BigInt(dto.department_id) : null,
        working_location_id: dto.working_location_id
          ? BigInt(dto.working_location_id)
          : null,
        status: STATUS_USER.INACTIVE,
      },
      select: {
        uuid: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        status: true,
        created_at: true,
      },
    });

    return {
      message: 'User registered. Approval pending.',
      user,
    };
  }

  async login(dto: LoginDto, context: RequestContext = {}) {
    const user = await this.prisma.users.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone_number: dto.identifier }],
        deleted_at: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Incorrect email or phone number');
    }

    const passwordIsValid = await comparePassword(dto.password, user.password_hash);

    if (!passwordIsValid) {
      await this.writeLoginAudit(user.id, context.ipAddress, false);
      throw new UnauthorizedException('Incorrect password.');
    }

    if (user.status !== STATUS_USER.ACTIVE) {
      throw new UnauthorizedException('Account is not active. Still pending not yet approved.');
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

    return tokens;
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
    const session = await this.findMatchingActiveSession(BigInt(userId), refreshToken);

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

  private async buildPayload(userId: bigint): Promise<JwtPayload> {
    const user = await this.prisma.users.findUniqueOrThrow({
      where: { id: userId },
    });
    const rbac = await this.loadUserRbac(userId);

    return buildJwtPayload(user, rbac.roles, rbac.permissions);
  }

  private async loadUserRbac(userId: bigint) {
    const userRoles = await this.prisma.user_roles.findMany({
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
    });

    const roles = userRoles.map((userRole) => userRole.role.name);
    const permissions = new Set<string>();

    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.role_permissions) {
        permissions.add(rolePermission.permission.permission_key);
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

  private async findMatchingActiveSession(userId: bigint, refreshToken: string) {
    const sessions = await this.prisma.user_sessions.findMany({
      where: {
        user_id: userId,
        is_revoked: false,
        expires_at: { gt: new Date() },
      },
    });

    for (const session of sessions) {
      const matches = await compareHash(refreshToken, session.refresh_token_hash);

      if (matches) return session;
    }

    return null;
  }

  private getRefreshExpiryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + REFRESH_TOKEN_EXPIRES_IN_DAYS);
    return date;
  }

  private normalizeDeviceInfo(deviceInfo?: string | string[]): string | undefined {
    return Array.isArray(deviceInfo) ? deviceInfo.join(', ') : deviceInfo;
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
        activity_type: success ? ACTIVITY_TYPE.LOGIN : ACTIVITY_TYPE.FAILED_LOGIN,
        activity_description: success ? 'User logged in.' : 'Failed login attempt.',
        action: success ? AUDIT_ACTION.LOGIN : AUDIT_ACTION.DENIED,
        ip_address: ipAddress,
      },
    });
  }
}
