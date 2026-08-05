
"use client";

import React, { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SearchMd, FilterFunnel01, UserPlus01, Eye, Users01,
  MarkerPin01, Building02, BankNote01, Activity, Edit05, UserX01, DotsVertical,
  Loading02, Download01, Upload01
} from '@untitledui/icons';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Employee } from '@/types/employee';
import { getEmployees, suspendEmployee, createEmployee, updateEmployee, transferEmployee } from '@/api/employees';
import { getTimeRecordsByEmployee } from '@/api/attendance';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  createAllowance,
  updateAllowance,
  getAllowances,
  createEmployeeDeduction,
  getDeductionTypes,
  getEmployeeDeductions,
  createPaymentStructure, 
  getPaymentCategories,
  getActivePaymentStructureByEmployee,
  updateEmployeeDeduction,
} from '@/api/payment-structures';
import { useAuth } from '@/context/auth-context';
import { userFriendlyError } from '@/lib/error-message';
import { exportToCSV, exportToExcel } from '@/lib/export-utils';
import { bulkImportEmployees } from '@/api/employees';
import { getMonthlyTaxes, MonthlyTax } from '@/api/system-config';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const formatRwf = (value: number) => `RWF ${value.toLocaleString()}`;

function mapApiEmployee(item: any, attendanceByEmployee = new Map<string, any[]>()): Employee {
  const structure = item.payment_structures?.[0] || {};
  const payrollFrequency = structure.payroll_frequency ?? item.employment_category?.payroll_frequency;
  const salary =
    payrollFrequency === 'MONTHLY'
      ? Number(structure.basic_salary ?? 0)
      : Number(structure.daily_rate ?? structure.basic_salary ?? 0);
  const timeRecords = attendanceByEmployee.get(String(item.id)) ?? item.time_records ?? [];
  const presentCount = timeRecords.filter((record: any) => record.attendance_status === 'PRESENT').length;
  const latestRecord = [...timeRecords].sort(
    (a, b) =>
      new Date(b.attendance_date ?? b.created_at).getTime() -
      new Date(a.attendance_date ?? a.created_at).getTime(),
  )[0];
  const activeTaxes = (item.employee_deductions ?? [])
    .filter((deduction: any) => deduction.is_active)
    .map((deduction: any) => {
      const type = deduction.deduction_type ?? deduction.deduction_types;
      return {
        deduction_type_id: String(deduction.deduction_type_id ?? type?.id ?? ''),
        name: type?.name ?? 'Tax',
        rate: type?.percentage_value != null ? Number(type.percentage_value) : undefined,
      };
    })
    .filter((tax: any) => tax.deduction_type_id);

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
    attendanceRate: Number(item.attendance_stats?.rate ?? (timeRecords.length ? Math.round((presentCount / timeRecords.length) * 100) : 0)),
    lastAttendanceDate: item.attendance_stats?.last_date ?? latestRecord?.attendance_date,
    lastAttendanceStatus: item.attendance_stats?.last_status ?? latestRecord?.attendance_status,
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
    pause_reason: item.pause_reason ?? '',
    activeTaxIds: activeTaxes.map((tax: any) => tax.deduction_type_id),
    activeTaxes,
  };
}

const getDaysBetween = (startStr?: string, endStr?: string) => {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr);
  const end = new Date(endStr);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = end.getTime() - start.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
  return days > 0 ? days : 0;
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const normalizeTaxName = (name?: string) =>
  String(name ?? '').toLowerCase().replace(/[^a-z]/g, '');

const isPitTaxName = (name?: string) => {
  const normalized = normalizeTaxName(name);
  return normalized === 'pit' || normalized.includes('personalincometax') || normalized.includes('paye');
};

