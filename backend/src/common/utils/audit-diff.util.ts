/**
 * Builds a clean audit_logs diff from two plain objects (or one object plus
 * an explicit set of keys to compare). Only keys that actually differ are
 * included, both sides always share the same key set, and changed_fields
 * always matches exactly what's in old_values/new_values - unlike ad hoc
 * full-entity snapshots, which bloat the log and make diffs hard to read.
 */
export interface AuditDiff {
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_fields: string[];
}

function serializeAuditValue(value: unknown): any {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

export function buildAuditDiff(
  oldEntity: Record<string, any> | null | undefined,
  newEntity: Record<string, any> | null | undefined,
  keys?: string[],
): AuditDiff {
  const oldObj = oldEntity ?? {};
  const newObj = newEntity ?? {};
  const candidateKeys =
    keys ??
    Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

  const changedFields: string[] = [];
  const oldValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};

  for (const key of candidateKeys) {
    const oldVal = serializeAuditValue(oldObj[key]);
    const newVal = serializeAuditValue(newObj[key]);
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changedFields.push(key);
      oldValues[key] = oldVal;
      newValues[key] = newVal;
    }
  }

  return {
    old_values: changedFields.length ? oldValues : null,
    new_values: changedFields.length ? newValues : null,
    changed_fields: changedFields,
  };
}
