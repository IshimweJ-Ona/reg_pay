import { compareHash, hashValue } from '../../common/utils/hash.util';
import { sha512 } from '../../common/utils/sha512.util';

export const hashPassword = async (plainPassword: string): Promise<string> => {
  const sha512Password = sha512(plainPassword);
  return hashValue(sha512Password);
};

export const comparePassword = async (
  plainPassword: string,
  storedPasswordHash: string,
): Promise<boolean> => {
  const sha512Password = sha512(plainPassword);
  return compareHash(sha512Password, storedPasswordHash);
};
