import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: any, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    let httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = exception?.response?.message || exception?.message || 'Internal server error';

    // Handle Prisma Client Errors
    if (exception.code?.startsWith('P')) {
      httpStatus = HttpStatus.BAD_REQUEST;
      switch (exception.code) {
        case 'P2002':
          message = `Duplicate entry: A record with this ${exception.meta?.target || 'value'} already exists.`;
          break;
        case 'P2003':
          message = 'Foreign key constraint failed: A related record is missing or protected.';
          break;
        case 'P2025':
          httpStatus = HttpStatus.NOT_FOUND;
          message = 'Record not found.';
          break;
        default:
          message = `Database Error [${exception.code}]: ${exception.message}`;
      }
    }

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message,
    };

    // LOG THE ERROR TO TERMINAL
    this.logger.error(
      `[${httpStatus}] ${httpAdapter.getRequestMethod(ctx.getRequest())} ${httpAdapter.getRequestUrl(ctx.getRequest())}`,
    );
    this.logger.error(exception instanceof Error ? exception.stack : JSON.stringify(exception));

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
