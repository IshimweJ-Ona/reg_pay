"use client";

import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, Eye, User } from 'lucide-react';
import { getPayrollBatches, getPayrollBatch, approvePayrollBatch, rejectPayrollBatch, rejectPayrollItem } from '@/api/payroll';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { userFriendlyError } from '@/lib/error-message';
import { formatRwf, getPayrollItemAmounts } from '@/lib/payroll-display';
import { useAuth } from '@/context/auth-context';

interface PendingBatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const pendingStatuses = new Set(['PENDING', 'IN_REVIEW', 'MANAGER_APPROVED']);

export function PendingBatchesModal({ isOpen, onClose, onRefresh }: PendingBatchesModalProps) {
  const { user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const { toast } = useToast();
  const roles = user?.roles ?? [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isBranchManager = roles.includes('BRANCH_MANAGER');

  useEffect(() => {
    if (isOpen) {
      loadPendingBatches();
    }
  }, [isOpen]);

  const loadPendingBatches = async () => {
    setIsLoading(true);
    try {
      const res = await getPayrollBatches();
      const allBatches = Array.isArray(res) ? res : res.batches || [];
      setBatches(allBatches.filter((b: any) => pendingStatuses.has(b.status)));
    } catch (error) {
      console.error('Failed to load pending batches:', error);
      toast({
        variant: 'destructive',
        title: 'Load failed',
        description: userFriendlyError(error, 'Could not load payroll batches awaiting review.'),
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
      loadPendingBatches();
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
      loadPendingBatches();
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
    if (!batch || ['APPROVED', 'REJECTED'].includes(batch.status)) return false;
    if (batch.status === 'MANAGER_APPROVED') return isSuperAdmin;
    if (batch.status === 'PENDING' || batch.status === 'IN_REVIEW') {
      return isBranchManager || isSuperAdmin;
    }
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Pending Payroll Review</h2>
            <p className="text-muted-foreground">Approve or decline batches awaiting disbursement.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <XCircle className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Batches List */}
          <div className="w-1/3 border-r overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">Awaiting Action</h3>
            {isLoading && batches.length === 0 ? (
              <div className="p-4 text-center animate-pulse">Loading batches...</div>
            ) : batches.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground italic">No pending batches found.</div>
            ) : (
              batches.map((batch) => (
                <div 
                  key={batch.uuid} 
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${selectedBatch?.uuid === batch.uuid ? 'bg-white border-primary shadow-md ring-1 ring-primary/10' : 'bg-white hover:border-slate-300 border-transparent shadow-sm'}`}
                  onClick={() => handleViewBatch(batch.uuid)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="font-mono text-[10px]">{batch.batch_code}</Badge>
                    <Badge className={batch.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}>
                      {batch.status}
                    </Badge>
                  </div>
                  <p className="font-bold text-slate-800">{batch.working_location?.name || 'Group HQ'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{batch.total_employees} Personnel</span>
                    <span className="text-sm font-bold text-primary">RWF {Number(batch.total_amount).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Batch Details */}
          <div className="flex-1 flex flex-col bg-white">
            {selectedBatch ? (
              <>
                <div className="p-6 border-b flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Clock className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{selectedBatch.batch_code}</h3>
                      <p className="text-sm text-muted-foreground">{selectedBatch.working_location?.name} • {selectedBatch.payroll_month}/{selectedBatch.payroll_year}</p>
                    </div>
                  </div>
                  {canReviewBatch(selectedBatch) && (
                    <div className="flex gap-2">
                      <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => handleRejectBatch(selectedBatch.uuid)} disabled={isActionLoading}>
                        <XCircle className="mr-2 h-4 w-4" /> Decline Batch
                      </Button>
                      <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20" onClick={() => handleApproveBatch(selectedBatch.uuid)} disabled={isActionLoading}>
                        <CheckCircle className="mr-2 h-4 w-4" /> Approve Batch
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="px-6 py-4 bg-slate-50 border-b flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-700">Personnel in Batch</h4>
                    <span className="text-xs font-medium text-muted-foreground">{selectedBatch.items?.length || 0} Records</span>
                  </div>
                  <ScrollArea className="flex-1">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Gross</TableHead>
                          <TableHead>Deductions</TableHead>
                          <TableHead>Net Payable</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBatch.items?.map((item: any) => {
                          const amounts = getPayrollItemAmounts(item, selectedBatch);

                          return (
                            <TableRow key={item.uuid} className={item.status === 'REJECTED' ? 'opacity-50 grayscale' : ''}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                    <User className="h-4 w-4 text-slate-500" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-sm">{item.employee?.first_name} {item.employee?.last_name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{item.employee?.national_id}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-medium">{amounts.attendanceDays}/{amounts.workDays ?? '-'}</TableCell>
                              <TableCell className="text-xs font-medium">{formatRwf(amounts.grossPay)}</TableCell>
                              <TableCell className="text-xs font-medium text-rose-600">-{formatRwf(amounts.totalDeductions)}</TableCell>
                              <TableCell className="text-sm font-bold text-slate-900">{formatRwf(amounts.netPay)}</TableCell>
                              <TableCell className="text-right">
                                {item.status === 'REJECTED' ? (
                                  <Badge variant="secondary" className="text-[10px]">Rejected</Badge>
                                ) : canReviewBatch(selectedBatch) ? (
                                  <Button variant="ghost" size="sm" className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs" onClick={() => handleRejectItem(item.uuid)} disabled={isActionLoading}>
                                    Reject
                                  </Button>
                                ) : (
                                  null
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
                <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center border-2 border-dashed">
                  <Eye className="h-10 w-10 text-slate-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-400">Select a batch to review</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">Click on a batch from the left panel to inspect its employees and financial breakdown.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
