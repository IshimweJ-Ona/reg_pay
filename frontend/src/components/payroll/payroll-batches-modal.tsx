"use client";

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PayrollStatusBadge } from '@/components/payroll/payroll-status-badge';
import { File02, CheckCircle, XCircle, User01 } from '@untitledui/icons';
import { getPayrollBatches, getPayrollBatch, approvePayrollBatch, rejectPayrollBatch, rejectPayrollItem } from '@/api/payroll';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { userFriendlyError } from '@/lib/error-message';
import { formatRwf, getPayrollItemAmounts } from '@/lib/payroll-display';
import { useAuth } from '@/context/auth-context';
import { EmptyState, InlineStateNote, TableStateRow } from '@/components/layout/page-state';

interface PayrollBatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  title: string;
  description: string;
  /** Comma-separated payment_batches statuses to filter to; omit for every status. */
  statusFilter?: string;
  /** Whether approve/reject/decline controls are shown at all. Defaults to true. */
  showActions?: boolean;
}

export function PayrollBatchesModal({
  isOpen,
  onClose,
  onRefresh,
  title,
  description,
  statusFilter,
  showActions = true,
}: PayrollBatchesModalProps) {
  const { user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();
  const roles = user?.roles ?? [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isBranchManager = roles.includes('BRANCH_MANAGER');

  useEffect(() => {
    if (isOpen) {
      loadBatches();
    } else {
      setSelectedBatch(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, statusFilter]);

  const loadBatches = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Filtered server-side when a status set is given, instead of always
      // fetching every batch and filtering client-side for each card.
      const res = await getPayrollBatches(statusFilter ? { status: statusFilter } : undefined);
      const allBatches = Array.isArray(res) ? res : res.batches || [];
      setBatches(allBatches);
    } catch (error) {
      const message = userFriendlyError(error, 'Could not load payroll batches.');
      setLoadError(message);
      toast({
        variant: 'destructive',
        title: 'Load failed',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewBatch = async (uuid: string) => {
    setIsLoading(true);
    try {
      const res = await getPayrollBatch(uuid);
      setSelectedBatch(res);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Batch unavailable',
        description: userFriendlyError(error, 'Failed to load batch details.'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveBatch = async (uuid: string) => {
    setIsActionLoading(true);
    try {
      await approvePayrollBatch(uuid, 'Batch approved via review panel.');
      toast({ title: 'Success', description: 'Batch has been approved.' });
      setSelectedBatch(null);
      loadBatches();
      onRefresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description: userFriendlyError(error, 'Please review the payroll details and try again.'),
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectBatch = async (uuid: string) => {
    const reason = prompt('Please enter a reason for rejection:');
    if (!reason) return;

    setIsActionLoading(true);
    try {
      await rejectPayrollBatch(uuid, reason);
      toast({ title: 'Success', description: 'Batch has been rejected.' });
      setSelectedBatch(null);
      loadBatches();
      onRefresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Rejection failed',
        description: userFriendlyError(error, 'Please review the payroll details and try again.'),
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectItem = async (itemUuid: string) => {
    const reason = prompt('Reason for denying this employee:');
    if (!reason) return;

    setIsActionLoading(true);
    try {
      await rejectPayrollItem(itemUuid, reason);
      toast({ title: 'Employee rejected', description: 'The employee has been marked as rejected in this batch.' });
      // Refresh batch details
      if (selectedBatch) handleViewBatch(selectedBatch.uuid);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Employee rejection failed',
        description: userFriendlyError(error, 'Failed to reject employee.'),
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const canReviewBatch = (batch: any) => {
    if (!showActions || !batch || ['APPROVED', 'REJECTED'].includes(batch.status)) return false;
    if (batch.status === 'MANAGER_APPROVED') return isSuperAdmin;
    if (batch.status === 'PENDING' || batch.status === 'IN_REVIEW') {
      return isBranchManager || isSuperAdmin;
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/40">
          <div>
            <DialogTitle className="text-xl font-headline font-bold text-foreground">{title}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{description}</DialogDescription>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row">
          {/* Batches List */}
          <div className="w-full md:w-1/3 max-h-64 md:max-h-none border-b md:border-b-0 md:border-r border-border overflow-y-auto p-4 space-y-3 bg-muted/20">
            <h3 className="text-xs font-bold text-muted-foreground uppercase px-2 mb-2">Batches</h3>
            {isLoading && batches.length === 0 ? (
              <InlineStateNote tone="info" className="bg-card">
                Loading payroll batches for review.
              </InlineStateNote>
            ) : loadError ? (
              <InlineStateNote tone="destructive" className="bg-card">
                {loadError}
              </InlineStateNote>
            ) : batches.length === 0 ? (
              <InlineStateNote className="bg-card">
                No payroll batches match this review queue.
              </InlineStateNote>
            ) : (
              batches.map((batch) => (
                <button
                  type="button"
                  key={batch.uuid}
                  className={`w-full p-4 rounded-lg text-left transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selectedBatch?.uuid === batch.uuid ? 'bg-card border-primary shadow-md ring-1 ring-primary/10' : 'bg-card hover:border-muted-foreground/30 border-transparent shadow-sm'}`}
                  onClick={() => handleViewBatch(batch.uuid)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="font-mono text-[10px]">{batch.batch_code}</Badge>
                    <PayrollStatusBadge status={batch.status} />
                  </div>
                  <p className="font-bold text-foreground">{batch.working_location?.name || 'Group HQ'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{batch.total_employees} Personnel</span>
                    <span className="text-sm font-bold text-primary">RWF {Number(batch.total_amount).toLocaleString()}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Batch Details */}
          <div className="flex-1 min-h-0 flex flex-col bg-card">
            {selectedBatch ? (
              <>
                <div className="p-6 border-b border-border flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <File02 className="h-6 w-6 text-primary" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{selectedBatch.batch_code}</h3>
                      <p className="text-sm text-muted-foreground">{selectedBatch.working_location?.name} • {selectedBatch.payroll_month}/{selectedBatch.payroll_year}</p>
                    </div>
                  </div>
                  {canReviewBatch(selectedBatch) && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => handleRejectBatch(selectedBatch.uuid)} disabled={isActionLoading}>
                        <XCircle className="mr-2 h-4 w-4" size={16} /> Decline Batch
                      </Button>
                      <Button className="bg-success hover:bg-success/90 text-success-foreground shadow-sm shadow-success/20" onClick={() => handleApproveBatch(selectedBatch.uuid)} disabled={isActionLoading}>
                        <CheckCircle className="mr-2 h-4 w-4" size={16} /> Approve Batch
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="px-6 py-4 bg-muted/40 border-b border-border flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground">Personnel in Batch</h4>
                    <span className="text-xs font-medium text-muted-foreground">{selectedBatch.items?.length || 0} Records</span>
                  </div>
                  <ScrollArea className="flex-1">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Gross</TableHead>
                          <TableHead>Deductions</TableHead>
                          <TableHead>Net Payable</TableHead>
                          {showActions && <TableHead className="text-right">Action</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedBatch.items?.length ?? 0) === 0 ? (
                          <TableStateRow
                            colSpan={showActions ? 6 : 5}
                            title="No payroll items in this batch"
                            description="This batch has no employee payroll rows to approve, reject, or export."
                          />
                        ) : selectedBatch.items.map((item: any) => {
                          const amounts = getPayrollItemAmounts(item, selectedBatch);

                          return (
                            <TableRow key={item.uuid} className={item.status === 'REJECTED' ? 'opacity-50 grayscale' : ''}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                    <User01 className="h-4 w-4 text-muted-foreground" size={16} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-sm">{item.employee?.first_name} {item.employee?.last_name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{item.employee?.national_id}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-medium">{amounts.attendanceDays}/{amounts.workDays ?? '-'}</TableCell>
                              <TableCell className="text-xs font-medium">{formatRwf(amounts.grossPay)}</TableCell>
                              <TableCell className="text-xs font-medium text-destructive">-{formatRwf(amounts.totalDeductions)}</TableCell>
                              <TableCell className="text-sm font-bold text-foreground">{formatRwf(amounts.netPay)}</TableCell>
                              {showActions && (
                                <TableCell className="text-right">
                                  {item.status === 'REJECTED' ? (
                                    <Badge variant="secondary" className="text-[10px]">Rejected</Badge>
                                  ) : canReviewBatch(selectedBatch) ? (
                                    <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 font-bold text-xs" onClick={() => handleRejectItem(item.uuid)} disabled={isActionLoading}>
                                      Reject
                                    </Button>
                                  ) : (
                                    null
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <EmptyState
                title="Select a batch to review"
                description="Choose a payroll batch to inspect employees, totals, deductions, approvals, and exception decisions."
                className="m-6 flex-1"
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
