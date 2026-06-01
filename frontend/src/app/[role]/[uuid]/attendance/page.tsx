
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Calendar, Search, Download, UserCheck, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getTimeRecords, createTimeRecord, clockOutTimeRecord } from '@/api/attendance';
import { getEmployees } from '@/api/employees';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportToCSV, exportToExcel } from '@/lib/export-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

export default function AttendanceMonitoringPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [viewMode, setViewMode] = useState<'LOG' | 'HISTORY'>('LOG');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canCreateAttendance = hasPermission('attendance.create');
  const canUpdateAttendance = hasPermission('attendance.update');
  const canLogAttendance = canCreateAttendance || canUpdateAttendance;

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recs, empsResponse] = await Promise.all([getTimeRecords(), getEmployees()]);
      const employeeList = empsResponse.employees || (Array.isArray(empsResponse) ? empsResponse : []);
      setRecords(Array.isArray(recs) ? recs : []);
      setEmployees(employeeList);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fetch failed', description: 'Could not load attendance data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const todayRecordsMap = useMemo(() => {
    const map: Record<string, any> = {};
    records.forEach(rec => {
      const recDate = new Date(rec.attendance_date).toISOString().split('T')[0];
      if (recDate === todayStr) {
        map[rec.employee_id] = rec;
      }
    });
    return map;
  }, [records, todayStr]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const name = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase());
      const category = emp.employment_category?.name?.toUpperCase();
      const matchesTab = activeTab === 'ALL' || category === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [employees, searchTerm, activeTab]);

  const filteredHistory = useMemo(() => {
    return records.filter(rec => {
      const name = `${rec.employee?.first_name ?? ''} ${rec.employee?.last_name ?? ''}`.toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase());
      const category = rec.employee?.payment_structures?.[0]?.payroll_frequency;
      const matchesTab = activeTab === 'ALL' || category === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [records, searchTerm, activeTab]);

  const handleMarkAttendance = async (employeeId: string, status: 'PRESENT' | 'ABSENT', clockIn?: string, clockOut?: string) => {
    try {
      const existing = todayRecordsMap[employeeId];
      if (existing && !canUpdateAttendance) {
        toast({ variant: 'destructive', title: 'Permission denied', description: 'You can view attendance, but cannot update existing logs.' });
        return;
      }

      if (!existing && !canCreateAttendance) {
        toast({ variant: 'destructive', title: 'Permission denied', description: 'You can view attendance, but cannot create new logs.' });
        return;
      }
      
      const attendanceDate = new Date().toISOString();
      const defaultClockIn = new Date();
      defaultClockIn.setHours(9, 0, 0, 0);
      
      const defaultClockOut = new Date();
      defaultClockOut.setHours(17, 0, 0, 0);

      const finalClockIn = clockIn ? new Date(`${todayStr}T${clockIn}`) : defaultClockIn;
      const finalClockOut = clockOut ? new Date(`${todayStr}T${clockOut}`) : defaultClockOut;

      if (existing) {
        // Update existing record (clock out/status)
        await clockOutTimeRecord(existing.uuid, {
          attendance_status: status,
          clock_out: status === 'PRESENT' ? finalClockOut.toISOString() : undefined
        });
      } else {
        // Create new record (clock in)
        await createTimeRecord({
          employee_id: employeeId,
          attendance_date: attendanceDate,
          attendance_status: status,
          clock_in: status === 'PRESENT' ? finalClockIn.toISOString() : undefined
        });
      }
      
      toast({ title: 'Success', description: `Attendance marked as ${status.toLowerCase()}.` });
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to mark attendance.' });
    }
  };

  const presentCount = useMemo(() => records.filter((record) => {
    const recDate = new Date(record.attendance_date).toISOString().split('T')[0];
    return recDate === todayStr && record.attendance_status === 'PRESENT';
  }).length, [records, todayStr]);

  const absentCount = useMemo(() => records.filter((record) => {
    const recDate = new Date(record.attendance_date).toISOString().split('T')[0];
    return recDate === todayStr && record.attendance_status === 'ABSENT';
  }).length, [records, todayStr]);

  const handleExport = (type: 'csv' | 'excel') => {
    const dataToExport = viewMode === 'HISTORY' ? filteredHistory : filteredEmployees.map(emp => {
      const rec = todayRecordsMap[emp.id];
      return {
        ...emp,
        attendance_status: rec?.attendance_status ?? 'NOT LOGGED',
        attendance_date: todayStr,
        clock_in: rec?.clock_in,
        clock_out: rec?.clock_out
      };
    });

    const exportData = dataToExport.map((rec: any) => ({
      Personnel: rec.first_name ? `${rec.first_name} ${rec.last_name}` : `${rec.employee?.first_name ?? ''} ${rec.employee?.last_name ?? ''}`,
      Department: rec.department?.name || rec.employee?.department?.name,
      Category: rec.employment_category?.name || rec.employee?.payment_structures?.[0]?.payroll_frequency,
      Date: new Date(rec.attendance_date).toLocaleDateString(),
      Status: rec.attendance_status
    }));

    if (type === 'csv') exportToCSV(exportData, 'attendance');
    else if (type === 'excel') exportToExcel(exportData, 'attendance');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Attendance Management</h1>
          <p className="text-muted-foreground">Log daily presence or monitor historical trends.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'LOG' ? 'default' : 'outline'} 
            onClick={() => setViewMode('LOG')}
            className="h-11"
          >
            <UserCheck className="mr-2 h-4 w-4" /> Daily Logger
          </Button>
          <Button 
            variant={viewMode === 'HISTORY' ? 'default' : 'outline'} 
            onClick={() => setViewMode('HISTORY')}
            className="h-11"
          >
            <Calendar className="mr-2 h-4 w-4" /> History
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11"><Download className="mr-2 h-4 w-4" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <UserCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Present Today</p>
            <p className="text-2xl font-bold">{presentCount} / {employees.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pending Log</p>
            <p className="text-2xl font-bold">{employees.length - presentCount - absentCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Absent Today</p>
            <p className="text-2xl font-bold">{absentCount}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TabsList className="bg-secondary/20 p-1 rounded-xl">
            <TabsTrigger value="ALL" className="rounded-lg font-bold text-xs px-6">All Staff</TabsTrigger>
            <TabsTrigger value="MONTHLY" className="rounded-lg font-bold text-xs px-6">Monthly</TabsTrigger>
            <TabsTrigger value="DAILY" className="rounded-lg font-bold text-xs px-6">Daily</TabsTrigger>
            <TabsTrigger value="CUSTOM" className="rounded-lg font-bold text-xs px-6">Custom</TabsTrigger>
          </TabsList>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name..." 
              className="pl-10 h-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="m-0">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            {viewMode === 'LOG' ? (
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="font-bold">Personnel</TableHead>
                    <TableHead className="font-bold">Category</TableHead>
                    <TableHead className="font-bold">Status Today</TableHead>
                    <TableHead className="font-bold">Clock In</TableHead>
                    <TableHead className="font-bold">Clock Out</TableHead>
                    {canLogAttendance && <TableHead className="font-bold text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => {
                    const rec = todayRecordsMap[emp.id];
                    return (
                      <AttendanceRow 
                        key={emp.id} 
                        employee={emp} 
                        record={rec} 
                        onMark={handleMarkAttendance} 
                        canLogAttendance={canLogAttendance}
                      />
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={canLogAttendance ? 6 : 5} className="text-center py-20 text-muted-foreground italic">No employees found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className="font-bold">Personnel</TableHead>
                    <TableHead className="font-bold">Department</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Check-In</TableHead>
                    <TableHead className="font-bold">Check-Out</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length > 0 ? filteredHistory.map((rec) => (
                    <TableRow key={rec.id} className="hover:bg-secondary/20 transition-colors">
                      <TableCell className="font-semibold">{`${rec.employee?.first_name ?? ''} ${rec.employee?.last_name ?? ''}`.trim() || rec.employee_id}</TableCell>
                      <TableCell>{rec.employee?.department?.name ?? 'Unassigned'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(rec.attendance_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-xs">{rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{rec.clock_out ? new Date(rec.clock_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</TableCell>
                      <TableCell>
                        <Badge className={
                          rec.attendance_status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                          'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        }>
                          {rec.attendance_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No historical logs found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AttendanceRow({ employee, record, onMark, canLogAttendance }: { employee: any, record: any, onMark: any, canLogAttendance: boolean }) {
  const [clockIn, setClockIn] = useState(record?.clock_in ? new Date(record.clock_in).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit'}) : '09:00');
  const [clockOut, setClockOut] = useState(record?.clock_out ? new Date(record.clock_out).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit'}) : '17:00');

  return (
    <TableRow className="hover:bg-secondary/10 transition-colors">
      <TableCell className="font-semibold">
        {employee.first_name} {employee.last_name}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px] font-bold">
          {employee.employment_category?.name || 'DAILY'}
        </Badge>
      </TableCell>
      <TableCell>
        {record ? (
          <Badge className={record.attendance_status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}>
            {record.attendance_status}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground border-dashed">NOT LOGGED</Badge>
        )}
      </TableCell>
      <TableCell>
        <Input 
          type="time" 
          value={clockIn} 
          onChange={(e) => setClockIn(e.target.value)}
          disabled={!canLogAttendance}
          className="w-32 h-8 text-xs font-mono"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="time" 
          value={clockOut} 
          onChange={(e) => setClockOut(e.target.value)}
          disabled={!canLogAttendance}
          className="w-32 h-8 text-xs font-mono"
        />
      </TableCell>
      {canLogAttendance && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button 
              size="sm" 
              variant={record?.attendance_status === 'PRESENT' ? 'default' : 'outline'}
              className={record?.attendance_status === 'PRESENT' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={() => onMark(employee.id, 'PRESENT', clockIn, clockOut)}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Present
            </Button>
            <Button 
              size="sm" 
              variant={record?.attendance_status === 'ABSENT' ? 'destructive' : 'outline'}
              onClick={() => onMark(employee.id, 'ABSENT')}
            >
              <XCircle className="h-4 w-4 mr-1" /> Absent
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
