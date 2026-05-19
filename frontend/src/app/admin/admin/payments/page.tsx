
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
    { id: '1', name: 'Standard Bank Group', type: 'Bank Transfer', coverage: 'Global', status: 'ACTIVE', fee: '0.05%' },
    { id: '2', name: 'Mobile Money Interconnect', type: 'Digital Wallet', coverage: 'Regional', status: 'ACTIVE', fee: '1.2%' },
    { id: '3', name: 'Corporate Swift', type: 'Wire', coverage: 'Global', status: 'MAINTENANCE', fee: 'Free' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Financial Infrastructure</h1>
          <p className="text-muted-foreground">Configure disbursement rails and payment gateway protocols.</p>
        </div>
        <Button className="h-11 px-6 shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> Provision Rail
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Primary Rail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Landmark className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">BK Rwanda</p>
                <p className="text-xs text-muted-foreground">SWIFT Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Processing Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Instant</p>
                <p className="text-xs text-muted-foreground">99.9% Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Security Protocol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">AES-256</p>
                <p className="text-xs text-muted-foreground">Full Encryption</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Disbursement Methods</CardTitle>
          <CardDescription>Available payment vectors for payroll execution.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 border-t">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Channel Name</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Fee Structure</TableHead>
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
