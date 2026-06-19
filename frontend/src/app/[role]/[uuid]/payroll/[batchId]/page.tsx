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
import { approvePayrollBatch, downloadPayrollBatchExport, getPayrollBatch, rejectPayrollBatch, submitPayrollBatch, rejectPayrollItem } from '@/api/payroll';
import { useAuth } from '@/context/auth-context';

const formatRwf = (value: number) => `RWF ${value.toLocaleString()}`;

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
        description: error?.response?.data?.message ?? "Please try again.",
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
        description: error?.response?.data?.message ?? 'Could not reject employee.',
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
        description: error?.response?.data?.message ?? 'Could not download this payroll batch.',
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
            <p className="text-sm text-muted-foreground">{batch.working_location?.name ?? batch.working_location_id} • {batch.payroll_month}/{batch.payroll_year}</p>
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
                        ? `You are authorizing the final disbursement of ${formatRwf(Number(batch.total_amount))} to ${rows.length} employees.`
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">Net Disbursement</p>
            <h3 className="text-2xl font-bold mt-1 text-primary">{formatRwf(Number(batch.total_amount))}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">Staff Count</p>
            <h3 className="text-2xl font-bold mt-1">{rows.length} Employees</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">Payment Date</p>
            <h3 className="text-2xl font-bold mt-1">{batch.approved_at ? new Date(batch.approved_at).toLocaleDateString() : 'Pending'}</h3>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-muted-foreground uppercase">Currency</p>
            <h3 className="text-2xl font-bold mt-1">Configured</h3>
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
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Role / Dept</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>OT/Bonus</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead className="text-right">Net Salary</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item: any) => (
                    <TableRow key={item.uuid} className="hover:bg-secondary/10 transition-colors">
                      <TableCell className="font-semibold">{`${item.employee?.first_name ?? ''} ${item.employee?.last_name ?? ''}`.trim()}</TableCell>
                      <TableCell className="text-sm font-mono">{item.employee?.phone_number || 'N/A'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.employee?.department?.name ?? 'Employee'}</TableCell>
                      <TableCell>{formatRwf(Number(item.transaction?.base_amount ?? item.transaction?.gross_amount ?? 0))}</TableCell>
                      <TableCell className="text-emerald-600">{formatRwf(Number(item.transaction?.allowance_amount ?? 0))}</TableCell>
                      <TableCell className="text-rose-600">-{formatRwf(Number(item.transaction?.total_deductions ?? 0))}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatRwf(Number(item.transaction?.net_amount ?? 0))}</TableCell>
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
                  ))}
                </TableBody>
              </Table>
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
