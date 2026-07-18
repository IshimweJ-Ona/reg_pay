
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from '@/components/ui/badge';
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
import { userFriendlyError } from '@/lib/error-message';
import { asPayrollNumber, formatRwf } from '@/lib/payroll-display';

const getEmployeeLocation = (employee: any) =>
  employee.working_location ?? employee.working_locations ?? null;

const getEmployeeDepartment = (employee: any) =>
  employee.department ?? employee.departments ?? null;

const getEmployeeCategory = (employee: any) =>
  employee.employment_category ?? employee.employment_categories ?? null;

const getPaymentStructure = (employee: any) =>
  employee.payment_structures?.[0] ?? null;

const getPayrollFrequency = (employee: any) =>
  getPaymentStructure(employee)?.payroll_frequency ??
  getEmployeeCategory(employee)?.payroll_frequency ??
  'UNSET';

const getSalaryBasis = (employee: any) => {
  const structure = getPaymentStructure(employee);
  const frequency = getPayrollFrequency(employee);
  return frequency === 'MONTHLY'
    ? asPayrollNumber(structure?.basic_salary)
    : asPayrollNumber(structure?.daily_rate ?? structure?.basic_salary);
};

const hasPaymentSetup = (employee: any) =>
  Boolean(getPaymentStructure(employee)) && getSalaryBasis(employee) > 0;

