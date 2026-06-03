"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Calendar, Search, Download, UserCheck, Clock, AlertTriangle, CheckCircle2, XCircle, FileSpreadsheet, Upload, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getTimeRecords, createTimeRecord, clockOutTimeRecord, bulkCreateTimeRecords } from '@/api/attendance';
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
import * as XLSX from 'xlsx';

export default function AttendanceMonitoringPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [viewMode, setViewMode] = useState<'LOG' | 'HISTORY'>('LOG');
  const [loading, setLoading] = useState(false);
  const [pendingSync, setPendingSync] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const canCreateAttendance = hasPermission('attendance.create');
  const canUpdateAttendance = hasPermission('attendance.update');
  const canLogAttendance = canCreateAttendance || canUpdateAttendance;

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    const startTime = performance.now();
    setLoading(true);
    try {
      const [recs, empsResponse] = await Promise.all([getTimeRecords(), getEmployees()]);
      const employeeList = empsResponse.employees || (Array.isArray(empsResponse) ? empsResponse : []);
      
      // Optimization: Filter history to past 5 days and sort desc
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      
      const filteredRecs = (Array.isArray(recs) ? recs : [])
        .filter(r => new Date(r.attendance_date) >= fiveDaysAgo)
        .sort((a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime());

      setRecords(filteredRecs);
      setEmployees(employeeList);
      
      const duration = (performance.now() - startTime) / 1000;
      console.log(`Fetch completed in ${duration.toFixed(3)}s`);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fetch failed', description: 'Could not load attendance data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // 15-minute auto-sync
    const interval = setInterval(() => {
        syncPendingLogs();
    }, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const syncPendingLogs = async () => {
    const logs = Object.values(pendingSync);
    if (logs.length === 0) return;

    try {
      await bulkCreateTimeRecords(logs);
      setPendingSync({});
      toast({ title: 'Synced', description: `${logs.length} logs persisted to database.` });
      fetchData();
    } catch (error) {
      console.error('Auto-sync failed', error);
    }
  };

  const todayRecordsMap = useMemo(() => {
    const map: Record<string, any> = {};
    records.forEach(rec => {
      const recDate = new Date(rec.attendance_date).toISOString().split('T')[0];
      if (recDate === todayStr) {
        map[rec.employee_id] = rec;
      }
    });
    // Add pending syncs to map for UI consistency
    Object.values(pendingSync).forEach(ps => {
        map[ps.employee_id] = ps;
    });
    return map;
  }, [records, todayStr, pendingSync]);

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

  const handleMarkAttendance = (employeeId: string, status: 'PRESENT' | 'ABSENT', clockIn?: string, clockOut?: string) => {
    const existing = todayRecordsMap[employeeId];
    if (existing && !canUpdateAttendance) {
      toast({ variant: 'destructive', title: 'Permission denied', description: 'Cannot update existing logs.' });
      return;
    }

    const log = {
        employee_id: employeeId,
        attendance_date: new Date().toISOString(),
        attendance_status: status,
        clock_in: status === 'PRESENT' ? new Date(`${todayStr}T${clockIn}`).toISOString() : undefined,
        clock_out: status === 'PRESENT' ? new Date(`${todayStr}T${clockOut}`).toISOString() : undefined
    };

    setPendingSync(prev => ({ ...prev, [employeeId]: log }));
    toast({ title: 'Logged Locally', description: `Attendance cached. Automatic sync in 15 mins.` });
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Max file size is 5MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);

      if (data.length > 200) {
        toast({ variant: 'destructive', title: 'Too many rows', description: 'files rows aree too many divide file into two' });
        return;
      }

      // Handle duplicates and empty fields
      const processedLogs: any[] = [];
      const seen = new Set();

      data.forEach(row => {
        const empId = row.employee_id || row.EmployeeID;
        if (!empId || seen.has(empId)) return; // Ignore duplicates or empty IDs
        
        seen.add(empId);
        processedLogs.push({
          employee_id: empId,
          attendance_date: todayStr,
          attendance_status: row.status || 'PRESENT',
          clock_in: row.clock_in ? new Date(`${todayStr}T${row.clock_in}`).toISOString() : undefined,
          clock_out: row.clock_out ? new Date(`${todayStr}T${row.clock_out}`).toISOString() : undefined,
        });
      });

      try {
        await bulkCreateTimeRecords(processedLogs);
        toast({ title: 'Import Success', description: `${processedLogs.length} attendance records imported.` });
        fetchData();
      } catch (err) {
        toast({ variant: 'destructive', title: 'Import Failed', description: 'Ensure the file format is correct.' });
      }
    };
    reader.readAsBinaryString(file);
  };

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

    const dateStr = new Date().toISOString().split('T')[0];
    const path = `REG_Pay/time_records/attendance_export/${dateStr}`;

    if (type === 'csv') exportToCSV(exportData, path);
    else if (type === 'excel') exportToExcel(exportData, path);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Attendance Systems</h1>
          <p className="text-muted-foreground">High-performance workforce logging & historical audit.</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleExcelImport} 
          />
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            className="h-11 border-dashed"
          >
            <Upload className="mr-2 h-4 w-4" /> Bulk Import
          </Button>
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
            <History className="mr-2 h-4 w-4" /> 5-Day History
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 shadow-sm"><Download className="mr-2 h-4 w-4" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <UserCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Present</p>
            <p className="text-2xl font-bold">{filteredEmployees.filter(e => todayRecordsMap[e.id]?.attendance_status === 'PRESENT').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pending</p>
            <p className="text-2xl font-bold">{filteredEmployees.length - Object.keys(todayRecordsMap).length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Absent</p>
            <p className="text-2xl font-bold">{filteredEmployees.filter(e => todayRecordsMap[e.id]?.attendance_status === 'ABSENT').length}</p>
          </div>
        </div>
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                <History className="h-6 w-6 text-primary" />
            </div>
            <div>
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Unsynced</p>
                <p className="text-2xl font-bold">{Object.keys(pendingSync).length}</p>
            </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TabsList className="bg-secondary/20 p-1 rounded-xl">
            <TabsTrigger value="ALL" className="rounded-lg font-bold text-xs px-6">All Staff</TabsTrigger>
            <TabsTrigger value="MONTHLY" className="rounded-lg font-bold text-xs px-6">Monthly</TabsTrigger>
            <TabsTrigger value="DAILY" className="rounded-lg font-bold text-xs px-6">Daily</TabsTrigger>
          </TabsList>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter by name..." 
              className="pl-10 h-11 bg-white border-none shadow-sm rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="m-0">
          <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
            {viewMode === 'LOG' ? (
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Personnel</TableHead>
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
                      <TableCell colSpan={canLogAttendance ? 5 : 4} className="text-center py-20 text-muted-foreground italic">No employees found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Personnel</TableHead>
                    <TableHead className="font-bold">Department</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length > 0 ? filteredHistory.map((rec) => (
                    <TableRow key={rec.id} className="hover:bg-secondary/20 transition-colors">
                      <TableCell className="font-semibold">{`${rec.employee?.first_name ?? ''} ${rec.employee?.last_name ?? ''}`.trim() || rec.employee_id}</TableCell>
                      <TableCell>{rec.employee?.department?.name ?? 'Unassigned'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{new Date(rec.attendance_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={
                          rec.attendance_status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600' :
                          'bg-rose-500/10 text-rose-600'
                        }>
                          {rec.attendance_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">No historical logs found (last 5 days).</TableCell>
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
      <TableCell>
        <div className="flex flex-col">
            <span className="font-bold text-slate-800">{employee.first_name} {employee.last_name}</span>
            <span className="text-[10px] text-muted-foreground uppercase">{employee.employment_category?.name || 'DAILY'}</span>
        </div>
      </TableCell>
      <TableCell>
        {record ? (
          <Badge className={record.attendance_status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}>
            {record.attendance_status}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground border-dashed">Awaiting</Badge>
        )}
      </TableCell>
      <TableCell>
        <Input 
          type="time" 
          value={clockIn} 
          onChange={(e) => setClockIn(e.target.value)}
          disabled={!canLogAttendance}
          className="w-28 h-9 text-xs font-mono rounded-lg border-slate-200"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="time" 
          value={clockOut} 
          onChange={(e) => setClockOut(e.target.value)}
          disabled={!canLogAttendance}
          className="w-28 h-9 text-xs font-mono rounded-lg border-slate-200"
        />
      </TableCell>
      {canLogAttendance && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className={`h-9 rounded-xl font-bold text-xs ${record?.attendance_status === 'PRESENT' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 text-emerald-600 border-emerald-100'}`}
              onClick={() => onMark(employee.id, 'PRESENT', clockIn, clockOut)}
            >
              Present
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className={`h-9 rounded-xl font-bold text-xs ${record?.attendance_status === 'ABSENT' ? 'bg-rose-600 text-white' : 'hover:bg-rose-50 text-rose-600 border-rose-100'}`}
              onClick={() => onMark(employee.id, 'ABSENT')}
            >
              Absent
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
