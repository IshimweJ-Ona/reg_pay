
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
  MapPin, Building2, CreditCard, Activity, Edit, Trash2, MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useToast } from '@/hooks/use-toast';
import { Employee } from '@/types/employee';
import { getEmployees, suspendEmployee, createEmployee, updateEmployee } from '@/api/employees';
import { getWorkingLocations, getDepartments } from '@/api/working_locations';
import { createAllowance, createPaymentStructure, getPaymentCategories } from '@/api/payment-structures';
import { useAuth } from '@/context/auth-context';

const formatRwf = (value: number) => `RWF ${value.toLocaleString()}`;

function mapApiEmployee(item: any): Employee {
  return {
    id: item.uuid,
    employeeId: item.uuid,
    fullName: `${item.first_name} ${item.last_name}`.trim(),
    department: item.department?.name ?? 'Unassigned',
    location: item.working_location?.name ?? 'Unassigned',
    salary: Number(item.payment_structures?.[0]?.basic_salary ?? 0),
    status: item.status,
    attendanceRate: 0,
    email: item.email ?? '',
  };
}

export default function EmployeeDirectoryPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<any[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<any[]>([]);
  
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
    allowance_title: '',
    allowance_amount: '',
    allowance_description: '',
  });

  const { toast } = useToast();

  const handleLocationChange = async (locationUuid: string) => {
    setNewEmployee(prev => ({ ...prev, working_location_id: locationUuid, department_id: '' }));
    setFilteredDepartments([]);
    if (locationUuid) {
      try {
        const data = await getDepartments(locationUuid);
        setFilteredDepartments(data.departments || []);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await getEmployees();
      const employeeList = response.employees || response;
      setEmployees(employeeList.map(mapApiEmployee));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Employees failed to load",
        description: error?.response?.data?.message ?? "Please check your backend connection.",
      });
    }
  };

  const loadMetadata = async () => {
    try {
      const [locsData, depsData] = await Promise.all([
        getWorkingLocations(),
        getDepartments()
      ]);
      setLocations(locsData.working_locations || []);
      setDepartments(depsData.departments || []);
      setFilteredDepartments(depsData.departments || []);
      setPaymentCategories(await getPaymentCategories().catch(() => []));
    } catch (error) {
      console.error('Failed to load metadata', error);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadMetadata();
  }, []);

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
    try {
      await updateEmployee(editingEmployee.id, {
        first_name: editingEmployee.fullName.split(' ')[0],
        last_name: editingEmployee.fullName.split(' ').slice(1).join(' '),
        email: editingEmployee.email,
      });
      await loadEmployees();
      toast({ title: "Employee Updated", description: "Record has been successfully synchronized." });
      setEditingEmployee(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error?.response?.data?.message || "Could not update employee.",
      });
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
          ['MANAGER', 'ON_MANAGER', 'BRANCH_MANAGER'].includes(role),
        ) && !user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));
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

  const filtered = employees.filter(e => 
    e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const selectedCategory = paymentCategories.find(
    (category) =>
      category.id === newEmployee.employment_category_id ||
      category.uuid === newEmployee.employment_category_id,
  );
  const selectedFrequency = selectedCategory?.payroll_frequency;
  const canAssignAllowance =
    selectedFrequency === 'MONTHLY' ||
    (selectedFrequency === 'CUSTOM' && Number(newEmployee.custom_work_days) > 21);
  const isLocationScopedManager =
    user?.roles?.some((role) =>
      ['MANAGER', 'ON_MANAGER', 'BRANCH_MANAGER'].includes(role),
    ) && !user?.roles?.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Employee Assets</h1>
          <p className="text-muted-foreground">Comprehensive database of all registered corporate personnel.</p>
        </div>
        <Button 
          className="h-11 px-6 shadow-lg shadow-primary/20"
          onClick={() => setIsAddingEmployee(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" /> Create Employee
        </Button>
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
        <Button variant="outline" className="h-11 gap-2 border-dashed bg-white">
          <Filter className="h-4 w-4" /> More Filters
        </Button>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Identity</TableHead>
              <TableHead className="font-bold">Affiliation</TableHead>
              <TableHead className="font-bold">Compensation</TableHead>
              <TableHead className="font-bold">Attendance</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((emp) => (
              <TableRow key={emp.id} className="hover:bg-secondary/10 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {emp.fullName.charAt(0)}
                    </div>
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
                    <span className="text-sm font-medium">{emp.attendanceRate}%</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(emp.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingEmployee(emp)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeleteId(emp.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Terminate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Employee Sheet */}
      <Sheet open={!!editingEmployee} onOpenChange={() => setEditingEmployee(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Update Employee Record</SheetTitle>
            <SheetDescription>Modify core professional and financial identity of the asset.</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                value={editingEmployee?.fullName || ''} 
                onChange={(e) => setEditingEmployee(prev => prev ? {...prev, fullName: e.target.value} : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Corporate Email</Label>
              <Input 
                value={editingEmployee?.email || ''} 
                onChange={(e) => setEditingEmployee(prev => prev ? {...prev, email: e.target.value} : null)}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setEditingEmployee(null)}>Cancel</Button>
            <Button className="flex-[2]" onClick={handleUpdate}>Update Profile</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Employee Sheet */}
      <Sheet open={isAddingEmployee} onOpenChange={setIsAddingEmployee}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create New Employee</SheetTitle>
            <SheetDescription>Register a new member of the REG Rwanda energy group.</SheetDescription>
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
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={newEmployee.working_location_id}
                  onChange={e => handleLocationChange(e.target.value)}
                >
                  <option value="">Select Location</option>
                  {locations.map(l => <option key={l.uuid} value={l.uuid}>{l.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Department</Label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={newEmployee.department_id}
                onChange={e => setNewEmployee(p => ({...p, department_id: e.target.value}))}
                disabled={!isLocationScopedManager && !newEmployee.working_location_id}
              >
                <option value="">{isLocationScopedManager || newEmployee.working_location_id ? "Select Department" : "Select Location First"}</option>
                {filteredDepartments.map(d => <option key={d.uuid} value={d.uuid}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Payment Category</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={newEmployee.employment_category_id}
                onChange={e => setNewEmployee(p => ({ ...p, employment_category_id: e.target.value }))}
              >
                <option value="">Select Payment Category</option>
                {paymentCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.payroll_frequency})
                  </option>
                ))}
              </select>
            </div>
            {selectedFrequency && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{selectedFrequency === 'MONTHLY' ? 'Monthly Salary' : 'Base Salary'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newEmployee.basic_salary}
                    onChange={e => setNewEmployee(p => ({ ...p, basic_salary: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily Rate</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newEmployee.daily_rate}
                    onChange={e => setNewEmployee(p => ({ ...p, daily_rate: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax %</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newEmployee.tax_percentage}
                    onChange={e => setNewEmployee(p => ({ ...p, tax_percentage: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                {selectedFrequency === 'CUSTOM' && (
                  <div className="space-y-2">
                    <Label>Custom Work Days</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newEmployee.custom_work_days}
                      onChange={e => setNewEmployee(p => ({ ...p, custom_work_days: e.target.value }))}
                      placeholder="21"
                    />
                  </div>
                )}
              </div>
            )}
            {canAssignAllowance && (
              <div className="space-y-3 rounded-md border p-3">
                <Label>Allowance</Label>
                <Input
                  placeholder="Allowance title"
                  value={newEmployee.allowance_title}
                  onChange={e => setNewEmployee(p => ({ ...p, allowance_title: e.target.value }))}
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="Amount"
                  value={newEmployee.allowance_amount}
                  onChange={e => setNewEmployee(p => ({ ...p, allowance_amount: e.target.value }))}
                />
                <Input
                  placeholder="Description"
                  value={newEmployee.allowance_description}
                  onChange={e => setNewEmployee(p => ({ ...p, allowance_description: e.target.value }))}
                />
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setIsAddingEmployee(false)}>Cancel</Button>
            <Button className="flex-[2]" onClick={handleCreate}>Create Employee</Button>
          </div>
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
    </div>
  );
}
