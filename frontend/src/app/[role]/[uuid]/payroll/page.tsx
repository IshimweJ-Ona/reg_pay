"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Plus, Search, Download, FileText, 
  MoreVertical, Eye, CheckCircle, XCircle, Clock, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PayrollBatch } from '@/types/payroll';
import { PayrollStatusBadge } from '@/components/payroll/payroll-status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGate } from '@/components/auth/permission-gate';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { approvePayrollBatch, downloadPayrollBatchExport, getPayrollBatches, rejectPayrollBatch } from '@/api/payroll';
import { exportToCSV, exportToExcel } from '@/lib/export-utils';
import { useToast } from '@/hooks/use-toast';
import { PendingBatchesModal } from '@/components/payroll/pending-batches-modal';

const formatRwf = (value: number) => `RWF ${value.toLocaleString()}`;

function mapApiBatch(batch: any): PayrollBatch {
  return {
    id: batch.uuid,
    batchId: batch.batch_code,
    period: `${batch.payroll_month}/${batch.payroll_year}`,
    location: batch.working_location?.name ?? batch.working_location_id,
    department: 'All',
    employeeCount: batch.total_employees,
    totalAmount: Number(batch.total_amount),
    status: batch.status,
    createdBy: batch.submittedBy?.email ?? 'System',
    createdAt: batch.created_at,
    paymentDate: batch.approved_at ?? batch.created_at,
  };
}

