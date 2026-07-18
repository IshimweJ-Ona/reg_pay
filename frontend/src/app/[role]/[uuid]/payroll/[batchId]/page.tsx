"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, FileText, Users,
  CheckCircle2, XCircle, Clock, MessageSquare, Download, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useParams, useRouter } from 'next/navigation';
import { PayrollStatusBadge } from '@/components/payroll/payroll-status-badge';
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
    let totalAllowanceOt = 0;
    let totalTax = 0;
    let totalIkimina = 0;
    let totalOtherDeductions = 0;
    let totalDeductions = 0;
    let totalNetPay = 0;
    let totalGrossPay = 0;

    rows.forEach((item: any) => {
      const {
        basePay,
        allowanceOt,
        grossPay,
        tax,
        ikimina,
        otherDeductions,
        totalDeductions: deductions,
        netPay,
      } = getPayrollItemAmounts(item, batch);

      totalBasePay += basePay;
      totalAllowanceOt += allowanceOt;
      totalGrossPay += grossPay;
      totalTax += tax;
      totalIkimina += ikimina;
      totalOtherDeductions += otherDeductions;
      totalDeductions += deductions;
      totalNetPay += netPay;
    });

    return {
      totalBasePay,
      totalAllowanceOt,
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
  const isAccountant = roles.includes('ACCOUNTANT');
  const isBranchManager = roles.includes('BRANCH_MANAGER');
  const isSuperAdmin = roles.includes('SUPER_ADMIN');

  const isTerminal = batch.status === 'APPROVED' || batch.status === 'REJECTED';

  const canSubmit = !isTerminal && (batch.status === 'DRAFT' || batch.status.startsWith('REJECTED')) && isAccountant;
  
  const canApproveBM = !isTerminal && batch.status === 'PENDING' && (isBranchManager || isSuperAdmin);
  const canApproveAdmin = !isTerminal && batch.status === 'MANAGER_APPROVED' && isSuperAdmin;
  const canApprove = canApproveBM || canApproveAdmin;
  const batchPaymentDate = rows[0]?.transaction?.payment_date ?? batch.approved_at;
  const hasRows = rows.length > 0;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
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
              <Save className="h-4 w-4" /> {batch.status.startsWith('REJECTED') ? 'Resubmit for Review' : 'Submit for Review'}
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export Assets
          </Button>
          {canApprove && (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <XCircle className="h-4 w-4" /> Reject Cycle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject Payroll Batch</DialogTitle>
                    <DialogDescription>Please provide a reason for the rejection. This will be visible to the batch creator.</DialogDescription>
                  </DialogHeader>
                  <Textarea placeholder="Type reason here..." value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-[100px]" />
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setComment('')}>Cancel</Button>
                    <Button variant="destructive" onClick={() => handleAction('REJECT')}>Confirm Rejection</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2 shadow-lg shadow-emerald-600/20">
                    <CheckCircle2 className="h-4 w-4" /> {canApproveAdmin ? 'Final Authorization' : 'Manager Approval'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{canApproveAdmin ? 'Final Authorization' : 'Manager Approval'}</DialogTitle>
                    <DialogDescription>
                      {canApproveAdmin 
                        ? `You are authorizing the final disbursement of ${formatRwf(batch.total_amount)} to ${rows.length} employees.`
                        : `You are approving this batch for final review by HQ.`}
                    </DialogDescription>
                  </DialogHeader>
                  <Textarea placeholder="Optional comment..." value={comment} onChange={(e) => setComment(e.target.value)} />
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setComment('')}>Cancel</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAction('APPROVE')}>
                      {canApproveAdmin ? 'Execute Payment' : 'Confirm Approval'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-6">
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">Net Disbursement</p>
            <h3 className="text-xl font-bold mt-1 text-primary">{formatRwf(hasRows ? totals.totalNetPay : batch.total_amount)}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">Gross Pay</p>
            <h3 className="text-xl font-bold mt-1">{formatRwf(hasRows ? totals.totalGrossPay : batch.total_gross)}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">Deductions</p>
            <h3 className="text-xl font-bold mt-1 text-rose-600">{formatRwf(hasRows ? totals.totalDeductions : batch.total_deductions)}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">PIT Tax</p>
            <h3 className="text-xl font-bold mt-1 text-rose-600">{formatRwf(hasRows ? totals.totalTax : batch.total_tax)}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">Staff Count</p>
            <h3 className="text-xl font-bold mt-1">{rows.length} Employees</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">Payment Date</p>
            <h3 className="text-xl font-bold mt-1">{formatPayrollDate(batchPaymentDate)}</h3>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="bg-white border p-1 h-12 rounded-xl mb-6">
          <TabsTrigger value="employees" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Users className="h-4 w-4" /> Employee Breakdown
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <Clock className="h-4 w-4" /> Approval Audit Trail
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">
            <FileText className="h-4 w-4" /> Attachments
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
                      <TableHead className="text-right">Allowances/OT</TableHead>
                      <TableHead className="text-right">Gross Pay</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Ikimina</TableHead>
                      <TableHead className="text-right">Other Deductions</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-16 text-muted-foreground italic">
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
                          <TableCell className="text-right text-emerald-600">{formatRwf(amounts.allowanceOt)}</TableCell>
                          <TableCell className="text-right font-medium">{formatRwf(amounts.grossPay)}</TableCell>
                          <TableCell className="text-right text-rose-600">
                            <div className="flex flex-col">
                              <span>{amounts.tax > 0 ? `-${formatRwf(amounts.tax)}` : '-'}</span>
                              {amounts.tax > 0 && <span className="text-[10px] text-muted-foreground">{taxLabel}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-purple-600">
                            {amounts.ikimina > 0 ? `-${formatRwf(amounts.ikimina)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right text-rose-600">
                            {amounts.otherDeductions > 0 ? `-${formatRwf(amounts.otherDeductions)}` : '—'}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">{formatRwf(amounts.netPay)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="secondary" 
                                className={item.status === 'REJECTED' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}
                              >
                                {item.status}
                              </Badge>
                              {canApprove && item.status !== 'REJECTED' && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRejectItem(item.uuid)}
                                  title="Reject this employee"
                                >
                                  <XCircle className="h-4 w-4" />
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
                        <TableCell className="text-right text-emerald-600">{formatRwf(totals.totalAllowanceOt)}</TableCell>
                        <TableCell className="text-right">{formatRwf(totals.totalGrossPay)}</TableCell>
                        <TableCell className="text-right text-rose-600">-{formatRwf(totals.totalTax)}</TableCell>
                        <TableCell className="text-right text-purple-600">
                          {totals.totalIkimina > 0 ? `-${formatRwf(totals.totalIkimina)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right text-rose-600">
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
                <div className="flex items-center justify-between p-4 border-t bg-white">
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
              {(batch.approval_actions ?? []).map((step: any, idx: number) => (
                <div key={idx} className="flex gap-4 relative">
                  {idx < (batch.approval_actions?.length ?? 0) - 1 && (
                    <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-slate-200" />
                  )}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${
                    step.action === 'REJECTED' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                  }`}>
                    {step.action === 'REJECTED' ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 space-y-1 pb-8">
                    <div className="flex items-center justify-between">
                      <p className="font-bold">{step.action} - {step.actionBy?.email ?? step.action_by}</p>
                      <span className="text-xs font-medium text-muted-foreground">{new Date(step.action_at).toLocaleString()}</span>
                    </div>
                    <div className="bg-secondary/40 p-3 rounded-xl flex gap-3 items-start">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm italic">"{step.comment ?? 'No comment'}"</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
