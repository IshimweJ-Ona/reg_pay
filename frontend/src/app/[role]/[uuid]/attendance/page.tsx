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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { userFriendlyError } from '@/lib/error-message';
import { useAuth } from '@/context/auth-context';
import { useAttendanceSync } from '@/context/attendance-sync-context';
import * as XLSX from 'xlsx';
import dayjs, { getRwandaTime } from '@/lib/dayjs';
import { AttendanceSyncPopover } from '@/components/attendance/attendance-sync-popover';

const PRESENT_SYMBOL = 'P';
const ABSENT_SYMBOL = 'A';

// Keys an existing/incoming record by employee + date so we can diff
// the uploaded file against what's already stored, cell by cell.
function recordKey(employeeId: string, attendanceDate: string) {
  return `${employeeId}_${attendanceDate}`;
}

// Normalizes hours for comparison: null/undefined/blank all mean "0".
function normalizedHours(value: any) {
  return Number(value ?? 0);
}

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
  const [importEmployeeType, setImportEmployeeType] = useState<'ALL' | 'MONTHLY' | 'DAILY' | 'CUSTOM'>('ALL');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'excel' | null>(null);
  const [exportPreset, setExportPreset] = useState<'LAST_MONTH' | 'LAST_YEAR' | 'CUSTOM' | 'SINGLE_DAY'>('CUSTOM');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [historyPreset, setHistoryPreset] = useState<'LAST_5_DAYS' | 'LAST_WEEK' | 'LAST_MONTH' | 'LAST_YEAR' | 'CUSTOM'>('LAST_5_DAYS');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
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
      // Optimization: only request the window we actually display (past 5
      // days, excluding today - today comes from getTodayAttendance below)
      // instead of pulling every time_record row in the database.
      const fiveDaysAgo = getRwandaTime().subtract(5, 'day').startOf('day');
      const yesterday = getRwandaTime().subtract(1, 'day').endOf('day');

      const [recs, empsResponse, todayRecs] = await Promise.all([
        getTimeRecords({
          start_date: fiveDaysAgo.format('YYYY-MM-DD'),
          end_date: yesterday.format('YYYY-MM-DD'),
          working_location_id: user?.location,
        }).catch((err) => {
          console.error('Failed to load time records:', err);
          return [];
        }),
        getEmployees().catch((err) => {
          console.error('Failed to load employees:', err);
          return { employees: [] };
        }),
        getTodayAttendance(user?.location, activeTab === 'ALL' ? undefined : activeTab).catch((err) => {
          console.error('Failed to load today attendance:', err);
          return [];
        })
      ]);
      const employeeList = empsResponse.employees || (Array.isArray(empsResponse) ? empsResponse : []);

      const filteredRecs = (Array.isArray(recs) ? recs : [])
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
      const category = rec.employee?.employment_category?.name?.toUpperCase();
      const matchesTab = activeTab === 'ALL' || category === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [records, searchTerm, activeTab]);

  // One row per employee, one column per date - same layout as the bulk
  // import template (employee_id/name/department, then a P/A column per date).
  const historyMatrix = useMemo(() => {
    const dateSet = new Set<string>();
    const employeeMap = new Map<string, {
      employeeId: string;
      name: string;
      department: string;
      statuses: Record<string, string>;
    }>();

    filteredHistory.forEach((rec) => {
      const dateKey = dayjs(rec.attendance_date).tz('Africa/Kigali').format('YYYY-MM-DD');
      dateSet.add(dateKey);

      const empId = rec.employee_id;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employeeId: empId,
          name: `${rec.employee?.first_name ?? ''} ${rec.employee?.last_name ?? ''}`.trim() || empId,
          department: rec.employee?.department?.name ?? 'Unassigned',
          statuses: {},
        });
      }
      employeeMap.get(empId)!.statuses[dateKey] = rec.attendance_status;
    });

    const dates = Array.from(dateSet).sort();
    const rows = Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return { dates, rows };
  }, [filteredHistory]);

  const handleMarkAttendance = (
    employeeId: string,
    status: 'PRESENT' | 'ABSENT',
    hoursWorked?: number,
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
    };

    setPendingSync((prev) => ({ ...prev, [employeeId]: log }));
    toast({ title: 'Logged Locally', description: 'Attendance cached. Use "Sync Now" to finalize.' });
  };

  // Employees filtered by the selected employment category for the template
  const templateEmployees = useMemo(() => {
    if (importEmployeeType === 'ALL') return employees;
    return employees.filter(
      (emp) => (emp.employment_category?.name ?? '').toUpperCase() === importEmployeeType,
    );
  }, [employees, importEmployeeType]);

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

    if (templateEmployees.length === 0) {
      toast({ variant: 'destructive', title: 'No Employees', description: `No ${importEmployeeType === 'ALL' ? '' : importEmployeeType.toLowerCase() + ' '}employees found to generate the template.` });
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
      // D=worked_hours (editable, blank), E=row_status (editable, P/A dropdown),
      // F onward=one column per date
      const DATE_START_COL = 6; // Column F (1-based)
      const ROW_STATUS_COL = 5; // Column E (1-based)

      // ── Header row ──
      const headers = ['employee_id', 'employee_name', 'department', 'worked_hours', 'row_status', ...dates];
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
      templateEmployees.forEach((emp, i) => {
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

        // D: worked_hours (editable, blank)
        const cellD = row.getCell(4);
        cellD.value = '';
        cellD.protection = { locked: false };

        // E: row_status (editable, P/A dropdown)
        const cellE = row.getCell(5);
        cellE.value = '';
        cellE.protection = { locked: false };
        cellE.dataValidation = {
          type: 'list',
          formulae: ['"P,A"'],
          allowBlank: true,
          errorStyle: 'error',
          errorTitle: 'Invalid Entry',
          error: 'Only P (Present) or A (Absent) are allowed.',
        };

        // F onward: date columns with formula =IF($E{row}="","",$E{row})
        // When the user types P/A in row_status (E), Excel evaluates the
        // formula and fills all date cells automatically. On re-import,
        // SheetJS reads either the cached result (if Excel saved it) or
        // the raw formula text. The JS parser below handles both cases:
        // a raw formula string (starts with "=") is treated as blank and
        // falls back to the row_status value, replicating the same logic
        // in JavaScript so the upload never depends on formula evaluation.
        dates.forEach((_, dIdx) => {
          const col = DATE_START_COL + dIdx;
          const cell = row.getCell(col);
          cell.value = { formula: `IF($E$${rowNum}="","",$E$${rowNum})` };
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
      sheet.getColumn(4).width = 16;  // worked_hours
      sheet.getColumn(5).width = 14;  // row_status
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
      const typeSuffix = importEmployeeType === 'ALL' ? '' : `_${importEmployeeType.toLowerCase()}`;
      a.download = `attendance_template_${importDateFrom}_to_${importDateTo}${typeSuffix}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Template Downloaded',
        description: `${templateEmployees.length} ${importEmployeeType === 'ALL' ? '' : importEmployeeType.toLowerCase() + ' '}employee(s) included. Type P/A in row_status (E) to auto-fill all dates, or fill per-date cells individually.`,
      });
    } catch (err) {
      console.error('Template generation error:', err);
      toast({ variant: 'destructive', title: 'Template Error', description: 'Could not generate the template file.' });
    }
  };

  // ── Uploads a filled template. Dates come from the file's own header
  // row (no re-typing a range). Before sending anything to the server,
  // every parsed employee+date cell is diffed against what's already
  // stored: unchanged cells are skipped/rejected client-side, and only
  // genuinely new or changed cells get sent. Re-uploading an unchanged
  // file sends nothing at all. ──
  const handleImportUpload = () => {
    if (!importFile) return;
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
        // D worked_hours, E row_status, F+ dates
        if (headers[0] !== 'employee_id' || headers[1] !== 'employee_name' || headers[2] !== 'department') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Columns A, B, C must be employee_id, employee_name, department.' });
          return;
        }
        if (headers[3] !== 'worked_hours') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Column D must be worked_hours.' });
          return;
        }
        if (headers[4] !== 'row_status') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Column E must be row_status.' });
          return;
        }

        const dateHeaders = headers.slice(5);
        if (dateHeaders.length === 0) {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'No date columns found in template.' });
          return;
        }

        // The template already carries its own date range as column
        // headers — parse it from the file instead of asking the user
        // to retype a range that's already baked in.
        const parsedDateHeaders = dateHeaders.map((h) => dayjs(h, 'DD/MM/YYYY', true));
        const invalidIdx = parsedDateHeaders.findIndex((d) => !d.isValid());
        if (invalidIdx !== -1) {
          toast({ variant: 'destructive', title: 'Import Rejected', description: `Invalid date column header: "${dateHeaders[invalidIdx]}".` });
          return;
        }

        const derivedDateFrom = parsedDateHeaders.reduce((min, d) => (d.isBefore(min) ? d : min));
        const derivedDateTo = parsedDateHeaders.reduce((max, d) => (d.isAfter(max) ? d : max));

        if (raw.length - 1 > 500) {
          toast({ variant: 'destructive', title: 'Too many rows', description: 'Limit is 500 rows. Please split the file.' });
          return;
        }

        const employeeMap = new Map<string, any>();
        employees.forEach((emp) => employeeMap.set(emp.id.toString(), emp));

        const allProcessedLogs: any[] = [];

        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          const rowNum = i + 1;
          const empIdRaw = row[0];
          const employeeNameRaw = row[1];
          const departmentRaw = row[2];
          const workedHrs = row[3];

          if (empIdRaw === undefined || empIdRaw === null || empIdRaw === '') continue;

          let empIdStr = String(empIdRaw).trim();
          empIdStr = empIdStr.replace(/,/g, '');
          if (empIdStr.includes('.')) {
            empIdStr = empIdStr.split('.')[0];
          }

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

          const rowStatusRaw = row[4];
          const rowStatusStr = rowStatusRaw !== undefined && rowStatusRaw !== null ? String(rowStatusRaw).trim().toUpperCase() : '';

          for (let d = 0; d < dateHeaders.length; d++) {
            const dateHeaderRaw = dateHeaders[d];
            const cellValue = row[5 + d]; // date columns start at index 5
            const parsedDate = parsedDateHeaders[d];

            // Convert cell value to string, or empty if missing.
            // If the cell contains a raw Excel formula (starts with "="),
            // treat it as blank — SheetJS cannot evaluate formulas, so we
            // rely on the JS fallback to row_status instead.
            const rawCellStr = cellValue !== undefined && cellValue !== null ? String(cellValue).trim().toUpperCase() : '';
            const cellValueStr = rawCellStr.startsWith('=') ? '' : rawCellStr;

            let activeSymbol = '';
            if (cellValueStr !== '') {
              activeSymbol = cellValueStr;
            } else if (rowStatusStr !== '') {
              activeSymbol = rowStatusStr;
            }

            if (activeSymbol === '') {
              continue;
            }

            // Determine attendance status
            let attendance_status: 'PRESENT' | 'ABSENT';
            let cellHoursWorked = hours_worked;

            if (activeSymbol === PRESENT_SYMBOL) {
              attendance_status = 'PRESENT';
            } else if (activeSymbol === ABSENT_SYMBOL) {
              attendance_status = 'ABSENT';
              cellHoursWorked = undefined;
            } else {
              toast({ variant: 'destructive', title: 'Validation Error', description: `Row ${rowNum}, date "${dateHeaderRaw}": only P or A are allowed (got "${activeSymbol}").` });
              return;
            }

            if (attendance_status === 'ABSENT' && (cellHoursWorked ?? 0) > 0) {
              toast({ variant: 'destructive', title: 'Validation Error', description: `Row ${rowNum}: hours_worked must be blank/0 when marked ABSENT.` });
              return;
            }

            allProcessedLogs.push({
              employee_id: empIdStr,
              attendance_date: parsedDate.format('YYYY-MM-DD'),
              attendance_status,
              hours_worked: cellHoursWorked,
            });
          }
        }

        if (allProcessedLogs.length === 0) {
          toast({ variant: 'destructive', title: 'Nothing to import', description: 'No filled attendance cells found.' });
          return;
        }

        // ── Diff against what's already stored ──
        // Pull the current full set of time records and key them by
        // employee_id + date so each parsed cell can be compared to
        // what's on file. Only cells that are new or genuinely changed
        // get sent; everything identical to what's stored is skipped.
        let existingRecords: any[] = [];
        try {
          const fetched = await getTimeRecords({
            start_date: derivedDateFrom.format('YYYY-MM-DD'),
            end_date: derivedDateTo.format('YYYY-MM-DD'),
          });
          existingRecords = Array.isArray(fetched) ? fetched : [];
        } catch (err) {
          console.error('Failed to fetch existing records for diffing:', err);
          toast({ variant: 'destructive', title: 'Import Failed', description: 'Could not verify existing records before import.' });
          return;
        }

        const existingMap = new Map<string, any>();
        existingRecords.forEach((rec: any) => {
          const dateStr = dayjs(rec.attendance_date).tz('Africa/Kigali').format('YYYY-MM-DD');
          existingMap.set(recordKey(String(rec.employee_id), dateStr), rec);
        });

        const changedLogs: any[] = [];
        let skippedCount = 0;

        for (const log of allProcessedLogs) {
          const existing = existingMap.get(recordKey(log.employee_id, log.attendance_date));

          const isUnchanged =
            existing &&
            existing.attendance_status === log.attendance_status &&
            normalizedHours(existing.hours_worked) === normalizedHours(log.hours_worked);

          if (isUnchanged) {
            skippedCount += 1;
          } else {
            changedLogs.push(log);
          }
        }

        if (changedLogs.length === 0) {
          toast({
            title: 'No Changes Detected',
            description: `All ${allProcessedLogs.length} record(s) already match what's stored. Nothing was imported.`,
          });
          return;
        }

        setLoading(true);
        await bulkCreateTimeRecords({
          date_from: derivedDateFrom.format('YYYY-MM-DD'),
          date_to: derivedDateTo.format('YYYY-MM-DD'),
          records: changedLogs,
        });

        toast({
          title: 'Import Success',
          description: `${changedLogs.length} record(s) imported. ${skippedCount} skipped (no change).`,
        });
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

  // ── Today's live snapshot export (LOG view). No date range needed —
  // this is always "right now". ──
  const handleExport = (type: 'csv' | 'excel') => {
    const dataToExport = filteredEmployees.map(emp => {
      const rec = todayRecordsMap[emp.id];
      return {
        ...emp,
        attendance_status: rec?.attendance_status ?? 'NOT LOGGED',
        attendance_date: todayStr,
        hours_worked: rec?.hours_worked,
      };
    });

    const exportData = dataToExport.map((rec: any) => ({
      Personnel: `${rec.first_name ?? ''} ${rec.last_name ?? ''}`,
      Department: rec.department?.name,
      Category: rec.employment_category?.name,
      Date: dayjs(rec.attendance_date).tz('Africa/Kigali').format('DD/MM/YYYY'),
      Status: rec.attendance_status,
      'Hours Worked': rec.hours_worked ?? '',
    }));

    const dateStr = new Date().toISOString().split('T')[0];
    const path = `REG_Pay/time_records/attendance_export/${dateStr}`;

    if (type === 'csv') exportToCSV(exportData, path);
    else if (type === 'excel') exportToExcel(exportData, path);
  };

  // ── Entry point for the Export dropdown. LOG view exports today's
  // snapshot immediately (no range makes sense there). HISTORY view
  // opens the date-range picker, since "history" is meaningless without
  // choosing a period. ──
  const handleExportClick = (type: 'csv' | 'excel') => {
    if (viewMode === 'LOG') {
      handleExport(type);
      return;
    }
    setExportType(type);
    setExportPreset('CUSTOM');
    setExportDateFrom('');
    setExportDateTo('');
    setIsExportDialogOpen(true);
  };

  // Resolves the History view's active preset into a concrete [from, to]
  // range. Previously the History tab always showed a hardcoded last-5-days
  // window with no way to see further back; this lets the user pick Last
  // Week / Last Month / Last Year, or any custom range, same as the export
  // dialog already allowed for downloads.
  const resolveHistoryRange = (): { from: dayjs.Dayjs; to: dayjs.Dayjs; label: string } | null => {
    const yesterday = getRwandaTime().subtract(1, 'day').endOf('day');
    if (historyPreset === 'LAST_5_DAYS') {
      return { from: getRwandaTime().subtract(5, 'day').startOf('day'), to: yesterday, label: 'Last 5 days' };
    }
    if (historyPreset === 'LAST_WEEK') {
      return { from: getRwandaTime().subtract(7, 'day').startOf('day'), to: yesterday, label: 'Last 7 days' };
    }
    if (historyPreset === 'LAST_MONTH') {
      const from = dayjs().subtract(1, 'month').startOf('month');
      const to = dayjs().subtract(1, 'month').endOf('month');
      return { from, to, label: from.format('MMMM YYYY') };
    }
    if (historyPreset === 'LAST_YEAR') {
      const from = dayjs().subtract(1, 'year').startOf('year');
      const to = dayjs().subtract(1, 'year').endOf('year');
      return { from, to, label: from.format('YYYY') };
    }
    // CUSTOM
    if (!historyDateFrom || !historyDateTo) return null;
    const from = dayjs(historyDateFrom).startOf('day');
    const to = dayjs(historyDateTo).startOf('day');
    return { from, to, label: `${from.format('DD MMM YYYY')} – ${to.format('DD MMM YYYY')}` };
  };

  const fetchHistoryRecords = async () => {
    const range = resolveHistoryRange();
    if (!range) {
      toast({ variant: 'destructive', title: 'Date required', description: 'Please choose a start and end date.' });
      return;
    }
    if (range.to.isBefore(range.from, 'day')) {
      toast({ variant: 'destructive', title: 'Invalid range', description: 'End date must be on or after the start date.' });
      return;
    }
    setHistoryLoading(true);
    try {
      const recs = await getTimeRecords({
        start_date: range.from.format('YYYY-MM-DD'),
        end_date: range.to.format('YYYY-MM-DD'),
        working_location_id: user?.location,
      });
      const sorted = (Array.isArray(recs) ? recs : [])
        .sort((a, b) => dayjs(b.attendance_date).unix() - dayjs(a.attendance_date).unix());
      setRecords(sorted);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to load history', description: userFriendlyError(error, 'Please try again.') });
    } finally {
      setHistoryLoading(false);
    }
  };

  // Resolves the active preset into a concrete [from, to] range.
  const resolveExportRange = (): { from: dayjs.Dayjs; to: dayjs.Dayjs; label: string } | null => {
    if (exportPreset === 'LAST_MONTH') {
      const from = dayjs().subtract(1, 'month').startOf('month');
      const to = dayjs().subtract(1, 'month').endOf('month');
      return { from, to, label: from.format('MMMM YYYY') };
    }
    if (exportPreset === 'LAST_YEAR') {
      const from = dayjs().subtract(1, 'year').startOf('year');
      const to = dayjs().subtract(1, 'year').endOf('year');
      return { from, to, label: from.format('YYYY') };
    }
    if (exportPreset === 'SINGLE_DAY') {
      if (!exportDateFrom) return null;
      const day = dayjs(exportDateFrom).startOf('day');
      return { from: day, to: day, label: day.format('DD MMM YYYY') };
    }
    // CUSTOM
    if (!exportDateFrom || !exportDateTo) return null;
    const from = dayjs(exportDateFrom).startOf('day');
    const to = dayjs(exportDateTo).startOf('day');
    return { from, to, label: `${from.format('DD MMM YYYY')} – ${to.format('DD MMM YYYY')}` };
  };

  // ── History export with a real date range. Fetches the full record
  // set fresh (not the 5-day-limited `records` state), filters by the
  // chosen range, and tells the user plainly if there's nothing there
  // instead of silently exporting an empty file. ──
  const performHistoryExport = async () => {
    if (!exportType) return;

    const range = resolveExportRange();
    if (!range) {
      toast({ variant: 'destructive', title: 'Date required', description: 'Please choose a date or date range.' });
      return;
    }

    if (range.to.isBefore(range.from, 'day')) {
      toast({ variant: 'destructive', title: 'Invalid range', description: 'date_to must be greater than or equal to date_from.' });
      return;
    }

    setLoading(true);
    try {
      const allRecords = await getTimeRecords({
        start_date: range.from.format('YYYY-MM-DD'),
        end_date: range.to.format('YYYY-MM-DD'),
      });
      const recordsInRange = (Array.isArray(allRecords) ? allRecords : []).filter((r: any) => {
        const recDate = dayjs(r.attendance_date).tz('Africa/Kigali').startOf('day');
        return (recDate.isAfter(range.from, 'day') || recDate.isSame(range.from, 'day'))
          && (recDate.isBefore(range.to, 'day') || recDate.isSame(range.to, 'day'));
      });

      if (recordsInRange.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Attendance Records Found',
          description: `No attendance records exist for ${range.label}. If you meant to log attendance for this period, use the Bulk Import button to download a template for these dates.`,
        });
        return;
      }

      const exportData = recordsInRange.map((rec: any) => ({
        Personnel: `${rec.employee?.first_name ?? ''} ${rec.employee?.last_name ?? ''}`.trim() || rec.employee_id,
        Department: rec.employee?.department?.name ?? 'Unassigned',
        Category: rec.employee?.employment_category?.name ?? '',
        Date: dayjs(rec.attendance_date).tz('Africa/Kigali').format('DD/MM/YYYY'),
        Status: rec.attendance_status,
        'Hours Worked': rec.hours_worked ?? '',
      }));

      const fromStr = range.from.format('YYYY-MM-DD');
      const toStr = range.to.format('YYYY-MM-DD');
      const path = `REG_Pay/time_records/attendance_export/${fromStr}_to_${toStr}`;

      if (exportType === 'csv') exportToCSV(exportData, path);
      else exportToExcel(exportData, path);

      setIsExportDialogOpen(false);
    } catch (err) {
      console.error('History export error:', err);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not fetch records for export.' });
    } finally {
      setLoading(false);
    }
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
              <DropdownMenuItem onClick={() => handleExportClick('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportClick('excel')}>Excel</DropdownMenuItem>
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
                      <TableCell colSpan={canLogAttendance ? 4 : 3} className="text-center py-20 text-muted-foreground italic">No employees found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <>
              <div className="flex flex-wrap items-center gap-2 p-4 border-b bg-slate-50/50">
                <span className="text-xs font-bold text-muted-foreground mr-1">Viewing:</span>
                {([
                  ['LAST_5_DAYS', 'Last 5 Days'],
                  ['LAST_WEEK', 'Last 7 Days'],
                  ['LAST_MONTH', 'Last Month'],
                  ['LAST_YEAR', 'Last Year'],
                  ['CUSTOM', 'Custom Range'],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={historyPreset === value ? 'default' : 'outline'}
                    className="h-8 text-xs rounded-lg"
                    onClick={() => setHistoryPreset(value)}
                  >
                    {label}
                  </Button>
                ))}
                {historyPreset === 'CUSTOM' && (
                  <div className="flex items-center gap-2 ml-1">
                    <Input type="date" className="h-8 w-36 text-xs" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input type="date" className="h-8 w-36 text-xs" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} />
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs rounded-lg ml-auto"
                  disabled={historyLoading}
                  onClick={fetchHistoryRecords}
                >
                  {historyLoading ? 'Loading...' : 'Load History'}
                </Button>
              </div>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold sticky left-0 bg-slate-50 z-10 min-w-[180px]">Personnel</TableHead>
                    <TableHead className="font-bold min-w-[140px]">Department</TableHead>
                    {historyMatrix.dates.map((date) => (
                      <TableHead key={date} className="font-bold text-center whitespace-nowrap min-w-[60px]">
                        {dayjs(date).format('DD/MM')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyMatrix.rows.length > 0 ? historyMatrix.rows.map((row) => (
                    <TableRow key={row.employeeId} className="hover:bg-secondary/20 transition-colors">
                      <TableCell className="font-semibold sticky left-0 bg-white z-10">{row.name}</TableCell>
                      <TableCell>{row.department}</TableCell>
                      {historyMatrix.dates.map((date) => {
                        const status = row.statuses[date];
                        return (
                          <TableCell key={date} className="text-center">
                            {status === 'PRESENT' ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-xs">P</span>
                            ) : status === 'ABSENT' ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 font-bold text-xs">A</span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={Math.max(4, 2 + historyMatrix.dates.length)} className="text-center py-20 text-muted-foreground italic">
                        No historical logs found for the selected range. Try a different preset or Load History again.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isImportOpen} onOpenChange={(open) => {
        setIsImportOpen(open);
        if (!open) {
          setImportFile(null);
          setImportEmployeeType('ALL');
        }
      }}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Bulk Import Attendance</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Select a date range to generate a template, or upload a filled template — only rows/dates that changed will be imported.
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

            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800">1. Download Template</p>
                  <p className="text-[10px] text-slate-500">
                    {templateEmployees.length} {importEmployeeType === 'ALL' ? '' : importEmployeeType.toLowerCase() + ' '}employee(s) and selected dates.
                  </p>
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
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">Employee Type</label>
                <Select value={importEmployeeType} onValueChange={(value) => setImportEmployeeType(value as typeof importEmployeeType)}>
                  <SelectTrigger className="h-9 rounded-xl bg-white text-xs">
                    <SelectValue placeholder="Employee type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Employees</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                <p className="text-[10px] text-slate-400 mt-1">Maximum size 5MB · Only changed rows/dates get imported</p>
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
              disabled={!importFile || employees.length === 0}
              className="h-10 rounded-xl text-xs font-semibold px-6 bg-slate-900 text-white hover:bg-slate-800"
            >
              Upload & Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportDialogOpen} onOpenChange={(open) => {
        setIsExportDialogOpen(open);
        if (!open) { setExportType(null); setExportDateFrom(''); setExportDateTo(''); }
      }}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Export Attendance History</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Choose the period you want to export.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={exportPreset === 'LAST_MONTH' ? 'default' : 'outline'}
                className="h-10 rounded-xl text-xs font-semibold"
                onClick={() => setExportPreset('LAST_MONTH')}
              >
                Last Month
              </Button>
              <Button
                type="button"
                variant={exportPreset === 'LAST_YEAR' ? 'default' : 'outline'}
                className="h-10 rounded-xl text-xs font-semibold"
                onClick={() => setExportPreset('LAST_YEAR')}
              >
                Last Year
              </Button>
              <Button
                type="button"
                variant={exportPreset === 'CUSTOM' ? 'default' : 'outline'}
                className="h-10 rounded-xl text-xs font-semibold"
                onClick={() => setExportPreset('CUSTOM')}
              >
                Custom Range
              </Button>
              <Button
                type="button"
                variant={exportPreset === 'SINGLE_DAY' ? 'default' : 'outline'}
                className="h-10 rounded-xl text-xs font-semibold"
                onClick={() => setExportPreset('SINGLE_DAY')}
              >
                Single Day
              </Button>
            </div>

            {exportPreset === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Date From</label>
                  <Input
                    type="date"
                    value={exportDateFrom}
                    onChange={(e) => setExportDateFrom(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Date To</label>
                  <Input
                    type="date"
                    value={exportDateTo}
                    onChange={(e) => setExportDateTo(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
            )}

            {exportPreset === 'SINGLE_DAY' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Date</label>
                <Input
                  type="date"
                  value={exportDateFrom}
                  onChange={(e) => setExportDateFrom(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            )}

            {(exportPreset === 'LAST_MONTH' || exportPreset === 'LAST_YEAR') && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                {exportPreset === 'LAST_MONTH'
                  ? `Exporting: ${dayjs().subtract(1, 'month').format('MMMM YYYY')}`
                  : `Exporting: ${dayjs().subtract(1, 'year').format('YYYY')}`}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsExportDialogOpen(false)}
              className="h-10 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={performHistoryExport}
              disabled={loading}
              className="h-10 rounded-xl text-xs font-semibold px-6 bg-slate-900 text-white hover:bg-slate-800"
            >
              {loading ? 'Exporting...' : 'Export'}
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

  useEffect(() => {
    if (record?.hours_worked) setHoursWorked(Number(record.hours_worked));
  }, [record]);

  const isOvertimeDay = typeof hoursWorked === 'number' && hoursWorked > 8;

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
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="hrs"
            value={hoursWorked}
            onChange={(e) => setHoursWorked(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={!canLogAttendance}
            className="w-24 h-9 text-xs font-mono rounded-lg border-slate-200"
          />
          {isOvertimeDay && (
            <Badge className="bg-amber-500/10 text-amber-600 text-[10px] whitespace-nowrap">+2,500 RWF OT</Badge>
          )}
        </div>
      </TableCell>
      {canLogAttendance && (
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={`h-9 rounded-xl font-bold text-xs ${record?.attendance_status === 'PRESENT' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50 text-emerald-600 border-emerald-100'}`}
              onClick={(e) => { e.preventDefault(); onMark(employee.id, 'PRESENT', hoursWorked || undefined); }}
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