export default function PayrollAdminPage() {
  const params = useParams();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  useEffect(() => {
    setIsLoading(true);
    getPayrollBatches()
      .then((items) => setBatches((Array.isArray(items) ? items : []).map(mapApiBatch)))
      .catch(() => setBatches([]))
      .finally(() => setIsLoading(false));
  }, []);

  const stats = [
    { name: 'Total Batches', value: String(batches.length), icon: FileText, color: 'text-blue-600' },
    { name: 'Active Batches', value: String(batches.filter(b => !['APPROVED', 'REJECTED'].includes(b.status)).length), icon: CheckCircle, color: 'text-emerald-600' },
    { name: 'Pending Review', value: String(batches.filter(b => ['PENDING', 'IN_REVIEW', 'MANAGER_APPROVED'].includes(b.status)).length), icon: Clock, color: 'text-amber-600', action: 'review' },
    { name: 'Total Disbursed', value: formatRwf(batches.filter(b => b.status === 'APPROVED').reduce((sum, batch) => sum + batch.totalAmount, 0)), icon: Wallet, color: 'text-primary' },
  ];

  const filteredBatches = batches.filter(b => {
    const matchesSearch = b.batchId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'ACTIVE') {
      return matchesSearch && !['APPROVED', 'REJECTED'].includes(b.status);
    } else {
      return matchesSearch && ['APPROVED', 'REJECTED'].includes(b.status);
    }
  });

  const handleExport = (type: 'csv' | 'excel') => {
    const exportData = filteredBatches.map(b => ({
      BatchID: b.batchId,
      Period: b.period,
      Location: b.location,
      Employees: b.employeeCount,
      TotalAmount: b.totalAmount,
      Status: b.status,
      CreatedAt: b.createdAt
    }));

    if (type === 'csv') exportToCSV(exportData, 'payroll');
    else if (type === 'excel') exportToExcel(exportData, 'payroll');
  };

  const refreshBatches = async () => {
    setIsLoading(true);
    try {
      const items = await getPayrollBatches();
      setBatches((Array.isArray(items) ? items : []).map(mapApiBatch));
    } catch (error) {
      setBatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (batch: PayrollBatch) => {
    try {
      await approvePayrollBatch(batch.id, 'Approved from payroll list.');
      await refreshBatches();
      toast({ title: 'Payroll approved', description: `${batch.batchId} has moved to the next approval step.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description: error?.response?.data?.message ?? 'Please review the payroll details and try again.',
      });
    }
  };

  const handleReject = async (batch: PayrollBatch) => {
    try {
      await rejectPayrollBatch(batch.id, 'Rejected from payroll list.');
      await refreshBatches();
      toast({ title: 'Payroll rejected', description: `${batch.batchId} has been rejected.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Rejection failed',
        description: error?.response?.data?.message ?? 'Please review the payroll details and try again.',
      });
    }
  };

  const handleBatchExport = async (batch: PayrollBatch) => {
    try {
      await downloadPayrollBatchExport(batch.id);
      toast({ title: 'Export ready', description: `${batch.batchId} has been downloaded.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: error?.response?.data?.message ?? 'Could not download this payroll batch.',
      });
    }
  };

  return (
    <div className="space-y-8">
      <PendingBatchesModal 
        isOpen={showReviewModal} 
        onClose={() => setShowReviewModal(false)} 
        onRefresh={refreshBatches} 
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Payroll Infrastructure</h1>
          <p className="text-muted-foreground">Manage and audit enterprise-wide salary disbursements.</p>
        </div>
        <PermissionGate permission="payroll.create">
          <Link href={`${basePath}/payroll/new`}>
            <Button className="h-11 px-6 shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Generate New Batch
            </Button>
          </Link>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name} className={`border-none shadow-sm ${stat.action ? 'cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all' : ''}`} onClick={() => stat.action === 'review' && setShowReviewModal(true)}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                  <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                </div>
                <div className="bg-secondary p-3 rounded-xl">
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex bg-white p-1 rounded-xl border shadow-sm">
          <Button 
            variant={activeTab === 'ACTIVE' ? 'default' : 'ghost'} 
            className="h-10 px-6 rounded-lg font-bold transition-all"
            onClick={() => setActiveTab('ACTIVE')}
          >
            Pending Review
          </Button>
          <Button 
            variant={activeTab === 'HISTORY' ? 'default' : 'ghost'} 
            className="h-10 px-6 rounded-lg font-bold transition-all"
            onClick={() => setActiveTab('HISTORY')}
          >
            Batch History
          </Button>
        </div>

        <div className="flex items-center gap-4 bg-white p-1.5 px-3 rounded-xl shadow-sm border flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={`Search ${activeTab === 'ACTIVE' ? 'pending' : 'historical'} batches...`} 
              className="pl-10 h-9 border-none bg-transparent focus-visible:ring-0"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground">
                <Download className="h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>Export as Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Batch ID</TableHead>
              <TableHead className="font-bold">Period</TableHead>
              <TableHead className="font-bold">Location</TableHead>
              <TableHead className="font-bold">Employees</TableHead>
              <TableHead className="font-bold">Total Amount</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold">Created Date</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20 text-muted-foreground animate-pulse">Loading payroll batches...</TableCell>
              </TableRow>
            ) : filteredBatches.length > 0 ? filteredBatches.map((batch) => (
              <TableRow key={batch.id} className="hover:bg-secondary/20 transition-colors">
                <TableCell className="font-medium text-primary">{batch.batchId}</TableCell>
                <TableCell>{batch.period}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{batch.location}</span>
                    <span className="text-xs text-muted-foreground">{batch.department}</span>
                  </div>
                </TableCell>
                <TableCell>{batch.employeeCount}</TableCell>
                <TableCell className="font-bold">{formatRwf(batch.totalAmount)}</TableCell>
                <TableCell><PayrollStatusBadge status={batch.status} /></TableCell>
                <TableCell className="text-muted-foreground">{batch.createdAt}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <Link href={`${basePath}/payroll/${batch.id}`}>
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem onClick={() => handleBatchExport(batch)}>
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                      </DropdownMenuItem>
                      <PermissionGate permission="payroll.approve">
                        <DropdownMenuItem className="text-emerald-600" onClick={() => handleApprove(batch)}>
                          <CheckCircle className="mr-2 h-4 w-4" /> Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleReject(batch)}>
                          <XCircle className="mr-2 h-4 w-4" /> Reject
                        </DropdownMenuItem>
                      </PermissionGate>
                      <DropdownMenuSeparator />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-20 text-muted-foreground italic">
                  {activeTab === 'ACTIVE' 
                    ? "No pending payroll cycles awaiting review." 
                    : "No historical payroll records found in the archive."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
