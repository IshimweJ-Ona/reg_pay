import { BadRequestException } from '@nestjs/common';

export function isNumericId(value: string) {
  return /^\d+$/.test(value);
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function normalizeSearch(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function requireUuidOrNumeric(value: string, fieldName: string) {
  if (!value || (!isNumericId(value) && !isUuid(value) && value.length < 3)) {
    throw new BadRequestException(
      `Please choose a valid ${fieldName.replace('_', ' ')}.`,
    );
  }
}
