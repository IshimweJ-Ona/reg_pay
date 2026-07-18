import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { scopeStorage, UserScope } from '../scope/scope-storage';
import { computeEffectivePermissions } from '../utils/effective-permissions.util';

@Injectable()
export class WorkingLocationScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    const scope: UserScope = {
      userId: user.userId || user.sub,
      roles: user.roles || [],
      // Same effective-permission computation used by PermissionsGuard,
      // so "<module>.read_all" here means exactly what it means for route
      // authorization — one source of truth, no drift between the two.
      permissions: Array.from(computeEffectivePermissions(user)),
      working_location_id: user.working_location_id || null,
      department_id: user.department_id || null,
    };

    return new Observable((subscriber) => {
      scopeStorage.run(scope, () => {
        next.handle().subscribe({
          next: (res) => subscriber.next(res),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
