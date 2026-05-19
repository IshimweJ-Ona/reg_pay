
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Calendar, Search, Filter, Download, UserCheck, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getTimeRecords } from '@/api/attendance';

export default function AttendanceMonitoringPage() {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    getTimeRecords().then(setRecords).catch(() => setRecords([]));
  }, []);

  const presentCount = useMemo(() => records.filter((record) => record.attendance_status === 'PRESENT').length, [records]);
  const absentCount = useMemo(() => records.filter((record) => record.attendance_status === 'ABSENT').length, [records]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Attendance Analytics</h1>
          <p className="text-muted-foreground">Monitor workforce presence and punctuality trends.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11"><Download className="mr-2 h-4 w-4" /> Export Audit Log</Button>
          <Button className="h-11 shadow-lg shadow-primary/20"><Calendar className="mr-2 h-4 w-4" /> Shift Scheduler</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <UserCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Present Today</p>
            <p className="text-2xl font-bold">{presentCount} / {records.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Late Arrivals</p>
            <p className="text-2xl font-bold">0</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Unresolved Absences</p>
            <p className="text-2xl font-bold">{absentCount}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search personnel logs..." className="pl-10 h-11 border-none bg-secondary/30" />
        </div>
        <Button variant="outline" className="h-11 border-dashed"><Filter className="h-4 w-4" /></Button>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Personnel</TableHead>
              <TableHead className="font-bold">Department</TableHead>
              <TableHead className="font-bold">Check-In</TableHead>
              <TableHead className="font-bold">Check-Out</TableHead>
              <TableHead className="font-bold">Date</TableHead>
              <TableHead className="font-bold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((rec) => (
              <TableRow key={rec.id} className="hover:bg-secondary/20 transition-colors">
                <TableCell className="font-semibold">{`${rec.employee?.first_name ?? ''} ${rec.employee?.last_name ?? ''}`.trim() || rec.employee_id}</TableCell>
                <TableCell>{rec.employee?.department?.name ?? 'Unassigned'}</TableCell>
                <TableCell className="font-mono text-xs">{rec.clock_in ? new Date(rec.clock_in).toLocaleTimeString() : '-'}</TableCell>
                <TableCell className="font-mono text-xs">{rec.clock_out ? new Date(rec.clock_out).toLocaleTimeString() : '-'}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(rec.attendance_date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge className={
                    rec.attendance_status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                    'bg-rose-500/10 text-rose-600 border-rose-500/20'
                  }>
                    {rec.attendance_status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
