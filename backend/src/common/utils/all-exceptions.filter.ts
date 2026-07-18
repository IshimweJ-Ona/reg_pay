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

    let message = this.resolveHttpMessage(exception, httpStatus);
    let details = this.resolveSafeDetails(exception);

    // Handle Prisma Client Errors
    if (exception.code?.startsWith('P')) {
      httpStatus = HttpStatus.BAD_REQUEST;
      details = undefined;
      switch (exception.code) {
        case 'P2002':
          message = this.duplicateMessage(exception.meta?.target);
          break;
        case 'P2003':
          message =
            'A related record is missing or cannot be changed because it is already in use.';
          break;
        case 'P2025':
          httpStatus = HttpStatus.NOT_FOUND;
          message = 'Record not found.';
          break;
        default:
          message =
            'We could not save this change because of a database constraint. Please review the information and try again.';
      }
    }

    if (httpStatus >= HttpStatus.INTERNAL_SERVER_ERROR) {
      message =
        'Something went wrong on the server. Please try again or contact support if the problem continues.';
      details = undefined;
    }

    const responseBody: Record<string, any> = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message,
    };

    if (details) {
      responseBody.details = details;
    }

    // LOG THE ERROR TO TERMINAL
    this.logger.error(
      `[${httpStatus}] ${httpAdapter.getRequestMethod(ctx.getRequest())} ${httpAdapter.getRequestUrl(ctx.getRequest())}`,
    );
    this.logger.error(
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }

  private resolveHttpMessage(exception: any, status: number): string {
    if (!(exception instanceof HttpException)) {
      return status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Something went wrong on the server. Please try again or contact support if the problem continues.'
        : 'The request could not be completed.';
    }

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return this.toPlainMessage(response);
    }

    if (response && typeof response === 'object') {
      const message = (response as Record<string, any>).message;

      if (Array.isArray(message)) {
        return this.toPlainMessage(message.join(' '));
      }

      if (typeof message === 'string') {
        return this.toPlainMessage(message);
      }

      const errors = (response as Record<string, any>).errors;
      if (Array.isArray(errors) && errors.length > 0) {
        return 'Some records could not be processed. Please review the listed issues and try again.';
      }
    }

    return this.toPlainMessage(exception.message || 'The request could not be completed.');
  }

  private resolveSafeDetails(exception: any) {
    if (!(exception instanceof HttpException)) return undefined;

    const response = exception.getResponse();
    if (!response || typeof response !== 'object') return undefined;

    const errors = (response as Record<string, any>).errors;
    if (!Array.isArray(errors) || errors.length === 0) return undefined;

    return errors.map((error) => {
      if (typeof error === 'string') return this.toPlainMessage(error);
      return {
        row: error.row,
        employee_id: error.employee_id,
        message: this.toPlainMessage(error.message ?? 'Please review this row.'),
      };
    });
  }

  private duplicateMessage(target: unknown): string {
    const fields = Array.isArray(target)
      ? target
      : typeof target === 'string'
        ? [target]
        : [];

    if (fields.length === 0) {
      return 'A record with these details already exists.';
    }

    const readableFields = fields
      .map((field) => String(field).replace(/_/g, ' '))
      .join(', ');

    return `A record with this ${readableFields} already exists.`;
  }

  private toPlainMessage(value: unknown): string {
    const fallback = 'The request could not be completed.';
    if (value === null || value === undefined) return fallback;

    const text = String(value).replace(/\s+/g, ' ').trim();
    return text || fallback;
  }
}
