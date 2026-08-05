"use client";

import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, File02, Users01,
  CheckCircle, XCircle, Clock, ClockRewind, MessageSquare01, Download01, Save01, LinkExternal01, Paperclip, Wallet01, Calculator, Percent01
} from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useParams, useRouter } from 'next/navigation';
import { PayrollStatusBadge } from '@/components/payroll/payroll-status-badge';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { userFriendlyError } from '@/lib/error-message';
import {
  getPayrollBatch,
  submitPayrollBatch,
  approvePayrollBatch,
  rejectPayrollBatch,
  rejectPayrollItem,
  downloadPayrollBatchExport,
} from '@/api/payroll';
import {
  formatPayrollDate,
  formatPayrollPeriod,
  formatRwf,
  getPayrollItemAmounts,
  getPayrollTaxLabel,
} from '@/lib/payroll-display';

const formatPeriodRange = (start?: unknown, end?: unknown) => {
  const startLabel = formatPayrollDate(start, '');
  const endLabel = formatPayrollDate(end, '');
  if (!startLabel && !endLabel) return 'Configured period';
  if (!startLabel) return endLabel;
  if (!endLabel || startLabel === endLabel) return startLabel;
  return `${startLabel} - ${endLabel}`;
};

const getAttachmentUrl = (path?: string) => {
  if (!path) return '#';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
  return `${apiBase}${path}`;
};

