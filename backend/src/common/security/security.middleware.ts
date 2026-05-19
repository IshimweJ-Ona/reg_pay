import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type RateBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, RateBucket>();
  private readonly windowMs = 60_000;
  private readonly maxRequests = 240;

  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const bucketKey = `${ip}:${req.path.startsWith('/auth') ? 'auth' : 'api'}`;
    const now = Date.now();
    const existing = this.buckets.get(bucketKey);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + this.windowMs };

    bucket.count += 1;
    this.buckets.set(bucketKey, bucket);

    if (bucket.count > this.maxRequests) {
      throw new HttpException(
        'Too many requests. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
