export const DEFAULT_OVERTIME_BONUS_PER_DAY = 2500;
export const DEFAULT_WORK_HOURS_PER_DAY = 8;

/** @deprecated kept as an alias so older imports don't break at compile time. */
export const DEFAULT_OVERTIME_RATE_PER_HOUR = DEFAULT_OVERTIME_BONUS_PER_DAY;

/**
 * Overtime is no longer a manually entered value. It is derived from
 * attendance: any day where hours_worked exceeds the configured default
 * work hours (8 by default) counts as one "overtime day", and each
 * overtime day earns a single flat bonus (2,500 RWF by default) —
 * regardless of how many hours over the threshold were worked.
 */
export function countOvertimeDays(
    dailyHoursWorked: number[],
    defaultWorkHours: number = DEFAULT_WORK_HOURS_PER_DAY,
): number {
    return dailyHoursWorked.filter((hours) => hours > defaultWorkHours).length;
}

export function calculateOvertimeBonus(
    overtimeDays: number,
    bonusPerDay: number = DEFAULT_OVERTIME_BONUS_PER_DAY,
): number {
    if (!overtimeDays || overtimeDays <= 0) return 0;
    return overtimeDays * bonusPerDay;
}

/** @deprecated Use calculateOvertimeBonus(countOvertimeDays(...)) instead. */
export function calculateOvertimePay(
    overtimeHours: number,
    ratePerHour: number = DEFAULT_OVERTIME_BONUS_PER_DAY,
): number {
    if (!overtimeHours || overtimeHours <= 0) return 0;
    return overtimeHours * ratePerHour;
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
