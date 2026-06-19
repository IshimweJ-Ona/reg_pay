
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  ArrowLeft, Save, Calculator, Users, 
  Search, Filter, ShieldCheck 
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getEmployees } from '@/api/employees';
import { createPayrollBatch } from '@/api/payroll';
import { getDepartments, getWorkingLocations } from '@/api/working_locations';
import { useAuth } from '@/context/auth-context';

export default function NewPayrollBatchPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const now = new Date();
  const [employees, setEmployees] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [workingLocationId, setWorkingLocationId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('all');
  const [paymentDate, setPaymentDate] = useState(now.toISOString().slice(0, 10));
  const [payrollMonth, setPayrollMonth] = useState(now.getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(now.getFullYear());
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['ALL']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workDays, setWorkDays] = useState('');

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  const { user } = useAuth();

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

  const handleCategoryToggle = (category: string) => {
    if (category === 'ALL') {
      setSelectedCategories(['ALL']);
      return;
    }

    setSelectedCategories(prev => {
      const filtered = prev.filter(c => c !== 'ALL');
      if (filtered.includes(category)) {
        const next = filtered.filter(c => c !== category);
        return next.length === 0 ? ['ALL'] : next;
      }
      return [...filtered, category];
    });
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
      
      const userLoc = locs.find((l: any) => l.uuid === user?.location || l.name === user?.location);
      if (userLoc) {
        setWorkingLocationId(userLoc.uuid);
        handleLocationChange(userLoc.uuid);
      } else if (locs[0]) {
        setWorkingLocationId(locs[0].uuid);
        handleLocationChange(locs[0].uuid);
      }
    });
  }, [user]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const locationMatch = !workingLocationId || emp.working_location?.uuid === workingLocationId;
      const departmentMatch = selectedDepartmentId === 'all' || emp.department?.uuid === selectedDepartmentId;
      
      const category = emp.employment_category?.name?.toUpperCase();
      const categoryMatch = selectedCategories.includes('ALL') || (category && selectedCategories.includes(category));
      
      return locationMatch && departmentMatch && categoryMatch;
    });
  }, [employees, workingLocationId, selectedDepartmentId, selectedCategories]);

  const uniqueEmployeeCount = useMemo(() => {
    const ids = new Set(filteredEmployees.map(e => e.id));
    return ids.size;
  }, [filteredEmployees]);

  const [overrides, setOverrides] = useState<Record<string, { salary?: number; phone?: string }>>({});

  const handleSalaryChange = (empId: string, value: string) => {
    const numValue = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (!isNaN(numValue)) {
      setOverrides(prev => ({ 
        ...prev, 
        [empId]: { ...prev[empId], salary: numValue } 
      }));
    }
  };

  const handlePhoneChange = (empId: string, value: string) => {
    setOverrides(prev => ({ 
      ...prev, 
      [empId]: { ...prev[empId], phone: value } 
    }));
  };

  const handleSubmit = async () => {
    try {
      await createPayrollBatch({
        working_location_id: workingLocationId,
        payroll_month: payrollMonth,
        payroll_year: payrollYear,
        payment_date: paymentDate,
        payment_method: 'BANK',
        categories: selectedCategories.includes('ALL') ? undefined : selectedCategories,
        ...(startDate ? { start_date: startDate } : {}),
        ...(endDate ? { end_date: endDate } : {}),
        ...(workDays ? { work_days: Number(workDays) } : {}),
        overrides: Object.entries(overrides).map(([id, data]) => ({
          employee_id: id,
          base_amount: data.salary,
          phone_number: data.phone
        }))
      });
      toast({ title: "Payroll Batch Created", description: "The batch has been saved as DRAFT." });
      router.push(`${basePath}/payroll`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Payroll batch failed",
        description: error?.response?.data?.message ?? "Please check employee payment structures.",
      });
    }
  };

  if (!hasPermission('payroll.create')) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-12">
        <Button variant="ghost" onClick={() => router.push(`${basePath}/payroll`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to payroll
        </Button>
        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <h1 className="text-xl font-bold">Payroll creation is not available</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Your assigned role can review payroll information, but it cannot generate new payroll batches.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                <Select value={workingLocationId} onValueChange={handleLocationChange}>
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
                <Label>Department Preview Filter</Label>
                <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                  <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((department) => (
                      <SelectItem key={department.uuid} value={department.uuid}>{department.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Employee Categories</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['ALL', 'MONTHLY', 'DAILY', 'CUSTOM'].map((cat) => (
                    <Button
                      key={cat}
                      type="button"
                      variant={selectedCategories.includes(cat) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleCategoryToggle(cat)}
                      className="rounded-full font-bold text-[10px]"
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Custom Start Date</Label>
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Custom End Date</Label>
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Custom Work Days</Label>
                <Input type="number" min="1" value={workDays} onChange={(event) => setWorkDays(event.target.value)} placeholder="Only for custom contracts" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Payroll Population</CardTitle>
                <CardDescription>The backend calculates payroll for all active employees in the selected location. Department filtering only changes this preview.</CardDescription>
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
                    <TableHead>Employee</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Payment Category</TableHead>
                    <TableHead>Salary Basis (Editable)</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => {
                    const base = Number(emp.payment_structures?.[0]?.basic_salary ?? 0);
                    const daily = Number(emp.payment_structures?.[0]?.daily_rate ?? 0);
                    const currentSalary = overrides[emp.id]?.salary ?? (base > 0 ? base : daily);
                    const currentPhone = overrides[emp.id]?.phone ?? (emp.phone_number || '');
                    
                    return (
                      <TableRow key={emp.uuid}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{`${emp.first_name} ${emp.last_name}`.trim()}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{emp.department?.name ?? 'Unassigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="text" 
                            className="h-8 w-40 text-xs font-mono" 
                            value={currentPhone}
                            onChange={(e) => handlePhoneChange(emp.id, e.target.value)}
                          />
                        </TableCell>
                        <TableCell>{emp.employment_category?.name ?? 'Unassigned'}</TableCell>
                        <TableCell>
                          <Input 
                            type="text" 
                            className="h-8 w-32 text-xs font-bold" 
                            value={currentSalary}
                            onChange={(e) => handleSalaryChange(emp.id, e.target.value)}
                          />
                        </TableCell>
                        <TableCell>{emp.department?.name ?? 'Unassigned'}</TableCell>
                        <TableCell>{emp.status}</TableCell>
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
                <span className="font-bold text-xl">{uniqueEmployeeCount}</span>
              </div>

              <div className="space-y-3">
                <p className="text-sm opacity-80">
                  Payroll totals are calculated by the NestJS backend from attendance, payment structure, deductions, tax rules, and allowances immediately after submission.
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <Button 
                  className="w-full bg-white text-primary hover:bg-white/90 font-bold h-12"
                  onClick={handleSubmit}
                  disabled={!workingLocationId || uniqueEmployeeCount === 0}
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
