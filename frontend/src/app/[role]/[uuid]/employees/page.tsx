
"use client";

import React, { useEffect, useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Filter, UserPlus, Eye, 
  MapPin, Building2, CreditCard, Activity, Edit, Trash2, MoreVertical,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Employee } from '@/types/employee';
import { getEmployees, suspendEmployee, createEmployee, updateEmployee, transferEmployee } from '@/api/employees';
import { getTimeRecords } from '@/api/attendance';
import { getWorkingLocations, getDepartments } from '@/api/working_locations';
import { getAvatarUrl, formatDisplayName } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  createAllowance, 
  updateAllowance,
  getAllowances,
  getEmployeeDeductions,
  createPaymentStructure, 
  getPaymentCategories,
  getActivePaymentStructureByEmployee,
  updateDeductionType,
  updateEmployeeDeduction
} from '@/api/payment-structures';
import { useAuth } from '@/context/auth-context';
import { exportToCSV, exportToExcel } from '@/lib/export-utils';
import { Download } from 'lucide-react';

const formatRwf = (value: number) => `RWF ${value.toLocaleString()}`;

function mapApiEmployee(item: any, attendanceByEmployee = new Map<string, any[]>()): Employee {
  const structure = item.payment_structures?.[0] || {};
  const payrollFrequency = structure.payroll_frequency ?? item.employment_category?.payroll_frequency;
  const salary =
    payrollFrequency === 'MONTHLY'
      ? Number(structure.basic_salary ?? 0)
      : Number(structure.daily_rate ?? structure.basic_salary ?? 0);
  const timeRecords = attendanceByEmployee.get(String(item.id)) ?? [];
  const presentCount = timeRecords.filter((record) => record.attendance_status === 'PRESENT').length;
  const latestRecord = [...timeRecords].sort(
    (a, b) =>
      new Date(b.attendance_date ?? b.created_at).getTime() -
      new Date(a.attendance_date ?? a.created_at).getTime(),
  )[0];

  return {
    id: item.uuid || '',
    uuid: item.uuid || '',
    bigIntId: item.id || '',
    employeeId: item.uuid || '',
    fullName: `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown Name',
    department: formatDisplayName(item.department?.name),
    location: formatDisplayName(item.working_location?.name),
    salary,
    status: item.status || 'ACTIVE',
    attendanceRate: timeRecords.length ? Math.round((presentCount / timeRecords.length) * 100) : 0,
    lastAttendanceDate: latestRecord?.attendance_date,
    lastAttendanceStatus: latestRecord?.attendance_status,
    employmentCategory: item.employment_category?.name ?? 'Unassigned',
    email: item.email ?? '',
    avatar_url: item.avatar_url,
    phone_number: item.phone_number ?? '',
    national_id: item.national_id ?? '',
    gender: item.gender ?? 'MALE',
    department_id: item.department_id ?? '',
    working_location_id: item.working_location_id ?? '',
    employment_category_id: item.employment_category_id ?? '',
    contract_start_date: item.contract_start_date ? new Date(item.contract_start_date).toISOString().split('T')[0] : '',
    contract_end_date: item.contract_end_date ? new Date(item.contract_end_date).toISOString().split('T')[0] : '',
  };
}

export default function EmployeeDirectoryPage() {
  const { user, hasPermission } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailStructure, setDetailStructure] = useState<any | null>(null);
  const [detailAllowances, setDetailAllowances] = useState<any[]>([]);
  const [detailDeductions, setDetailDeductions] = useState<any[]>([]);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialEmployeeData, setInitialEmployeeData] = useState<any>(null);
  
  // Employee Transfer State
  const [transferEmployeeData, setTransferEmployeeData] = useState<Employee | null>(null);
  const [transferLocationId, setTransferLocationId] = useState<string>('');
  const [transferDepartmentId, setTransferDepartmentId] = useState<string>('');
  const [transferDepartments, setTransferDepartments] = useState<any[]>([]);
  const [transferReason, setTransferReason] = useState<string>('');
  
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<any[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    location: 'ALL',
    department: 'ALL',
    category: 'ALL',
    status: 'ALL',
  });
  
  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    national_id: '',
    gender: 'MALE' as any,
    working_location_id: '',
    department_id: '',
    employment_category_id: '',
    basic_salary: '',
    daily_rate: '',
    tax_percentage: '0',
    custom_work_days: '',
    contract_start_date: '',
    contract_end_date: '',
    allowance_title: '',
    allowance_amount: '',
    allowance_description: '',
  });

  const { toast } = useToast();

  const handleTransferLocationChange = async (locationUuid: string) => {
    setTransferLocationId(locationUuid);
    setTransferDepartmentId('');
    setTransferDepartments([]);
    if (locationUuid) {
      try {
        const data = await getDepartments(locationUuid);
        setTransferDepartments(data.departments || (Array.isArray(data) ? data : []));
      } catch (error) {
        console.error('Failed to fetch transfer departments:', error);
      }
    }
  };

  const handleTransferSubmit = async () => {
    if (!transferEmployeeData) return;
    if (!transferLocationId || !transferDepartmentId) {
      toast({
        variant: "destructive",
        title: "Validation error",
        description: "Target location and department are required."
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await transferEmployee(transferEmployeeData.uuid, {
        working_location_id: transferLocationId,
        department_id: transferDepartmentId,
        reason: transferReason || undefined
      });
      toast({
        title: "Transfer request submitted",
        description: `Transfer request for ${transferEmployeeData.fullName} has been submitted for approval.`
      });
      setTransferEmployeeData(null);
      loadEmployees();
    } catch (error: any) {
      console.error('Failed to submit transfer request:', error);
      toast({
        variant: "destructive",
        title: "Transfer submission failed",
        description: error?.response?.data?.message || "An error occurred while submitting the transfer request."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationChange = async (locationUuid: string) => {
    setNewEmployee(prev => ({ ...prev, working_location_id: locationUuid, department_id: '' }));
    setFilteredDepartments([]);
    if (locationUuid) {
      try {
        const data = await getDepartments(locationUuid);
        setFilteredDepartments(data.departments || (Array.isArray(data) ? data : []));
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    }
  };

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      const [response, timeRecords] = await Promise.all([
        getEmployees(),
        getTimeRecords().catch(() => []),
      ]);
      const employeeList = response.employees || (Array.isArray(response) ? response : []);
      const attendanceByEmployee = new Map<string, any[]>();

      (Array.isArray(timeRecords) ? timeRecords : []).forEach((record: any) => {
        const employeeId = String(record.employee_id ?? record.employee?.id ?? '');
        if (!employeeId) return;
        const existing = attendanceByEmployee.get(employeeId) ?? [];
        existing.push(record);
        attendanceByEmployee.set(employeeId, existing);
      });

      const uniqueEmployees = new Map<string, Employee>();
      employeeList.forEach((item: any) => {
        const employee = mapApiEmployee(item, attendanceByEmployee);
        if (employee.uuid) uniqueEmployees.set(employee.uuid, employee);
      });

      setEmployees([...uniqueEmployees.values()]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Network Connectivity Issue",
        description: "Failed to retrieve employee assets. Retrying in background.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMetadata = async () => {
    getWorkingLocations().then(res => setLocations(res.working_locations || (Array.isArray(res) ? res : []))).catch(() => setLocations([]));
    getDepartments().then(res => {
      const deps = res.departments || (Array.isArray(res) ? res : []);
      setDepartments(deps);
      setFilteredDepartments(deps);
    }).catch(() => { setDepartments([]); setFilteredDepartments([]); });
    getPaymentCategories().then(res => setPaymentCategories(Array.isArray(res) ? res : [])).catch(() => setPaymentCategories([]));
  };

  useEffect(() => {
    loadEmployees();
    loadMetadata();

    // Listen for global system updates (via SSE) to refresh data instantly
    const handleSystemUpdate = (event: any) => {
      if (event.detail?.type === 'employees_updated') {
        console.log('Instant sync: Refreshing employee database...');
        loadEmployees();
      }
    };

    window.addEventListener('system_update', handleSystemUpdate);
    return () => window.removeEventListener('system_update', handleSystemUpdate);
  }, []);

  const handleEditClick = async (emp: Employee) => {
    setEditingEmployee(emp);
    try {
      const structure = await getActivePaymentStructureByEmployee(emp.bigIntId!);
      const allowances = await getAllowances(emp.bigIntId!);
      
      const data = {
        first_name: emp.fullName.split(' ')[0],
        last_name: emp.fullName.split(' ').slice(1).join(' '),
        email: emp.email,
        phone_number: emp.phone_number?.replace('+250', '') || '',
        national_id: emp.national_id || '',
        gender: emp.gender || 'MALE',
        working_location_id: emp.working_location_id || '',
        department_id: emp.department_id || '',
        employment_category_id: emp.employment_category_id || '',
        basic_salary: structure.basic_salary?.toString() || '',
        daily_rate: structure.daily_rate?.toString() || '',
        tax_percentage: structure.tax_percentage?.toString() || '0',
        custom_work_days: structure.custom_work_days?.toString() || '',
        contract_start_date: emp.contract_start_date || '',
        contract_end_date: emp.contract_end_date || '',
        allowance_title: allowances[0]?.title || '',
        allowance_amount: allowances[0]?.amount?.toString() || '',
        allowance_description: allowances[0]?.description || '',
      };
      
      setNewEmployee(data);
      setInitialEmployeeData(data);
      
      if (emp.working_location_id) {
        const data = await getDepartments(emp.working_location_id);
        setFilteredDepartments(data.departments || (Array.isArray(data) ? data : []));
      }
    } catch (error) {
      console.error('Failed to load employee details:', error);
    }
  };

  const handleViewDetails = async (emp: Employee) => {
    setDetailEmployee(emp);
    setDetailLoading(true);
    setDetailStructure(null);
    setDetailAllowances([]);
    setDetailDeductions([]);

    try {
      const [structure, allowances, deductions] = await Promise.all([
        getActivePaymentStructureByEmployee(emp.bigIntId!).catch(() => null),
        getAllowances(emp.bigIntId!).catch(() => []),
        getEmployeeDeductions(emp.bigIntId!).catch(() => []),
      ]);

      setDetailStructure(structure);
      setDetailAllowances(Array.isArray(allowances) ? allowances : []);
      setDetailDeductions(Array.isArray(deductions) ? deductions : []);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshEmployeeDetails = async () => {
    if (!detailEmployee?.bigIntId) return;
    const [structure, allowances, deductions] = await Promise.all([
      getActivePaymentStructureByEmployee(detailEmployee.bigIntId).catch(() => null),
      getAllowances(detailEmployee.bigIntId).catch(() => []),
      getEmployeeDeductions(detailEmployee.bigIntId).catch(() => []),
    ]);

    setDetailStructure(structure);
    setDetailAllowances(Array.isArray(allowances) ? allowances : []);
    setDetailDeductions(Array.isArray(deductions) ? deductions : []);
  };

  const handleDeductionRateUpdate = async (
    deduction: any,
    value: string,
  ) => {
    try {
      const type = deduction.deduction_type;
      await updateDeductionType(type.uuid, {
        deduction_mode: type.deduction_mode,
        amount: type.deduction_mode === 'FIXED' ? value : '0',
        percentage_value: type.deduction_mode === 'PERCENTAGE' ? value : '0',
      });
      await refreshEmployeeDetails();
      toast({ title: 'Deduction updated', description: `${type.name} rate has been updated.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deduction update failed',
        description: error?.response?.data?.message ?? 'Please check the value and try again.',
      });
    }
  };

  const handleEmployeeDeductionToggle = async (
    deduction: any,
    isActive: boolean,
  ) => {
    try {
      await updateEmployeeDeduction(deduction.uuid, { is_active: isActive });
      await refreshEmployeeDetails();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deduction update failed',
        description: error?.response?.data?.message ?? 'Please try again.',
      });
    }
  };

  const getStatusBadge = (status: Employee['status']) => {
    switch (status) {
      case 'ACTIVE': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>;
      case 'SUSPENDED': return <Badge variant="destructive">Suspended</Badge>;
      case 'TERMINATED': return <Badge variant="outline" className="text-muted-foreground">Terminated</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleUpdate = async () => {
    if (!editingEmployee) return;

    // Duplicate prevention on the frontend (pre-flight check)
    const email = newEmployee.email || undefined;
    const phone_number = newEmployee.phone_number ? `+250${newEmployee.phone_number}` : undefined;
    const national_id = newEmployee.national_id;

    const duplicate = employees.find(
      (e) =>
        e.uuid !== editingEmployee.uuid &&
        (
          (email && e.email === email) ||
          (phone_number && e.phone_number === phone_number) ||
          (national_id && e.national_id === national_id)
        ),
    );

    if (duplicate) {
      toast({
        variant: "destructive",
        title: "Duplicate record found",
        description: `Another employee (${duplicate.fullName}) already has this email, phone, or national ID.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCategory = paymentCategories.find(
        (category) =>
          category.id === newEmployee.employment_category_id ||
          category.uuid === newEmployee.employment_category_id,
      );
      const selectedFrequency = selectedCategory?.payroll_frequency;
      
      const submissionData = {
        first_name: newEmployee.first_name,
        last_name: newEmployee.last_name,
        email,
        phone_number,
        national_id,
        gender: newEmployee.gender,
        department_id: newEmployee.department_id || undefined,
        working_location_id: newEmployee.working_location_id || undefined,
        employment_category_id: newEmployee.employment_category_id || undefined,
        basic_salary: newEmployee.basic_salary || undefined,
        daily_rate: newEmployee.daily_rate || undefined,
        tax_percentage: newEmployee.tax_percentage || undefined,
        custom_work_days: newEmployee.custom_work_days ? Number(newEmployee.custom_work_days) : undefined,
        allowance_title: newEmployee.allowance_title || undefined,
        allowance_amount: newEmployee.allowance_amount || undefined,
      };

      await updateEmployee(editingEmployee.id, submissionData);

      const fieldLabels: Record<string, string> = {
        first_name: "First Name",
        last_name: "Last Name",
        email: "Email",
        phone_number: "Phone Number",
        national_id: "National ID",
        gender: "Gender",
        department_id: "Department",
        working_location_id: "Location",
        employment_category_id: "Employment Category",
        basic_salary: "Monthly Salary",
        daily_rate: "Daily Rate",
        tax_percentage: "Tax Percentage",
        custom_work_days: "Contracted Days",
        allowance_title: "Allowance Title",
        allowance_amount: "Allowance Amount",
      };

      const changes = Object.keys(newEmployee)
        .filter((key) => {
          const newVal = String(newEmployee[key as keyof typeof newEmployee] || '');
          const oldVal = String(initialEmployeeData?.[key] || '');
          return newVal !== oldVal;
        })
        .map((key) => fieldLabels[key] || key);

      const changeDescription = changes.length > 0 
        ? `Updated: ${changes.join(', ')}` 
        : "No changes detected, but record was synchronized.";

      if (selectedFrequency) {
        const canAssignAllowance =
          selectedFrequency === 'MONTHLY' ||
          (selectedFrequency === 'CUSTOM' &&
            Number(newEmployee.custom_work_days) > 21);

        if (canAssignAllowance && newEmployee.allowance_title && newEmployee.allowance_amount) {
          const currentAllowances = await getAllowances(editingEmployee.bigIntId!);
          if (currentAllowances.length > 0) {
            await updateAllowance(currentAllowances[0].uuid, {
              title: newEmployee.allowance_title,
              amount: newEmployee.allowance_amount,
              description: newEmployee.allowance_description || undefined,
            });
          } else {
            await createAllowance({
              employee_id: editingEmployee.bigIntId!,
              title: newEmployee.allowance_title,
              amount: newEmployee.allowance_amount,
              description: newEmployee.allowance_description || undefined,
            });
          }
        }
      }

      await loadEmployees();
      toast({ title: "Employee Updated", description: changeDescription });
      setEditingEmployee(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error?.response?.data?.message || "Could not update employee.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!newEmployee.first_name || !newEmployee.last_name || !newEmployee.national_id) {
      toast({ variant: "destructive", title: "Missing Information", description: "Names and National ID are mandatory." });
      return;
    }

    try {
      const selectedCategory = paymentCategories.find(
        (category) =>
          category.id === newEmployee.employment_category_id ||
          category.uuid === newEmployee.employment_category_id,
      );
      const selectedFrequency = selectedCategory?.payroll_frequency;
      const isLocationScopedManager =
        user?.roles?.some((role) =>
          ['BRANCH_MANAGER'].includes(role),
        ) && !user?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));
      const canAssignAllowance =
        selectedFrequency === 'MONTHLY' ||
        (selectedFrequency === 'CUSTOM' &&
          Number(newEmployee.custom_work_days) > 21);
      const submissionData = {
        first_name: newEmployee.first_name,
        last_name: newEmployee.last_name,
        email: newEmployee.email || undefined,
        phone_number: newEmployee.phone_number ? `+250${newEmployee.phone_number}` : undefined,
        national_id: newEmployee.national_id,
        gender: newEmployee.gender,
        contract_start_date: newEmployee.contract_start_date || undefined,
        contract_end_date: newEmployee.contract_end_date || undefined,
        department_id: newEmployee.department_id || undefined,
        employment_category_id: newEmployee.employment_category_id || undefined,
        ...(isLocationScopedManager ? {} : { working_location_id: newEmployee.working_location_id || undefined }),
      };
      const created = await createEmployee(submissionData);
      const createdEmployee = created?.employee ?? created;

      if (createdEmployee?.id && selectedFrequency) {
        await createPaymentStructure({
          employee_id: createdEmployee.id,
          payroll_frequency: selectedFrequency,
          basic_salary: newEmployee.basic_salary || '0',
          daily_rate: newEmployee.daily_rate || '0',
          overtime_rate: '0',
          tax_percentage: newEmployee.tax_percentage || '0',
          custom_work_days: newEmployee.custom_work_days ? Number(newEmployee.custom_work_days) : undefined,
          effective_from: new Date().toISOString().slice(0, 10),
        });

        if (canAssignAllowance && newEmployee.allowance_title && newEmployee.allowance_amount) {
          await createAllowance({
            employee_id: createdEmployee.id,
            title: newEmployee.allowance_title,
            amount: newEmployee.allowance_amount,
            description: newEmployee.allowance_description || undefined,
          });
        }
      }
      await loadEmployees();
      toast({ title: "Employee Created", description: "New employee has been added to the system." });
      setIsAddingEmployee(false);
      setNewEmployee({
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        national_id: '',
        gender: 'MALE',
        working_location_id: '',
        department_id: '',
        employment_category_id: '',
        basic_salary: '',
        daily_rate: '',
        tax_percentage: '0',
        custom_work_days: '',
        contract_start_date: '',
        contract_end_date: '',
        allowance_title: '',
        allowance_amount: '',
        allowance_description: '',
      });
      setFilteredDepartments([]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: error?.response?.data?.message || "Could not create employee.",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await suspendEmployee(deleteId, "Suspended from employee dashboard.");
      await loadEmployees();
      toast({ variant: "destructive", title: "Employee Suspended", description: "The employee record has been updated." });
      setDeleteId(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Employee update failed",
        description: error?.response?.data?.message ?? "Please try again.",
      });
    }
  };

  const filtered = employees.filter((e) => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch =
      e.fullName.toLowerCase().includes(normalizedSearch) ||
      e.employeeId.toLowerCase().includes(normalizedSearch) ||
      e.department.toLowerCase().includes(normalizedSearch) ||
      e.location.toLowerCase().includes(normalizedSearch);

    return (
      matchesSearch &&
      (filters.location === 'ALL' || e.working_location_id === filters.location) &&
      (filters.department === 'ALL' || e.department_id === filters.department) &&
      (filters.category === 'ALL' || e.employment_category_id === filters.category) &&
      (filters.status === 'ALL' || e.status === filters.status)
    );
  });
  const resetFilters = () =>
    setFilters({
      location: 'ALL',
      department: 'ALL',
      category: 'ALL',
      status: 'ALL',
    });
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'ALL').length;
  const selectedCategory = paymentCategories.find(
    (category) =>
      category.id === newEmployee.employment_category_id ||
      category.uuid === newEmployee.employment_category_id,
  );
  const selectedFrequency = selectedCategory?.payroll_frequency;
  const canCreateEmployee = hasPermission('employees.create');
  const canUpdateEmployee = hasPermission('employees.update');
  const isLocationScopedManager =
    user?.roles?.some((role) =>
      ['BRANCH_MANAGER'].includes(role),
    ) && !user?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));

  const handleExport = (type: 'csv' | 'excel') => {
    const sortedData = [...filtered].sort((a, b) => {
      const locComp = a.location.localeCompare(b.location);
      if (locComp !== 0) return locComp;
      const depComp = a.department.localeCompare(b.department);
      if (depComp !== 0) return depComp;
      return a.fullName.localeCompare(b.fullName);
    });

    const exportData = sortedData.map(emp => ({
      'BigInt ID': emp.bigIntId,
      'Full Name': emp.fullName,
      'Email': emp.email,
      'Phone Number': emp.phone_number,
      'Location': emp.location,
      'Department': emp.department,
      'Basic Salary': emp.salary,
      'Allowance': 0, 
      'Tax Deductions': 0, 
      'Status': emp.status
    }));

    if (type === 'csv') exportToCSV(exportData, 'employees');
    else if (type === 'excel') exportToExcel(exportData, 'employees');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Employee Assets</h1>
          <p className="text-muted-foreground">Comprehensive database of all registered corporate personnel.</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 px-6 shadow-sm border-dashed">
                <Download className="mr-2 h-4 w-4" /> Export Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>Export as Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreateEmployee && (
            <Button 
              className="h-11 px-6 shadow-lg shadow-primary/20"
              onClick={() => setIsAddingEmployee(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Create Employee
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by ID, Name, Department..." 
            className="pl-10 h-11 border-none bg-white shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 border-dashed bg-white">
              <Filter className="h-4 w-4" />
              More Filters
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-3">
            <DropdownMenuLabel className="px-0">Working Location</DropdownMenuLabel>
            <select
              aria-label="Filter by working location"
              className="mb-3 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={filters.location}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  location: event.target.value,
                  department: 'ALL',
                }))
              }
            >
              <option value="ALL">All scoped locations</option>
              {locations.map((location) => (
                <option key={location.uuid} value={String(location.id ?? location.uuid)}>
                  {formatDisplayName(location.name)}
                </option>
              ))}
            </select>

            <DropdownMenuLabel className="px-0">Department</DropdownMenuLabel>
            <select
              aria-label="Filter by department"
              className="mb-3 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={filters.department}
              onChange={(event) =>
                setFilters((current) => ({ ...current, department: event.target.value }))
              }
            >
              <option value="ALL">All scoped departments</option>
              {departments
                .filter(
                  (department) =>
                    filters.location === 'ALL' ||
                    String(department.working_location_id) === filters.location,
                )
                .map((department) => (
                  <option key={department.uuid} value={String(department.id ?? department.uuid)}>
                    {formatDisplayName(department.name)}
                  </option>
                ))}
            </select>

            <DropdownMenuLabel className="px-0">Employment Category</DropdownMenuLabel>
            <select
              aria-label="Filter by employment category"
              className="mb-3 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option value="ALL">All categories</option>
              {paymentCategories.map((category) => (
                <option key={category.uuid ?? category.id} value={String(category.id ?? category.uuid)}>
                  {category.name}
                </option>
              ))}
            </select>

            <DropdownMenuLabel className="px-0">Status</DropdownMenuLabel>
            <select
              aria-label="Filter by employee status"
              className="mb-3 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={resetFilters}>Clear filters</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Identity</TableHead>
              <TableHead className="font-bold">Affiliation</TableHead>
              <TableHead className="font-bold">Salary</TableHead>
              <TableHead className="font-bold">Attendance</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20 text-muted-foreground animate-pulse">Synchronizing Personnel Database...</TableCell>
              </TableRow>
            ) : filtered.length > 0 ? filtered.map((emp) => (
              <TableRow key={emp.id} className="hover:bg-secondary/10 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border shadow-sm">
                      <AvatarImage src={getAvatarUrl(emp.avatar_url)} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {emp.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-semibold">{emp.fullName}</span>
                      <span className="text-xs text-muted-foreground">{emp.employeeId}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Building2 className="h-3 w-3 text-muted-foreground" /> {emp.department}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {emp.location}
                    </div>
                    <Badge variant="outline" className="w-fit text-[10px]">
                      {emp.employmentCategory}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-bold">
                    <CreditCard className="h-4 w-4 text-emerald-600" /> {formatRwf(emp.salary)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{emp.attendanceRate}%</span>
                      <span className="text-[10px] text-muted-foreground">
                        {emp.lastAttendanceStatus
                          ? `${emp.lastAttendanceStatus} · ${new Date(emp.lastAttendanceDate ?? '').toLocaleDateString()}`
                          : 'No time records'}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(emp.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canUpdateEmployee && (
                        <DropdownMenuItem onClick={() => handleEditClick(emp)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit Profile
                        </DropdownMenuItem>
                      )}
                      {hasPermission('employees.transfer') && (
                        <DropdownMenuItem onClick={async () => {
                          setTransferEmployeeData(emp);
                          setTransferLocationId(emp.working_location_id || '');
                          setTransferDepartmentId(emp.department_id || '');
                          setTransferReason('');
                          if (emp.working_location_id) {
                            try {
                              const data = await getDepartments(emp.working_location_id);
                              setTransferDepartments(data.departments || (Array.isArray(data) ? data : []));
                            } catch (e) {
                              setTransferDepartments([]);
                            }
                          } else {
                            setTransferDepartments([]);
                          }
                        }}>
                          <MapPin className="mr-2 h-4 w-4" /> Transfer Employee
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleViewDetails(emp)}>
                        <Eye className="mr-2 h-4 w-4" /> View Details
                      </DropdownMenuItem>
                      {hasPermission('employees.suspend') && (
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteId(emp.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Terminate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No employee records found matching your criteria.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Employee Form Sheet (Create/Edit) */}
      <Sheet open={isAddingEmployee || !!editingEmployee} onOpenChange={(open) => {
        if (!open) {
          setIsAddingEmployee(false);
          setEditingEmployee(null);
          setNewEmployee({
            first_name: '',
            last_name: '',
            email: '',
            phone_number: '',
            national_id: '',
            gender: 'MALE',
            working_location_id: '',
            department_id: '',
            employment_category_id: '',
            basic_salary: '',
            daily_rate: '',
            tax_percentage: '0',
            custom_work_days: '',
            contract_start_date: '',
            contract_end_date: '',
            allowance_title: '',
            allowance_amount: '',
            allowance_description: '',
          });
        }
      }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingEmployee ? 'Update Employee' : 'Create New Employee'}</SheetTitle>
            <SheetDescription>
              {editingEmployee 
                ? 'Modify core professional and financial identity of the asset.' 
                : 'Register a new member of the REG Rwanda energy group.'}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input 
                  placeholder="Jean"
                  value={newEmployee.first_name}
                  onChange={e => setNewEmployee(p => ({...p, first_name: e.target.value}))}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input 
                  placeholder="Nshimiyimana"
                  value={newEmployee.last_name}
                  onChange={e => setNewEmployee(p => ({...p, last_name: e.target.value}))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input 
                type="email"
                placeholder="jean@reg.rw"
                value={newEmployee.email}
                onChange={e => setNewEmployee(p => ({...p, email: e.target.value}))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">+250</span>
                <Input 
                  placeholder="788 000 000"
                  value={newEmployee.phone_number}
                  onChange={e => setNewEmployee(p => ({...p, phone_number: e.target.value}))}
                  className="pl-14"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>National ID</Label>
              <Input 
                placeholder="1199..."
                value={newEmployee.national_id}
                onChange={e => setNewEmployee(p => ({...p, national_id: e.target.value}))}
              />
            </div>
            {!isLocationScopedManager && (
              <div className="space-y-2">
                <Label>Location</Label>
                <select 
                  aria-label="Employee location"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={newEmployee.working_location_id}
                  onChange={e => handleLocationChange(e.target.value)}
                >
                  <option value="">Select Location</option>
                  {locations.map(l => <option key={l.uuid} value={l.uuid}>{formatDisplayName(l.name)}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Department</Label>
              <select 
                aria-label="Employee department"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={newEmployee.department_id}
                onChange={e => setNewEmployee(p => ({...p, department_id: e.target.value}))}
                disabled={!isLocationScopedManager && !newEmployee.working_location_id}
              >
                <option value="">{isLocationScopedManager || newEmployee.working_location_id ? "Select Department" : "Select Location First"}</option>
                {filteredDepartments.map(d => <option key={d.uuid} value={d.uuid}>{formatDisplayName(d.name)}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contract Start Date</Label>
                <Input 
                  type="date"
                  value={newEmployee.contract_start_date}
                  onChange={e => setNewEmployee(p => ({...p, contract_start_date: e.target.value}))}
                />
              </div>
              <div className="space-y-2">
                <Label>Contract End Date (Optional)</Label>
                <Input 
                  type="date"
                  value={newEmployee.contract_end_date}
                  onChange={e => setNewEmployee(p => ({...p, contract_end_date: e.target.value}))}
                />
                <p className="text-[10px] text-muted-foreground italic">* For daily/custom employees only. After this date, employee will be paused.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Category</Label>
              <select
                aria-label="Employee payment category"
                className="w-full h-10 px-3 rounded-md border border-input bg-background font-bold text-xs"
                value={newEmployee.employment_category_id}
                onChange={e => setNewEmployee(p => ({ ...p, employment_category_id: e.target.value }))}
              >
                <option value="">Select Category</option>
                {paymentCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedFrequency === 'MONTHLY' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <Label>Monthly Salary (RWF)</Label>
                  <Input
                    type="number"
                    value={newEmployee.basic_salary}
                    onChange={e => setNewEmployee(p => ({ ...p, basic_salary: e.target.value }))}
                    placeholder="e.g. 500000"
                  />
                  <p className="text-[10px] text-muted-foreground italic mt-1">* Fixed monthly payment. Taxes and benefits apply automatically.</p>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Employee Benefits (Allowances)</p>
                  <div className="space-y-2">
                    <Label className="text-emerald-800">Allowance Title</Label>
                    <Input
                      placeholder="e.g. Transport Allowance"
                      value={newEmployee.allowance_title}
                      onChange={e => setNewEmployee(p => ({ ...p, allowance_title: e.target.value }))}
                      className="bg-white border-emerald-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-emerald-800">Allowance Amount (RWF)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 50000"
                      value={newEmployee.allowance_amount}
                      onChange={e => setNewEmployee(p => ({ ...p, allowance_amount: e.target.value }))}
                      className="bg-white border-emerald-200"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedFrequency === 'DAILY' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label>Daily Rate (RWF)</Label>
                <Input
                  type="number"
                  value={newEmployee.daily_rate}
                  onChange={e => setNewEmployee(p => ({ ...p, daily_rate: e.target.value }))}
                  placeholder="e.g. 5000"
                />
                <p className="text-[10px] text-muted-foreground italic mt-1">* Payment calculated as: Daily Rate × Days Worked.</p>
              </div>
            )}

            {selectedFrequency === 'CUSTOM' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Daily Rate (RWF)</Label>
                    <Input
                      type="number"
                      value={newEmployee.daily_rate}
                      onChange={e => setNewEmployee(p => ({ ...p, daily_rate: e.target.value }))}
                      placeholder="e.g. 10000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contracted Days</Label>
                    <Input
                      type="number"
                      value={newEmployee.custom_work_days}
                      onChange={e => setNewEmployee(p => ({ ...p, custom_work_days: e.target.value }))}
                      placeholder="e.g. 30"
                    />
                  </div>
                </div>

                {Number(newEmployee.custom_work_days) > 21 ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-3">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Full Benefits Applied (&gt; 21 Days)</p>
                    <div className="space-y-2">
                      <Label className="text-emerald-800">Allowance Title</Label>
                      <Input
                        placeholder="e.g. Performance Bonus"
                        value={newEmployee.allowance_title}
                        onChange={e => setNewEmployee(p => ({ ...p, allowance_title: e.target.value }))}
                        className="bg-white border-emerald-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-emerald-800">Allowance Amount (RWF)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 50000"
                        value={newEmployee.allowance_amount}
                        onChange={e => setNewEmployee(p => ({ ...p, allowance_amount: e.target.value }))}
                        className="bg-white border-emerald-200"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-600 italic">* Benefits and taxes are only applied for contracts over 21 days.</p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => {
               setIsAddingEmployee(false);
               setEditingEmployee(null);
            }}>Cancel</Button>
            <Button 
              className="flex-[2]" 
              onClick={editingEmployee ? handleUpdate : handleCreate}
              disabled={isSubmitting}
            >
               {isSubmitting ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   {editingEmployee ? 'Updating...' : 'Creating...'}
                 </>
               ) : (
                 editingEmployee ? 'Update Employee' : 'Create Employee'
               )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!detailEmployee} onOpenChange={(open) => {
        if (!open) {
          setDetailEmployee(null);
          setDetailStructure(null);
          setDetailAllowances([]);
          setDetailDeductions([]);
        }
      }}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detailEmployee?.fullName ?? 'Employee'} Details</SheetTitle>
            <SheetDescription>
              Salary structure, allowances, and active deductions for payroll review.
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading employee details...</div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="font-semibold">{detailEmployee?.department}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-semibold">{detailEmployee?.location}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-semibold">{detailEmployee?.phone_number || '-'}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">National ID</p>
                  <p className="font-semibold">{detailEmployee?.national_id || '-'}</p>
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="border-b p-3">
                  <h3 className="font-semibold">Salary Structure</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Payroll Frequency</p>
                    <p className="font-medium">{detailStructure?.payroll_frequency ?? 'Not configured'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Basic Salary</p>
                    <p className="font-medium">{formatRwf(Number(detailStructure?.basic_salary ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Daily Rate</p>
                    <p className="font-medium">{formatRwf(Number(detailStructure?.daily_rate ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Overtime Rate</p>
                    <p className="font-medium">{formatRwf(Number(detailStructure?.overtime_rate ?? 0))}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="border-b p-3">
                  <h3 className="font-semibold">Deduction Types</h3>
                </div>
                <div className="divide-y">
                  {detailDeductions.length > 0 ? detailDeductions.map((deduction) => {
                    const type = deduction.deduction_type;
                    const value = type.deduction_mode === 'FIXED'
                      ? type.amount
                      : type.percentage_value;

                    return (
                      <div key={deduction.uuid} className="grid grid-cols-[1fr_130px_90px] items-end gap-3 p-3">
                        <div>
                          <p className="font-medium">{type.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {type.deduction_mode === 'FIXED' ? 'Fixed amount' : 'Percentage'} · starts {new Date(deduction.start_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Rate</Label>
                          <Input
                            type="number"
                            defaultValue={value}
                            onBlur={(event) => {
                              if (event.target.value !== value) {
                                handleDeductionRateUpdate(deduction, event.target.value);
                              }
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2 pb-2">
                          <Switch
                            checked={deduction.is_active}
                            onCheckedChange={(checked) => handleEmployeeDeductionToggle(deduction, checked)}
                          />
                          <span className="text-xs">{deduction.is_active ? 'Active' : 'Off'}</span>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="p-4 text-sm text-muted-foreground">No deductions assigned.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="border-b p-3">
                  <h3 className="font-semibold">Allowances</h3>
                </div>
                <div className="divide-y">
                  {detailAllowances.length > 0 ? detailAllowances.map((allowance) => (
                    <div key={allowance.uuid} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium">{allowance.title}</p>
                        <p className="text-xs text-muted-foreground">{allowance.description || 'No description'}</p>
                      </div>
                      <p className="font-semibold">{formatRwf(Number(allowance.amount))}</p>
                    </div>
                  )) : (
                    <p className="p-4 text-sm text-muted-foreground">No allowances assigned.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Employment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the employee status to TERMINATED. This action is recorded in the group audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!transferEmployeeData} onOpenChange={(open) => !open && setTransferEmployeeData(null)}>
        <DialogContent className="sm:max-w-[425px] bg-white border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline font-bold">Transfer Employee</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Submit a transfer request for this employee. The transfer requires approval before it is applied.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="rounded-2xl bg-secondary/10 p-4 text-xs space-y-2 border border-secondary/20">
              <p className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Employee details</p>
              <p className="font-bold text-base text-slate-800">{transferEmployeeData?.fullName}</p>
              
              <div className="grid grid-cols-2 gap-4 pt-3 mt-2 border-t border-slate-200/60">
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Current Location</p>
                  <p className="font-bold text-xs text-slate-700 mt-1">{transferEmployeeData?.location || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Current Department</p>
                  <p className="font-bold text-xs text-slate-700 mt-1">{transferEmployeeData?.department || 'Unassigned'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Target Location</Label>
              <select
                aria-label="Target Location"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={transferLocationId}
                onChange={(e) => handleTransferLocationChange(e.target.value)}
              >
                <option value="">Select Location</option>
                {locations.map(l => (
                  <option key={l.uuid} value={l.uuid}>
                    {formatDisplayName(l.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Target Department</Label>
              <select
                aria-label="Target Department"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={transferDepartmentId}
                onChange={(e) => setTransferDepartmentId(e.target.value)}
                disabled={!transferLocationId}
              >
                <option value="">{transferLocationId ? "Select Department" : "Select Location First"}</option>
                {transferDepartments.map(d => (
                  <option key={d.uuid} value={d.uuid}>
                    {formatDisplayName(d.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Reason for Transfer</Label>
              <textarea
                aria-label="Reason for Transfer"
                className="w-full min-h-[90px] p-3 rounded-xl border border-slate-200 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Describe the reason for transfer..."
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={() => setTransferEmployeeData(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button className="rounded-xl bg-primary hover:bg-primary/95" onClick={handleTransferSubmit} disabled={isSubmitting || !transferLocationId || !transferDepartmentId}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Transfer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
