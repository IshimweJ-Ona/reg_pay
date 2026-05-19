
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
import { getEmployees, suspendEmployee } from '@/api/employees';

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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadEmployees = async () => {
    try {
      const response = await getEmployees();
      setEmployees(response.map(mapApiEmployee));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Employees failed to load",
        description: error?.response?.data?.message ?? "Please check your backend connection.",
      });
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const getStatusBadge = (status: Employee['status']) => {
    switch (status) {
      case 'ACTIVE': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>;
      case 'SUSPENDED': return <Badge variant="destructive">Suspended</Badge>;
      case 'TERMINATED': return <Badge variant="outline" className="text-muted-foreground">Terminated</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleUpdate = () => {
    if (!editingEmployee) return;
    setEmployees(employees.map(e => e.id === editingEmployee.id ? editingEmployee : e));
    toast({ title: "Employee Updated", description: "Record has been successfully synchronized." });
    setEditingEmployee(null);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Employee Assets</h1>
          <p className="text-muted-foreground">Comprehensive database of all registered corporate personnel.</p>
        </div>
        <Button className="h-11 px-6 shadow-lg shadow-primary/20">
          <UserPlus className="mr-2 h-4 w-4" /> Onboard Employee
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
                    <CreditCard className="h-4 w-4 text-emerald-600" /> ${emp.salary.toLocaleString()}
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
              <Label>Base Salary (USD)</Label>
              <Input 
                type="number" 
                value={editingEmployee?.salary || ''} 
                onChange={(e) => setEditingEmployee(prev => prev ? {...prev, salary: parseInt(e.target.value) || 0} : null)}
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
