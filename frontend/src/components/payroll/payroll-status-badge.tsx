import { StatusBadge, StatusTone } from "@/components/ui/status-badge";
import { PayrollStatus } from "@/types/payroll";

const statusConfig: Record<PayrollStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: "Draft", tone: "secondary" },
  REVIEW: { label: "Review", tone: "info" },
  PENDING_APPROVAL: { label: "Pending Approval", tone: "warning" },
  PENDING: { label: "Pending", tone: "warning" },
  IN_REVIEW: { label: "In Review", tone: "info" },
  MANAGER_APPROVED: { label: "Pending Super Admin", tone: "info" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "destructive" },
  REJECTED_BY_BRANCH_MANAGER: { label: "Rejected by Manager", tone: "destructive" },
  REJECTED_BY_SUPER_ADMIN: { label: "Rejected by Super Admin", tone: "destructive" },
  PROCESSING: { label: "Processing", tone: "accent" },
  COMPLETED: { label: "Completed", tone: "success" },
  FAILED: { label: "Failed", tone: "destructive" },
};

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  const config = statusConfig[status] ?? { label: status ?? "Unknown", tone: "secondary" as StatusTone };
  return <StatusBadge label={config.label} tone={config.tone} />;
}
