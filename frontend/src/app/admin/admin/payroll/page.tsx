
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Plus, Search, Filter, Download, FileText, 
  MoreVertical, Eye, Edit, CheckCircle, XCircle, Trash 
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
import { getPayrollBatches } from '@/api/payroll';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [batches, setBatches] = useState<PayrollBatch[]>([]);

  useEffect(() => {
    getPayrollBatches().then((items) => setBatches(items.map(mapApiBatch))).catch(() => setBatches([]));
  }, []);

  const stats = [
    { name: 'Total Batches', value: String(batches.length), icon: FileText, color: 'text-blue-600' },
    { name: 'Pending Approval', value: String(batches.filter((batch) => batch.status === 'PENDING').length), icon: Eye, color: 'text-amber-600' },
    { name: 'Total Amount', value: `$${batches.reduce((sum, batch) => sum + batch.totalAmount, 0).toLocaleString()}`, icon: Plus, color: 'text-primary' },
    { name: 'Failed Transfers', value: '0', icon: XCircle, color: 'text-destructive' },
  ];

  const filteredBatches = batches.filter(b => 
    b.batchId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Payroll Infrastructure</h1>
          <p className="text-muted-foreground">Manage and audit enterprise-wide salary disbursements.</p>
        </div>
        <PermissionGate permission="payroll.create">
          <Link href="/admin/admin/payroll/new">
            <Button className="h-11 px-6 shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Generate New Batch
            </Button>
          </Link>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name} className="border-none shadow-sm">
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

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search batches by ID or Location..." 
            className="pl-10 h-11 border-none bg-secondary/30 focus-visible:ring-1 focus-visible:ring-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-11 gap-2 border-dashed">
          <Filter className="h-4 w-4" /> Advanced filters
        </Button>
        <Button variant="outline" className="h-11 gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
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
            {filteredBatches.map((batch) => (
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
                <TableCell className="font-bold">${batch.totalAmount.toLocaleString()}</TableCell>
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
                      <Link href={`/admin/admin/payroll/${batch.id}`}>
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                      </Link>
                      <PermissionGate permission="payroll.manage">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" /> Edit Batch
                        </DropdownMenuItem>
                      </PermissionGate>
                      <PermissionGate permission="payroll.approve">
                        <DropdownMenuItem className="text-emerald-600">
                          <CheckCircle className="mr-2 h-4 w-4" /> Approve
                        </DropdownMenuItem>
                      </PermissionGate>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <FileText className="mr-2 h-4 w-4" /> Export PDF
                      </DropdownMenuItem>
                      <PermissionGate permission="payroll.manage">
                        <DropdownMenuItem className="text-destructive">
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </PermissionGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
