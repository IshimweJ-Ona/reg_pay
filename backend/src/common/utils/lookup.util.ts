import { BadRequestException } from '@nestjs/common';

export function isNumericId(value: string) {
  return /^\d+$/.test(value);
}

export function normalizeSearch(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function requireUuidOrNumeric(value: string, fieldName: string) {
  if (!value || (!isNumericId(value) && value.length < 16)) {
    throw new BadRequestException(`${fieldName} must be a uuid or numeric id.`);
  }
}
