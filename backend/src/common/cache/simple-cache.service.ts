import { Injectable } from '@nestjs/common';

@Injectable()
export class SimpleCacheService {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  async remember<T>(
    key: string,
    ttl: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await factory();
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });

    return value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
