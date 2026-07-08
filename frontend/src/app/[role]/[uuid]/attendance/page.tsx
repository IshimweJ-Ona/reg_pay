"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import ExcelJS from 'exceljs';
import { Search, Download, UserCheck, Clock, AlertTriangle, Upload, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getTimeRecords, bulkCreateTimeRecords, getTodayAttendance } from '@/api/attendance';
import { getEmployees } from '@/api/employees';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportToCSV, exportToExcel } from '@/lib/export-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { useAttendanceSync } from '@/context/attendance-sync-context';
import * as XLSX from 'xlsx';
import dayjs, { getRwandaTime } from '@/lib/dayjs';
import { AttendanceSyncPopover } from '@/components/attendance/attendance-sync-popover';

const PRESENT_SYMBOL = 'P';
const ABSENT_SYMBOL = 'A';

export default function AttendanceMonitoringPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [viewMode, setViewMode] = useState<'LOG' | 'HISTORY'>('LOG');
  const [loading, setLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importDateFrom, setImportDateFrom] = useState('');
  const [importDateTo, setImportDateTo] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();
  const { startSync, syncState, pendingSync, setPendingSync } = useAttendanceSync();

  const canCreateAttendance = hasPermission('attendance.create');
  const canUpdateAttendance = hasPermission('attendance.update');
  const canLogAttendance = canCreateAttendance || canUpdateAttendance;

  const todayStr = getRwandaTime().format('YYYY-MM-DD');

  const fetchData = async () => {
    const startTime = performance.now();
    setLoading(true);
    try {
      const [recs, empsResponse, todayRecs] = await Promise.all([
        getTimeRecords(),
        getEmployees(),
        getTodayAttendance(user?.location, activeTab === 'ALL' ? undefined : activeTab)
      ]);
      const employeeList = empsResponse.employees || (Array.isArray(empsResponse) ? empsResponse : []);

      // Optimization: Filter history to past 5 days (excluding today)
      const fiveDaysAgo = getRwandaTime().subtract(5, 'day').startOf('day');
      const todayStart = getRwandaTime().startOf('day');

      const filteredRecs = (Array.isArray(recs) ? recs : [])
        .filter(r => {
          const recDate = dayjs(r.attendance_date).tz('Africa/Kigali');
          return recDate.isSameOrAfter(fiveDaysAgo) && recDate.isBefore(todayStart);
        })
        .sort((a, b) => dayjs(b.attendance_date).unix() - dayjs(a.attendance_date).unix());

      setRecords(filteredRecs);
      setEmployees(employeeList);

      // Pre-fill today's synced records
      const syncedTodayMap: Record<string, any> = {};
      (todayRecs || []).forEach((r: any) => {
        syncedTodayMap[r.employee_id] = r;
      });
      setRecords(prev => [...prev, ...todayRecs]);

      const duration = (performance.now() - startTime) / 1000;
      console.log(`Fetch completed in ${duration.toFixed(3)}s`);
    } catch (error) {
      const status = (error as any)?.response?.status;
      const msg = status ? `Could not load attendance data (HTTP ${status}).` : 'Could not load attendance data.';
      console.error('Attendance fetch error:', error);
      toast({ variant: 'destructive', title: 'Fetch failed', description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Midnight UI clear check
    const interval = setInterval(() => {
      const now = getRwandaTime();
      if (now.hour() === 0 && now.minute() === 0) {
        setPendingSync({});
        fetchData();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    const logs = Object.values(pendingSync);
    if (logs.length === 0) return;
    try {
      await startSync(logs);
      setPendingSync({});
      fetchData();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const todayRecordsMap = useMemo(() => {
    const map: Record<string, any> = {};
    records.forEach(rec => {
      const recDate = dayjs(rec.attendance_date).tz('Africa/Kigali').format('YYYY-MM-DD');
      if (recDate === todayStr) {
        map[rec.employee_id] = rec;
      }
    });
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

  const handleMarkAttendance = (
    employeeId: string,
    status: 'PRESENT' | 'ABSENT',
    hoursWorked?: number,
    overtimeHours?: number,
  ) => {
    const existing = todayRecordsMap[employeeId];
    if (existing && !canUpdateAttendance) {
      toast({ variant: 'destructive', title: 'Permission denied', description: 'Cannot update existing logs.' });
      return;
    }

    const log = {
      employee_id: employeeId,
      attendance_date: new Date().toISOString(),
      attendance_status: status,
      hours_worked: status === 'PRESENT' ? hoursWorked : undefined,
      overtime_hours: status === 'PRESENT' ? overtimeHours : undefined,
    };

    setPendingSync((prev) => ({ ...prev, [employeeId]: log }));
    toast({ title: 'Logged Locally', description: 'Attendance cached. Use "Sync Now" to finalize.' });
  };

  // ── Downloads a plain .xlsx template built entirely in-memory with ExcelJS ──
  const downloadTemplate = async () => {
    if (!importDateFrom || !importDateTo) {
      if (employees.length === 0) {
        toast({ variant: 'destructive', title: 'No Employees', description: 'No employees found to generate the template.' });
        return;
      }
      toast({ variant: 'destructive', title: 'Date Range Required', description: 'Please select a date range.' });
      return;
    }

    const start = dayjs(importDateFrom);
    const end = dayjs(importDateTo);
    if (end.isBefore(start)) {
      toast({ variant: 'destructive', title: 'Invalid range', description: 'date_to must be greater than or equal to date_from.' });
      return;
    }

    const dates: string[] = [];
    let cur = start;
    while (cur.isSameOrBefore(end, 'day')) {
      dates.push(cur.format('DD/MM/YYYY'));
      cur = cur.add(1, 'day');
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'REG Pay';
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Attendance');

      // ── Column definitions ──
      // A=employee_id (locked), B=employee_name (locked), C=department (locked),
      // D=overtime_hours (editable, blank), E=worked_hours (editable, blank),
      // F=row_status (editable, P/A dropdown), G onward=one column per date
      const DATE_START_COL = 7; // Column G (1-based)
      const ROW_STATUS_COL = 6; // Column F (1-based)

      // ── Header row ──
      const headers = ['employee_id', 'employee_name', 'department', 'overtime_hours', 'worked_hours', 'row_status', ...dates];
      const headerRow = sheet.getRow(1);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
      headerRow.height = 30;

      // ── Data rows ──
      employees.forEach((emp, i) => {
        const rowNum = i + 2;
        const row = sheet.getRow(rowNum);

        // A: employee_id (locked)
        const cellA = row.getCell(1);
        cellA.value = emp.id.toString();
        cellA.protection = { locked: true };

        // B: employee_name (locked)
        const cellB = row.getCell(2);
        cellB.value = `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim();
        cellB.protection = { locked: true };

        // C: department (locked)
        const cellC = row.getCell(3);
        cellC.value = emp.department?.name ?? '';
        cellC.protection = { locked: true };

        // D: overtime_hours (editable, blank)
        const cellD = row.getCell(4);
        cellD.value = '';
        cellD.protection = { locked: false };

        // E: worked_hours (editable, blank)
        const cellE = row.getCell(5);
        cellE.value = '';
        cellE.protection = { locked: false };

        // F: row_status (editable, P/A dropdown)
        const cellF = row.getCell(6);
        cellF.value = '';
        cellF.protection = { locked: false };
        cellF.dataValidation = {
          type: 'list',
          formulae: ['"P,A"'],
          allowBlank: true,
          errorStyle: 'error',
          errorTitle: 'Invalid Entry',
          error: 'Only P (Present) or A (Absent) are allowed.',
        };

        // G onward: date columns with formula =IF($F{row}="","",$F{row})
        dates.forEach((_, dIdx) => {
          const col = DATE_START_COL + dIdx;
          const cell = row.getCell(col);
          cell.value = { formula: `IF($F$${rowNum}="","",$F$${rowNum})` };
          cell.protection = { locked: false };
          cell.dataValidation = {
            type: 'list',
            formulae: ['"P,A"'],
            allowBlank: true,
            errorStyle: 'error',
            errorTitle: 'Invalid Entry',
            error: 'Only P (Present) or A (Absent) are allowed.',
          };
        });
      });

      // ── Column widths ──
      sheet.getColumn(1).width = 14;  // employee_id
      sheet.getColumn(2).width = 30;  // employee_name
      sheet.getColumn(3).width = 25;  // department
      sheet.getColumn(4).width = 16;  // overtime_hours
      sheet.getColumn(5).width = 16;  // worked_hours
      sheet.getColumn(6).width = 14;  // row_status
      dates.forEach((_, dIdx) => {
        sheet.getColumn(DATE_START_COL + dIdx).width = 14;
      });

      // ── Freeze header row ──
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      // ── Protect sheet (required for cell-level locking to take effect) ──
      await sheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertRows: false,
        deleteRows: false,
      });

      // ── Generate buffer and trigger download ──
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_template_${importDateFrom}_to_${importDateTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Template Downloaded',
        description: 'Type P/A in row_status (F) to auto-fill all dates, or fill per-date cells individually.',
      });
    } catch (err) {
      console.error('Template generation error:', err);
      toast({ variant: 'destructive', title: 'Template Error', description: 'Could not generate the template file.' });
    }
  };

  const handleImportUpload = () => {
    if (!importFile) return;
    if (!importDateFrom || !importDateTo) {
      toast({ variant: 'destructive', title: 'Date Range required', description: 'Please select a date range.' });
      return;
    }
    const start = dayjs(importDateFrom);
    const end = dayjs(importDateTo);
    if (end.isBefore(start)) {
      toast({ variant: 'destructive', title: 'Invalid range', description: 'date_to must be greater than or equal to date_from.' });
      return;
    }
    if (importFile.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Max file size is 5MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary', raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!raw || raw.length < 2) {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'File is empty or has no data rows.' });
          return;
        }

        const headers: string[] = raw[0].map((h: any) => String(h ?? '').trim());

        // Column layout: A employee_id, B employee_name, C department,
        // D overtime_hours, E worked_hours, F row_status, G+ dates
        if (headers[0] !== 'employee_id' || headers[1] !== 'employee_name' || headers[2] !== 'department') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Columns A, B, C must be employee_id, employee_name, department.' });
          return;
        }
        if (headers[3] !== 'overtime_hours' || headers[4] !== 'worked_hours') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Columns D and E must be overtime_hours and worked_hours.' });
          return;
        }
        if (headers[5] !== 'row_status') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Column F must be row_status.' });
          return;
        }

        const dateHeaders = headers.slice(6);
        if (dateHeaders.length === 0) {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'No date columns found in template.' });
          return;
        }

        if (raw.length - 1 > 500) {
          toast({ variant: 'destructive', title: 'Too many rows', description: 'Limit is 500 rows. Please split the file.' });
          return;
        }

        const employeeMap = new Map<string, any>();
        employees.forEach((emp) => employeeMap.set(emp.id.toString(), emp));

        const processedLogs: any[] = [];

        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          const rowNum = i + 1;
          const empIdRaw = row[0];
          const employeeNameRaw = row[1];
          const departmentRaw = row[2];
          const overrideOT = row[3];
          const workedHrs = row[4];
          const rowStatus = row[5]; // row_status at index 5

          if (empIdRaw === undefined || empIdRaw === null || empIdRaw === '') continue;

          const empIdStr = String(empIdRaw).trim();
          if (!/^\d+$/.test(empIdStr)) {
            toast({ variant: 'destructive', title: 'Validation Error', description: `Row ${rowNum}: employee_id "${empIdStr}" must be numeric.` });
            return;
          }

          const expectedEmployee = employeeMap.get(empIdStr);
          if (!expectedEmployee) {
            toast({ variant: 'destructive', title: 'Validation Error', description: `Row ${rowNum}: employee_id "${empIdStr}" does not match any employee in the template.` });
            return;
          }

          const employeeNameStr = String(employeeNameRaw ?? '').trim();
          const expectedName = `${expectedEmployee.first_name ?? ''} ${expectedEmployee.last_name ?? ''}`.trim();
          if (employeeNameStr && employeeNameStr !== expectedName) {
            toast({
              variant: 'destructive',
              title: 'Validation Error',
              description: `Row ${rowNum}: employee_name must remain unchanged from the downloaded template. Expected ${expectedName}.`,
            });
            return;
          }

          const expectedDept = expectedEmployee.department?.name ?? '';
          const departmentStr = String(departmentRaw ?? '').trim();
          if (departmentStr && departmentStr !== expectedDept) {
            toast({
              variant: 'destructive',
              title: 'Validation Error',
              description: `Row ${rowNum}: department must remain unchanged from the downloaded template. Expected ${expectedDept || '(none)'}.`,
            });
            return;
          }

          const hours_worked = workedHrs !== '' && workedHrs != null ? Number(workedHrs) : undefined;
          const overtime_hours = overrideOT !== '' && overrideOT != null ? Number(overrideOT) : undefined;

          for (let d = 0; d < dateHeaders.length; d++) {
            const dateHeaderRaw = dateHeaders[d];
            const cellValue = row[6 + d]; // date columns start at index 6

            // Determine attendance status
            let attendance_status: 'PRESENT' | 'ABSENT';
            let cellHoursWorked = hours_worked;
            let cellOvertimeHours = overtime_hours;

            // Empty cell = ABSENT (not recorded)
            if (cellValue === undefined || cellValue === null || cellValue === '') {
              attendance_status = 'ABSENT';
              cellHoursWorked = undefined;
              cellOvertimeHours = undefined;
            } else {
              const symbolValue = String(cellValue).trim();

              if (symbolValue === PRESENT_SYMBOL) {
                attendance_status = 'PRESENT';
              } else if (symbolValue === ABSENT_SYMBOL) {
                attendance_status = 'ABSENT';
                cellHoursWorked = undefined;
                cellOvertimeHours = undefined;
              } else {
                toast({ variant: 'destructive', title: 'Validation Error', description: `Row ${rowNum}, date "${dateHeaderRaw}": only P or A are allowed (got "${symbolValue}").` });
                return;
              }
            }

            if (attendance_status === 'ABSENT' && ((cellHoursWorked ?? 0) > 0 || (cellOvertimeHours ?? 0) > 0)) {
              toast({ variant: 'destructive', title: 'Validation Error', description: `Row ${rowNum}: hours_worked and overtime_hours must be blank/0 when marked ABSENT.` });
              return;
            }

            const parsedDate = dayjs(dateHeaderRaw, 'DD/MM/YYYY');
            if (!parsedDate.isValid()) {
              toast({ variant: 'destructive', title: 'Validation Error', description: `Invalid date column header: "${dateHeaderRaw}".` });
              return;
            }
            if (parsedDate.isBefore(start, 'day') || parsedDate.isAfter(end, 'day')) {
              toast({ variant: 'destructive', title: 'Validation Error', description: `Date "${dateHeaderRaw}" is outside the selected range.` });
              return;
            }

            processedLogs.push({
              employee_id: empIdStr,
              attendance_date: parsedDate.format('YYYY-MM-DD'),
              attendance_status,
              hours_worked: cellHoursWorked,
              overtime_hours: cellOvertimeHours,
            });
          }
        }

        if (processedLogs.length === 0) {
          toast({ variant: 'destructive', title: 'Nothing to import', description: 'No filled attendance cells found.' });
          return;
        }

        setLoading(true);
        await bulkCreateTimeRecords({
          date_from: importDateFrom,
          date_to: importDateTo,
          records: processedLogs,
        });

        toast({ title: 'Import Success', description: `${processedLogs.length} attendance records imported.` });
        setIsImportOpen(false);
        setImportFile(null);
        fetchData();
      } catch (err: any) {
        console.error('Import error:', err);
        const serverErrors = err.response?.data?.errors;
        if (Array.isArray(serverErrors) && serverErrors.length > 0) {
          toast({ variant: 'destructive', title: 'Import Failed (Server)', description: `Row ${serverErrors[0].row}: ${serverErrors[0].message}` });
        } else {
          toast({ variant: 'destructive', title: 'Import Failed (Server)', description: 'An unexpected error occurred while importing.' });
        }
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(importFile);
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
        <div className="flex gap-2 items-center">
          <AttendanceSyncPopover />
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
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
                <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold">{Object.keys(pendingSync).length}</p>
                    {Object.keys(pendingSync).length > 0 && (
                        <Button
                            type="button"
                            size="sm"
                            className="h-8 bg-primary hover:bg-primary/90 text-[10px] font-bold px-3 rounded-lg animate-pulse shadow-lg shadow-primary/20"
                            onClick={(e) => { e.preventDefault(); handleSync(); }}
                            disabled={syncState.isSyncing}
                        >
                            {syncState.isSyncing ? 'Syncing...' : 'Sync Now'}
                        </Button>
                    )}
                </div>
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
                    <TableHead className="font-bold">Hours Worked</TableHead>
                    <TableHead className="font-bold">Overtime Hrs</TableHead>
                    {canLogAttendance && <TableHead className="font-bold text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => {
                    const rec = todayRecordsMap[emp.id];
                    return (
                      <AttendanceRow
                        key={emp.uuid}
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
                    <TableRow key={rec.uuid} className="hover:bg-secondary/20 transition-colors">
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

      <Dialog open={isImportOpen} onOpenChange={(open) => {
        setIsImportOpen(open);
        if (!open) setImportFile(null);
      }}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Bulk Import Attendance</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Select a date range to generate a template or upload your filled template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Date From</label>
                <Input
                  type="date"
                  value={importDateFrom}
                  onChange={(e) => setImportDateFrom(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Date To</label>
                <Input
                  type="date"
                  value={importDateTo}
                  onChange={(e) => setImportDateTo(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800">1. Download Template</p>
                <p className="text-[10px] text-slate-500">Includes all active employees and dates.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={downloadTemplate}
                disabled={!importDateFrom || !importDateTo}
                className="h-9 rounded-xl font-semibold text-xs"
              >
                <Download className="mr-1 h-3.5 w-3.5" /> Download
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">2. Upload Template File</label>
              <div
                className="border-2 border-dashed border-slate-200 hover:border-slate-300 transition-colors rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50"
                onClick={() => {
                  const el = document.getElementById('dialog-file-input');
                  el?.click();
                }}
              >
                <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <p className="text-xs text-slate-600 font-medium">
                  {importFile ? importFile.name : 'Click to select Excel/CSV file'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Maximum size 5MB</p>
                <input
                  id="dialog-file-input"
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xlsm, .xls, .csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImportFile(file);
                  }}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => {
                setIsImportOpen(false);
                setImportFile(null);
              }}
              className="h-10 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportUpload}
              disabled={!importFile || !importDateFrom || !importDateTo || employees.length === 0}
              className="h-10 rounded-xl text-xs font-semibold px-6 bg-slate-900 text-white hover:bg-slate-800"
            >
              Upload & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendanceRow({
  employee,
  record,
  onMark,
  canLogAttendance,
}: {
  employee: any;
  record: any;
  onMark: any;
  canLogAttendance: boolean;
}) {
  const [hoursWorked, setHoursWorked] = useState<number | ''>('');
  const [overtimeHours, setOvertimeHours] = useState<number | ''>('');

  useEffect(() => {
    if (record?.hours_worked) setHoursWorked(Number(record.hours_worked));
    if (record?.overtime_hours) setOvertimeHours(Number(record.overtime_hours));
  }, [record]);

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
          type="number"
          min={0}
          placeholder="hrs"
          value={hoursWorked}
          onChange={(e) => setHoursWorked(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={!canLogAttendance}
          className="w-24 h-9 text-xs font-mono rounded-lg border-slate-200"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={0}
          placeholder="OT hrs"
          value={overtimeHours}
          onChange={(e) => setOvertimeHours(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={!canLogAttendance}
          className="w-24 h-9 text-xs font-mono rounded-lg border-slate-200"
        />
      </TableCell>
      {canLogAttendance && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`h-9 rounded-xl font-bold text-xs ${record?.attendance_status === 'PRESENT' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 text-emerald-600 border-emerald-100'}`}
              onClick={(e) => { e.preventDefault(); onMark(employee.id, 'PRESENT', hoursWorked || undefined, overtimeHours || undefined); }}
            >
              Present
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`h-9 rounded-xl font-bold text-xs ${record?.attendance_status === 'ABSENT' ? 'bg-rose-600 text-white' : 'hover:bg-rose-50 text-rose-600 border-rose-100'}`}
              onClick={(e) => { e.preventDefault(); onMark(employee.id, 'ABSENT'); }}
            >
              Absent
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}