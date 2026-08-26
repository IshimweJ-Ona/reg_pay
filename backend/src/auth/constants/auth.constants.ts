// No insecure fallback secrets - a deployment that forgets to set these
// must fail loudly at boot rather than silently sign tokens with a
// well-known default value.
function requireSecret(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(
      `${envVar} must be set. Generate a long random value and add it to your .env.`,
    );
  }
  return value;
}

export const JWT_ACCESS_SECRET = requireSecret('JWT_ACCESS_SECRET');

export const JWT_REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET');

export const ACCESS_TOKEN_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN || '15m';

export const REFRESH_TOKEN_EXPIRES_IN =
  process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7;
