import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { CurrentUserType } from '../types/current-user.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) return true;

    const { user } = context.switchToHttp().getRequest<{
      user?: CurrentUserType;
    }>();

    const hasPermission = requiredPermissions.some((permission) =>
      user?.permissions?.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('You do not have the required permission.');
    }

    return true;
  }
}
