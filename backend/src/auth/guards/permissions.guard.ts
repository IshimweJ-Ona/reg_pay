import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { CurrentUserType } from '../types/current-user.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const userPermissions = new Set(
      user ? await this.loadEffectivePermissions(BigInt(user.userId)) : [],
    );
    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.has(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('You do not have the required permission.');
    }

    return true;
  }

  private async loadEffectivePermissions(userId: bigint) {
    const [userRoles, userPermissions, permissionOverrides] =
      await Promise.all([
        this.prisma.user_roles.findMany({
          where: { user_id: userId },
          include: {
            role: {
              include: {
                role_permissions: { include: { permission: true } },
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
      ]);

    const permissions = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.role_permissions) {
        permissions.add(rolePermission.permission.permission_key);
      }
    }
    for (const userPermission of userPermissions) {
      permissions.add(userPermission.permission.permission_key);
    }

    const impliedMap: Record<string, string[]> = {
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
      'payroll.create': ['payroll.read', 'payroll.manage'],
      'payroll.manage': ['payroll.read', 'payroll.create', 'payroll.approve'],
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
      'branches.manage': ['departments.manage', 'branch-manager.manage'],
    };

    for (const permission of Array.from(permissions)) {
      for (const implied of impliedMap[permission] ?? []) {
        permissions.add(implied);
      }
    }

    for (const override of permissionOverrides) {
      if (override.is_allowed) {
        permissions.add(override.permission.permission_key);
      } else {
        permissions.delete(override.permission.permission_key);
      }
    }

    return Array.from(permissions);
  }
}
