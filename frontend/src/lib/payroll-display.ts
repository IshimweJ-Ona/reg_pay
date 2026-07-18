export const asPayrollNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof (value as { toString?: () => string }).toString === 'function') {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const formatRwf = (value: unknown) =>
  `RWF ${asPayrollNumber(value).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;

export const formatPayrollDate = (value?: unknown, fallback = 'Pending') => {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString();
};

export const formatPayrollPeriod = (month?: unknown, year?: unknown) => {
  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  if (!parsedMonth || !parsedYear) return 'Unscheduled';

  return new Date(parsedYear, parsedMonth - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });
};

export const getPayrollTransaction = (item: any) =>
  item?.transaction ?? item?.transactions ?? {};

export const getPayrollMetadata = (item: any) =>
  getPayrollTransaction(item)?.calculation_metadata ?? {};

export const getIkiminaAmount = (batch: any, item: any) => {
  const contribution = batch?.ikimina_contributions?.find(
    (entry: any) => String(entry.employee_id) === String(item?.employee_id),
  );
  return contribution ? asPayrollNumber(contribution.amount) : 0;
};

export const getPayrollItemAmounts = (item: any, batch?: any) => {
  const transaction = getPayrollTransaction(item);
  const tax = asPayrollNumber(transaction.tax_amount);
  const ikimina = getIkiminaAmount(batch, item);
  const totalDeductions = asPayrollNumber(transaction.total_deductions);
  const otherDeductions = Math.max(0, totalDeductions - tax - ikimina);

  return {
    basePay: asPayrollNumber(transaction.base_amount ?? transaction.gross_amount),
    allowanceOt: asPayrollNumber(transaction.allowance_amount),
    grossPay: asPayrollNumber(transaction.gross_amount),
    tax,
    ikimina,
    otherDeductions,
    totalDeductions,
    netPay: asPayrollNumber(transaction.net_amount),
    attendanceDays: asPayrollNumber(transaction.attendance_days),
    workDays:
      transaction.payroll_work_days === null || transaction.payroll_work_days === undefined
        ? null
        : asPayrollNumber(transaction.payroll_work_days),
    periodStart: transaction.payroll_start_date,
    periodEnd: transaction.payroll_end_date,
    paymentDate: transaction.payment_date,
  };
};

export const getPayrollTaxLabel = (item: any) => {
  const metadata = getPayrollMetadata(item);
  const breakdown = Array.isArray(metadata?.tax_breakdown)
    ? metadata.tax_breakdown
    : [];
  const primaryTax = breakdown.find((entry: any) => asPayrollNumber(entry?.prorated_amount) > 0) ?? breakdown[0];

  if (!primaryTax?.name) return 'PIT';

  const rate = asPayrollNumber(primaryTax.rate);
  return rate > 0 ? `${primaryTax.name} ${rate}%` : primaryTax.name;
};

