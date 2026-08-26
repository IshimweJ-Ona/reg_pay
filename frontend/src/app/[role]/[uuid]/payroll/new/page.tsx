
"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  ArrowLeft, Save01, Calculator, Users01,
  SearchMd, ShieldTick, Paperclip, X
} from '@untitledui/icons';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getEmployees } from '@/api/employees';
import { createPayrollBatch, uploadPayrollBatchAttachments } from '@/api/payroll';
import { getDepartments, getWorkingLocations } from '@/api/working_locations';
import { useAuth } from '@/context/auth-context';
import { userFriendlyError } from '@/lib/error-message';
import { asPayrollNumber, formatRwf } from '@/lib/payroll-display';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingState, PermissionDeniedState, TableStateRow } from '@/components/layout/page-state';

const getEmployeeLocation = (employee: any) =>
  employee.working_location ?? employee.working_locations ?? null;

const getEmployeeDepartment = (employee: any) =>
  employee.department ?? employee.departments ?? null;

const getEmployeePosition = (employee: any) =>
  employee.position ?? employee.positions ?? null;

const getEmployeeCategory = (employee: any) =>
  employee.position?.employment_category ?? employee.position?.employment_categories ?? null;

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
  const [selectedPositionId, setSelectedPositionId] = useState('all');
  const [paymentDate, setPaymentDate] = useState(now.toISOString().slice(0, 10));
  const [payrollMonth, setPayrollMonth] = useState(now.getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(now.getFullYear());
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['ALL']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workDays, setWorkDays] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [batchAttachments, setBatchAttachments] = useState<File[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);

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
    setLoadingSetup(true);
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
    }).finally(() => setLoadingSetup(false));
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

  const availablePositions = useMemo(() => {
    const byUuid = new Map<string, { uuid: string; name: string }>();
    for (const emp of batchEmployees) {
      const position = getEmployeePosition(emp);
      if (position?.uuid && !byUuid.has(position.uuid)) {
        byUuid.set(position.uuid, { uuid: position.uuid, name: position.name });
      }
    }
    return Array.from(byUuid.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [batchEmployees]);

  const filteredEmployees = useMemo(() => {
    return batchEmployees.filter(emp => {
      const department = getEmployeeDepartment(emp);
      const departmentMatch = selectedDepartmentId === 'all' || department?.uuid === selectedDepartmentId;
      const position = getEmployeePosition(emp);
      const positionMatch = selectedPositionId === 'all' || position?.uuid === selectedPositionId;
      const searchMatch = !searchTerm.trim() || employeeSearchText(emp).includes(searchTerm.toLowerCase());

      return departmentMatch && positionMatch && searchMatch;
    });
  }, [batchEmployees, selectedDepartmentId, selectedPositionId, searchTerm]);

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

  const handleAttachmentChange = (files: FileList | null) => {
    if (!files) return;
    setBatchAttachments((current) => {
      const existingKeys = new Set(current.map((file) => `${file.name}-${file.size}`));
      const additions = Array.from(files).filter((file) => !existingKeys.has(`${file.name}-${file.size}`));
      return [...current, ...additions].slice(0, 10);
    });
  };

  const removeAttachment = (index: number) => {
    setBatchAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
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
      const createdBatch = await createPayrollBatch({
        working_location_id: workingLocationId,
        payroll_month: payrollMonth,
        payroll_year: payrollYear,
        payment_date: paymentDate,
        payment_method: 'BANK',
        description: batchDescription.trim() || undefined,
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

      if (batchAttachments.length > 0 && createdBatch?.uuid) {
        await uploadPayrollBatchAttachments(createdBatch.uuid, batchAttachments);
      }

      toast({
        title: "Payroll Batch Created",
        description: batchAttachments.length > 0
          ? "The batch has been saved as DRAFT with its attachments."
          : "The batch has been saved as DRAFT.",
      });
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
          <ArrowLeft className="mr-2 h-4 w-4" size={16} /> Back to payroll
        </Button>
        <PermissionDeniedState
          title="Payroll creation permission required"
          description="Your role can review payroll information, but it cannot generate new payroll batches."
        />
      </div>
    );
  }

  if (loadingSetup) {
    return (
      <LoadingState
        title="Loading payroll setup"
        description="Preparing employees, branches, departments, and default pay-period values."
      />
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Return to payroll runs">
          <ArrowLeft className="h-5 w-5" size={20} />
        </Button>
        <div className="flex-1">
          <PageHeader
            title="Generate Payroll Batch"
            description="Initiate salary calculations for a specific cycle."
          />
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-6">
          <Card className="border border-border shadow-sm">
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
              <div className="space-y-2">
                <Label>Position Preview Filter</Label>
                <Select value={selectedPositionId} onValueChange={setSelectedPositionId}>
                  <SelectTrigger><SelectValue placeholder="All Positions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Positions</SelectItem>
                    {availablePositions.map((position) => (
                      <SelectItem key={position.uuid} value={position.uuid}>{position.name}</SelectItem>
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
              <div className="space-y-2 md:col-span-2">
                <Label>Batch Description</Label>
                <Textarea
                  value={batchDescription}
                  onChange={(event) => setBatchDescription(event.target.value)}
                  placeholder="Add context for reviewers, payment notes, or any correction reason."
                  className="min-h-[88px]"
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Attachments</Label>
                    <p className="text-[10px] text-muted-foreground">Upload payroll evidence or supporting documents for reviewers.</p>
                  </div>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-xs font-semibold shadow-sm hover:bg-secondary/60">
                    <Paperclip className="h-3.5 w-3.5" size={14} />
                    Add Files
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => handleAttachmentChange(event.target.files)}
                    />
                  </label>
                </div>
                {batchAttachments.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {batchAttachments.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                        <Paperclip className="h-3.5 w-3.5 text-muted-foreground" size={14} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{file.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeAttachment(index)}
                          aria-label={`Remove attachment ${file.name}`}
                        >
                          <X className="h-3.5 w-3.5" size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
                    No attachments selected.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Payroll Population</CardTitle>
                <CardDescription>The backend calculates payroll for all active employees in the selected location. Department filtering only changes this preview.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <SearchMd className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" size={12} />
                  <Input
                    placeholder="Search..."
                    className="pl-7 h-8 text-xs"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
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
                    <TableStateRow
                      colSpan={7}
                      title="No employees match this payroll preview"
                      description="Adjust the branch, department, payroll frequency, or search filters before creating this batch."
                    />
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
                            {emp.national_id && (
                              <span className="text-[10px] text-muted-foreground uppercase">{emp.national_id}</span>
                            )}
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
                            <StatusBadge label="Ready" tone="success" />
                          ) : (
                            <StatusBadge label="Missing structure" tone="destructive" />
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

        <Card className="border border-border shadow-sm bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" size={20} /> Batch Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-3 border-b border-white/20 pb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users01 className="h-4 w-4 opacity-70" size={16} />
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
                <span className={`font-bold ${missingPaymentSetupCount > 0 ? 'text-warning' : ''}`}>
                  {missingPaymentSetupCount}
                </span>
              </div>
            </div>

            <p className="text-sm opacity-80">
              Payroll totals are calculated by the NestJS backend from attendance, payment structure, deductions, tax rules, and allowances immediately after submission. Review every row above before finalizing.
            </p>

            <div className="pt-2 space-y-3 md:max-w-sm md:ml-auto">
              <Button
                className="w-full bg-card text-primary hover:bg-card/90 font-bold h-12"
                onClick={handleSubmit}
                disabled={!workingLocationId || uniqueEmployeeCount === 0 || missingPaymentSetupCount > 0}
              >
                <Save01 className="mr-2 h-4 w-4" size={16} /> Finalize Draft
              </Button>
              <p className="text-[10px] text-center opacity-60">
                <ShieldTick className="h-3 w-3 inline mr-1" size={12} /> Draft batches remain reviewable before approval
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
