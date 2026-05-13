import { createHash } from 'crypto';

export const sha512 = (value: string): string => {
  return createHash('sha512').update(value, 'utf8').digest('hex');
};
