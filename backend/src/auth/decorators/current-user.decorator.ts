import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUserType } from '../types/current-user.type';

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserType | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserType;

    return data ? user?.[data] : user;
  },
);
