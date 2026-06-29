import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IMPLIED_PERMISSIONS } from '../../common/constants/permissions.constants';
import type { CurrentUserType } from '../types/current-user.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<{
      user?: CurrentUserType;
    }>();

    // SUPER_ADMIN bypasses all permission checks
    if (user?.roles?.includes('SUPER_ADMIN')) return true;

    // Build effective permission set from JWT payload
    const effective = new Set<string>(user?.permissions ?? []);

    // Expand implied permissions
    for (const key of Array.from(effective)) {
      for (const implied of IMPLIED_PERMISSIONS[key] ?? []) {
        effective.add(implied);
      }
    }

    // Apply overrides from JWT payload
    for (const override of user?.permission_overrides ?? []) {
      if (override.is_allowed) {
        effective.add(override.permission_key);
      } else {
        effective.delete(override.permission_key);
      }
    }

    const hasPermission = required.some((p) => effective.has(p));

    if (!hasPermission) {
      throw new ForbiddenException('You do not have the required permission.');
    }

    return true;
  }
}
