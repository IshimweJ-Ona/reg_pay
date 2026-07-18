import { JwtService } from '@nestjs/jwt';
import type { users } from '@prisma/client';

import {
  ACCESS_TOKEN_EXPIRES_IN,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  REFRESH_TOKEN_EXPIRES_IN,
} from '../constants/auth.constants';

import type { JwtPayload } from '../interfaces/jwt-payload.interface';

export type UserForToken = Pick<
  users,
  | 'id'
  | 'uuid'
  | 'email'
  | 'phone_number'
  | 'first_name'
  | 'last_name'
  | 'status'
  | 'working_location_id'
  | 'department_id'
>;

export const buildJwtPayload = (
  user: UserForToken,
  roles: string[],
  permissions: string[],
  permissionOverrides: JwtPayload['permission_overrides'] = [],
): JwtPayload => ({
  sub: user.id.toString(),
  uuid: user.uuid,
  email: user.email,
  phone_number: user.phone_number,
  first_name: user.first_name,
  last_name: user.last_name,
  status: user.status,
  roles,
  permissions,
  permission_overrides: permissionOverrides,
  working_location_id: user.working_location_id?.toString() ?? null,
  department_id: user.department_id?.toString() ?? null,
});

export const signAccessToken = (
  jwtService: JwtService,
  payload: JwtPayload,
): string => {
  return jwtService.sign(payload, {
    secret: JWT_ACCESS_SECRET,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
};

export const signRefreshToken = (
  jwtService: JwtService,
  payload: JwtPayload,
): string => {
  return jwtService.sign(payload, {
    secret: JWT_REFRESH_SECRET,
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
};
