
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, MapPin, Calendar, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { getTimeRecords } from '@/api/attendance';

export default function UserAttendancePage() {
  const { toast } = useToast();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [lastLog, setLastLog] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    getTimeRecords().then(setLogs).catch(() => setLogs([]));
  }, []);

  const hoursThisWeek = useMemo(() => logs.reduce((sum, log) => sum + Number(log.hours_worked ?? 0), 0), [logs]);

  const handleCheckAction = () => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setIsCheckedIn(!isCheckedIn);
    setLastLog(time);
    toast({
      title: !isCheckedIn ? "Checked In Successfully" : "Checked Out Successfully",
      description: `Timestamp recorded at ${time} from REG HQ.`,
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Attendance Log</h1>
          <p className="text-muted-foreground text-sm">Monitor your work hours and regional compliance rating.</p>
        </div>
        <div className="flex gap-4 p-1 bg-white border rounded-2xl shadow-sm">
          <div className="px-4 py-2 border-r">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Current Rating</p>
            <p className="text-lg font-bold text-emerald-600">{logs.length ? Math.round((logs.filter((log) => log.attendance_status === 'PRESENT').length / logs.length) * 100) : 0}%</p>
          </div>
          <div className="px-4 py-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Hours This Week</p>
            <p className="text-lg font-bold">{hoursThisWeek.toFixed(1)}h</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-none shadow-lg overflow-hidden flex flex-col">
          <div className={`h-2 ${isCheckedIn ? 'bg-emerald-500' : 'bg-primary'}`} />
          <CardHeader className="text-center pb-2">
            <div className={`mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${isCheckedIn ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
              <Clock className="h-8 w-8" />
            </div>
            <CardTitle>{isCheckedIn ? 'Session Active' : 'System Ready'}</CardTitle>
            <CardDescription>Record your working hours at REG HQ.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center gap-6 pt-4">
            <div className="bg-secondary/40 p-6 rounded-2xl text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Current Server Time</p>
              <p className="text-3xl font-headline font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> Kigali, Rwanda
              </div>
            </div>
            
            <Button 
              size="lg" 
              className={`h-16 rounded-2xl font-bold text-lg shadow-xl transition-all ${isCheckedIn ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'}`}
              onClick={handleCheckAction}
            >
              {isCheckedIn ? 'Clock Out' : 'Clock In'}
            </Button>
            
            {lastLog && (
              <p className="text-center text-xs text-muted-foreground font-medium italic">
                Last recorded action at {lastLog}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> Recent Entry Log
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 border-t">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Total Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-secondary/10 transition-colors">
                    <TableCell className="font-semibold">{new Date(log.attendance_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono text-xs">{log.clock_in ? new Date(log.clock_in).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{log.clock_out ? new Date(log.clock_out).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell className="font-bold text-xs">{Number(log.hours_worked ?? 0).toFixed(2)}h</TableCell>
                    <TableCell>
                      <Badge className={log.attendance_status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}>
                        {log.attendance_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