const employeeSearchText = (employee: any) =>
  [
    employee.first_name,
    employee.last_name,
    employee.phone_number,
    employee.national_id,
    getEmployeeDepartment(employee)?.name,
    getEmployeeLocation(employee)?.name,
    getEmployeeCategory(employee)?.name,
    getPayrollFrequency(employee),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

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
  const [searchTerm, setSearchTerm] = useState('');

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  const { user } = useAuth();
  const isLocationUnrestricted = Boolean(!user?.location_id || user?.roles?.includes('SUPER_ADMIN'));

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
      
      const userLoc = locs.find((l: any) => l.uuid === user?.location_id || l.name === user?.location);
      if (userLoc) {
        setWorkingLocationId(userLoc.uuid);
        handleLocationChange(userLoc.uuid);
      } else if (locs[0]) {
        setWorkingLocationId(locs[0].uuid);
        handleLocationChange(locs[0].uuid);
      }
    });
  }, [user?.location_id]);

  const batchEmployees = useMemo(() => {
    return employees.filter(emp => {
      const location = getEmployeeLocation(emp);
      const locationMatch = !workingLocationId || location?.uuid === workingLocationId;
      const frequency = getPayrollFrequency(emp).toUpperCase();
      const categoryMatch = selectedCategories.includes('ALL') || selectedCategories.includes(frequency);
      const isActive = emp.status === 'ACTIVE';
      
      return isActive && locationMatch && categoryMatch;
    });
  }, [employees, workingLocationId, selectedCategories]);

  const filteredEmployees = useMemo(() => {
    return batchEmployees.filter(emp => {
      const department = getEmployeeDepartment(emp);
      const departmentMatch = selectedDepartmentId === 'all' || department?.uuid === selectedDepartmentId;
      const searchMatch = !searchTerm.trim() || employeeSearchText(emp).includes(searchTerm.toLowerCase());

      return departmentMatch && searchMatch;
    });
  }, [batchEmployees, selectedDepartmentId, searchTerm]);

  const uniqueEmployeeCount = useMemo(() => {
    const ids = new Set(batchEmployees.map(e => e.id));
    return ids.size;
  }, [batchEmployees]);

  const missingPaymentSetupCount = useMemo(
    () => batchEmployees.filter((employee) => !hasPaymentSetup(employee)).length,
    [batchEmployees],
  );

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
    if (missingPaymentSetupCount > 0) {
      toast({
        variant: 'destructive',
        title: 'Payment setup incomplete',
        description: `${missingPaymentSetupCount} active employee${missingPaymentSetupCount === 1 ? '' : 's'} need a valid payment structure before this batch can be created.`,
      });
      return;
    }

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
        description: userFriendlyError(error, "Please check employee payment structures."),
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
    <div className="max-w-[1800px] mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-headline font-bold">Generate Payroll Batch</h1>
          <p className="text-muted-foreground">Initiate salary calculations for a specific cycle.</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-6">
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
              {isLocationUnrestricted ? (
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
              ) : (
                <div className="space-y-2">
                  <Label>Working Location</Label>
                  <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                    {locations.find(l => l.uuid === workingLocationId)?.name ?? user?.location ?? 'Your branch'}
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Batches are always created for your own branch.</p>
                </div>
              )}
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
                <Label>Payroll Frequencies</Label>
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
                  <Input
                    placeholder="Search..."
                    className="pl-7 h-8 text-xs"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
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
                    <TableHead>Frequency</TableHead>
                    <TableHead>Salary Basis (Editable)</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Payment Setup</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-muted-foreground italic">
                        No active employees match this payroll preview.
                      </TableCell>
                    </TableRow>
                  ) : filteredEmployees.map((emp) => {
                    const category = getEmployeeCategory(emp);
                    const department = getEmployeeDepartment(emp);
                    const frequency = getPayrollFrequency(emp);
                    const currentSalary = overrides[emp.id]?.salary ?? getSalaryBasis(emp);
                    const currentPhone = overrides[emp.id]?.phone ?? (emp.phone_number || '');
                    const paymentReady = hasPaymentSetup(emp);
                    
                    return (
                      <TableRow key={emp.uuid}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{`${emp.first_name} ${emp.last_name}`.trim()}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{emp.national_id || emp.uuid}</span>
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
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{frequency}</span>
                            <span className="text-[10px] text-muted-foreground">{category?.name ?? 'Unassigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Input
                              type="text"
                              className="h-8 w-32 text-xs font-bold"
                              value={currentSalary}
                              onChange={(e) => handleSalaryChange(emp.id, e.target.value)}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {frequency === 'MONTHLY' ? 'Monthly basic' : 'Daily rate'} • {formatRwf(currentSalary)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{department?.name ?? 'Unassigned'}</TableCell>
                        <TableCell>
                          {paymentReady ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Ready</Badge>
                          ) : (
                            <Badge variant="outline" className="text-rose-600 border-rose-200">Missing structure</Badge>
                          )}
                        </TableCell>
                        <TableCell>{emp.status}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-lg bg-primary text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" /> Batch Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-3 border-b border-white/20 pb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 opacity-70" />
                  <span className="text-sm">Batch Employees</span>
                </div>
                <span className="font-bold text-xl">{uniqueEmployeeCount}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="opacity-80">Visible Preview</span>
                <span className="font-bold">{filteredEmployees.length}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="opacity-80">Missing Payment Setup</span>
                <span className={`font-bold ${missingPaymentSetupCount > 0 ? 'text-amber-200' : ''}`}>
                  {missingPaymentSetupCount}
                </span>
              </div>
            </div>

            <p className="text-sm opacity-80">
              Payroll totals are calculated by the NestJS backend from attendance, payment structure, deductions, tax rules, and allowances immediately after submission. Review every row above before finalizing.
            </p>

            <div className="pt-2 space-y-3 md:max-w-sm md:ml-auto">
              <Button 
                className="w-full bg-white text-primary hover:bg-white/90 font-bold h-12"
                onClick={handleSubmit}
                disabled={!workingLocationId || uniqueEmployeeCount === 0 || missingPaymentSetupCount > 0}
              >
                <Save className="mr-2 h-4 w-4" /> Finalize Draft
              </Button>
              <p className="text-[10px] text-center opacity-60">
                <ShieldCheck className="h-3 w-3 inline mr-1" /> Draft batches remain reviewable before approval
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
