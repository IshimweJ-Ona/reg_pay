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

  private readonly impliedPermissions: Record<string, string[]> = {
    'employees.create': [
      'employees.read',
      'employees.update',
      'employees.suspend',
      'employees.transfer',
    ],
    'attendance.create': [
      'attendance.read',
      'attendance.update',
      'attendance.approve',
    ],
    'payroll.create': [
      'payroll.read',
      'payroll.manage',
    ],
    'payroll.manage': [
      'payroll.read',
      'payroll.create',
      'payroll.approve',
    ],
    'payment-structures.create': [
      'payment-structures.read',
      'payment-structures.update',
      'payment-structures.delete',
    ],
    'users.create': [
      'users.read',
      'users.update',
      'users.approve',
      'users.suspend',
    ],
    'permissions.manage': [
      'permissions.read',
      'permissions.create',
      'permissions.assign',
    ],
    'branches.manage': [
      'departments.manage',
      'branch-manager.manage',
    ],
    'branch-manager.manage': [
      'users.read',
      'users.update',
      'permissions.read',
      'permissions.assign',
      'departments.manage',
      'employees.create',
      'employees.read',
      'employees.update',
      'attendance.read',
      'payroll.read',
    ],
  };

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) return true;

    const { user } = context.switchToHttp().getRequest<{
      user?: CurrentUserType;
    }>();

    if (user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role))) {
      return true;
    }

    const branchManagerPermissions = new Set([
      'users.read',
      'users.update',
      'permissions.read',
      'permissions.assign',
      'branches.manage',
      'departments.manage',
      'employees.create',
      'employees.read',
      'employees.update',
      'employees.suspend',
      'attendance.read',
      'payroll.read',
    ]);

    if (
      user?.roles?.includes('BRANCH_MANAGER') &&
      requiredPermissions.some((permission) => branchManagerPermissions.has(permission))
    ) {
      return true;
    }

    const expandedPermissions = this.expandPermissions(user?.permissions ?? []);
    const hasPermission = requiredPermissions.some((permission) =>
      expandedPermissions.has(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('You do not have the required permission.');
    }

    return true;
  }

  private expandPermissions(permissions: string[]) {
    const expanded = new Set(permissions);
    for (const permission of permissions) {
      for (const implied of this.impliedPermissions[permission] ?? []) {
        expanded.add(implied);
      }
    }
    return expanded;
  }
}
