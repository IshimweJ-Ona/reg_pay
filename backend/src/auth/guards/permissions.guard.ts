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

    if (user?.roles?.some((role) => ['SUPER_ADMIN'].includes(role))) {
      return true;
    }

    const branchManagerPermissions = new Set([
      'users.read',
      'users.create',
      'users.update',
      'users.suspend',
      'users.approve',
      'users.transfer',
      'permissions.read',
      'permissions.assign',
      'branches.manage',
      'departments.manage',
      'employees.create',
      'employees.read',
      'employees.update',
      'employees.suspend',
      'employees.transfer',
      'attendance.create',
      'attendance.read',
      'attendance.update',
      'attendance.approve',
      'payment-structures.create',
      'payment-structures.read',
      'payment-structures.update',
      'payment-structures.delete',
      'allowances.manage',
      'payroll.create',
      'payroll.read',
      'payroll.manage',
      'payroll.approve',
      'payroll.reports',
      'notifications.read',
      'notifications.manage',
    ]);

    if (
      user?.roles?.some((role) => ['BRANCH_MANAGER'].includes(role)) &&
      requiredPermissions.some((permission) =>
        branchManagerPermissions.has(permission),
      )
    ) {
      return true;
    }

    const userPermissions = new Set(user?.permissions ?? []);
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.has(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('You do not have the required permission.');
    }

    return true;
  }
}
