"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import ExcelJS from 'exceljs';
import { SearchMd, Download01, Upload01, ClockRewind, Users01 } from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { TableStateRow } from '@/components/layout/page-state';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { getTimeRecords, bulkCreateTimeRecords } from '@/api/attendance';
import { getEmployees } from '@/api/employees';
import { getPositions, type Position } from '@/api/positions';
import { getWorkingLocations, WorkingLocation } from '@/api/working_locations';
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
import { PermissionGate } from '@/components/auth/permission-gate';
import { useToast } from '@/hooks/use-toast';
import { userFriendlyError } from '@/lib/error-message';
import { useAuth } from '@/context/auth-context';
import * as XLSX from 'xlsx';
import dayjs, { getRwandaTime } from '@/lib/dayjs';

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

// Attendance is only ever recorded by downloading a template, filling it in,
// and uploading it back (see downloadTemplate/handleImportUpload below) -
// there is no live per-employee marking UI. This page's only view is the
// History table, filterable by date range, employment category, position,
// and employee.
export default function AttendanceMonitoringPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importDateFrom, setImportDateFrom] = useState('');
  const [importDateTo, setImportDateTo] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importEmployeeType, setImportEmployeeType] = useState<'ALL' | 'MONTHLY' | 'DAILY' | 'CUSTOM'>('ALL');
  const [importPositionId, setImportPositionId] = useState('ALL');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'excel' | null>(null);
  const [exportPreset, setExportPreset] = useState<'LAST_MONTH' | 'LAST_YEAR' | 'CUSTOM' | 'SINGLE_DAY'>('CUSTOM');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [historyPreset, setHistoryPreset] = useState<'LAST_5_DAYS' | 'LAST_WEEK' | 'LAST_MONTH' | 'LAST_YEAR' | 'CUSTOM'>('LAST_5_DAYS');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyEmployeeId, setHistoryEmployeeId] = useState('all');
  const [historyPositionId, setHistoryPositionId] = useState('all');
  const [historyLoadedRange, setHistoryLoadedRange] = useState<{ from: string; to: string; label: string } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [workingLocations, setWorkingLocations] = useState<WorkingLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();

  const canViewAllLocations = hasPermission('branches.read_all');

  // Which location's attendance we're scoped to right now: the explicitly
  // chosen one (cross-location roles), else the signed-in user's own location.
  const activeLocationParam = selectedLocationId || user?.location;

  const fetchData = async () => {
    setLoading(true);
    try {
      // Default landing window: past 5 days through today. This also seeds
      // historyLoadedRange so the History table renders a proper date grid
      // immediately, without requiring a "Load History" click first.
      const fiveDaysAgo = getRwandaTime().subtract(5, 'day').startOf('day');
      const today = getRwandaTime().endOf('day');

      const [recs, empsResponse, positionsRes] = await Promise.all([
        getTimeRecords({
          start_date: fiveDaysAgo.format('YYYY-MM-DD'),
          end_date: today.format('YYYY-MM-DD'),
          working_location_id: activeLocationParam,
        }).catch((err) => {
          console.error('Failed to load time records:', err);
          return [];
        }),
        getEmployees().catch((err) => {
          console.error('Failed to load employees:', err);
          return { employees: [] };
        }),
        getPositions().catch((err) => {
          console.error('Failed to load positions:', err);
          return [];
        }),
      ]);
      const employeeList = empsResponse.employees || (Array.isArray(empsResponse) ? empsResponse : []);

      const sortedRecs = (Array.isArray(recs) ? recs : [])
        .sort((a, b) => dayjs(b.attendance_date).unix() - dayjs(a.attendance_date).unix());

      setRecords(sortedRecs);
      setEmployees(employeeList);
      setPositions(Array.isArray(positionsRes) ? positionsRes : []);
      setHistoryLoadedRange({
        from: fiveDaysAgo.format('YYYY-MM-DD'),
        to: today.format('YYYY-MM-DD'),
        label: 'Last 5 days',
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-location roles get an explicit location picker; everyone else stays
  // implicitly scoped to their own location (current behavior, unchanged).
  useEffect(() => {
    if (!canViewAllLocations) return;
    getWorkingLocations()
      .then((data) => {
        const locations: WorkingLocation[] = data.working_locations || data || [];
        setWorkingLocations(locations);
        const ownLocation = locations.find((loc) => loc.name === user?.location);
        if (ownLocation) setSelectedLocationId(ownLocation.uuid);
      })
      .catch((err) => console.error('Failed to load working locations:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewAllLocations]);

  // Re-fetch whenever the selected location changes.
  useEffect(() => {
    if (!selectedLocationId) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId]);

  const filteredHistory = useMemo(() => {
    return records.filter(rec => {
      const name = `${rec.employee?.first_name ?? ''} ${rec.employee?.last_name ?? ''}`.toLowerCase();
      const matchesSelectedEmployee = historyEmployeeId === 'all' || String(rec.employee_id) === historyEmployeeId || rec.employee?.uuid === historyEmployeeId;
      const matchesSearch = historyEmployeeId !== 'all' || name.includes(searchTerm.toLowerCase());
      const category = rec.employee?.employment_category?.name?.toUpperCase();
      const matchesTab = activeTab === 'ALL' || category === activeTab;
      const matchesPosition = historyPositionId === 'all' || rec.employee?.position?.uuid === historyPositionId;
      return matchesSelectedEmployee && matchesSearch && matchesTab && matchesPosition;
    });
  }, [records, searchTerm, activeTab, historyEmployeeId, historyPositionId]);

  const historyEmployeeOptions = useMemo(() => {
    return employees
      .filter((emp) => {
        const category = emp.employment_category?.name?.toUpperCase();
        const matchesTab = activeTab === 'ALL' || category === activeTab;
        const matchesPosition = historyPositionId === 'all' || emp.position?.uuid === historyPositionId;
        return matchesTab && matchesPosition;
      })
      .sort((a, b) => `${a.first_name ?? ''} ${a.last_name ?? ''}`.localeCompare(`${b.first_name ?? ''} ${b.last_name ?? ''}`));
  }, [employees, activeTab, historyPositionId]);

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

    if (historyLoadedRange) {
      let cursor = dayjs(historyLoadedRange.from).startOf('day');
      const end = dayjs(historyLoadedRange.to).startOf('day');
      while (cursor.isBefore(end, 'day') || cursor.isSame(end, 'day')) {
        dateSet.add(cursor.format('YYYY-MM-DD'));
        cursor = cursor.add(1, 'day');
      }
    }

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

    if (historyLoadedRange && historyEmployeeId !== 'all' && !employeeMap.has(historyEmployeeId)) {
      const emp = employees.find((item) => String(item.id) === historyEmployeeId || item.uuid === historyEmployeeId);
      if (emp) {
        employeeMap.set(historyEmployeeId, {
          employeeId: String(emp.id),
          name: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || String(emp.id),
          department: emp.department?.name ?? emp.departments?.name ?? 'Unassigned',
          statuses: {},
        });
      }
    }

    const dates = Array.from(dateSet).sort();
    const rows = Array.from(employeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return { dates, rows };
  }, [filteredHistory, historyLoadedRange, historyEmployeeId, employees]);

  // Employees filtered by the selected employment category AND position for
  // the template - mirrors the employees bulk-import template's own
  // position + employment_category filtering.
  const templateEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesCategory = importEmployeeType === 'ALL'
        || (emp.employment_category?.name ?? '').toUpperCase() === importEmployeeType;
      const matchesPosition = importPositionId === 'ALL'
        || String(emp.position_id) === importPositionId;
      return matchesCategory && matchesPosition;
    });
  }, [employees, importEmployeeType, importPositionId]);

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
      toast({ variant: 'destructive', title: 'No Employees', description: 'No employees match the selected employment category and position.' });
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
      // D=position (locked), E=working_location (locked), F=overtime_hours
      // (editable, blank), G=row_status (editable, P/A dropdown), H onward=one
      // column per date
      const DATE_START_COL = 8; // Column H (1-based)
      // ── Header row ──
      const headers = ['employee_id', 'employee_name', 'department', 'position', 'working_location', 'overtime_hours', 'row_status', ...dates];
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

        // D: position (locked)
        const cellD = row.getCell(4);
        cellD.value = emp.position?.name ?? '';
        cellD.protection = { locked: true };

        // E: working_location (locked)
        const cellE = row.getCell(5);
        cellE.value = emp.working_location?.name ?? emp.working_locations?.name ?? '';
        cellE.protection = { locked: true };

        // F: overtime_hours (editable, blank)
        const cellF = row.getCell(6);
        cellF.value = '';
        cellF.protection = { locked: false };

        // G: row_status (editable, P/A dropdown)
        const cellG = row.getCell(7);
        cellG.value = '';
        cellG.protection = { locked: false };
        cellG.dataValidation = {
          type: 'list',
          formulae: ['"P,A"'],
          allowBlank: true,
          errorStyle: 'error',
          errorTitle: 'Invalid Entry',
          error: 'Only P (Present) or A (Absent) are allowed.',
        };

        // Date columns mirror row_status (G) via formula so typing P/A once
        // fills the row in Excel. On re-import SheetJS may hand back the raw
        // formula string instead of its cached value, so the parser below
        // treats a leading "=" as blank and falls back to row_status.
        dates.forEach((_, dIdx) => {
          const col = DATE_START_COL + dIdx;
          const cell = row.getCell(col);
          cell.value = { formula: `IF($G$${rowNum}="","",$G$${rowNum})` };
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
      sheet.getColumn(4).width = 20;  // position
      sheet.getColumn(5).width = 25;  // working_location
      sheet.getColumn(6).width = 16;  // overtime_hours
      sheet.getColumn(7).width = 14;  // row_status
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
      const positionSuffix = importPositionId === 'ALL' ? '' : `_${(positions.find(p => p.id === importPositionId)?.name ?? '').toLowerCase().replace(/\s+/g, '-')}`;
      a.download = `attendance_template_${importDateFrom}_to_${importDateTo}${typeSuffix}${positionSuffix}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Template Downloaded',
        description: `${templateEmployees.length} employee(s) included. Type P/A in row_status (G) to auto-fill all dates, or fill per-date cells individually.`,
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
        // D position, E working_location, F overtime_hours, G row_status, H+ dates
        if (headers[0] !== 'employee_id' || headers[1] !== 'employee_name' || headers[2] !== 'department') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Columns A, B, C must be employee_id, employee_name, department.' });
          return;
        }
        if (headers[3] !== 'position') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Column D must be position.' });
          return;
        }
        if (headers[4] !== 'working_location') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Column E must be working_location.' });
          return;
        }
        if (headers[5] !== 'overtime_hours') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Column F must be overtime_hours.' });
          return;
        }
        if (headers[6] !== 'row_status') {
          toast({ variant: 'destructive', title: 'Import Rejected', description: 'Column G must be row_status.' });
          return;
        }

        const dateHeaders = headers.slice(7);
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
          const positionRaw = row[3];
          const workedHrs = row[5];

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

          const expectedPosition = expectedEmployee.position?.name ?? '';
          const positionStr = String(positionRaw ?? '').trim();
          if (positionStr && positionStr !== expectedPosition) {
            toast({
              variant: 'destructive',
              title: 'Validation Error',
              description: `Row ${rowNum}: position must remain unchanged from the downloaded template. Expected ${expectedPosition || '(none)'}.`,
            });
            return;
          }

          const overtimeHours = workedHrs !== '' && workedHrs != null ? Number(workedHrs) : undefined;

          const rowStatusRaw = row[6];
          const rowStatusStr = rowStatusRaw !== undefined && rowStatusRaw !== null ? String(rowStatusRaw).trim().toUpperCase() : '';

          let overtimeAssigned = false;

          for (let d = 0; d < dateHeaders.length; d++) {
            const dateHeaderRaw = dateHeaders[d];
            const cellValue = row[7 + d]; // date columns start at index 7
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
            let cellOvertimeHours: number | undefined = undefined;

            if (activeSymbol === PRESENT_SYMBOL) {
              attendance_status = 'PRESENT';
              if (overtimeHours !== undefined && overtimeHours > 0) {
                if (!overtimeAssigned) {
                  cellOvertimeHours = overtimeHours;
                  overtimeAssigned = true;
                } else {
                  cellOvertimeHours = 0;
                }
              } else if (overtimeHours !== undefined && overtimeHours === 0) {
                cellOvertimeHours = 0;
              }
            } else if (activeSymbol === ABSENT_SYMBOL) {
              attendance_status = 'ABSENT';
              cellOvertimeHours = undefined;
            } else {
              toast({ variant: 'destructive', title: 'Validation Error', description: `Row ${rowNum}, date "${dateHeaderRaw}": only P or A are allowed (got "${activeSymbol}").` });
              return;
            }

            if (attendance_status === 'ABSENT' && (cellOvertimeHours ?? 0) > 0) {
              toast({ variant: 'destructive', title: 'Validation Error', description: `Row ${rowNum}: overtime_hours must be blank/0 when marked ABSENT.` });
              return;
            }

            allProcessedLogs.push({
              employee_id: empIdStr,
              attendance_date: parsedDate.format('YYYY-MM-DD'),
              attendance_status,
              overtime_hours: cellOvertimeHours,
            });
          }
        }

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
            normalizedHours(existing.overtime_hours) === normalizedHours(log.overtime_hours);

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

  // ── Entry point for the Export dropdown. Attendance is history-only now,
  // so this always opens the date-range picker — "history" is meaningless
  // without choosing a period. ──
  const handleExportClick = (type: 'csv' | 'excel') => {
    setExportType(type);
    setExportPreset('CUSTOM');
    setExportDateFrom('');
    setExportDateTo('');
    setIsExportDialogOpen(true);
  };

  // Resolves the History view's active preset into a concrete [from, to]
  // range. Lets the user pick Last 5 Days / Last Week / Last Month / Last
  // Year, or any custom range, same as the export dialog already allows.
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
        working_location_id: activeLocationParam,
        employee_id: historyEmployeeId !== 'all' ? historyEmployeeId : undefined,
      });
      const sorted = (Array.isArray(recs) ? recs : [])
        .sort((a, b) => dayjs(b.attendance_date).unix() - dayjs(a.attendance_date).unix());
      setRecords(sorted);
      setHistoryLoadedRange({
        from: range.from.format('YYYY-MM-DD'),
        to: range.to.format('YYYY-MM-DD'),
        label: range.label,
      });
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
        Position: rec.employee?.position?.name ?? '',
        'Employment Category': rec.employee?.employment_category?.name ?? '',
        Date: dayjs(rec.attendance_date).tz('Africa/Kigali').format('DD/MM/YYYY'),
        Status: rec.attendance_status,
        'Overtime Hours': rec.overtime_hours ?? '',
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
      <PageHeader
        title="Attendance Systems"
        description="Attendance history, filterable by date range, employment category, position, and employee."
        actions={
          <>
            {canViewAllLocations && (
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="h-11 w-[220px] bg-card">
                  <SelectValue placeholder="Select working location" />
                </SelectTrigger>
                <SelectContent>
                  {workingLocations.map((loc) => (
                    <SelectItem key={loc.uuid} value={loc.uuid}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <PermissionGate permission="attendance.create">
              <Button
                variant="outline"
                onClick={() => setIsImportOpen(true)}
                className="h-11 border-dashed"
              >
                <Upload01 className="mr-2 h-4 w-4" size={16} /> Bulk Import
              </Button>
            </PermissionGate>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 shadow-sm"><Download01 className="mr-2 h-4 w-4" size={16} /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExportClick('csv')}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportClick('excel')}>Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          icon={<Users01 className="h-6 w-6" size={24} />}
          label="Employees in view"
          value={historyEmployeeOptions.length}
          tone="primary"
        />
        <StatCard
          icon={<ClockRewind className="h-6 w-6" size={24} />}
          label="Attendance records loaded"
          value={filteredHistory.length}
          tone="accent"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TabsList className="bg-secondary/20 p-1 rounded-lg">
            <TabsTrigger value="ALL" className="rounded-lg font-bold text-xs px-6">All Staff</TabsTrigger>
            <TabsTrigger value="MONTHLY" className="rounded-lg font-bold text-xs px-6">Monthly</TabsTrigger>
            <TabsTrigger value="DAILY" className="rounded-lg font-bold text-xs px-6">Daily</TabsTrigger>
            <TabsTrigger value="CUSTOM" className="rounded-lg font-bold text-xs px-6">Custom</TabsTrigger>
          </TabsList>

          <div className="relative w-full md:w-72">
            <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" size={16} />
            <Input
              placeholder="Filter by name..."
              className="pl-10 h-11 bg-card border border-border shadow-sm rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="m-0">
          <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-4 border-b bg-muted/50">
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
              <div className="w-full sm:w-48">
                <Select value={historyPositionId} onValueChange={setHistoryPositionId}>
                  <SelectTrigger className="h-8 bg-card text-xs">
                    <SelectValue placeholder="All positions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All positions</SelectItem>
                    {positions.map((pos) => (
                      <SelectItem key={pos.uuid} value={pos.uuid}>
                        {pos.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-64">
                <Select value={historyEmployeeId} onValueChange={setHistoryEmployeeId}>
                  <SelectTrigger className="h-8 bg-card text-xs">
                    <SelectValue placeholder="All employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All employees</SelectItem>
                    {historyEmployeeOptions.map((emp) => (
                      <SelectItem key={emp.uuid ?? emp.id} value={String(emp.id)}>
                        {`${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || emp.national_id || 'Unnamed employee'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="font-bold sticky left-0 bg-muted z-10 min-w-[180px]">Full Name</TableHead>
                  <TableHead className="font-bold min-w-[140px]">Department</TableHead>
                  {historyMatrix.dates.map((date) => (
                    <TableHead key={date} className="font-bold text-center whitespace-nowrap min-w-[60px]">
                      {dayjs(date).format('DD/MM')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableStateRow
                    colSpan={Math.max(3, 2 + historyMatrix.dates.length)}
                    tone="info"
                    title="Loading attendance history"
                    description="Preparing records for the selected date range."
                  />
                ) : historyMatrix.rows.length > 0 ? historyMatrix.rows.map((row) => (
                  <TableRow key={row.employeeId} className="hover:bg-secondary/20 transition-colors">
                    <TableCell className="font-semibold sticky left-0 bg-card z-10">{row.name}</TableCell>
                    <TableCell>{row.department}</TableCell>
                    {historyMatrix.dates.map((date) => {
                      const status = row.statuses[date];
                      return (
                        <TableCell key={date} className="text-center">
                          {status === 'PRESENT' ? (
                            <StatusBadge tone="success" label={PRESENT_SYMBOL} className="px-1.5 py-0" />
                          ) : status === 'ABSENT' ? (
                            <StatusBadge tone="destructive" label={ABSENT_SYMBOL} className="px-1.5 py-0" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                )) : (
                  <TableStateRow
                    colSpan={Math.max(3, 2 + historyMatrix.dates.length)}
                    title="No historical logs found"
                    description="Try another date preset, widen the range, or use Bulk Import to record attendance for this period."
                  />
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isImportOpen} onOpenChange={(open) => {
        setIsImportOpen(open);
        if (!open) {
          setImportFile(null);
          setImportEmployeeType('ALL');
          setImportPositionId('ALL');
        }
      }}>
        <DialogContent className="max-w-md bg-card rounded-lg p-6 border shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Bulk Import Attendance</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Select a date range to generate a template, or upload a filled template — only rows/dates that changed will be imported. This is the only way to record attendance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Date From</label>
                <Input
                  type="date"
                  value={importDateFrom}
                  onChange={(e) => setImportDateFrom(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Date To</label>
                <Input
                  type="date"
                  value={importDateTo}
                  onChange={(e) => setImportDateTo(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-2 bg-muted p-4 rounded-lg border border-border">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground">1. Download Template</p>
                  <p className="text-[10px] text-muted-foreground">
                    {templateEmployees.length} employee(s) and selected dates.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={downloadTemplate}
                  disabled={!importDateFrom || !importDateTo}
                  className="h-9 rounded-lg font-semibold text-xs"
                >
                  <Download01 className="mr-1 h-3.5 w-3.5" size={14} /> Download
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Employment Category</label>
                  <Select value={importEmployeeType} onValueChange={(value) => setImportEmployeeType(value as typeof importEmployeeType)}>
                    <SelectTrigger className="h-9 rounded-lg bg-card text-xs">
                      <SelectValue placeholder="Employment category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Position</label>
                  <Select value={importPositionId} onValueChange={setImportPositionId}>
                    <SelectTrigger className="h-9 rounded-lg bg-card text-xs">
                      <SelectValue placeholder="Position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Positions</SelectItem>
                      {positions.map((position) => (
                        <SelectItem key={position.uuid ?? position.id} value={String(position.id)}>{position.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">2. Upload Template File</label>
              <div
                className="border-2 border-dashed border-border hover:border-muted-foreground/30 transition-colors rounded-lg p-6 text-center cursor-pointer bg-muted/50"
                onClick={() => {
                  const el = document.getElementById('dialog-file-input');
                  el?.click();
                }}
              >
                <Upload01 className="mx-auto h-8 w-8 text-muted-foreground mb-2" size={32} />
                <p className="text-xs text-foreground font-medium">
                  {importFile ? importFile.name : 'Click to select Excel/CSV file'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Maximum size 5MB · Only changed rows/dates get imported</p>
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
              className="h-10 rounded-lg text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportUpload}
              disabled={!importFile || employees.length === 0}
              className="h-10 rounded-lg text-xs font-semibold px-6 bg-primary hover:bg-primary/90"
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
        <DialogContent className="max-w-md bg-card rounded-lg p-6 border shadow-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Export Attendance History</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Choose the period you want to export.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={exportPreset === 'LAST_MONTH' ? 'default' : 'outline'}
                className="h-10 rounded-lg text-xs font-semibold"
                onClick={() => setExportPreset('LAST_MONTH')}
              >
                Last Month
              </Button>
              <Button
                type="button"
                variant={exportPreset === 'LAST_YEAR' ? 'default' : 'outline'}
                className="h-10 rounded-lg text-xs font-semibold"
                onClick={() => setExportPreset('LAST_YEAR')}
              >
                Last Year
              </Button>
              <Button
                type="button"
                variant={exportPreset === 'CUSTOM' ? 'default' : 'outline'}
                className="h-10 rounded-lg text-xs font-semibold"
                onClick={() => setExportPreset('CUSTOM')}
              >
                Custom Range
              </Button>
              <Button
                type="button"
                variant={exportPreset === 'SINGLE_DAY' ? 'default' : 'outline'}
                className="h-10 rounded-lg text-xs font-semibold"
                onClick={() => setExportPreset('SINGLE_DAY')}
              >
                Single Day
              </Button>
            </div>

            {exportPreset === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Date From</label>
                  <Input
                    type="date"
                    value={exportDateFrom}
                    onChange={(e) => setExportDateFrom(e.target.value)}
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Date To</label>
                  <Input
                    type="date"
                    value={exportDateTo}
                    onChange={(e) => setExportDateTo(e.target.value)}
                    className="h-10 rounded-lg"
                  />
                </div>
              </div>
            )}

            {exportPreset === 'SINGLE_DAY' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={exportDateFrom}
                  onChange={(e) => setExportDateFrom(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
            )}

            {(exportPreset === 'LAST_MONTH' || exportPreset === 'LAST_YEAR') && (
              <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
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
              className="h-10 rounded-lg text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={performHistoryExport}
              disabled={loading}
              className="h-10 rounded-lg text-xs font-semibold px-6 bg-primary hover:bg-primary/90"
            >
              {loading ? 'Exporting...' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
