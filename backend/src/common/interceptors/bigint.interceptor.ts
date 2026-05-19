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
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.transform(data)));
  }

  /**
   * Recursively traverses the response data and converts BigInts to strings.
   */
  private transform(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Convert BigInt to string
    if (typeof data === 'bigint') {
      return data.toString();
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.transform(item));
    }

    // Handle objects recursively
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
