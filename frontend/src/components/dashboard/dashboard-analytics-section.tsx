"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  Lock,
  SlidersHorizontal,
  Users,
  WalletCards,
} from "lucide-react";
import { format, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  getEmployeeDashboardAnalytics,
  getPayrollDashboardAnalytics,
  type AnalyticsOption,
  type EmployeeDashboardAnalytics,
  type PayrollDashboardAnalytics,
} from "@/api/dashboard-analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
  RetryButton,
} from "@/components/layout/page-state";
import { cn } from "@/lib/utils";

type LoadState<T> =
  | { status: "idle"; data?: undefined; error?: undefined }
  | { status: "loading"; data?: T; error?: undefined }
  | { status: "success"; data: T; error?: undefined }
  | { status: "error"; data?: T; error: string };

type RangePreset =
  | "current_month"
  | "last_30_days"
  | "last_90_days"
  | "last_12_months"
  | "last_24_months"
  | "year_to_date"
  | "custom";

interface DashboardAnalyticsSectionProps {
  canViewEmployeeAnalytics: boolean;
  canViewPayrollAnalytics: boolean;
}

interface DashboardFilters {
  range: RangePreset;
  from: string;
  to: string;
  working_location_id: string;
  employee_status: string;
  employee_department_id: string;
  employee_position_id: string;
  employee_category_id: string;
  payroll_status: string;
  payroll_department_id: string;
  payroll_position_id: string;
}

const RANGE_PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: "current_month", label: "Current month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "last_24_months", label: "Last 2 years" },
  { value: "year_to_date", label: "Year to date" },
  { value: "custom", label: "Custom dates" },
];

