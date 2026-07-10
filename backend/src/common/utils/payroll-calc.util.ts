export const DEFAULT_OVERTIME_RATE_PER_HOUR = 2500;


export function calculateOvertimePay(
    overtimeHours: number,
    ratePerHour: number = DEFAULT_OVERTIME_RATE_PER_HOUR,
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
