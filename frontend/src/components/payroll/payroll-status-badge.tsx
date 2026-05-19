
import { Badge } from "@/components/ui/badge";
import { PayrollStatus } from "@/types/payroll";
import { cn } from "@/lib/utils";

const statusConfig: Record<PayrollStatus, { label: string, className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  REVIEW: { label: 'Review', className: 'bg-blue-100 text-blue-600 border-blue-200' },
  PENDING_APPROVAL: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-600 border-amber-200' },
  PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-600 border-amber-200' },
  IN_REVIEW: { label: 'In Review', className: 'bg-blue-100 text-blue-600 border-blue-200' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-600 border-emerald-200' },
  REJECTED: { label: 'Rejected', className: 'bg-rose-100 text-rose-600 border-rose-200' },
  PROCESSING: { label: 'Processing', className: 'bg-indigo-100 text-indigo-600 border-indigo-200' },
  COMPLETED: { label: 'Completed', className: 'bg-green-500 text-white border-green-600' },
  FAILED: { label: 'Failed', className: 'bg-red-500 text-white border-red-600' },
};

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("font-semibold px-2 py-0.5", config.className)}>
      {config.label}
    </Badge>
  );
}
