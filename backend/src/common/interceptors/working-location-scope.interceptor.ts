import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { scopeStorage, UserScope } from '../scope/scope-storage';

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
