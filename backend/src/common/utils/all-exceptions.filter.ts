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

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message: exception?.response?.message || exception?.message || 'Internal server error',
    };

    // LOG THE ERROR TO TERMINAL
    this.logger.error(
      `[${httpStatus}] ${httpAdapter.getRequestMethod(ctx.getRequest())} ${httpAdapter.getRequestUrl(ctx.getRequest())}`,
    );
    this.logger.error(exception instanceof Error ? exception.stack : JSON.stringify(exception));

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