export default function EmployeeDirectoryPage() {
  const { user, hasPermission } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailStructure, setDetailStructure] = useState<any | null>(null);
  const [detailAllowances, setDetailAllowances] = useState<any[]>([]);
  const [detailAttendance, setDetailAttendance] = useState<any[]>([]);
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
  const [transferLocations, setTransferLocations] = useState<any[]>([]);
  
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<any[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<any[]>([]);
  const [monthlyTaxes, setMonthlyTaxes] = useState<MonthlyTax[]>([]);
  const [deductionTypes, setDeductionTypes] = useState<any[]>([]);
  const [editDeductions, setEditDeductions] = useState<any[]>([]);
  const [detailDeductions, setDetailDeductions] = useState<any[]>([]);
  const [selectedTaxDeductionTypeIds, setSelectedTaxDeductionTypeIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    location: 'ALL',
    department: 'ALL',
    category: 'ALL',
    tax: 'ALL',
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
    contract_start_date: '',
    contract_end_date: '',
    contracted_days: '',
    allowance_title: '',
    allowance_amount: '',
    allowance_description: '',
  });

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importingBulk, setImportingBulk] = useState(false);

  const { toast } = useToast();

  const isBranchManagerActor = Boolean(
    user && user.role !== 'SUPER_ADMIN' &&
    ((user.roles && user.roles.includes('BRANCH_MANAGER')) || user.role === 'BRANCH_MANAGER'),
  );
  const canManageDeductions = hasPermission('deductions.manage');
  const canReadPaymentStructures = hasPermission('payment-structures.read') || canManageDeductions;
  const monthlyCategories = paymentCategories.filter((c: any) => c.payroll_frequency === 'MONTHLY');
  const dailyOrCustomCategories = paymentCategories.filter((c: any) => c.payroll_frequency !== 'MONTHLY');

  // The backend only ever uses ONE of these two columns depending on the
  // employee's employment category (see employees.service.ts bulkImport):
  // - MONTHLY categories: daily_rate is auto-computed from basic_salary
  //   (basic_salary / working days), so a daily_rate column is meaningless.
  // - DAILY / CUSTOM categories: basic_salary is either unused (DAILY) or
  //   derived from daily_rate x contract days (CUSTOM), so a basic_salary
  //   column is meaningless.
  // Splitting the template by frequency instead of offering one sheet with
  // both columns avoids people filling in a column that's silently ignored.
  const handleDownloadTemplate = async (frequencyGroup: 'MONTHLY' | 'DAILY_CUSTOM') => {
    const relevantCategories = frequencyGroup === 'MONTHLY' ? monthlyCategories : dailyOrCustomCategories;

    if (relevantCategories.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No matching employment categories',
        description: frequencyGroup === 'MONTHLY'
          ? 'There are no Monthly employment categories set up yet.'
          : 'There are no Daily or Custom employment categories set up yet.',
      });
      return;
    }

    // Branch managers create employees only in their own branch (the backend
    // auto-assigns working_location_id, see employees.service.ts bulkImport),
    // so no working_location column is needed for them. `/departments` is
    // already branch-scoped server-side for non-super-admins, so no extra
    // filtering is needed here either.
    const relevantDepartments = departments;

    const headers = [
      'first_name', 'last_name', 'email', 'phone_number', 'national_id',
      'gender', 'contract_start_date', 'contract_end_date',
      ...(isBranchManagerActor ? [] : ['working_location']),
      'department', 'employment_category',
      ...(frequencyGroup === 'MONTHLY' ? ['basic_salary'] : ['daily_rate']),
    ];

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'REG Pay';
      workbook.created = new Date();

      // --- The only sheet the user ever needs to touch or upload ---------
      const sheet = workbook.addWorksheet('Employees');

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
      headerRow.height = 26;
      headers.forEach((_, i) => { sheet.getColumn(i + 1).width = 22; });
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      const colOf = (name: string) => headers.indexOf(name) + 1; // 1-based; 0 means absent
      const genderCol = colOf('gender');
      const departmentCol = colOf('department');
      const categoryCol = colOf('employment_category');
      const locationCol = colOf('working_location'); // 0 for branch managers
      const startDateCol = colOf('contract_start_date');
      const endDateCol = colOf('contract_end_date');

      // --- Hidden lookup sheet the dropdowns above pull their options from.
      // It's "veryHidden" (not just "hidden"), so it never appears as a tab
      // in Excel at all — there is nothing to fill in or upload except the
      // "Employees" sheet. It automatically reflects whatever departments /
      // employment categories / branches currently exist, so a department
      // added today shows up in the dropdown the next time this template is
      // downloaded.
      const listSheet = workbook.addWorksheet('Lists', { state: 'veryHidden' });
      const departmentNames = relevantDepartments.map((d: any) => d.name).filter(Boolean);
      const categoryNames = relevantCategories.map((c: any) => c.name).filter(Boolean);
      const locationNames = isBranchManagerActor ? [] : locations.map((l: any) => l.name).filter(Boolean);
      listSheet.getCell(1, 1).value = 'department';
      listSheet.getCell(1, 2).value = 'employment_category';
      listSheet.getCell(1, 3).value = 'working_location';
      departmentNames.forEach((name: string, i: number) => { listSheet.getCell(i + 2, 1).value = name; });
      categoryNames.forEach((name: string, i: number) => { listSheet.getCell(i + 2, 2).value = name; });
      locationNames.forEach((name: string, i: number) => { listSheet.getCell(i + 2, 3).value = name; });

      // --- Pre-format enough blank rows for a full import (matches the
      // backend's 500-row cap) with real dropdowns and a real date picker,
      // so most mistakes are caught by Excel itself before the file is ever
      // uploaded. ---
      const ROWS = 500;
      const minDate = new Date(2000, 0, 1);
      const maxDate = new Date(2100, 11, 31);

      for (let r = 2; r <= ROWS + 1; r++) {
        const row = sheet.getRow(r);

        if (genderCol) {
          row.getCell(genderCol).dataValidation = {
            type: 'list',
            formulae: ['"MALE,FEMALE"'],
            allowBlank: true,
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Invalid gender',
            error: 'Please pick MALE or FEMALE from the dropdown.',
          };
        }

        if (departmentCol && departmentNames.length > 0) {
          row.getCell(departmentCol).dataValidation = {
            type: 'list',
            formulae: [`Lists!$A$2:$A$${departmentNames.length + 1}`],
            allowBlank: true,
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Unknown department',
            error: 'Please pick a department from the dropdown — it must already exist in the system.',
          };
        }

        if (categoryCol && categoryNames.length > 0) {
          row.getCell(categoryCol).dataValidation = {
            type: 'list',
            formulae: [`Lists!$B$2:$B$${categoryNames.length + 1}`],
            allowBlank: true,
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Unknown employment category',
            error: 'Please pick an employment category from the dropdown — it must already exist in the system.',
          };
        }

        if (locationCol && locationNames.length > 0) {
          row.getCell(locationCol).dataValidation = {
            type: 'list',
            formulae: [`Lists!$C$2:$C$${locationNames.length + 1}`],
            allowBlank: true,
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Unknown branch',
            error: 'Please pick a branch from the dropdown — it must already exist in the system.',
          };
        }

        for (const dateCol of [startDateCol, endDateCol]) {
          if (!dateCol) continue;
          const cell = row.getCell(dateCol);
          cell.numFmt = 'yyyy-mm-dd';
          cell.dataValidation = {
            type: 'date',
            operator: 'between',
            formulae: [minDate, maxDate],
            allowBlank: true,
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Invalid date',
            error: 'Our system only accepts real dates in YYYY-MM-DD format (e.g. 2026-01-31). Please enter a valid date.',
            showInputMessage: true,
            promptTitle: 'Date format',
            prompt: 'Enter the date as YYYY-MM-DD, e.g. 2026-01-31.',
          };
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = frequencyGroup === 'MONTHLY'
        ? 'employee_bulk_import_template_monthly.xlsx'
        : 'employee_bulk_import_template_daily_custom.xlsx';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Template downloaded',
        description: `Fill in the "Employees" sheet only — first_name and last_name are the only required columns. Use the dropdowns for gender, department, employment category${isBranchManagerActor ? '' : ' and branch'}, and the date fields for contract dates (YYYY-MM-DD). This template only lists ${frequencyGroup === 'MONTHLY' ? 'Monthly' : 'Daily and Custom'} employment categories — use the other template for the rest.`,
      });
    } catch (err) {
      console.error('Template generation error:', err);
      toast({ variant: 'destructive', title: 'Template Error', description: 'Could not generate the template file.' });
    }
  };

  const handleBulkImport = async () => {
    if (!importFile) {
      toast({ variant: "destructive", title: "No file selected", description: "Please select an Excel/CSV file to import." });
      return;
    }
    setImportingBulk(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          // cellDates: true makes cells that Excel stored as real dates
          // (contract_start_date / contract_end_date, filled via the
          // template's date pickers) come back as JS Date objects instead
          // of raw serial numbers like 46052.
          const wb = XLSX.read(evt.target?.result, { type: 'binary', raw: false, cellDates: true });
          // The template's only fillable/uploadable tab is "Employees" — a
          // hidden "Lists" sheet backs its dropdowns but is never meant to
          // be read here. Fall back to the first sheet for older templates
          // or hand-built files that don't use that sheet name.
          const sheetName = wb.SheetNames.includes('Employees') ? 'Employees' : wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          if (!raw || raw.length < 2) {
            toast({ variant: "destructive", title: "Import Rejected", description: "File is empty or has no data rows." });
            setImportingBulk(false);
            return;
          }

          const headers: string[] = raw[0].map((h: any) => String(h ?? '').trim().toLowerCase());

          // Expected columns: first_name, last_name, email, phone_number, national_id, gender,
          // contract_start_date, contract_end_date, department_id, working_location_id,
          // employment_category_id, basic_salary, daily_rate, tax_percentage
          const employeeItems: any[] = [];
          const skippedRows: string[] = [];

          for (let i = 1; i < raw.length; i++) {
            const row = raw[i];
            if (!row || row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '')) continue; // fully blank row, ignore silently

            const item: any = {};
            headers.forEach((header: string, idx: number) => {
              const cellValue = row[idx];
              if (!header || cellValue === undefined || cellValue === null || cellValue === '') return;
              // A real Excel date (from the template's date-picker columns)
              // arrives as a JS Date here — convert it to the plain
              // YYYY-MM-DD string our system expects instead of stringifying
              // the Date object itself.
              item[header] = cellValue instanceof Date
                ? cellValue.toISOString().split('T')[0]
                : String(cellValue).trim();
            });

            if (item.first_name && item.last_name) {
              employeeItems.push(item);
            } else {
              // The row has SOME data but is missing a required field — say so
              // instead of quietly dropping it, so it doesn't look like the
              // person's entry just disappeared.
              skippedRows.push(`Row ${i + 1}: missing ${!item.first_name && !item.last_name ? 'first_name and last_name' : !item.first_name ? 'first_name' : 'last_name'}.`);
            }
          }

          if (employeeItems.length === 0) {
            toast({ variant: "destructive", title: "No valid data", description: "No rows with first_name and last_name found." });
            setImportingBulk(false);
            return;
          }

          if (skippedRows.length > 0) {
            toast({
              variant: "destructive",
              title: `${skippedRows.length} row(s) are missing required fields`,
              description: `${skippedRows.slice(0, 3).join(' ')}${skippedRows.length > 3 ? ` (+${skippedRows.length - 3} more)` : ''} Fix these rows and re-upload — no rows were imported.`,
            });
            setImportingBulk(false);
            return;
          }

          if (employeeItems.length > 500) {
            toast({ variant: "destructive", title: "Too many records", description: "Maximum 500 employees per import." });
            setImportingBulk(false);
            return;
          }

          // Translate the human-friendly "department" / "employment_category" /
          // "working_location" name columns (from the downloadable template)
          // into the department_id / employment_category_id / working_location_id
          // fields the API expects. Raw *_id columns (uuid or numeric) are left
          // untouched for power users who fill those in directly instead.
          const rowErrors: string[] = [];
          employeeItems.forEach((item, idx) => {
            const rowNum = idx + 1;

            // Branch managers never need to supply this — the backend
            // auto-assigns their own working_location_id regardless of what
            // (if anything) is sent, and the template omits this column for
            // them entirely.
            let resolvedWorkingLocationId: string | undefined = item.working_location_id;
            if (item.working_location && !item.working_location_id) {
              const match = locations.find(
                (l: any) => String(l.name).trim().toLowerCase() === String(item.working_location).trim().toLowerCase(),
              );
              if (match) {
                resolvedWorkingLocationId = String(match.uuid ?? match.id);
                item.working_location_id = resolvedWorkingLocationId;
              } else {
                rowErrors.push(`Row ${rowNum}: branch "${item.working_location}" was not found.`);
              }
              delete item.working_location;
            }

            // Departments are created one-per-branch and can share the same
            // name across different branches, so a name match must be
            // scoped to the row's resolved branch (or, for a branch
            // manager, `departments` is already scoped server-side to just
            // their own branch — see the comment on `relevantDepartments`
            // above).
            if (item.department && !item.department_id) {
              const candidates = resolvedWorkingLocationId
                ? departments.filter((d: any) => String(d.working_location_id) === String(resolvedWorkingLocationId) || d.working_location?.uuid === resolvedWorkingLocationId)
                : departments;
              const match = candidates.find(
                (d: any) => String(d.name).trim().toLowerCase() === String(item.department).trim().toLowerCase(),
              );
              if (match) {
                item.department_id = String(match.uuid ?? match.id);
              } else {
                rowErrors.push(`Row ${rowNum}: department "${item.department}" was not found${resolvedWorkingLocationId ? ' for the given branch' : ''}.`);
              }
              delete item.department;
            }

            if (item.employment_category && !item.employment_category_id) {
              const match = paymentCategories.find(
                (c: any) => String(c.name).trim().toLowerCase() === String(item.employment_category).trim().toLowerCase(),
              );
              if (match) {
                item.employment_category_id = String(match.uuid ?? match.id);
              } else {
                rowErrors.push(`Row ${rowNum}: employment category "${item.employment_category}" was not found.`);
              }
              delete item.employment_category;
            }

            // Format validation: catch obviously-wrong values here with a
            // specific, human-readable reason, instead of letting them
            // reach the backend as a generic 400 that doesn't say which
            // row or field was the problem.
            if (item.gender) {
              const normalized = String(item.gender).trim().toUpperCase();
              if (normalized !== 'MALE' && normalized !== 'FEMALE') {
                rowErrors.push(`Row ${rowNum}: gender "${item.gender}" must be exactly MALE or FEMALE.`);
              } else {
                item.gender = normalized;
              }
            }

            const datePattern = /^\d{4}-\d{2}-\d{2}$/;
            for (const dateField of ['contract_start_date', 'contract_end_date']) {
              const value = item[dateField];
              if (!value) continue;
              const isValidCalendarDate = datePattern.test(value) && !Number.isNaN(new Date(value).getTime());
              if (!isValidCalendarDate) {
                rowErrors.push(
                  `Row ${rowNum}: ${dateField} "${value}" is not in the format our system uses. Our system only accepts dates as YYYY-MM-DD (e.g. 2026-01-31).`,
                );
              }
            }

            // A contract can't end before (or the same day) it starts —
            // catch this here with the exact row number instead of letting
            // it fail as a generic error once it reaches the server.
            if (
              item.contract_start_date &&
              item.contract_end_date &&
              datePattern.test(item.contract_start_date) &&
              datePattern.test(item.contract_end_date) &&
              new Date(item.contract_end_date).getTime() <= new Date(item.contract_start_date).getTime()
            ) {
              rowErrors.push(
                `Row ${rowNum}: contract_end_date "${item.contract_end_date}" must be later than contract_start_date "${item.contract_start_date}".`,
              );
            }

            for (const numField of ['basic_salary', 'daily_rate', 'tax_percentage']) {
              if (item[numField] && Number.isNaN(Number(item[numField]))) {
                rowErrors.push(`Row ${rowNum}: ${numField} "${item[numField]}" must be a plain number (no currency symbols or commas).`);
              }
            }

            if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
              rowErrors.push(`Row ${rowNum}: email "${item.email}" doesn't look like a valid email address.`);
            }
          });

          // Duplicate national_id / email WITHIN the file — the backend
          // would reject these anyway on the second occurrence, but with a
          // less specific message. Flag both rows involved up front.
          const seenNationalIds = new Map<string, number>();
          const seenEmails = new Map<string, number>();
          employeeItems.forEach((item, idx) => {
            const rowNum = idx + 1;
            if (item.national_id) {
              const key = String(item.national_id).trim();
              if (seenNationalIds.has(key)) {
                rowErrors.push(`Row ${rowNum}: national_id "${key}" is a duplicate of row ${seenNationalIds.get(key)}.`);
              } else {
                seenNationalIds.set(key, rowNum);
              }
            }
            if (item.email) {
              const key = String(item.email).trim().toLowerCase();
              if (seenEmails.has(key)) {
                rowErrors.push(`Row ${rowNum}: email "${key}" is a duplicate of row ${seenEmails.get(key)}.`);
              } else {
                seenEmails.set(key, rowNum);
              }
            }
          });

          if (rowErrors.length > 0) {
            toast({
              variant: "destructive",
              title: `${rowErrors.length} issue(s) found — nothing was imported`,
              description: `${rowErrors.slice(0, 3).join(' ')}${rowErrors.length > 3 ? ` (+${rowErrors.length - 3} more)` : ''} Fix these in the "Employees" sheet and re-upload.`,
            });
            setImportingBulk(false);
            return;
          }

          const result = await bulkImportEmployees({ employees: employeeItems });
          
          if (result.errors && result.errors.length > 0) {
            toast({
              title: `Imported ${result.imported}/${result.total}`,
              description: `${result.errors.length} row(s) had errors. Check the first error: ${result.errors[0].message}`,
            });
          } else {
            toast({
              title: "Bulk Import Complete",
              description: `${result.imported} employees imported successfully.`,
            });
          }
          
          setIsBulkImportOpen(false);
          setImportFile(null);
          loadEmployees();
        } catch (err: any) {
          toast({ variant: "destructive", title: "Import Failed", description: userFriendlyError(err, "Could not process the file.") });
        } finally {
          setImportingBulk(false);
        }
      };
      reader.readAsBinaryString(importFile);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Import Failed", description: userFriendlyError(error, "Could not read the file.") });
      setImportingBulk(false);
    }
  };

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
        description: userFriendlyError(error, "An error occurred while submitting the transfer request.")
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
      const response = await getEmployees();
      const employeeList = response.employees || (Array.isArray(response) ? response : []);
      const attendanceByEmployee = new Map<string, any[]>();

      const uniqueEmployees = new Map<string, Employee>();
      employeeList.forEach((item: any) => {
        const employee = mapApiEmployee(item, attendanceByEmployee);
        if (employee.uuid) uniqueEmployees.set(employee.uuid, employee);
      });

      setEmployees([...uniqueEmployees.values()]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: error?.code === 'ECONNABORTED' ? "Employee List Timeout" : "Employee List Failed",
        description: userFriendlyError(error, "Could not retrieve employees. Please refresh or try again."),
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
    getMonthlyTaxes()
      .then((res) => {
        setMonthlyTaxes(Array.isArray(res) ? res : []);
        if (canReadPaymentStructures) {
          return getDeductionTypes()
            .then((types) => setDeductionTypes(Array.isArray(types) ? types : []))
            .catch(() => setDeductionTypes([]));
        }
        setDeductionTypes([]);
      })
      .catch(() => {
        setMonthlyTaxes([]);
        setDeductionTypes([]);
      });
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
    setEditDeductions([]);
    setSelectedTaxDeductionTypeIds([]);
    try {
      const [structure, allowances, deductions] = await Promise.all([
        getActivePaymentStructureByEmployee(emp.bigIntId!),
        getAllowances(emp.bigIntId!),
        canManageDeductions
          ? getEmployeeDeductions(emp.bigIntId!).catch(() => [])
          : Promise.resolve([]),
      ]);
      
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
        contract_start_date: emp.contract_start_date || '',
        contract_end_date: emp.contract_end_date || '',
        contracted_days: '',
        allowance_title: allowances[0]?.title || '',
        allowance_amount: allowances[0]?.amount?.toString() || '',
        allowance_description: allowances[0]?.description || '',
      };
      
      setNewEmployee(data);
      setInitialEmployeeData(data);
      setEditDeductions(Array.isArray(deductions) ? deductions : []);
      setSelectedTaxDeductionTypeIds(
        (Array.isArray(deductions) ? deductions : [])
          .filter((deduction: any) => deduction.is_active)
          .map((deduction: any) =>
            String(deduction.deduction_type_id ?? deduction.deduction_type?.id ?? ''),
          )
          .filter(Boolean),
      );
      
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
    setDetailAttendance([]);

    try {
      const [structure, allowances, deductions, attendance] = await Promise.all([
        getActivePaymentStructureByEmployee(emp.bigIntId!).catch(() => null),
        getAllowances(emp.bigIntId!).catch(() => []),
        getEmployeeDeductions(emp.bigIntId!).catch(() => []),
        getTimeRecordsByEmployee(emp.bigIntId!).catch(() => []),
      ]);

      setDetailStructure(structure);
      setDetailAllowances(Array.isArray(allowances) ? allowances : []);
      setDetailDeductions(Array.isArray(deductions) ? deductions : []);
      setDetailAttendance(Array.isArray(attendance) ? attendance : []);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshEditDeductions = async (employeeId: string) => {
    if (!canManageDeductions) return;
    const deductions = await getEmployeeDeductions(employeeId).catch(() => []);
    setEditDeductions(Array.isArray(deductions) ? deductions : []);
  };

  const handleEditDeductionToggle = async (
    deduction: any,
    isActive: boolean,
  ) => {
    if (!editingEmployee?.bigIntId) return;
    try {
      await updateEmployeeDeduction(deduction.uuid, { is_active: isActive });
      const deductionTypeId = String(
        deduction.deduction_type_id ?? deduction.deduction_type?.id ?? '',
      );
      if (deductionTypeId) {
        setSelectedTaxDeductionTypeIds((current) =>
          isActive
            ? Array.from(new Set([...current, deductionTypeId]))
            : current.filter((id) => id !== deductionTypeId),
        );
      }
      await refreshEditDeductions(editingEmployee.bigIntId);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deduction update failed',
        description: userFriendlyError(error, 'Please try again.'),
      });
    }
  };

  const getStatusBadge = (status: Employee['status'], pauseReason?: string) => {
    switch (status) {
      case 'ACTIVE':
        return <StatusBadge label="Active" tone="success" />;
      case 'SUSPENDED':
        return <StatusBadge label="Suspended" tone="destructive" />;
      case 'TERMINATED':
        return <StatusBadge label="Terminated" tone="secondary" />;
      case 'PAUSED':
        const isContractExpired = pauseReason && (
          pauseReason.toLowerCase().includes('contract') ||
          pauseReason.toLowerCase().includes('expired') ||
          pauseReason.toLowerCase().includes('ended')
        );
        return (
          <div className="flex flex-col gap-1 items-start">
            <StatusBadge label="Paused" tone="warning" />
            {isContractExpired ? (
              <span className="text-[10px] font-bold text-warning italic leading-tight" title={pauseReason}>
                Contract working days have ended
              </span>
            ) : pauseReason ? (
              <span className="text-[10px] text-muted-foreground italic leading-tight" title={pauseReason}>
                {pauseReason}
              </span>
            ) : null}
          </div>
        );
      default:
        return <StatusBadge label={String(status)} tone="secondary" />;
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

    const selectedCategory = paymentCategories.find(
      (category) =>
        category.id === newEmployee.employment_category_id ||
        category.uuid === newEmployee.employment_category_id,
    );
    const selectedFrequency = selectedCategory?.payroll_frequency;

    if (selectedFrequency !== 'MONTHLY') {
      const startDate = newEmployee.contract_start_date;
      const endDate = newEmployee.contract_end_date;

      if (startDate && endDate && new Date(endDate).getTime() <= new Date(startDate).getTime()) {
        toast({
          variant: "destructive",
          title: "Invalid contract dates",
          description: "The contract end date must be later than the contract start date.",
        });
        return;
      }

      // editingEmployee still holds the values as they were before this
      // edit, so this is genuinely the *previous* contract's end date —
      // only relevant when the start date is actually being changed
      // (i.e. a new contract is being set up).
      const previousEndDate = editingEmployee.contract_end_date;
      if (
        startDate &&
        previousEndDate &&
        startDate !== editingEmployee.contract_start_date &&
        new Date(startDate).getTime() <= new Date(previousEndDate).getTime()
      ) {
        toast({
          variant: "destructive",
          title: "Invalid contract start date",
          description: `The new contract must start after the previous contract's end date (${previousEndDate}).`,
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const contractDays = selectedFrequency !== 'MONTHLY'
        ? getDaysBetween(newEmployee.contract_start_date, newEmployee.contract_end_date)
        : 0;

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
        contract_start_date: selectedFrequency !== 'MONTHLY' ? (newEmployee.contract_start_date || undefined) : null,
        contract_end_date: selectedFrequency !== 'MONTHLY' ? (newEmployee.contract_end_date || undefined) : null,
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
        contract_start_date: "Contract Start Date",
        contract_end_date: "Contract End Date",
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
          (selectedFrequency === 'CUSTOM' && contractDays > 21);

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

      if (canManageDeductions && editingEmployee.bigIntId && selectedFrequency === 'MONTHLY') {
        for (const option of assignableTaxOptions) {
          const deductionTypeId = String(option.deductionType.id);
          const shouldBeActive = selectedTaxDeductionTypeIds.includes(deductionTypeId);
          const existingDeduction = editDeductions.find((deduction) => {
            const type = deduction.deduction_type;
            return (
              String(deduction.deduction_type_id) === deductionTypeId ||
              String(type?.id) === deductionTypeId ||
              normalizeTaxName(type?.name) === normalizeTaxName(option.tax.name)
            );
          });

          if (existingDeduction) {
            if (Boolean(existingDeduction.is_active) !== shouldBeActive) {
              await updateEmployeeDeduction(existingDeduction.uuid, {
                is_active: shouldBeActive,
                start_date: shouldBeActive
                  ? option.tax.effective_from || todayInputValue()
                  : existingDeduction.start_date,
              });
            }
          } else if (shouldBeActive) {
            await createEmployeeDeduction({
              employee_id: editingEmployee.bigIntId,
              deduction_type_id: deductionTypeId,
              start_date: option.tax.effective_from || todayInputValue(),
              is_active: true,
            });
          }
        }

        await refreshEditDeductions(editingEmployee.bigIntId);
      }

      await loadEmployees();
      toast({ title: "Employee Updated", description: changeDescription });
      setEditingEmployee(null);
      setEditDeductions([]);
      setSelectedTaxDeductionTypeIds([]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: userFriendlyError(error, "Could not update employee."),
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

    const newEmployeeCategory = paymentCategories.find(
      (category) =>
        category.id === newEmployee.employment_category_id ||
        category.uuid === newEmployee.employment_category_id,
    );
    if (
      newEmployeeCategory?.payroll_frequency !== 'MONTHLY' &&
      newEmployee.contract_start_date &&
      newEmployee.contract_end_date &&
      new Date(newEmployee.contract_end_date).getTime() <= new Date(newEmployee.contract_start_date).getTime()
    ) {
      toast({
        variant: "destructive",
        title: "Invalid contract dates",
        description: "The contract end date must be later than the contract start date.",
      });
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
        Boolean(user?.location_id) && !user?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));
        // Location-scoped = has their own branch assigned and is not SUPER_ADMIN.
        // Covers BRANCH_MANAGER and any other branch-tied role (HR, ACCOUNTANT,
        // ATTENDANT, etc), not just BRANCH_MANAGER specifically.
      const contractDays = selectedFrequency !== 'MONTHLY'
        ? getDaysBetween(newEmployee.contract_start_date, newEmployee.contract_end_date)
        : 0;

      const canAssignAllowance =
        selectedFrequency === 'MONTHLY' ||
        (selectedFrequency === 'CUSTOM' && contractDays > 21);
      const submissionData = {
        first_name: newEmployee.first_name,
        last_name: newEmployee.last_name,
        email: newEmployee.email || undefined,
        phone_number: newEmployee.phone_number ? `+250${newEmployee.phone_number}` : undefined,
        national_id: newEmployee.national_id,
        gender: newEmployee.gender,
        contract_start_date: selectedFrequency !== 'MONTHLY' ? (newEmployee.contract_start_date || undefined) : undefined,
        contract_end_date: selectedFrequency !== 'MONTHLY' ? (newEmployee.contract_end_date || undefined) : undefined,
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
        contract_start_date: '',
        contract_end_date: '',
        contracted_days: '',
        allowance_title: '',
        allowance_amount: '',
        allowance_description: '',
      });
      setFilteredDepartments([]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: userFriendlyError(error, "Could not create employee."),
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
        description: userFriendlyError(error, "Please try again."),
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
      (filters.tax === 'ALL' || (e.activeTaxIds ?? []).includes(filters.tax)) &&
      (filters.status === 'ALL' || e.status === filters.status)
    );
  });
  // SUPER_ADMIN sees every branch at once, so the flat list becomes hard to
  // scan once there are more than a handful of employees. Arranging it by
  // working location (with a header row per branch) gives them the same
  // "which branch is this" context a branch-scoped user gets for free just
  // by only ever seeing their own branch.
  const isSuperAdminUser = !!user?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));
  const displayEmployees = isSuperAdminUser
    ? [...filtered].sort(
        (a, b) => a.location.localeCompare(b.location) || a.fullName.localeCompare(b.fullName),
      )
    : filtered;
  const locationCounts = isSuperAdminUser
    ? displayEmployees.reduce((acc: Record<string, number>, e) => {
        acc[e.location] = (acc[e.location] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  const resetFilters = () =>
    setFilters({
      location: 'ALL',
      department: 'ALL',
      category: 'ALL',
      tax: 'ALL',
      status: 'ALL',
    });
  const activeFilterCount = Object.values(filters).filter((value) => value !== 'ALL').length;
  const selectedCategory = paymentCategories.find(
    (category) =>
      category.id === newEmployee.employment_category_id ||
      category.uuid === newEmployee.employment_category_id,
  );
  const selectedFrequency = selectedCategory?.payroll_frequency;
  const assignableTaxOptions = monthlyTaxes
    .filter((tax) => tax.is_active && !isPitTaxName(tax.name))
    .map((tax) => {
      const deductionType = deductionTypes.find(
        (type) => normalizeTaxName(type.name) === normalizeTaxName(tax.name),
      );
      return { tax, deductionType };
    })
    .filter((option) => option.deductionType);
  const canCreateEmployee = hasPermission('employees.create');
  const canUpdateEmployee = hasPermission('employees.update');
  const isLocationScopedManager =
    Boolean(user?.location_id) && !user?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));
    // Location-scoped = has their own branch assigned and is not SUPER_ADMIN.
    // Covers BRANCH_MANAGER and any other branch-tied role (HR, ACCOUNTANT,
    // ATTENDANT, etc), not just BRANCH_MANAGER specifically.

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
      'Tax Deductions': emp.activeTaxes?.map((tax) => tax.name).join(', ') || '', 
      'Status': emp.status
    }));

    if (type === 'csv') exportToCSV(exportData, 'employees');
    else if (type === 'excel') exportToExcel(exportData, 'employees');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Assets"
        description="Comprehensive database of all registered corporate personnel."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 px-6 shadow-sm border-dashed">
                  <Download01 className="mr-2 h-4 w-4 text-black" size={16} /> Export Data
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>Export as Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canCreateEmployee && (
              <Button
                variant="outline"
                className="h-11 px-6 border-dashed"
                onClick={() => setIsBulkImportOpen(true)}
              >
                <Upload01 className="mr-2 h-4 w-4 text-black" size={16} /> Bulk Import
              </Button>
            )}
            {canCreateEmployee && (
              <Button
                className="h-11 px-6 shadow-lg shadow-primary/20"
                onClick={() => setIsAddingEmployee(true)}
              >
                <UserPlus01 className="mr-2 h-4 w-4 text-primary-foreground" size={16} /> Create Employee
              </Button>
            )}
          </>
        }
      />

      <StatCard
        icon={<Users01 size={20} />}
        label={activeFilterCount > 0 || searchTerm ? 'Matching employees' : 'Total employees'}
        value={filtered.length}
        tone="primary"
        className="w-fit"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative col-span-2">
          <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" size={16} />
          <Input
            placeholder="Search by ID, Name, Department..."
            className="pl-10 h-11 border-none bg-card shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 border-dashed bg-card">
              <FilterFunnel01 className="h-4 w-4 text-black" size={16} />
              More Filters
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-3">
            {!isLocationScopedManager && (
              <>
                <DropdownMenuLabel className="px-0">Working Location</DropdownMenuLabel>
                <Select
                  value={filters.location}
                  onValueChange={(value) =>
                    setFilters((current) => ({
                      ...current,
                      location: value,
                      department: 'ALL',
                    }))
                  }
                >
                  <SelectTrigger aria-label="Filter by working location" className="mb-3 h-9 text-sm">
                    <SelectValue placeholder="All scoped locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All scoped locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.uuid} value={String(location.id ?? location.uuid)}>
                        {formatDisplayName(location.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <DropdownMenuLabel className="px-0">Department</DropdownMenuLabel>
            <Select
              value={filters.department}
              onValueChange={(value) => setFilters((current) => ({ ...current, department: value }))}
            >
              <SelectTrigger aria-label="Filter by department" className="mb-3 h-9 text-sm">
                <SelectValue placeholder="All scoped departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All scoped departments</SelectItem>
                {departments
                  .filter(
                    (department) =>
                      filters.location === 'ALL' ||
                      String(department.working_location_id) === filters.location,
                  )
                  .map((department) => (
                    <SelectItem key={department.uuid} value={String(department.id ?? department.uuid)}>
                      {formatDisplayName(department.name)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <DropdownMenuLabel className="px-0">Employment Category</DropdownMenuLabel>
            <Select
              value={filters.category}
              onValueChange={(value) => setFilters((current) => ({ ...current, category: value }))}
            >
              <SelectTrigger aria-label="Filter by employment category" className="mb-3 h-9 text-sm">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {paymentCategories.map((category) => (
                  <SelectItem key={category.uuid ?? category.id} value={String(category.id ?? category.uuid)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {assignableTaxOptions.length > 0 && (
              <>
                <DropdownMenuLabel className="px-0">Tax Type</DropdownMenuLabel>
                <Select
                  value={filters.tax}
                  onValueChange={(value) => setFilters((current) => ({ ...current, tax: value }))}
                >
                  <SelectTrigger aria-label="Filter by tax type" className="mb-3 h-9 text-sm">
                    <SelectValue placeholder="All tax assignments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All tax assignments</SelectItem>
                    {assignableTaxOptions.map(({ tax, deductionType }) => (
                      <SelectItem key={tax.uuid} value={String(deductionType.id)}>
                        {tax.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <DropdownMenuLabel className="px-0">Status</DropdownMenuLabel>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            >
              <SelectTrigger aria-label="Filter by employee status" className="mb-3 h-9 text-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={resetFilters}>Clear filters</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
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
            ) : displayEmployees.length > 0 ? displayEmployees.map((emp, idx) => (
              <React.Fragment key={emp.id}>
              {isSuperAdminUser && emp.location !== displayEmployees[idx - 1]?.location && (
                <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                  <TableCell colSpan={6} className="py-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <MarkerPin01 className="h-3.5 w-3.5" size={14} /> {emp.location || 'Unassigned location'}
                      <span className="font-normal normal-case text-muted-foreground/80">
                        · {locationCounts[emp.location] ?? 0} employee{(locationCounts[emp.location] ?? 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="hover:bg-secondary/10 transition-colors">
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
                      <Building02 className="h-3 w-3 text-muted-foreground" size={12} /> {emp.department}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MarkerPin01 className="h-3 w-3" size={12} /> {emp.location}
                    </div>
                    <Badge variant="outline" className="w-fit text-[10px]">
                      {emp.employmentCategory}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-bold">
                    <BankNote01 className="h-4 w-4 text-success" size={16} /> {formatRwf(emp.salary)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-info" size={16} />
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
                <TableCell>{getStatusBadge(emp.status, emp.pause_reason)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><DotsVertical className="h-4 w-4 text-black" size={16} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canUpdateEmployee && (
                        <DropdownMenuItem onClick={() => handleEditClick(emp)}>
                          <Edit05 className="mr-2 h-4 w-4" size={16} /> Edit Profile
                        </DropdownMenuItem>
                      )}
                      {hasPermission('employees.transfer') && (
                        <DropdownMenuItem onClick={async () => {
                          setTransferEmployeeData(emp);
                          setTransferLocationId(emp.working_location_id || '');
                          setTransferDepartmentId(emp.department_id || '');
                          setTransferReason('');
                          if (transferLocations.length === 0) {
                            try {
                              const locData = await getWorkingLocations({ scope: 'transfer' });
                              setTransferLocations(locData.working_locations || (Array.isArray(locData) ? locData : []));
                            } catch {
                              // Fall back to the general (possibly single-branch) list rather
                              // than leaving the dropdown completely empty.
                              setTransferLocations(locations);
                            }
                          }
                          if (emp.working_location_id) {
                            try {
                              const data = await getDepartments(emp.working_location_id);
                              setTransferDepartments(data.departments || (Array.isArray(data) ? data : []));
                            } catch {
                              setTransferDepartments([]);
                            }
                          } else {
                            setTransferDepartments([]);
                          }
                        }}>
                          <MarkerPin01 className="mr-2 h-4 w-4" size={16} /> Transfer Employee
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleViewDetails(emp)}>
                        <Eye className="mr-2 h-4 w-4" size={16} /> View Details
                      </DropdownMenuItem>
                      {hasPermission('employees.suspend') && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(emp.id)}
                        >
                          <UserX01 className="mr-2 h-4 w-4" size={16} /> Terminate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              </React.Fragment>
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
            contract_start_date: '',
            contract_end_date: '',
            contracted_days: '',
            allowance_title: '',
            allowance_amount: '',
            allowance_description: '',
          });
          setEditDeductions([]);
          setSelectedTaxDeductionTypeIds([]);
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">+250</span>
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
                <Select
                  value={newEmployee.working_location_id}
                  onValueChange={(value) => handleLocationChange(value)}
                >
                  <SelectTrigger aria-label="Employee location" className="w-full">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => <SelectItem key={l.uuid} value={l.uuid}>{formatDisplayName(l.name)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={newEmployee.department_id}
                onValueChange={(value) => setNewEmployee(p => ({...p, department_id: value}))}
                disabled={!isLocationScopedManager && !newEmployee.working_location_id}
              >
                <SelectTrigger aria-label="Employee department" className="w-full">
                  <SelectValue placeholder={isLocationScopedManager || newEmployee.working_location_id ? "Select Department" : "Select Location First"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredDepartments.map(d => <SelectItem key={d.uuid} value={d.uuid}>{formatDisplayName(d.name)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Category</Label>
              <Select
                value={newEmployee.employment_category_id}
                onValueChange={(catId) => {
                  const cat = paymentCategories.find(c => c.id === catId || c.uuid === catId);
                  setNewEmployee(p => {
                    const next = { ...p, employment_category_id: catId };
                    if (cat?.payroll_frequency === 'MONTHLY') {
                      next.contract_start_date = '';
                      next.contract_end_date = '';
                      next.contracted_days = '';
                    }
                    return next;
                  });
                }}
              >
                <SelectTrigger aria-label="Employee payment category" className="w-full font-bold text-xs">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                {paymentCategories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFrequency && selectedFrequency !== 'MONTHLY' && (
              <>
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>Contracted Days (optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 20"
                    value={newEmployee.contracted_days}
                    onChange={e => {
                      const days = e.target.value;
                      setNewEmployee(p => {
                        if (!days || Number(days) <= 0) {
                          return { ...p, contracted_days: days };
                        }
                        const start = new Date();
                        const end = new Date(start);
                        end.setDate(end.getDate() + Number(days));
                        const toDateInput = (d: Date) => d.toISOString().split('T')[0];
                        return {
                          ...p,
                          contracted_days: days,
                          contract_start_date: toDateInput(start),
                          contract_end_date: toDateInput(end),
                        };
                      });
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground italic">* Automatically fills the start/end dates below (start = today, end = today + this many days). You can still adjust them manually.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
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
              </>
            )}

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
                  <p className="text-[10px] text-muted-foreground italic mt-1">* PIT applies automatically. Other configured taxes can be assigned below.</p>
                </div>

                <div className="p-3 bg-success/10 border border-success/20 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold text-success uppercase tracking-widest">Employee Benefits (Allowances)</p>
                  <div className="space-y-2">
                    <Label className="text-success">Allowance Title</Label>
                    <Input
                      placeholder="e.g. Transport Allowance"
                      value={newEmployee.allowance_title}
                      onChange={e => setNewEmployee(p => ({ ...p, allowance_title: e.target.value }))}
                      className="bg-card border-success/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-success">Allowance Amount (RWF)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 50000"
                      value={newEmployee.allowance_amount}
                      onChange={e => setNewEmployee(p => ({ ...p, allowance_amount: e.target.value }))}
                      className="bg-card border-success/30"
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
                <div className="space-y-2">
                  <Label>Daily Rate (RWF)</Label>
                  <Input
                    type="number"
                    value={newEmployee.daily_rate}
                    onChange={e => setNewEmployee(p => ({ ...p, daily_rate: e.target.value }))}
                    placeholder="e.g. 10000"
                  />
                </div>

                {getDaysBetween(newEmployee.contract_start_date, newEmployee.contract_end_date) > 21 ? (
                  <div className="p-3 bg-success/10 border border-success/20 rounded-xl space-y-3">
                    <p className="text-[10px] font-bold text-success uppercase tracking-widest">Full Benefits Applied (&gt; 21 Days)</p>
                    <div className="space-y-2">
                      <Label className="text-success">Allowance Title</Label>
                      <Input
                        placeholder="e.g. Performance Bonus"
                        value={newEmployee.allowance_title}
                        onChange={e => setNewEmployee(p => ({ ...p, allowance_title: e.target.value }))}
                        className="bg-card border-success/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-success">Allowance Amount (RWF)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 50000"
                        value={newEmployee.allowance_amount}
                        onChange={e => setNewEmployee(p => ({ ...p, allowance_amount: e.target.value }))}
                        className="bg-card border-success/30"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-warning italic">* Benefits are only applied for contracts over 21 days.</p>
                )}
              </div>
            )}

            {editingEmployee && canManageDeductions && (
              <div className="p-3 bg-secondary/30 border border-border rounded-xl space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-widest">Employee Deductions / Taxes</p>
                  <Badge variant="outline">{editDeductions.filter((deduction) => deduction.is_active).length} Active</Badge>
                </div>

                {selectedFrequency === 'MONTHLY' ? (
                  <>
                    {editDeductions.length > 0 && (
                      <div className="divide-y rounded-lg border border-border bg-card">
                        {editDeductions.map((deduction) => {
                          const type = deduction.deduction_type;
                          const matchingTax = monthlyTaxes.find(
                            (tax) => normalizeTaxName(tax.name) === normalizeTaxName(type?.name),
                          );
                          const rate = matchingTax
                            ? Number(matchingTax.rate)
                            : Number(type?.percentage_value ?? 0);

                          return (
                            <div key={deduction.uuid} className="flex items-center justify-between gap-3 p-3">
                              <div>
                                <p className="text-sm font-semibold">{type?.name ?? 'Deduction'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {rate.toLocaleString()}% · effective {new Date(matchingTax?.effective_from ?? deduction.start_date).toLocaleDateString()}
                                </p>
                              </div>
                              <Switch
                                checked={deduction.is_active}
                                onCheckedChange={(checked) => handleEditDeductionToggle(deduction, checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Tax Types</Label>
                      <div className="space-y-2">
                        {assignableTaxOptions.map(({ tax, deductionType }) => {
                          const deductionTypeId = String(deductionType.id);
                          const checked = selectedTaxDeductionTypeIds.includes(deductionTypeId);
                          return (
                            <label
                              key={tax.uuid}
                              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) =>
                                  setSelectedTaxDeductionTypeIds((current) =>
                                    value
                                      ? Array.from(new Set([...current, deductionTypeId]))
                                      : current.filter((id) => id !== deductionTypeId),
                                  )
                                }
                                className="mt-0.5"
                              />
                              <span>
                                <span className="block text-sm font-semibold">
                                  {tax.name} ({Number(tax.rate).toLocaleString()}%)
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  Effective {new Date(tax.effective_from).toLocaleDateString()}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {assignableTaxOptions.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No non-PIT tax policies are available from Tax Setup.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                    Additional tax deductions can only be assigned to employees in the Monthly payment category.
                  </p>
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
                   <Loading02 className="mr-2 h-4 w-4 animate-spin" size={16} />
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
          setDetailAttendance([]);
        }
      }}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between gap-4">
              <SheetTitle>{detailEmployee?.fullName ?? 'Employee'} Details</SheetTitle>
              {detailEmployee && getStatusBadge(detailEmployee.status, detailEmployee.pause_reason)}
            </div>
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
                    <p className="text-xs text-muted-foreground">Overtime Policy</p>
                    <p className="font-medium">Flat 2,500 RWF/day past 8 hrs</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="border-b p-3">
                  <h3 className="font-semibold">Assigned Deductions / Taxes</h3>
                </div>
                <div className="divide-y">
                  {detailDeductions.length > 0 ? (
                    detailDeductions.map((deduction) => {
                      const type = deduction.deduction_type;
                      const matchingTax = monthlyTaxes.find(
                        (tax) => normalizeTaxName(tax.name) === normalizeTaxName(type?.name),
                      );
                      const isPercentage = type?.deduction_mode === 'PERCENTAGE' || matchingTax;
                      const value = isPercentage
                        ? `${Number(matchingTax?.rate ?? type?.percentage_value ?? 0).toLocaleString()}%`
                        : formatRwf(Number(type?.amount ?? 0));

                      return (
                      <div key={deduction.uuid} className="flex items-center justify-between gap-3 p-3">
                        <div>
                          <p className="font-medium">{type?.name ?? 'Deduction'}</p>
                          <p className="text-xs text-muted-foreground">
                            {deduction.is_active ? 'Active' : 'Inactive'} · effective {new Date(matchingTax?.effective_from ?? deduction.start_date).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className="bg-success/10 text-success border-success/20">
                          {value}
                        </Badge>
                      </div>
                      );
                    })
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground">
                      No employee-specific deductions assigned. PIT is automatic for monthly employees.
                    </p>
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

              <div className="rounded-lg border">
                <div className="border-b p-3 flex items-center justify-between">
                  <h3 className="font-semibold">Attendance History</h3>
                  <span className="text-xs text-muted-foreground">{detailAttendance.length} record{detailAttendance.length === 1 ? '' : 's'}</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y">
                  {detailAttendance.length > 0 ? detailAttendance.map((rec: any) => {
                    const isOvertime = rec.attendance_status === 'PRESENT' && Number(rec.overtime_hours ?? 0) > 0;
                    return (
                      <div key={rec.uuid} className="flex items-center justify-between p-3 text-sm">
                        <div>
                          <p className="font-medium">{new Date(rec.attendance_date).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {rec.overtime_hours ? `${rec.overtime_hours} overtime hrs` : 'No overtime logged'}
                            {isOvertime && ' · overtime payable'}
                          </p>
                        </div>
                        <StatusBadge
                          label={rec.attendance_status}
                          tone={rec.attendance_status === 'PRESENT' ? 'success' : 'destructive'}
                        />
                      </div>
                    );
                  }) : (
                    <p className="p-4 text-sm text-muted-foreground">No attendance records found for this employee.</p>
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

      <Dialog open={isBulkImportOpen} onOpenChange={(open) => {
        setIsBulkImportOpen(open);
        if (!open) setImportFile(null);
      }}>
        <DialogContent className="max-w-md bg-card rounded-3xl p-6 border border-border shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Bulk Import Employees</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Download the template that matches the employees you're importing, and fill in its "Employees" sheet only — that's the one and only sheet to upload back here. Required columns are first_name and last_name; the rest are optional. Gender, department, employment category{isBranchManagerActor ? '' : ' and branch'} are dropdowns, and contract dates use the YYYY-MM-DD format our system requires. Import Monthly and Daily/Custom employees separately, since each uses a different template.
              {isBranchManagerActor && ' Employees you import are automatically assigned to your branch.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownloadTemplate('MONTHLY')}
              className="h-10 rounded-xl text-xs font-semibold border-dashed"
            >
              <Download01 className="mr-2 h-4 w-4 text-black" size={16} /> Monthly
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownloadTemplate('DAILY_CUSTOM')}
              className="h-10 rounded-xl text-xs font-semibold border-dashed"
            >
              <Download01 className="mr-2 h-4 w-4 text-black" size={16} /> Daily / Custom
            </Button>
          </div>

          <div className="space-y-4 my-4">
            <div
              className="border-2 border-dashed border-border hover:border-muted-foreground/50 transition-colors rounded-2xl p-6 text-center cursor-pointer bg-secondary/20"
              onClick={() => {
                const el = document.getElementById('bulk-employee-file-input');
                el?.click();
              }}
            >
              <Upload01 className="mx-auto h-8 w-8 text-muted-foreground mb-2" size={32} />
              <p className="text-xs text-foreground font-medium">
                {importFile ? importFile.name : 'Click to select Excel/CSV file'}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Maximum size 5MB, up to 500 employees</p>
              <input
                id="bulk-employee-file-input"
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => {
                setIsBulkImportOpen(false);
                setImportFile(null);
              }}
              className="h-10 rounded-xl text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={!importFile || importingBulk}
              className="h-10 rounded-xl text-xs font-semibold px-6 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {importingBulk ? (
                <>
                  <Loading02 className="mr-2 h-4 w-4 animate-spin" size={16} />
                  Importing...
                </>
              ) : (
                "Upload & Import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferEmployeeData} onOpenChange={(open) => !open && setTransferEmployeeData(null)}>
        <DialogContent className="sm:max-w-[425px] bg-card border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline font-bold">Transfer Employee</DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              Submit a transfer request for this employee. The transfer requires approval before it is applied.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="rounded-2xl bg-secondary/10 p-4 text-xs space-y-2 border border-secondary/20">
              <p className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">Employee details</p>
              <p className="font-bold text-base text-foreground">{transferEmployeeData?.fullName}</p>

              <div className="grid grid-cols-2 gap-4 pt-3 mt-2 border-t border-border">
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Current Location</p>
                  <p className="font-bold text-xs text-foreground mt-1">{transferEmployeeData?.location || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Current Department</p>
                  <p className="font-bold text-xs text-foreground mt-1">{transferEmployeeData?.department || 'Unassigned'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Target Location</Label>
              <Select value={transferLocationId} onValueChange={(value) => handleTransferLocationChange(value)}>
                <SelectTrigger aria-label="Target Location" className="w-full h-11 rounded-xl text-sm">
                  <SelectValue placeholder="Select Location" />
                </SelectTrigger>
                <SelectContent>
                  {transferLocations.map(l => (
                    <SelectItem key={l.uuid} value={l.uuid}>
                      {formatDisplayName(l.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Target Department</Label>
              <Select
                value={transferDepartmentId}
                onValueChange={setTransferDepartmentId}
                disabled={!transferLocationId}
              >
                <SelectTrigger aria-label="Target Department" className="w-full h-11 rounded-xl text-sm">
                  <SelectValue placeholder={transferLocationId ? "Select Department" : "Select Location First"} />
                </SelectTrigger>
                <SelectContent>
                  {transferDepartments.map(d => (
                    <SelectItem key={d.uuid} value={d.uuid}>
                      {formatDisplayName(d.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Reason for Transfer</Label>
              <textarea
                aria-label="Reason for Transfer"
                className="w-full min-h-[90px] p-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                  <Loading02 className="mr-2 h-4 w-4 animate-spin" size={16} />
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
