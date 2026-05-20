
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, Save, Calculator, Users, 
  Search, Filter, Banknote, ShieldCheck 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getEmployees } from '@/api/employees';
import { createPayrollBatch } from '@/api/payroll';
import { getWorkingLocations } from '@/api/working_locations';

export default function NewPayrollBatchPage() {
  const router = useRouter();
  const { toast } = useToast();
  const now = new Date();
  const [employees, setEmployees] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [workingLocationId, setWorkingLocationId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('all');
  const [paymentDate, setPaymentDate] = useState(now.toISOString().slice(0, 10));
  const [payrollMonth, setPayrollMonth] = useState(now.getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(now.getFullYear());
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, { overtime: number, bonus: number, deductions: number }>>({});

  const handleLocationChange = async (locationUuid: string) => {
    setWorkingLocationId(locationUuid);
    setSelectedDepartmentId('all');
    setDepartments([]);
    if (locationUuid) {
      try {
        const data = await getDepartments(locationUuid);
        setDepartments(data.departments || []);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    }
  };

  useEffect(() => {
    Promise.all([
      getEmployees().catch(() => ({ employees: [] })), 
      getWorkingLocations().catch(() => ({ working_locations: [] }))
    ]).then(([employeeData, locationData]) => {
      const emps = employeeData.employees || [];
      const locs = locationData.working_locations || [];
      setEmployees(emps);
      setLocations(locs);
      if (locs[0]) {
        setWorkingLocationId(locs[0].uuid);
        handleLocationChange(locs[0].uuid);
      }
      setSelectedEmployees(emps.map((employee: any) => employee.uuid));
    });
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const locationMatch = !workingLocationId || emp.working_location?.uuid === workingLocationId;
      const departmentMatch = selectedDepartmentId === 'all' || emp.department?.uuid === selectedDepartmentId;
      return locationMatch && departmentMatch;
    });
  }, [employees, workingLocationId, selectedDepartmentId]);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleAdjustmentChange = (id: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAdjustments(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { overtime: 0, bonus: 0, deductions: 0 }), [field]: numValue }
    }));
  };

  const batchTotals = useMemo(() => {
    return selectedEmployees.reduce((acc, id) => {
      const emp = employees.find(e => e.uuid === id)!;
      const adj = adjustments[id] || { overtime: 0, bonus: 0, deductions: 0 };
      const gross = Number(emp.payment_structures?.[0]?.basic_salary ?? 0) + adj.overtime + adj.bonus;
      const tax = gross * 0.1; // Simple 10% tax
      const net = gross - tax - adj.deductions;
      return {
        count: acc.count + 1,
        totalNet: acc.totalNet + net,
        totalGross: acc.totalGross + gross
      };
    }, { count: 0, totalNet: 0, totalGross: 0 });
  }, [selectedEmployees, adjustments]);

  const handleSubmit = async () => {
    try {
      await createPayrollBatch({
        working_location_id: workingLocationId,
        payroll_month: payrollMonth,
        payroll_year: payrollYear,
        payment_date: paymentDate,
        payment_method: 'BANK',
      });
      toast({ title: "Payroll Batch Initialized", description: "The batch has been sent to review phase." });
      router.push('/admin/admin/payroll');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Payroll batch failed",
        description: error?.response?.data?.message ?? "Please check employee payment structures.",
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-headline font-bold">Generate Payroll Batch</h1>
          <p className="text-muted-foreground">Initiate salary calculations for a specific cycle.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Batch Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Payroll Period</Label>
                <Select value={`${payrollYear}-${payrollMonth}`} onValueChange={(value) => {
                  const [year, month] = value.split('-').map(Number);
                  setPayrollYear(year);
                  setPayrollMonth(month);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select Period" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={`${now.getFullYear()}-${now.getMonth() + 1}`}>Current Month</SelectItem>
                    <SelectItem value={`${now.getFullYear()}-${Math.max(1, now.getMonth())}`}>Previous Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Working Location</Label>
                <Select value={workingLocationId} onValueChange={setWorkingLocationId}>
                  <SelectTrigger><SelectValue placeholder="All Locations" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.uuid} value={location.uuid}>{location.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Department Filtering</Label>
                <Select defaultValue="all">
                  <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="eng">Engineering</SelectItem>
                    <SelectItem value="ops">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Employee Selection & Adjustments</CardTitle>
                <CardDescription>Select employees and input variable pay components.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-7 h-8 text-xs" />
                </div>
                <Button variant="outline" size="sm" className="h-8"><Filter className="h-3 w-3" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Overtime</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Deduction</TableHead>
                    <TableHead className="text-right">Net Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => {
                    const adj = adjustments[emp.uuid] || { overtime: 0, bonus: 0, deductions: 0 };
                    const base = Number(emp.payment_structures?.[0]?.basic_salary ?? 0);
                    const net = (base + adj.overtime + adj.bonus) * 0.9 - adj.deductions;
                    const isSelected = selectedEmployees.includes(emp.uuid);
                    
                    return (
                      <TableRow key={emp.uuid} className={isSelected ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleEmployee(emp.uuid)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{`${emp.first_name} ${emp.last_name}`.trim()}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{emp.department?.name ?? 'Unassigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">${base}</TableCell>
                        <TableCell>
                          <Input 
                            className="h-8 w-20 text-xs" 
                            type="number" 
                            placeholder="0"
                            onChange={(e) => handleAdjustmentChange(emp.uuid, 'overtime', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            className="h-8 w-20 text-xs" 
                            type="number" 
                            placeholder="0"
                            onChange={(e) => handleAdjustmentChange(emp.uuid, 'bonus', e.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            className="h-8 w-20 text-xs" 
                            type="number" 
                            placeholder="0"
                            onChange={(e) => handleAdjustmentChange(emp.uuid, 'deductions', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm text-primary">
                          ${net.toFixed(0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-lg bg-primary text-white sticky top-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" /> Batch Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center border-b border-white/20 pb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 opacity-70" />
                  <span className="text-sm">Total Employees</span>
                </div>
                <span className="font-bold text-xl">{batchTotals.count}</span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm opacity-80">
                  <span>Gross Disbursements</span>
                  <span>${batchTotals.totalGross.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm opacity-80">
                  <span>Estimated Tax Pool</span>
                  <span>-${(batchTotals.totalGross * 0.1).toLocaleString()}</span>
                </div>
                <div className="pt-4 flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider font-bold opacity-70">Total Net Amount</span>
                    <span className="text-3xl font-bold">${batchTotals.totalNet.toLocaleString()}</span>
                  </div>
                  <Banknote className="h-8 w-8 opacity-20" />
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button 
                  className="w-full bg-white text-primary hover:bg-white/90 font-bold h-12"
                  onClick={handleSubmit}
                  disabled={selectedEmployees.length === 0}
                >
                  <Save className="mr-2 h-4 w-4" /> Finalize Draft
                </Button>
                <p className="text-[10px] text-center opacity-60">
                  <ShieldCheck className="h-3 w-3 inline mr-1" /> All data encrypted with corporate standard AES-256
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
