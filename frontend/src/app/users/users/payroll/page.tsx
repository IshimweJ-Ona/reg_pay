
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText, TrendingUp, Wallet, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

const formatRwf = (value: number) => `RWF ${value.toLocaleString()}`;

export default function UserPayrollPage() {
  const { user } = useAuth();
  const payslips = useMemo(() => [], []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Payroll & Compensation</h1>
          <p className="text-muted-foreground text-sm">Review your salary history and download your official payslips.</p>
        </div>
        <Button className="h-11 shadow-lg shadow-primary/20"><Download className="mr-2 h-4 w-4" /> Yearly Summary Report</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-primary text-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase opacity-70">Latest Net Salary</p>
                <h3 className="text-3xl font-bold">{formatRwf(0)}</h3>
              </div>
              <div className="bg-white/20 p-2 rounded-lg">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <ArrowUpRight className="h-3 w-3" />
              <span>No paid payroll found yet</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase text-muted-foreground">Annual Earnings</p>
                <h3 className="text-2xl font-bold">{formatRwf(0)}</h3>
              </div>
              <div className="bg-emerald-100 p-2 rounded-lg">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase text-muted-foreground">Total Taxes Paid</p>
                <h3 className="text-2xl font-bold">{formatRwf(0)}</h3>
              </div>
              <div className="bg-amber-100 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Recent Payslips</CardTitle>
          <CardDescription>Click on a row to view the full digital breakdown.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Pay Period</TableHead>
                <TableHead>Net Disbursement</TableHead>
                <TableHead>Tax Deductions</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.map((slip: any) => (
                <TableRow key={slip.id} className="hover:bg-secondary/10 transition-colors cursor-pointer group">
                  <TableCell className="font-bold">{slip.period}</TableCell>
                  <TableCell className="font-mono text-sm">{formatRwf(slip.netPay)}</TableCell>
                  <TableCell className="text-rose-600 font-mono text-xs">-{formatRwf(Number(slip.tax))}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{slip.date}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{slip.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="group-hover:text-primary"><Download className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
