import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic) {
      return (await super.canActivate(context)) as boolean;
    }

    const request = context.switchToHttp().getRequest();
    const hasBearerToken =
      typeof request.headers?.authorization === 'string' &&
      request.headers.authorization.startsWith('Bearer ');

    if (!hasBearerToken) return true;

    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return true;
    }
  }
}
