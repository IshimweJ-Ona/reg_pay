import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileSearch,
  Loader2,
  Lock,
  PauseCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PageStateTone = "default" | "info" | "success" | "warning" | "destructive";

const toneClasses: Record<PageStateTone, string> = {
  default: "bg-muted text-muted-foreground border-border",
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
};

interface PageStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: PageStateTone;
  className?: string;
}

export function PageState({
  title,
  description,
  icon,
  action,
  tone = "default",
  className,
}: PageStateProps) {
  return (
    <section
      className={cn(
        "flex min-h-[280px] items-center justify-center rounded-lg border bg-card p-6 text-center shadow-sm",
        className,
      )}
      role={tone === "destructive" ? "alert" : "status"}
      aria-live={tone === "destructive" ? "assertive" : "polite"}
    >
      <div className="flex max-w-md flex-col items-center gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-lg border", toneClasses[tone])}>
          {icon}
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="pt-1">{action}</div>}
      </div>
    </section>
  );
}

export function LoadingState({
  title = "Loading workspace",
  description = "Preparing the latest HR and payroll data.",
  className,
}: Partial<Pick<PageStateProps, "title" | "description" | "className">>) {
  return (
    <PageState
      title={title}
      description={description}
      tone="info"
      className={className}
      icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
    />
  );
}

export function EmptyState({
  title = "No records found",
  description = "Adjust your filters or create the first record when you have permission.",
  action,
  className,
}: Partial<Pick<PageStateProps, "title" | "description" | "action" | "className">>) {
  return (
    <PageState
      title={title}
      description={description}
      action={action}
      className={className}
      icon={<FileSearch className="h-5 w-5" aria-hidden="true" />}
    />
  );
}

export function ErrorState({
  title = "This area could not load",
  description = "Try again or continue from another module while the rest of the workspace remains available.",
  action,
  className,
}: Partial<Pick<PageStateProps, "title" | "description" | "action" | "className">>) {
  return (
    <PageState
      title={title}
      description={description}
      tone="destructive"
      action={action}
      className={className}
      icon={<AlertCircle className="h-5 w-5" aria-hidden="true" />}
    />
  );
}

export function PermissionDeniedState({
  title = "Permission required",
  description = "Your current role does not include access to this workspace area.",
  action,
  className,
}: Partial<Pick<PageStateProps, "title" | "description" | "action" | "className">>) {
  return (
    <PageState
      title={title}
      description={description}
      tone="warning"
      action={action}
      className={className}
      icon={<Lock className="h-5 w-5" aria-hidden="true" />}
    />
  );
}

export function DisabledState({
  title = "Action unavailable",
  description = "This control is disabled until the required information or permission is available.",
  action,
  className,
}: Partial<Pick<PageStateProps, "title" | "description" | "action" | "className">>) {
  return (
    <PageState
      title={title}
      description={description}
      tone="default"
      action={action}
      className={className}
      icon={<PauseCircle className="h-5 w-5" aria-hidden="true" />}
    />
  );
}

export function SuccessState({
  title = "Saved successfully",
  description = "The change is complete and the workspace is up to date.",
  action,
  className,
}: Partial<Pick<PageStateProps, "title" | "description" | "action" | "className">>) {
  return (
    <PageState
      title={title}
      description={description}
      tone="success"
      action={action}
      className={className}
      icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
    />
  );
}

export function InlineStateNote({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: PageStateTone;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", toneClasses[tone], className)}>
      <div className="flex items-start gap-2">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>{children}</div>
      </div>
    </div>
  );
}

export function RetryButton({ onClick, label = "Try again" }: { onClick: () => void; label?: string }) {
  return <Button onClick={onClick}>{label}</Button>;
}

export function TableStateRow({
  colSpan,
  title,
  description,
  tone = "default",
}: {
  colSpan: number;
  title: string;
  description?: string;
  tone?: PageStateTone;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <PageState
          title={title}
          description={description}
          tone={tone}
          className="min-h-[220px] rounded-none border-0 shadow-none"
          icon={
            tone === "info" ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : tone === "destructive" ? (
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            ) : (
              <FileSearch className="h-5 w-5" aria-hidden="true" />
            )
          }
        />
      </TableCell>
    </TableRow>
  );
}
