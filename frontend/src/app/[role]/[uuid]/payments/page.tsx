
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { CreditCard, Plus, Landmark, Wallet, ShieldCheck, MoreVertical, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function FinancialSetupPage() {
  const paymentMethods = [
    { id: '1', name: 'Bank transfer', type: 'Salary payments', coverage: 'All branches', status: 'ACTIVE', fee: 'Configured by finance' },
    { id: '2', name: 'Mobile money', type: 'Staff allowances', coverage: 'Rwanda', status: 'ACTIVE', fee: 'Provider rate' },
    { id: '3', name: 'Manual review', type: 'Exception payments', coverage: 'HQ approval', status: 'ACTIVE', fee: 'No system fee' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Financial Setup</h1>
          <p className="text-muted-foreground">Review payroll payment methods and finance controls used by the system.</p>
        </div>
        <Button className="h-11 px-6 shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> Add Payment Method
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Primary Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Landmark className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">Bank transfer</p>
                <p className="text-xs text-muted-foreground">Default for salaries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Payroll Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Ready</p>
                <p className="text-xs text-muted-foreground">Approval flow enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Finance Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Approval</p>
                <p className="text-xs text-muted-foreground">Payroll changes require review</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>Methods available when payroll is prepared and approved.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Used For</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentMethods.map((pm) => (
                <TableRow key={pm.id} className="hover:bg-secondary/10 transition-colors">
                  <TableCell className="font-bold">{pm.name}</TableCell>
                  <TableCell>{pm.type}</TableCell>
                  <TableCell className="font-mono text-xs">{pm.fee}</TableCell>
                  <TableCell><Badge variant="outline">{pm.coverage}</Badge></TableCell>
                  <TableCell>
                    <Badge className={pm.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}>
                      {pm.status}
                    </Badge>
                  </TableCell>
                  <TableCell><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
