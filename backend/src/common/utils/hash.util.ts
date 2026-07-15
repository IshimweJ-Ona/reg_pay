import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const DEFAULT_SALT_ROUNDS = 12;

export const hashValue = async (
  value: string,
  saltRounds = DEFAULT_SALT_ROUNDS,
): Promise<string> => {
  return bcrypt.hash(value, saltRounds);
};

export const compareHash = async (
  value: string,
  hashedValue: string,
): Promise<boolean> => {
  return bcrypt.compare(value, hashedValue);
};

export const hashToken = (token: string): string => {
  return createHash('sha256').update(token).digest('hex');
};

