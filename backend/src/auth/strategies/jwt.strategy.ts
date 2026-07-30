import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JWT_ACCESS_SECRET } from '../constants/auth.constants';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { CurrentUserType } from '../types/current-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { buildRawPermissionKeys } from '../../common/utils/effective-permissions.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      // try Authorization header first, fall back to ?token= query param (needed for SSE)
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => (req?.query?.token as string) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: JWT_ACCESS_SECRET,
    });
  }

  /**
   * Only the token's `sub` (user id) is trusted here - roles, permissions,
   * working location, and status are re-read from the DB on every request
   * so an admin's changes apply on the next API call, not the next login.
   */
  async validate(payload: JwtPayload): Promise<CurrentUserType> {
    let userId: bigint;
    try {
      userId = BigInt(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid session token.');
    }

    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        uuid: true,
        email: true,
        phone_number: true,
        first_name: true,
        last_name: true,
        status: true,
        deleted_at: true,
        working_location_id: true,
        department_id: true,
        user_roles: {
          select: { roles: { select: { name: true, permission_keys: true } } },
        },
        user_permissions: { select: { permission_key: true } },
        user_permission_overrides: {
          select: { permission_key: true, is_allowed: true },
        },
      },
    });

    if (!user || user.deleted_at) {
      throw new UnauthorizedException(
        'Your session is no longer valid. Please log in again.',
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

    return {
      uuid: user.uuid,
      userId: payload.sub,
      email: user.email,
      phone_number: user.phone_number,
      first_name: user.first_name,
      last_name: user.last_name,
      status: user.status,
      roles: user.user_roles.map((ur) => ur.roles?.name).filter(Boolean),
      permissions: buildRawPermissionKeys(user),
      permission_overrides: (user.user_permission_overrides ?? []).map((o) => ({
        permission_key: o.permission_key,
        is_allowed: o.is_allowed,
      })),
      working_location_id: user.working_location_id?.toString() ?? null,
      department_id: user.department_id?.toString() ?? null,
    };
  }
}