// --chart-N (globals.css) are plain hex colors, not HSL components - the
// chart config must reference them as-is. ChartStyle (components/ui/chart.tsx)
// injects `color` verbatim as `--color-<key>: <color>`, so wrapping these in
// `hsl(...)` produced invalid CSS like `hsl(#2a78d6)`, which the browser
// silently drops to black - every bar/area/line rendered solid black.
const employeeChartConfig = {
  total: {
    label: "Scoped headcount",
    color: "var(--chart-1)",
  },
  added: {
    label: "Added",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const payrollChartConfig = {
  gross: {
    label: "Gross",
    color: "var(--chart-1)",
  },
  net: {
    label: "Net",
    color: "var(--chart-2)",
  },
  tax: {
    label: "Tax",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const statusChartConfig = {
  count: {
    label: "Batches",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const employeeAnalyticsCache = new Map<string, EmployeeDashboardAnalytics>();
const payrollAnalyticsCache = new Map<string, PayrollDashboardAnalytics>();

export function DashboardAnalyticsSection({
  canViewEmployeeAnalytics,
  canViewPayrollAnalytics,
}: DashboardAnalyticsSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [reloadToken, setReloadToken] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [employeeState, setEmployeeState] = useState<
    LoadState<EmployeeDashboardAnalytics>
  >({ status: "idle" });
  const [payrollState, setPayrollState] = useState<
    LoadState<PayrollDashboardAnalytics>
  >({ status: "idle" });

  const filters = useMemo(() => {
    const params = new URLSearchParams(queryString);
    const range = parseRangePreset(params.get("analytics_range"));
    const presetDates = getPresetDates(range);
    const from = params.get("analytics_from") ?? presetDates.from;
    const to = params.get("analytics_to") ?? presetDates.to;

    return {
      range,
      from,
      to,
      working_location_id: params.get("analytics_location") ?? "all",
      employee_status: params.get("employee_status") ?? "all",
      employee_department_id: params.get("employee_department") ?? "all",
      employee_position_id: params.get("employee_position") ?? "all",
      employee_category_id: params.get("employee_category") ?? "all",
      payroll_status: params.get("payroll_status") ?? "all",
      payroll_department_id: params.get("payroll_department") ?? "all",
      payroll_position_id: params.get("payroll_position") ?? "all",
    };
  }, [queryString]);

  const updateParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const next = params.toString();
      router.replace(`${pathname}${next ? `?${next}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const retry = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (canViewEmployeeAnalytics) {
      const request = {
        from: filters.from,
        to: filters.to,
        working_location_id: filters.working_location_id,
        status: filters.employee_status,
        department_id: filters.employee_department_id,
        position_id: filters.employee_position_id,
        employment_category_id: filters.employee_category_id,
      };
      const cacheKey = analyticsCacheKey("employees", request);
      const cachedData = employeeAnalyticsCache.get(cacheKey);

      setEmployeeState((current) => ({
        status: "loading",
        data: current.data ?? cachedData,
      }));
      getEmployeeDashboardAnalytics(request)
        .then((data) => {
          employeeAnalyticsCache.set(cacheKey, data);
          if (!cancelled) setEmployeeState({ status: "success", data });
        })
        .catch((error) => {
          if (!cancelled) {
            setEmployeeState((current) => ({
              status: "error",
              data: current.data,
              error: errorMessage(error, "Employee analytics could not load."),
            }));
          }
        });
    } else {
      setEmployeeState({ status: "idle" });
    }

    if (canViewPayrollAnalytics) {
      const request = {
        from: filters.from,
        to: filters.to,
        working_location_id: filters.working_location_id,
        status: filters.payroll_status,
        department_id: filters.payroll_department_id,
        position_id: filters.payroll_position_id,
      };
      const cacheKey = analyticsCacheKey("payroll", request);
      const cachedData = payrollAnalyticsCache.get(cacheKey);

      setPayrollState((current) => ({
        status: "loading",
        data: current.data ?? cachedData,
      }));
      getPayrollDashboardAnalytics(request)
        .then((data) => {
          payrollAnalyticsCache.set(cacheKey, data);
          if (!cancelled) setPayrollState({ status: "success", data });
        })
        .catch((error) => {
          if (!cancelled) {
            setPayrollState((current) => ({
              status: "error",
              data: current.data,
              error: errorMessage(error, "Payroll analytics could not load."),
            }));
          }
        });
    } else {
      setPayrollState({ status: "idle" });
    }

    return () => {
      cancelled = true;
    };
  }, [
    canViewEmployeeAnalytics,
    canViewPayrollAnalytics,
    filters.employee_category_id,
    filters.employee_department_id,
    filters.employee_position_id,
    filters.employee_status,
    filters.from,
    filters.payroll_status,
    filters.payroll_department_id,
    filters.payroll_position_id,
    filters.to,
    filters.working_location_id,
    reloadToken,
  ]);

  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of [
      ...(employeeState.data?.filters.working_locations ?? []),
      ...(payrollState.data?.filters.working_locations ?? []),
    ]) {
      map.set(option.value, option.label);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [employeeState.data, payrollState.data]);

  const scope =
    employeeState.data?.scope ??
    payrollState.data?.scope ??
    null;
  const canSelectLocation =
    !!employeeState.data?.scope.can_select_working_location ||
    !!payrollState.data?.scope.can_select_working_location;
  const isLoading =
    employeeState.status === "loading" || payrollState.status === "loading";
  const hasLoadedAnalyticsData = !!employeeState.data || !!payrollState.data;
  const isInitialLoading = isLoading && !hasLoadedAnalyticsData;
  const isRefreshing = isLoading && hasLoadedAnalyticsData;
  const hasAnyAnalyticsPermission =
    canViewEmployeeAnalytics || canViewPayrollAnalytics;

  const onRangeChange = (range: RangePreset) => {
    if (range === "custom") {
      updateParams({ analytics_range: range });
      return;
    }
    const dates = getPresetDates(range);
    updateParams({
      analytics_range: range,
      analytics_from: dates.from,
      analytics_to: dates.to,
    });
  };

  return (
    <section className="space-y-5" aria-labelledby="dashboard-analytics-heading">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 id="dashboard-analytics-heading" className="text-lg font-semibold text-foreground">
            Operational analytics
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Scoped employee and payroll trends for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scope?.was_overridden && (
            <Badge variant="outline" className="gap-1 border-warning/30 bg-warning/10 text-warning">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Assigned location enforced
            </Badge>
          )}
          {scope && (
            <Badge variant="secondary" className="gap-1">
              {scope.mode === "GLOBAL" ? "Global scope" : scope.label}
            </Badge>
          )}
          {isRefreshing && hasAnyAnalyticsPermission && (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Updating
            </Badge>
          )}
          {!isLoading && hasAnyAnalyticsPermission && (
            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
              Updated
            </Badge>
          )}
        </div>
      </div>

      {hasAnyAnalyticsPermission ? (
        <>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <LabeledSelect
                label="Period"
                value={filters.range}
                options={RANGE_PRESETS}
                disabled={isInitialLoading}
                onValueChange={(value) => onRangeChange(value as RangePreset)}
              />
              <DateField
                label="From"
                value={filters.from}
                disabled={isInitialLoading}
                onChange={(value) =>
                  updateParams({
                    analytics_range: "custom",
                    analytics_from: value,
                  })
                }
              />
              <DateField
                label="To"
                value={filters.to}
                disabled={isInitialLoading}
                onChange={(value) =>
                  updateParams({
                    analytics_range: "custom",
                    analytics_to: value,
                  })
                }
              />
              {canSelectLocation ? (
                <LabeledSelect
                  label="Working location"
                  value={filters.working_location_id}
                  options={locationOptions}
                  allLabel="All locations"
                  disabled={isInitialLoading || locationOptions.length === 0}
                  onValueChange={(value) =>
                    updateParams({ analytics_location: value })
                  }
                />
              ) : (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Working location
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-start rounded-md text-muted-foreground"
                    disabled
                  >
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    {scope?.label ?? "Assigned location"}
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Period, dates, and working location apply to every chart below. Each chart also has its own
              filter row for the dimensions specific to it (status, department, position, etc.).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {canViewPayrollAnalytics && (
              <PayrollTrendCard
                state={payrollState}
                onRetry={retry}
                filters={filters}
                isDisabled={isInitialLoading}
                onFilterChange={updateParams}
              />
            )}
            {canViewEmployeeAnalytics && (
              <EmployeeTrendCard
                state={employeeState}
                onRetry={retry}
                filters={filters}
                isDisabled={isInitialLoading}
                onFilterChange={updateParams}
                advancedOpen={advancedOpen}
                onAdvancedOpenChange={setAdvancedOpen}
              />
            )}
            {canViewPayrollAnalytics && (
              <PayrollStatusCard
                state={payrollState}
                onRetry={retry}
                filters={filters}
                isDisabled={isInitialLoading}
                onFilterChange={updateParams}
              />
            )}
          </div>
        </>
      ) : (
        <PermissionDeniedState
          title="Analytics permission required"
          description="Employee analytics require employees.read. Payroll analytics require payroll.reports."
        />
      )}
    </section>
  );
}

function EmployeeTrendCard({
  state,
  onRetry,
  filters,
  isDisabled,
  onFilterChange,
  advancedOpen,
  onAdvancedOpenChange,
}: {
  state: LoadState<EmployeeDashboardAnalytics>;
  onRetry: () => void;
  filters: DashboardFilters;
  isDisabled: boolean;
  onFilterChange: (updates: Record<string, string | null | undefined>) => void;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
}) {
  const data = state.data;
  const hasData =
    !!data &&
    (data.summary.total_employees > 0 || data.summary.new_employees > 0);

  return (
    <AnalyticsChartCard
      title="Employee headcount"
      description={data?.scope.label ?? "Scoped employee trend"}
      icon={<Users className="h-5 w-5" aria-hidden="true" />}
      state={state.status}
      error={state.status === "error" ? state.error : undefined}
      empty={!hasData}
      emptyTitle="No employee trend data"
      emptyDescription="Adjust the period or employee filters to see headcount movement."
      hasLoadedData={!!data}
      onRetry={onRetry}
      headerFilters={
        <Collapsible open={advancedOpen} onOpenChange={onAdvancedOpenChange}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Chart filters
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")}
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <LabeledSelect
                label="Employee status"
                value={filters.employee_status}
                options={data?.filters.statuses ?? []}
                allLabel="All statuses"
                disabled={isDisabled}
                onValueChange={(value) => onFilterChange({ employee_status: value })}
              />
              <LabeledSelect
                label="Department"
                value={filters.employee_department_id}
                options={data?.filters.departments ?? []}
                allLabel="All departments"
                disabled={isDisabled}
                onValueChange={(value) => onFilterChange({ employee_department: value })}
              />
              <LabeledSelect
                label="Position"
                value={filters.employee_position_id}
                options={data?.filters.positions ?? []}
                allLabel="All positions"
                disabled={isDisabled}
                onValueChange={(value) => onFilterChange({ employee_position: value })}
              />
              <LabeledSelect
                label="Employment category"
                value={filters.employee_category_id}
                options={data?.filters.employment_categories ?? []}
                allLabel="All categories"
                disabled={isDisabled}
                onValueChange={(value) => onFilterChange({ employee_category: value })}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      }
      summary={
        data && (
          <SummaryGrid
            items={[
              ["Scoped headcount", data.summary.total_employees.toLocaleString()],
              ["Active", data.summary.active_employees.toLocaleString()],
              ["Added in period", data.summary.new_employees.toLocaleString()],
            ]}
          />
        )
      }
    >
      {data && (
        <>
          <p className="sr-only">
            Employee chart for {data.scope.label}: {data.summary.total_employees} scoped employees,
            {` ${data.summary.new_employees}`} added in the selected period.
          </p>
          <ChartContainer config={employeeChartConfig} className="h-[320px] w-full aspect-auto">
            <AreaChart data={data.headcount_trend} margin={{ left: 8, right: 12, top: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={24}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={42} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="total"
                name="total"
                type="monotone"
                fill="var(--color-total)"
                fillOpacity={0.14}
                stroke="var(--color-total)"
                strokeWidth={2}
              />
              <Line
                dataKey="added"
                name="added"
                type="monotone"
                stroke="var(--color-added)"
                strokeWidth={2}
                dot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </>
      )}
    </AnalyticsChartCard>
  );
}

function PayrollTrendCard({
  state,
  onRetry,
  filters,
  isDisabled,
  onFilterChange,
}: {
  state: LoadState<PayrollDashboardAnalytics>;
  onRetry: () => void;
  filters: DashboardFilters;
  isDisabled: boolean;
  onFilterChange: (updates: Record<string, string | null | undefined>) => void;
}) {
  const data = state.data;
  const hasData = !!data && data.summary.batch_count > 0;

  return (
    <AnalyticsChartCard
      title="Payroll batch trend"
      description={data?.scope.label ?? "Scoped payroll totals by period"}
      icon={<WalletCards className="h-5 w-5" aria-hidden="true" />}
      state={state.status}
      error={state.status === "error" ? state.error : undefined}
      empty={!hasData}
      emptyTitle="No payroll batches in this period"
      emptyDescription="Adjust the period, status, or location filter to review payroll movement."
      hasLoadedData={!!data}
      onRetry={onRetry}
      className="xl:col-span-2"
      headerFilters={
        <div className="grid w-full gap-2 sm:grid-cols-3">
          <LabeledSelect
            label="Batch status"
            value={filters.payroll_status}
            options={data?.filters.statuses ?? []}
            allLabel="All statuses"
            disabled={isDisabled}
            onValueChange={(value) => onFilterChange({ payroll_status: value })}
          />
          <LabeledSelect
            label="Department"
            value={filters.payroll_department_id}
            options={data?.filters.departments ?? []}
            allLabel="All departments"
            disabled={isDisabled}
            onValueChange={(value) => onFilterChange({ payroll_department: value })}
          />
          <LabeledSelect
            label="Position"
            value={filters.payroll_position_id}
            options={data?.filters.positions ?? []}
            allLabel="All positions"
            disabled={isDisabled}
            onValueChange={(value) => onFilterChange({ payroll_position: value })}
          />
        </div>
      }
      summary={
        data && (
          <SummaryGrid
            items={[
              ["Batches", data.summary.batch_count.toLocaleString()],
              ["Gross", formatRwfCompact(data.summary.total_gross)],
              ["Net", formatRwfCompact(data.summary.total_net)],
              ["Tax", formatRwfCompact(data.summary.total_tax)],
            ]}
          />
        )
      }
    >
      {data && (
        <>
          <p className="sr-only">
            Payroll chart for {data.scope.label}: {data.summary.batch_count} batches totaling
            {` ${formatRwf(data.summary.total_net)}`} net.
          </p>
          <ChartContainer config={payrollChartConfig} className="h-[340px] w-full aspect-auto">
            <ComposedChart data={data.batch_trend} margin={{ left: 8, right: 16, top: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={22}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={58}
                tickFormatter={formatRwfCompact}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-[9rem] items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {payrollChartConfig[String(name) as keyof typeof payrollChartConfig]?.label ?? String(name)}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {formatRwf(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="gross"
                name="gross"
                fill="var(--color-gross)"
                radius={[4, 4, 0, 0]}
                maxBarSize={46}
              />
              <Bar
                dataKey="net"
                name="net"
                fill="var(--color-net)"
                radius={[4, 4, 0, 0]}
                maxBarSize={46}
              />
              <Line
                dataKey="tax"
                name="tax"
                type="monotone"
                stroke="var(--color-tax)"
                strokeWidth={2}
                dot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </ComposedChart>
          </ChartContainer>
        </>
      )}
    </AnalyticsChartCard>
  );
}

function PayrollStatusCard({
  state,
  onRetry,
  filters,
  isDisabled,
  onFilterChange,
}: {
  state: LoadState<PayrollDashboardAnalytics>;
  onRetry: () => void;
  filters: DashboardFilters;
  isDisabled: boolean;
  onFilterChange: (updates: Record<string, string | null | undefined>) => void;
}) {
  const data = state.data;
  const hasData = !!data && data.status_distribution.length > 0;
  const height = Math.max(280, (data?.status_distribution.length ?? 0) * 48);

  return (
    <AnalyticsChartCard
      title="Batch status"
      description={data?.scope.label ?? "Review state of scoped payroll batches"}
      icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
      state={state.status}
      error={state.status === "error" ? state.error : undefined}
      empty={!hasData}
      emptyTitle="No batch statuses to summarize"
      emptyDescription="No payroll batches match the current period and status filters."
      hasLoadedData={!!data}
      onRetry={onRetry}
      headerFilters={
        <div className="grid w-full gap-2 sm:grid-cols-3">
          <LabeledSelect
            label="Batch status"
            value={filters.payroll_status}
            options={data?.filters.statuses ?? []}
            allLabel="All statuses"
            disabled={isDisabled}
            onValueChange={(value) => onFilterChange({ payroll_status: value })}
          />
          <LabeledSelect
            label="Department"
            value={filters.payroll_department_id}
            options={data?.filters.departments ?? []}
            allLabel="All departments"
            disabled={isDisabled}
            onValueChange={(value) => onFilterChange({ payroll_department: value })}
          />
          <LabeledSelect
            label="Position"
            value={filters.payroll_position_id}
            options={data?.filters.positions ?? []}
            allLabel="All positions"
            disabled={isDisabled}
            onValueChange={(value) => onFilterChange({ payroll_position: value })}
          />
        </div>
      }
      summary={
        data && (
          <SummaryGrid
            items={[
              ["Pending", data.summary.pending_batches.toLocaleString()],
              ["Total statuses", data.status_distribution.length.toLocaleString()],
            ]}
          />
        )
      }
    >
      {data && (
        <>
          <p className="sr-only">
            Batch status chart for {data.scope.label}: {data.status_distribution.length} statuses represented.
          </p>
          <ChartContainer
            config={statusChartConfig}
            className="w-full aspect-auto"
            style={{ height }}
          >
            <BarChart
              data={data.status_distribution}
              layout="vertical"
              margin={{ left: 8, right: 34, top: 12, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis
                dataKey="label"
                type="category"
                width={150}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" name="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} maxBarSize={28}>
                <LabelList
                  dataKey="count"
                  position="right"
                  className="fill-foreground"
                  fontSize={12}
                  fontWeight={600}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </>
      )}
    </AnalyticsChartCard>
  );
}

function AnalyticsChartCard({
  title,
  description,
  icon,
  state,
  error,
  empty,
  emptyTitle,
  emptyDescription,
  summary,
  headerFilters,
  children,
  onRetry,
  className,
  hasLoadedData,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  state: LoadState<unknown>["status"];
  error?: string;
  empty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  summary?: ReactNode;
  headerFilters?: ReactNode;
  children: ReactNode;
  onRetry: () => void;
  className?: string;
  hasLoadedData?: boolean;
}) {
  const isInitialLoading = state === "loading" && !hasLoadedData;
  const isRefreshing = state === "loading" && hasLoadedData;
  const isBlockingError = state === "error" && !hasLoadedData;
  const isRefreshError = state === "error" && hasLoadedData;

  return (
    <Card className={cn("border border-border shadow-sm", className)}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                {icon}
              </span>
              <span className="truncate">{title}</span>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {isRefreshing ? (
            <Badge variant="outline" className="shrink-0 border-primary/30 bg-primary/10 text-primary">
              Updating
            </Badge>
          ) : state === "success" ? (
            <Badge variant="outline" className="shrink-0 border-success/30 bg-success/10 text-success">
              Ready
            </Badge>
          ) : null}
        </div>
        {headerFilters}
        {summary}
      </CardHeader>
      <CardContent>
        {isInitialLoading ? (
          <LoadingState
            title="Loading chart"
            description="Preparing scoped analytics for this view."
            className="min-h-[320px]"
          />
        ) : isBlockingError ? (
          <ErrorState
            title="Chart could not load"
            description={error}
            action={<RetryButton onClick={onRetry} />}
            className="min-h-[320px]"
          />
        ) : isRefreshError ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <span>{error ?? "The chart could not refresh. Showing the last loaded result."}</span>
              <RetryButton onClick={onRetry} />
            </div>
            {empty ? (
              <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                className="min-h-[320px]"
              />
            ) : (
              children
            )}
          </div>
        ) : empty ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            className="min-h-[320px]"
          />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function SummaryGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{label}</dt>
          <dd className="truncate text-sm font-semibold text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onValueChange,
  disabled,
  allLabel,
}: {
  label: string;
  value: string;
  options: Array<AnalyticsOption | { value: string; label: string }>;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  allLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-10 bg-background" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel ?? "All"}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
      <Input
        type="date"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10"
      />
    </label>
  );
}

function getPresetDates(range: RangePreset) {
  const today = new Date();
  const to = format(today, "yyyy-MM-dd");

  if (range === "current_month") {
    return { from: format(startOfMonth(today), "yyyy-MM-dd"), to };
  }
  if (range === "last_30_days") {
    return { from: format(subDays(today, 29), "yyyy-MM-dd"), to };
  }
  if (range === "last_90_days") {
    return { from: format(subDays(today, 89), "yyyy-MM-dd"), to };
  }
  if (range === "year_to_date") {
    return { from: format(startOfYear(today), "yyyy-MM-dd"), to };
  }
  if (range === "last_24_months") {
    return { from: format(startOfMonth(subMonths(today, 24)), "yyyy-MM-dd"), to };
  }

  return { from: format(startOfMonth(subMonths(today, 11)), "yyyy-MM-dd"), to };
}

function analyticsCacheKey(domain: "employees" | "payroll", filters: Record<string, string>) {
  const key = Object.entries(filters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("&");

  return `${domain}:${key}`;
}

function parseRangePreset(value: string | null): RangePreset {
  if (RANGE_PRESETS.some((preset) => preset.value === value)) {
    return value as RangePreset;
  }
  return "last_12_months";
}

function errorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    (error as any).response?.data?.message
  ) {
    const message = (error as any).response.data.message;
    return Array.isArray(message) ? message.join(" ") : String(message);
  }
  return fallback;
}

function formatRwf(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)} RWF`;
}

function formatRwfCompact(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}
