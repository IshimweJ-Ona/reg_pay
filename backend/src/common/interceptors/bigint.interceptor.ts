import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor to handle BigInt serialization issues in JSON responses.
 * Since JSON.stringify does not support BigInt, this interceptor recursively
 * converts all BigInt values in the response data to strings.
 */
@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.transform(data)));
  }

  private transform(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'bigint') {
      return data.toString();
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transform(item));
    }

    if (typeof data === 'object') {
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          data[key] = this.transform(data[key]);
        }
      }
      return data;
    }

    return data;
  }
}
