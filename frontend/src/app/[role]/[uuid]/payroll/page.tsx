"use client";

import { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Plus, SearchMd, Download01, File02,
  DotsVertical, Eye, CheckCircle, XCircle, Clock, Wallet01, Activity
} from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { PayrollBatch } from '@/types/payroll';
import { PayrollStatusBadge } from '@/components/payroll/payroll-status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageHeader } from '@/components/layout/page-header';
import { TableStateRow } from '@/components/layout/page-state';
import { StatCard, StatCardTone } from '@/components/ui/stat-card';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { approvePayrollBatch, downloadPayrollBatchExport, getPayrollBatches, rejectPayrollBatch } from '@/api/payroll';
import { getPositions, type Position } from '@/api/positions';
import { exportToCSV, exportToExcel } from '@/lib/export-utils';
import { useToast } from '@/hooks/use-toast';
import { userFriendlyError } from '@/lib/error-message';
import { PayrollBatchesModal } from '@/components/payroll/payroll-batches-modal';
import { formatPayrollDate, formatPayrollPeriod, formatRwf } from '@/lib/payroll-display';
import { useAuth } from '@/context/auth-context';

const getBatchList = (payload: any) =>
  Array.isArray(payload) ? payload : payload?.batches ?? [];

// A batch can span several departments/positions (it's a set of employees,
// not scoped to one), so this collapses each batch's items down to the
// distinct names involved instead of pretending there's a single value.
function summarizeDistinct(names: (string | undefined | null)[]): string {
  const distinct = Array.from(new Set(names.filter((name): name is string => Boolean(name))));
  if (distinct.length === 0) return '—';
  if (distinct.length === 1) return distinct[0];
  return `Mixed (${distinct.length})`;
}

function mapApiBatch(batch: any): PayrollBatch {
  const submitter =
    batch.submittedBy ??
    batch.users_payment_batches_submitted_byTousers ??
    batch.submitted_by_user;
  const firstTransaction = batch.items?.[0]?.transaction;
  const items = Array.isArray(batch.items) ? batch.items : [];

  return {
    id: batch.uuid,
    batchId: batch.batch_code,
    period: formatPayrollPeriod(batch.payroll_month, batch.payroll_year),
    location: batch.working_location?.name ?? batch.working_location_id,
    department: summarizeDistinct(items.map((item: any) => item.employee?.department?.name)),
    position: summarizeDistinct(items.map((item: any) => item.employee?.position?.name)),
    positionNames: Array.from(
      new Set(items.map((item: any) => item.employee?.position?.name).filter(Boolean)),
    ) as string[],
    employeeCount: batch.total_employees,
    totalGross: Number(batch.total_gross ?? 0),
    totalDeductions: Number(batch.total_deductions ?? 0),
    totalTax: Number(batch.total_tax ?? 0),
    totalAmount: Number(batch.total_amount),
    status: batch.status,
    createdBy: submitter?.email ?? submitter?.first_name ?? 'System',
    createdAt: batch.created_at,
    paymentDate: firstTransaction?.payment_date ?? batch.approved_at ?? batch.created_at,
  };
}

