import { RequestStatus } from '../../src/types.ts';

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isBoundedText(value: unknown, minimum: number, maximum: number): value is string {
  if (typeof value !== 'string') return false;
  const length = value.trim().length;
  return length >= minimum && length <= maximum;
}

export function isOptionalBoundedText(value: unknown, maximum: number): boolean {
  return value === undefined || isBoundedText(value, 0, maximum);
}

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isOptionalDateOnly(value: unknown): boolean {
  return value === undefined || value === null || isDateOnly(value);
}

export function isRequestStatus(value: unknown): value is RequestStatus {
  return value === 'NEW' || value === 'QUALIFIED' || value === 'CLOSED';
}