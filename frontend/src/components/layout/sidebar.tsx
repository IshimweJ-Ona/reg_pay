"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, Users, MapPin, Building2, UserCircle, 
  Calendar, CreditCard, FileText, Settings, LogOut, ShieldCheck, Bell, Percent, Activity, Coins
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  type: 'admin' | 'user';
}

interface SidebarMenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
}

export function Sidebar({ type }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();
  const params = useParams();
  const { user, logout, hasPermission } = useAuth();

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  const adminMenuItems: SidebarMenuItem[] = [
    { name: 'Dashboard', href: `${basePath}`, icon: LayoutDashboard },
    { name: 'Users', href: `${basePath}/users`, icon: Users, permission: 'users.read' },
    { name: 'Employees', href: `${basePath}/employees`, icon: UserCircle, permission: 'employees.read' },
    { 
      name: 'Branches', 
      href: `${basePath}/locations`, 
      icon: MapPin, 
      permission: 'branches.manage'
    },
    { name: 'Departments', href: `${basePath}/departments`, icon: Building2, permission: 'departments.manage' },
    { name: 'Attendance', href: `${basePath}/attendance`, icon: Calendar, permission: 'attendance.read' },
    { name: 'Payroll Engine', href: `${basePath}/payroll`, icon: FileText, permission: 'payroll.read' },
    { name: 'Ikimina Savings', href: `${basePath}/ikimina`, icon: Coins, permission: 'ikimina.read' },
    { name: 'Tax Setup', href: `${basePath}/payments`, icon: Percent, permission: 'system-config.manage' },
    { name: 'Audit Logs', href: `${basePath}/audit-logs`, icon: Activity, permission: 'audit.view' },
    { name: 'Notifications', href: `${basePath}/notifications`, icon: Bell },
    { name: 'Profile', href: `${basePath}/profile`, icon: UserCircle },
    { name: 'Settings', href: `${basePath}/settings`, icon: Settings, permission: 'settings.manage_system' },
  ];

  const userMenuItems: SidebarMenuItem[] = [
    { name: 'Dashboard', href: `${basePath}`, icon: LayoutDashboard },
    { name: 'Employees', href: `${basePath}/employees`, icon: UserCircle, permission: 'employees.read' },
    { name: 'Team Access', href: `${basePath}/users`, icon: Users, permission: 'users.read' },
    { name: 'My Payroll', href: `${basePath}/payroll`, icon: FileText, permission: 'payroll.read' },
    { name: 'Attendance', href: `${basePath}/attendance`, icon: Calendar, permission: 'attendance.read' },
    { name: 'Audit Logs', href: `${basePath}/audit-logs`, icon: Activity, permission: 'audit.view' },
    { name: 'Notifications', href: `${basePath}/notifications`, icon: Bell },
    { name: 'Profile', href: `${basePath}/profile`, icon: UserCircle },
  ];

  const menuItems = type === 'admin' ? adminMenuItems : userMenuItems;

  return (
    <aside className={cn(
      "h-screen flex flex-col transition-all duration-300 bg-white border-r relative",
      collapsed ? "w-20" : "w-72"
    )}>
      <div className="p-6 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <span className="font-headline font-bold text-xl tracking-tight">REG(Rwanda Energy Group)</span>
          </div>
        )}
        {collapsed && <ShieldCheck className="h-8 w-8 text-primary mx-auto" />}
      </div>

      <div className={cn("px-6 mb-4 flex items-center gap-4", collapsed ? "justify-center" : "")}>
        <NotificationBell type={type} />
      </div>

      <ScrollArea className="flex-1 px-4">
        <nav className="space-y-1 py-4">
          {menuItems.map((item) => {
            if (item.permission && !hasPermission(item.permission)) return null;

            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium",
                  isActive 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-muted-foreground")} />
                {!collapsed && <span className="text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t mt-auto bg-secondary/5">
        <div className={cn("flex items-center gap-3 p-2 rounded-xl mb-4 bg-white border shadow-sm", collapsed ? "justify-center" : "")}>
          <Avatar className="h-10 w-10 border shadow-sm">
            <AvatarImage src={getAvatarUrl(user?.avatar_url)} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {user?.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold truncate">{user?.name}</span>
              <span className="text-[9px] font-bold text-muted-foreground truncate uppercase tracking-widest">{user?.role}</span>
            </div>
          )}
        </div>
        <Button 
          variant="outline" 
          className={cn("w-full justify-start gap-3 border-none shadow-none text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-bold text-xs h-10", collapsed ? "px-0 justify-center" : "")}
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Exit Secure Area</span>}
        </Button>
      </div>
    </aside>
  );
}
