import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JWT_ACCESS_SECRET } from '../constants/auth.constants';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { CurrentUserType } from '../types/current-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // try Authorization header first, fall back to ?token= query param (needed for SSE)
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => (req?.query?.token as string) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: JWT_ACCESS_SECRET,
    });
  }

  validate(payload: JwtPayload): CurrentUserType {
    return {
      uuid: payload.uuid,
      userId: payload.sub,
      email: payload.email,
      phone_number: payload.phone_number,
      first_name: payload.first_name,
      last_name: payload.last_name,
      status: payload.status,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
      permission_overrides: payload.permission_overrides ?? [],
      working_location_id: payload.working_location_id,
      department_id: payload.department_id,
    };
  }
}
