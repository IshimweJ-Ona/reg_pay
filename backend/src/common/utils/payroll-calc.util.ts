export const DEFAULT_OVERTIME_BONUS_PER_DAY = 2500;
export const DEFAULT_WORK_HOURS_PER_DAY = 8;
export const DEFAULT_MONTHLY_WORK_DAYS = 26;

/** Kept as an alias so older imports don't break at compile time. */
export const DEFAULT_OVERTIME_RATE_PER_HOUR = DEFAULT_OVERTIME_BONUS_PER_DAY;

/**
 * Legacy helpers for old total-hours attendance records. New attendance rows
 * store overtime_hours directly.
 */
export function countOvertimeDays(
  dailyHoursWorked: number[],
  defaultWorkHours: number = DEFAULT_WORK_HOURS_PER_DAY,
): number {
  return dailyHoursWorked.filter((hours) => hours > defaultWorkHours).length;
}

export function countOvertimeHours(
  dailyHoursWorked: number[],
  defaultWorkHours: number = DEFAULT_WORK_HOURS_PER_DAY,
): number {
  return dailyHoursWorked.reduce(
    (sum, hours) =>
      sum + (hours > defaultWorkHours ? hours - defaultWorkHours : 0),
    0,
  );
}

export function calculateOvertimeBonus(
  overtimeDays: number,
  bonusPerDay: number = DEFAULT_OVERTIME_BONUS_PER_DAY,
): number {
  if (!overtimeDays || overtimeDays <= 0) return 0;
  return overtimeDays * bonusPerDay;
}

export function calculateOvertimePay(
  overtimeHours: number,
  ratePerHour: number = DEFAULT_OVERTIME_BONUS_PER_DAY,
): number {
  if (!overtimeHours || overtimeHours <= 0) return 0;
  return overtimeHours * ratePerHour;
}

export function calculateMonthlyDailyRate(
  monthlySalary: number | string,
  workingDays: number = DEFAULT_MONTHLY_WORK_DAYS,
): number {
  const salary = Number(monthlySalary);
  if (!Number.isFinite(salary) || salary <= 0 || workingDays <= 0) return 0;
  return Number((salary / workingDays).toFixed(2));
}

export function getContractDays(
  contractStartDate: Date | string,
  contractEndDate: Date | string,
): number {
  const start = new Date(contractStartDate);
  const end = new Date(contractEndDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return diffDays > 0 ? diffDays : 0;
}

export function calculateCustomContractTotal(
  dailyRate: number,
  contractStartDate: Date | string,
  contractEndDate: Date | string,
): number {
  const days = getContractDays(contractStartDate, contractEndDate);
  return dailyRate * days;
}
