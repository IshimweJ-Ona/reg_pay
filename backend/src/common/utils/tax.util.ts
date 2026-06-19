/**
 * Calculates Rwanda PAYE (Pay As You Earn) tax based on gross monthly salary.
 * Using RRA 2024 progressive tax brackets.
 *
 * @param grossMonthlySalary The total taxable income for the month
 * @returns The calculated PAYE tax amount
 */
export function calculateRwandaPaye(grossMonthlySalary: number): number {
  if (grossMonthlySalary <= 60000) {
    return 0;
  }

  let tax = 0;
  let remaining = grossMonthlySalary;

  // 0 - 60,000: 0%
  remaining -= 60000;

  // 60,001 - 100,000: 10%
  if (remaining > 40000) {
    tax += 40000 * 0.1;
    remaining -= 40000;
  } else {
    tax += remaining * 0.1;
    return Math.round(tax);
  }

  // 100,001 - 200,000: 20%
  if (remaining > 100000) {
    tax += 100000 * 0.2;
    remaining -= 100000;
  } else {
    tax += remaining * 0.2;
    return Math.round(tax);
  }

  // Above 200,000: 30%
  tax += remaining * 0.3;

  return Math.round(tax);
}
