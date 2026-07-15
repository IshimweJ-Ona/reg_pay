"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Clock, Loader2, RotateCw, User, MapPin, Building2, Shield, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAuditLogs, type AuditLogEntry } from '@/api/audit-logs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import dayjs from '@/lib/dayjs';
import { formatDisplayName } from '@/lib/utils';

export default function AuditLogsPage() {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const [auditRefreshing, setAuditRefreshing] = useState(false);
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const canViewAudit = hasPermission('audit.view');

  const selectedAudit = auditLogs.find((log) => log.id === selectedAuditId) ?? auditLogs[0];

  useEffect(() => {
    if (user && !canViewAudit) {
      router.replace('/unauthorized');
      return;
    }
    if (canViewAudit) {
      loadAuditLogs();
    }
  }, [canViewAudit, user, router]);

  useEffect(() => {
    if (!canViewAudit) return;
    const interval = window.setInterval(refreshAuditLogs, 15000);
    return () => window.clearInterval(interval);
  }, [canViewAudit]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const logs = await getAuditLogs(100);
      setAuditLogs(logs);
      if (logs.length > 0) {
        setSelectedAuditId(logs[0].id);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Audit logs failed to load',
        description: error?.response?.data?.message ?? 'Could not load system audit logs.',
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAuditLogs = async () => {
    setAuditRefreshing(true);
    try {
      const logs = await getAuditLogs(100);
      setAuditLogs(logs);
      setSelectedAuditId((current) => current || logs[0]?.id || '');
    } catch (error: any) {
      // Don't toast on auto-refresh failures
    } finally {
      setAuditRefreshing(false);
    }
  };

  const formatAuditTime = (value: string) =>
    dayjs(value).tz('Africa/Kigali').format('MMM D, YYYY HH:mm:ss');

  const renderAuditJson = (value: any) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return 'None';
    return JSON.stringify(value, null, 2);
  };

  const getActionVariant = (action: string) => {
    switch (action) {
      case 'CREATED': return 'default';
      case 'APPROVED': return 'success';
      case 'DENIED': case 'DELETED': return 'destructive';
      case 'UPDATED': case 'LOGIN': return 'secondary';
      default: return 'outline';
    }
  };

  const getModuleIcon = (module: string) => {
    switch (module) {
      case 'AUTH': return <Fingerprint className="h-3.5 w-3.5" />;
      case 'EMPLOYEES': case 'ATTENDANCE': return <User className="h-3.5 w-3.5" />;
      case 'ORGANIZATION': case 'DEPARTMENTS': return <Building2 className="h-3.5 w-3.5" />;
      case 'PAYROLL': return <Activity className="h-3.5 w-3.5" />;
      default: return <Activity className="h-3.5 w-3.5" />;
    }
  };

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canViewAudit) return null;

  return (
    <div className="max-w-[1800px] space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Monitor system-wide activity, data changes, and user operations with full traceability.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" /> System Activity Trail
              </CardTitle>
              <CardDescription>Every action recorded with who did it, their role, location, and what changed.</CardDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={refreshAuditLogs} disabled={auditRefreshing}>
              {auditRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          <div className="rounded-lg border overflow-hidden">
            <ScrollArea className="h-[520px]">
              <Table>
                <TableHeader className="bg-secondary/40 sticky top-0">
                  <TableRow>
                    <TableHead className="w-[180px]">Actor</TableHead>
                    <TableHead className="w-[140px]">Role / Location</TableHead>
                    <TableHead className="w-[130px]">Timestamp</TableHead>
                    <TableHead className="w-[90px]">Module</TableHead>
                    <TableHead className="w-[80px]">Action</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.length > 0 ? auditLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      className={`cursor-pointer ${selectedAudit?.id === log.id ? 'bg-primary/5 font-semibold' : ''}`}
                      onClick={() => setSelectedAuditId(log.id)}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{log.user?.name || log.user?.email || 'System'}</span>
                          <span className="text-[10px] text-muted-foreground">{log.user?.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {log.user?.roles && log.user.roles.length > 0 && (
                            <Badge variant="outline" className="w-fit text-[9px] font-mono">
                              {log.user.roles[0]}
                            </Badge>
                          )}
                          {log.user?.working_location && (
                            <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">
                              {formatDisplayName(log.user.working_location.name)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatAuditTime(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 text-[10px] font-mono">
                          {getModuleIcon(log.module_name)}
                          {log.module_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionVariant(log.action) as any} className="text-[10px] font-mono">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-xs" title={log.activity_description}>
                        {log.activity_description}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No audit logs found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <div className="rounded-lg border bg-secondary/10 p-4">
            {selectedAudit ? (
              <ScrollArea className="h-[520px] pr-2">
                <div className="space-y-5">
                  {/* Header */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activity Detail</p>
                    <h3 className="text-sm font-bold text-slate-800 mt-1">{selectedAudit.activity_description}</h3>
                  </div>

                  {/* Actor Info */}
                  <div className="rounded-lg bg-white p-3 border shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Performed By</p>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-bold text-primary text-sm">
                          {selectedAudit.user?.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-sm">{selectedAudit.user?.name || 'System'}</p>
                        <p className="text-xs text-muted-foreground">{selectedAudit.user?.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      {selectedAudit.user?.roles && selectedAudit.user.roles.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Role</p>
                          <p className="font-semibold">{selectedAudit.user.roles.join(', ')}</p>
                        </div>
                      )}
                      {selectedAudit.user?.working_location && (
                        <div>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Location
                          </p>
                          <p className="font-semibold">{formatDisplayName(selectedAudit.user.working_location.name)}</p>
                        </div>
                      )}
                      {selectedAudit.user?.department && (
                        <div>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> Department
                          </p>
                          <p className="font-semibold">{formatDisplayName(selectedAudit.user.department.name)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timestamp & IP */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-md bg-white p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">Timestamp</p>
                      <p className="font-semibold">{formatAuditTime(selectedAudit.created_at)}</p>
                    </div>
                    <div className="rounded-md bg-white p-2.5 border">
                      <p className="text-[10px] text-muted-foreground">IP Address</p>
                      <p className="font-semibold">{selectedAudit.ip_address ?? 'N/A'}</p>
                    </div>
                  </div>

                  {/* Target Entity */}
                  <div className="rounded-md bg-white p-2.5 border text-xs">
                    <p className="text-[10px] text-muted-foreground">Target Entity</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] font-mono">{selectedAudit.entity_table}</Badge>
                      <span className="font-mono text-muted-foreground">#{selectedAudit.entity_id}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">{selectedAudit.module_name}</Badge>
                    </div>
                  </div>

                  {/* Affected Employee */}
                  {selectedAudit.employee && (
                    <div className="rounded-lg bg-white p-3 border shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Affected Employee</p>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{selectedAudit.employee.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        {selectedAudit.employee.national_id && (
                          <div>
                            <p className="text-[10px] text-muted-foreground">National ID</p>
                            <p className="font-mono">{selectedAudit.employee.national_id}</p>
                          </div>
                        )}
                        {selectedAudit.employee.department && (
                          <div>
                            <p className="text-[10px] text-muted-foreground">Department</p>
                            <p className="font-semibold">{formatDisplayName(selectedAudit.employee.department.name)}</p>
                          </div>
                        )}
                        {selectedAudit.employee.working_location && (
                          <div>
                            <p className="text-[10px] text-muted-foreground">Location</p>
                            <p className="font-semibold">{formatDisplayName(selectedAudit.employee.working_location.name)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Changed Fields */}
                  {selectedAudit.changed_fields && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Changed Fields</p>
                      <pre className="max-h-32 overflow-auto rounded-md bg-white p-2 text-[10px] font-mono border">{renderAuditJson(selectedAudit.changed_fields)}</pre>
                    </div>
                  )}

                  {/* New Values */}
                  {selectedAudit.new_values && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New Values</p>
                      <pre className="max-h-32 overflow-auto rounded-md bg-white p-2 text-[10px] font-mono border">{renderAuditJson(selectedAudit.new_values)}</pre>
                    </div>
                  )}

                  {/* Old Values */}
                  {selectedAudit.old_values && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Old Values</p>
                      <pre className="max-h-32 overflow-auto rounded-md bg-white p-2 text-[10px] font-mono border">{renderAuditJson(selectedAudit.old_values)}</pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-full min-h-72 items-center justify-center text-center text-muted-foreground">
                <div>
                  <Clock className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                  <p>No activity selected.</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}