export default function PayrollAdminPage() {
  const params = useParams();
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openStatCard, setOpenStatCard] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [batchesPage, setBatchesPage] = useState(1);
  const BATCHES_PAGE_SIZE = 20;
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;
  const roles = user?.roles ?? [];
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const canApprove = hasPermission('payroll.approve');

  useEffect(() => {
    setIsLoading(true);
    getPayrollBatches()
      .then((items) => setBatches(getBatchList(items).map(mapApiBatch)))
      .catch(() => setBatches([]))
      .finally(() => setIsLoading(false));
    getPositions().then(setPositions).catch(() => setPositions([]));
  }, []);

  const stats = [
    {
      name: 'Total Batches',
      value: String(batches.length),
      icon: File02,
      tone: 'info' as StatCardTone,
      key: 'total',
      title: 'All Payroll Batches',
      description: 'Every payroll batch across every status.',
      statusFilter: undefined,
      showActions: false,
    },
    {
      name: 'Active Batches',
      value: String(batches.filter(b => !['APPROVED', 'REJECTED'].includes(b.status)).length),
      icon: Activity,
      tone: 'success' as StatCardTone,
      key: 'active',
      title: 'Active Payroll Batches',
      description: 'Batches still moving through the approval pipeline.',
      statusFilter: 'DRAFT,PENDING,IN_REVIEW,MANAGER_APPROVED',
      showActions: true,
    },
    {
      name: 'Pending Review',
      value: String(batches.filter(b => ['PENDING', 'IN_REVIEW', 'MANAGER_APPROVED'].includes(b.status)).length),
      icon: Clock,
      tone: 'warning' as StatCardTone,
      key: 'pending',
      title: 'Pending Payroll Review',
      description: 'Approve or decline batches awaiting disbursement.',
      statusFilter: 'PENDING,IN_REVIEW,MANAGER_APPROVED',
      showActions: true,
    },
    {
      name: 'Total Disbursed',
      value: formatRwf(batches.filter(b => b.status === 'APPROVED').reduce((sum, batch) => sum + batch.totalAmount, 0)),
      icon: Wallet01,
      tone: 'primary' as StatCardTone,
      key: 'disbursed',
      title: 'Disbursed Payroll Batches',
      description: 'Batches that have been fully approved and paid out.',
      statusFilter: 'APPROVED',
      showActions: false,
    },
  ];

  const activeStat = stats.find((s) => s.key === openStatCard);

  const filteredBatches = batches.filter(b => {
    const matchesSearch = b.batchId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.createdBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === 'ALL' || b.positionNames.includes(positionFilter);

    if (activeTab === 'ACTIVE') {
      return matchesSearch && matchesPosition && !['APPROVED', 'REJECTED'].includes(b.status);
    } else {
      return matchesSearch && matchesPosition && ['APPROVED', 'REJECTED'].includes(b.status);
    }
  });

  const batchesTotalPages = Math.max(1, Math.ceil(filteredBatches.length / BATCHES_PAGE_SIZE));
  const paginatedBatches = filteredBatches.slice(
    (batchesPage - 1) * BATCHES_PAGE_SIZE,
    batchesPage * BATCHES_PAGE_SIZE,
  );

  useEffect(() => {
    setBatchesPage(1);
  }, [searchTerm, positionFilter, activeTab]);

  const handleExport = (type: 'csv' | 'excel') => {
    const exportData = filteredBatches.map(b => ({
      BatchID: b.batchId,
      Period: b.period,
      Location: b.location,
      Employees: b.employeeCount,
      GrossPay: b.totalGross,
      TotalTax: b.totalTax,
      TotalDeductions: b.totalDeductions,
      NetPay: b.totalAmount,
      Status: b.status,
      CreatedAt: b.createdAt,
      PaymentDate: b.paymentDate,
    }));

    if (type === 'csv') exportToCSV(exportData, 'payroll');
    else if (type === 'excel') exportToExcel(exportData, 'payroll');
  };

  const refreshBatches = async () => {
    setIsLoading(true);
    try {
      const items = await getPayrollBatches();
      setBatches(getBatchList(items).map(mapApiBatch));
    } catch {
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
        description: userFriendlyError(error, 'Please review the payroll details and try again.'),
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
        description: userFriendlyError(error, 'Please review the payroll details and try again.'),
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
        description: userFriendlyError(error, 'Could not download this payroll batch.'),
      });
    }
  };

  const canReviewBatch = (batch: PayrollBatch) => {
    if (['APPROVED', 'REJECTED'].includes(batch.status)) return false;
    if (!canApprove) return false;
    // If batch is already manager-approved, only SUPER_ADMIN can do the final approval
    if (batch.status === 'MANAGER_APPROVED') return isSuperAdmin;
    return true;
  };

  return (
    <div className="space-y-8">
      <PayrollBatchesModal
        isOpen={!!activeStat}
        onClose={() => setOpenStatCard(null)}
        onRefresh={refreshBatches}
        title={activeStat?.title ?? ''}
        description={activeStat?.description ?? ''}
        statusFilter={activeStat?.statusFilter}
        showActions={activeStat?.showActions ?? false}
      />

      <PageHeader
        title="Payroll Infrastructure"
        description="Manage and audit enterprise-wide salary disbursements."
        actions={
          <PermissionGate permission="payroll.create">
            <Link href={`${basePath}/payroll/new`}>
              <Button className="h-11 px-6 shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" size={16} /> Generate New Batch
              </Button>
            </Link>
          </PermissionGate>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <StatCard
            key={stat.name}
            icon={<stat.icon className="h-5 w-5" size={20} />}
            label={stat.name}
            value={stat.value}
            tone={stat.tone}
            onClick={() => setOpenStatCard(stat.key)}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex bg-card p-1 rounded-lg border shadow-sm">
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

        <div className="flex items-center gap-4 bg-card p-1.5 px-3 rounded-lg shadow-sm border flex-1">
          <div className="relative flex-1">
            <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" size={16} />
            <Input
              placeholder={`Search ${activeTab === 'ACTIVE' ? 'pending' : 'historical'} batches...`}
              className="pl-10 h-9 border border-border bg-transparent focus-visible:ring-0"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="h-9 w-[180px] border border-border bg-transparent">
              <SelectValue placeholder="Filter by position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Positions</SelectItem>
              {positions.map((position) => (
                <SelectItem key={position.uuid} value={position.name}>{position.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="h-6 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground">
                <Download01 className="h-4 w-4" size={16} /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>Export as Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold px-3">Batch ID</TableHead>
              <TableHead className="font-bold px-3">Period</TableHead>
              <TableHead className="font-bold px-3">Assignment</TableHead>
              <TableHead className="font-bold px-3">Employees</TableHead>
              <TableHead className="font-bold text-right px-3">Gross Pay</TableHead>
              <TableHead className="font-bold text-right px-3">Deductions</TableHead>
              <TableHead className="font-bold text-right px-3">Net Pay</TableHead>
              <TableHead className="font-bold px-3">Status</TableHead>
              <TableHead className="font-bold px-3">Created / Submitted By</TableHead>
              <TableHead className="w-[56px] px-2"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableStateRow
                colSpan={10}
                tone="info"
                title="Loading payroll batches"
                description="Preparing active runs, archived payroll records, and approval status."
              />
            ) : paginatedBatches.length > 0 ? paginatedBatches.map((batch) => (
              <TableRow key={batch.id} className="even:bg-secondary/10 hover:bg-secondary/20 transition-colors">
                <TableCell className="font-medium text-primary px-3 whitespace-nowrap">{batch.batchId}</TableCell>
                <TableCell className="px-3 whitespace-nowrap">{batch.period}</TableCell>
                <TableCell className="px-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{batch.location}</span>
                    <span className="text-xs text-muted-foreground">{batch.department}</span>
                    <span className="text-xs text-muted-foreground">{batch.position}</span>
                  </div>
                </TableCell>
                <TableCell className="px-3">{batch.employeeCount}</TableCell>
                <TableCell className="text-right font-medium px-3 whitespace-nowrap">{formatRwf(batch.totalGross)}</TableCell>
                <TableCell className="text-right px-3 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-medium text-destructive">-{formatRwf(batch.totalDeductions)}</span>
                    <span className="text-[10px] text-muted-foreground">PIT {formatRwf(batch.totalTax)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold text-primary px-3 whitespace-nowrap">{formatRwf(batch.totalAmount)}</TableCell>
                <TableCell className="px-3"><PayrollStatusBadge status={batch.status} /></TableCell>
                <TableCell className="px-3">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground whitespace-nowrap">{formatPayrollDate(batch.createdAt)}</span>
                    <span className="text-muted-foreground text-xs truncate max-w-[160px]">{batch.createdBy}</span>
                  </div>
                </TableCell>
                <TableCell className="px-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Open actions for payroll batch ${batch.batchId}`}>
                        <DotsVertical className="h-4 w-4 text-muted-foreground" size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <Link href={`${basePath}/payroll/${batch.id}`}>
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" size={16} /> View Details
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuItem onClick={() => handleBatchExport(batch)}>
                        <Download01 className="mr-2 h-4 w-4" size={16} /> Export CSV
                      </DropdownMenuItem>
                      {canReviewBatch(batch) && (
                        <PermissionGate permission="payroll.approve">
                          <DropdownMenuItem className="text-success" onClick={() => handleApprove(batch)}>
                            <CheckCircle className="mr-2 h-4 w-4" size={16} /> Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleReject(batch)}>
                            <XCircle className="mr-2 h-4 w-4" size={16} /> Reject
                          </DropdownMenuItem>
                        </PermissionGate>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableStateRow
                colSpan={10}
                title={activeTab === 'ACTIVE' ? "No payroll cycles awaiting review" : "No historical payroll records"}
                description={
                  activeTab === 'ACTIVE'
                    ? "Create a payroll batch when the pay period is ready, or adjust your search."
                    : "Archived payroll records will appear here after batches are approved, rejected, or completed."
                }
              />
            )}
          </TableBody>
        </Table>
        <Pagination
          page={batchesPage}
          totalPages={batchesTotalPages}
          total={filteredBatches.length}
          limit={BATCHES_PAGE_SIZE}
          onPageChange={setBatchesPage}
        />
      </div>
    </div>
  );
}