export default function PayrollBatchDetailsPage() {
  const router = useRouter();
  const params = useParams<{ batchId: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [batch, setBatch] = useState<any | null>(null);

  const batchId = params.batchId;

  const loadBatch = async () => {
    const response = await getPayrollBatch(batchId);
    setBatch(response);
  };

  useEffect(() => {
    loadBatch().catch(() => setBatch(null));
  }, [batchId]);

  const rows = useMemo(() => batch?.items ?? [], [batch]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return rows.slice(startIndex, startIndex + itemsPerPage);
  }, [rows, currentPage]);

  const totalPages = Math.ceil(rows.length / itemsPerPage);

  const totals = useMemo(() => {
    let totalBasePay = 0;
    let totalAllowances = 0;
    let totalOvertimeHours = 0;
    let totalOvertimePay = 0;
    let totalTax = 0;
    let totalIkimina = 0;
    let totalOtherDeductions = 0;
    let totalDeductions = 0;
    let totalNetPay = 0;
    let totalGrossPay = 0;

    rows.forEach((item: any) => {
      const {
        basePay,
        allowances,
        overtimeHours,
        overtimePay,
        grossPay,
        tax,
        ikimina,
        otherDeductions,
        totalDeductions: deductions,
        netPay,
      } = getPayrollItemAmounts(item, batch);

      totalBasePay += basePay;
      totalAllowances += allowances;
      totalOvertimeHours += overtimeHours;
      totalOvertimePay += overtimePay;
      totalGrossPay += grossPay;
      totalTax += tax;
      totalIkimina += ikimina;
      totalOtherDeductions += otherDeductions;
      totalDeductions += deductions;
      totalNetPay += netPay;
    });

    return {
      totalBasePay,
      totalAllowances,
      totalOvertimeHours,
      totalOvertimePay,
      totalGrossPay,
      totalTax,
      totalIkimina,
      totalOtherDeductions,
      totalDeductions,
      totalNetPay,
    };
  }, [rows, batch]);

  const handleAction = async (type: 'APPROVE' | 'REJECT' | 'SUBMIT') => {
    if (type === 'REJECT' && !comment.trim()) {
      toast({ variant: 'destructive', title: 'Reason required', description: 'Please provide a reason for rejection.' });
      return;
    }

    try {
      if (type === 'APPROVE') await approvePayrollBatch(batchId, comment);
      if (type === 'REJECT') await rejectPayrollBatch(batchId, comment);
      if (type === 'SUBMIT') await submitPayrollBatch(batchId);
      await loadBatch();
      toast({
        title: type === 'APPROVE' ? "Batch Approved" : type === 'REJECT' ? "Batch Rejected" : "Batch Submitted",
        description: type === 'APPROVE' && rows.some((r: any) => r.status === 'REJECTED')
          ? "Batch approved. Rejected employees have been moved to a new batch."
          : `Payroll cycle ${batch?.batch_code ?? batchId} has been updated.`
      });
      setComment('');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Payroll action failed",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const handleRejectItem = async (itemUuid: string) => {
    const reason = window.prompt('Please provide a reason for rejecting this employee:');
    if (!reason) return;

    try {
      await rejectPayrollItem(itemUuid, reason);
      await loadBatch();
      toast({ title: 'Employee Rejected', description: 'The employee has been marked as rejected in this batch.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: userFriendlyError(error, 'Could not reject employee.'),
      });
    }
  };

  const handleExport = async () => {
    try {
      await downloadPayrollBatchExport(batchId);
      toast({ title: 'Export ready', description: 'The payroll batch CSV has been downloaded.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: userFriendlyError(error, 'Could not download this payroll batch.'),
      });
    }
  };

  if (!batch) return <div className="p-8 text-sm text-muted-foreground">Loading payroll batch...</div>;

  const roles = user?.roles ?? [];
  const isBranchManager = roles.includes('BRANCH_MANAGER');
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isApproved = batch.status === 'APPROVED';
  const isRejected = batch.status === 'REJECTED' || batch.status.startsWith('REJECTED');

  const canSubmit = !isApproved && (batch.status === 'DRAFT' || isRejected);
  
  const canApproveInitial = !isApproved && batch.status === 'PENDING' && (
    user?.permissions?.includes('payroll.approve_initial') ||
    user?.permissions?.includes('payroll.approve') ||
    isBranchManager ||
    isSuperAdmin
  );

  const canApproveFinal = !isApproved && batch.status === 'MANAGER_APPROVED' && (
    user?.permissions?.includes('payroll.approve_final') ||
    user?.permissions?.includes('payroll.approve') ||
    isSuperAdmin
  );

  const canApprove = canApproveInitial || canApproveFinal;
  const batchPaymentDate = rows[0]?.transaction?.payment_date ?? batch.approved_at;
  const hasRows = rows.length > 0;
  const activityTrail = batch.activity_trail ?? batch.approval_actions ?? [];
  const attachments = Array.isArray(batch.attachments) ? batch.attachments : [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-headline font-bold">{batch.batch_code}</h1>
              <PayrollStatusBadge status={batch.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {batch.working_location?.name ?? batch.working_location_id} • {formatPayrollPeriod(batch.payroll_month, batch.payroll_year)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <Button className="bg-primary hover:bg-primary/90 gap-2 shadow-lg" onClick={() => handleAction('SUBMIT')}>
              <Save01 className="h-4 w-4" size={16} /> {isRejected ? 'Resubmit for Review' : 'Submit for Review'}
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download01 className="h-4 w-4" size={16} /> Export Assets
          </Button>
          {canApprove && (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <XCircle className="h-4 w-4" size={16} /> Reject Cycle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject Payroll Batch</DialogTitle>
                    <DialogDescription>Please provide a reason for the rejection. This will be sent as a notification to the batch creator.</DialogDescription>
                  </DialogHeader>
                  <Textarea placeholder="Type rejection reason here..." value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-[100px]" />
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setComment('')}>Cancel</Button>
                    <Button variant="destructive" onClick={() => handleAction('REJECT')}>Confirm Rejection</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-success hover:bg-success/90 text-success-foreground gap-2 shadow-lg shadow-success/20">
                    <CheckCircle className="h-4 w-4" size={16} /> {canApproveFinal ? 'Final Authorization' : 'Initial Approval'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{canApproveFinal ? 'Final Authorization' : 'Initial Approval'}</DialogTitle>
                    <DialogDescription>
                      {canApproveFinal
                        ? `You are authorizing the final disbursement of ${formatRwf(batch.total_amount)} to ${rows.length} employees.`
                        : `You are approving this batch for final authorization.`}
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea placeholder="Optional comment..." value={comment} onChange={(e) => setComment(e.target.value)} />
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setComment('')}>Cancel</Button>
                    <Button className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleAction('APPROVE')}>
                      {canApproveFinal ? 'Execute Payment' : 'Confirm Approval'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {isRejected && batch.rejected_reason && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive shadow-sm">
          <div className="flex items-center gap-2 font-bold text-base">
            <XCircle className="h-5 w-5" size={20} />
            Batch Rejected by Reviewer
          </div>
          <p className="mt-2 font-medium whitespace-pre-wrap">
            Reason: {batch.rejected_reason}
          </p>
          <p className="mt-2 text-xs">
            Please make any required updates to employees/time records and click <strong>Resubmit for Review</strong> above to submit this batch back into the approval workflow.
          </p>
        </div>
      )}

      {isApproved && (
        <div className="rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <CheckCircle className="h-4 w-4 text-success" size={16} />
            Completed & Approved Batch
          </div>
          <p className="mt-1">
            This payroll batch is fully approved and locked. The edit button is disabled and no further changes can be made.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard
          tone="primary"
          icon={<Wallet01 className="h-5 w-5" size={20} />}
          label="Net Disbursement"
          value={formatRwf(hasRows ? totals.totalNetPay : batch.total_amount)}
        />
        <StatCard
          tone="accent"
          icon={<Calculator className="h-5 w-5" size={20} />}
          label="Gross Pay"
          value={formatRwf(hasRows ? totals.totalGrossPay : batch.total_gross)}
        />
        <StatCard
          tone="destructive"
          icon={<XCircle className="h-5 w-5" size={20} />}
          label="Deductions"
          value={formatRwf(hasRows ? totals.totalDeductions : batch.total_deductions)}
        />
        <StatCard
          tone="destructive"
          icon={<Percent01 className="h-5 w-5" size={20} />}
          label="PIT Tax"
          value={formatRwf(hasRows ? totals.totalTax : batch.total_tax)}
        />
        <StatCard
          tone="info"
          icon={<Users01 className="h-5 w-5" size={20} />}
          label="Staff Count"
          value={`${rows.length} Employees`}
        />
        <StatCard
          tone="success"
          icon={<Clock className="h-5 w-5" size={20} />}
          label="Payment Date"
          value={formatPayrollDate(batchPaymentDate)}
        />
      </div>

      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="bg-card border p-1 h-12 rounded-xl mb-6">
          <TabsTrigger value="employees" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users01 className="h-4 w-4" size={16} /> Employee Breakdown
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ClockRewind className="h-4 w-4" size={16} /> Approval Audit Trail
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <File02 className="h-4 w-4" size={16} /> Attachments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Role / Dept</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead className="text-right">Basic Pay</TableHead>
                      <TableHead className="text-right">PIT Tax</TableHead>
                      <TableHead className="text-right">Allowances</TableHead>
                      <TableHead className="text-right">OT Hours</TableHead>
                      <TableHead className="text-right">OT Pay</TableHead>
                      <TableHead className="text-right">Gross Pay</TableHead>
                      <TableHead className="text-right">Ikimina</TableHead>
                      <TableHead className="text-right">Other Deductions</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="text-center py-16 text-muted-foreground italic">
                          No employees are attached to this payroll batch.
                        </TableCell>
                      </TableRow>
                    ) : paginatedRows.map((item: any) => {
                      const amounts = getPayrollItemAmounts(item, batch);
                      const taxLabel = getPayrollTaxLabel(item);
                      const frequency = item.transaction?.calculation_metadata?.configured_frequency ?? 'Configured';

                      return (
                        <TableRow key={item.uuid} className="hover:bg-secondary/10 transition-colors">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold">{`${item.employee?.first_name ?? ''} ${item.employee?.last_name ?? ''}`.trim()}</span>
                              <span className="text-[10px] text-muted-foreground uppercase">{item.employee?.national_id || item.employee_id}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{item.employee?.phone_number || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">{item.employee?.department?.name ?? 'Employee'}</span>
                              <span className="text-[10px] font-medium uppercase text-muted-foreground">{frequency}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{amounts.attendanceDays}/{amounts.workDays ?? '-'} days</span>
                              <span className="text-[10px] text-muted-foreground">{formatPeriodRange(amounts.periodStart, amounts.periodEnd)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatRwf(amounts.basePay)}</TableCell>
                          <TableCell className="text-right text-destructive">
                            <div className="flex flex-col">
                              <span>{amounts.tax > 0 ? `-${formatRwf(amounts.tax)}` : '-'}</span>
                              {amounts.tax > 0 && <span className="text-[10px] text-muted-foreground">{taxLabel}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-success">{formatRwf(amounts.allowances)}</TableCell>
                          <TableCell className="text-right font-medium">{amounts.overtimeHours.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-success">{formatRwf(amounts.overtimePay)}</TableCell>
                          <TableCell className="text-right font-medium">{formatRwf(amounts.grossPay)}</TableCell>
                          <TableCell className="text-right font-medium text-accent">
                            {amounts.ikimina > 0 ? `-${formatRwf(amounts.ikimina)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {amounts.otherDeductions > 0 ? `-${formatRwf(amounts.otherDeductions)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">{formatRwf(amounts.netPay)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <PayrollStatusBadge status={item.status} />
                              {canApprove && item.status !== 'REJECTED' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRejectItem(item.uuid)}
                                  title="Reject this employee"
                                >
                                  <XCircle className="h-4 w-4" size={16} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Totals Row */}
                    {rows.length > 0 && (
                      <TableRow className="bg-secondary/20 font-bold border-t-2">
                        <TableCell colSpan={4}>Total</TableCell>
                        <TableCell className="text-right">{formatRwf(totals.totalBasePay)}</TableCell>
                        <TableCell className="text-right text-destructive">-{formatRwf(totals.totalTax)}</TableCell>
                        <TableCell className="text-right text-success">{formatRwf(totals.totalAllowances)}</TableCell>
                        <TableCell className="text-right">{totals.totalOvertimeHours.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-success">{formatRwf(totals.totalOvertimePay)}</TableCell>
                        <TableCell className="text-right">{formatRwf(totals.totalGrossPay)}</TableCell>
                        <TableCell className="text-right text-accent">
                          {totals.totalIkimina > 0 ? `-${formatRwf(totals.totalIkimina)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {totals.totalOtherDeductions > 0 ? `-${formatRwf(totals.totalOtherDeductions)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-primary">{formatRwf(totals.totalNetPay)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t bg-card">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, rows.length)} of {rows.length} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center px-4 text-sm font-semibold">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6 space-y-6">
              {activityTrail.length > 0 ? activityTrail.map((step: any, idx: number) => {
                const isRejected = String(step.action).includes('REJECT') || String(step.action).includes('DENIED');
                const actorName = step.actor?.name ?? step.actionBy?.email ?? step.action_by ?? 'System';
                const actorEmail = step.actor?.email ?? step.actionBy?.email;
                return (
                <div key={idx} className="flex gap-4 relative">
                  {idx < activityTrail.length - 1 && (
                    <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border" />
                  )}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${
                    isRejected ? 'bg-destructive text-destructive-foreground' : 'bg-success text-success-foreground'
                  }`}>
                    {isRejected ? <XCircle className="h-5 w-5" size={20} /> : <CheckCircle className="h-5 w-5" size={20} />}
                  </div>
                  <div className="flex-1 space-y-1 pb-8">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold">{step.label ?? step.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {actorName}{actorEmail ? ` (${actorEmail})` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {step.scope && <Badge variant="outline" className="text-[10px]">{step.scope}</Badge>}
                        <span className="text-xs font-medium text-muted-foreground">{new Date(step.action_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="bg-secondary/40 p-3 rounded-xl flex gap-3 items-start">
                      <MessageSquare01 className="h-4 w-4 text-muted-foreground mt-0.5" size={16} />
                      <p className="text-sm italic">{step.comment ?? 'No comment'}</p>
                    </div>
                  </div>
                </div>
                );
              }) : (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No batch activity has been recorded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="border-none shadow-sm">
            <CardContent className="pt-6 space-y-6">
              <div className="rounded-xl border bg-muted/40 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Batch Description</p>
                <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                  {batch.description?.trim() || 'No description was added to this batch.'}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Attachments</p>
                  <Badge variant="outline">{attachments.length}</Badge>
                </div>
                {attachments.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {attachments.map((attachment: any, index: number) => (
                      <div key={attachment.id ?? index} className="rounded-xl border bg-card p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Paperclip className="h-4 w-4 text-primary" size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{attachment.original_name ?? attachment.name ?? 'Attachment'}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.mime_type ?? 'File'} • {attachment.size ? `${(Number(attachment.size) / 1024).toFixed(1)} KB` : 'Size unknown'}
                            </p>
                            {attachment.uploaded_at && (
                              <p className="mt-1 text-[10px] text-muted-foreground">Uploaded {new Date(attachment.uploaded_at).toLocaleString()}</p>
                            )}
                          </div>
                          {attachment.url && (
                            <a
                              href={getAttachmentUrl(attachment.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:text-primary"
                              title="Open attachment"
                            >
                              <LinkExternal01 className="h-4 w-4" size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No attachments were added to this payroll batch.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
