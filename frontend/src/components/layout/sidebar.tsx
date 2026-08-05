"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Grid01, Users01, MarkerPin01, Building02, UserCircle, Briefcase01,
  Calendar, File02, Settings01, LogOut01, Bell01, Percent01, Activity, Coins01
} from '@untitledui/icons';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils';

interface SidebarProps {
  type: 'admin' | 'user';
}

type NavIcon = React.ComponentType<{ className?: string; size?: number }>;

interface SidebarMenuItem {
  name: string;
  href: string;
  icon: NavIcon;
  permission?: string;
  permissions?: string[];
}

export function Sidebar({ type }: SidebarProps) {
  const [collapsed] = React.useState(false);
  const pathname = usePathname();
  const params = useParams();
  const { user, logout, hasPermission } = useAuth();

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  const adminMenuItems: SidebarMenuItem[] = [
    { name: 'Dashboard', href: `${basePath}`, icon: Grid01 },
    { name: 'Users', href: `${basePath}/users`, icon: Users01, permission: 'users.read' },
    { name: 'Employees', href: `${basePath}/employees`, icon: Briefcase01, permission: 'employees.read' },
    {
      name: 'Branches',
      href: `${basePath}/locations`,
      icon: MarkerPin01,
      permission: 'branches.read_all'
    },
    { name: 'Departments', href: `${basePath}/departments`, icon: Building02, permission: 'departments.manage' },
    { name: 'Attendance', href: `${basePath}/attendance`, icon: Calendar, permission: 'attendance.read' },
    { name: 'Payroll Engine', href: `${basePath}/payroll`, icon: File02, permission: 'payroll.read' },
    { name: 'Ikimina Savings', href: `${basePath}/ikimina`, icon: Coins01, permission: 'ikimina.read' },
    { name: 'Tax Setup', href: `${basePath}/payments`, icon: Percent01, permission: 'system-config.manage' },
    { name: 'Audit Logs', href: `${basePath}/audit-logs`, icon: Activity, permission: 'audit.view' },
    { name: 'Notifications', href: `${basePath}/notifications`, icon: Bell01 },
    { name: 'Profile', href: `${basePath}/profile`, icon: UserCircle },
    { name: 'Settings', href: `${basePath}/settings`, icon: Settings01, permissions: ['roles.manage', 'roles.manage_own_location', 'system-config.manage'] },
  ];

  const userMenuItems: SidebarMenuItem[] = [
    { name: 'Dashboard', href: `${basePath}`, icon: Grid01 },
    { name: 'Employees', href: `${basePath}/employees`, icon: Briefcase01, permission: 'employees.read' },
    { name: 'Team Access', href: `${basePath}/users`, icon: Users01, permission: 'users.read' },
    { name: 'My Payroll', href: `${basePath}/payroll`, icon: File02, permission: 'payroll.read' },
    { name: 'Attendance', href: `${basePath}/attendance`, icon: Calendar, permission: 'attendance.read' },
    { name: 'Audit Logs', href: `${basePath}/audit-logs`, icon: Activity, permission: 'audit.view' },
    { name: 'Notifications', href: `${basePath}/notifications`, icon: Bell01 },
    { name: 'Profile', href: `${basePath}/profile`, icon: UserCircle },
  ];

  const menuItems = type === 'admin' ? adminMenuItems : userMenuItems;

  return (
    <aside className={cn(
      "h-screen flex flex-col transition-all duration-300 bg-card border-r border-border relative",
      collapsed ? "w-20" : "w-72"
    )}>
      <div className="p-6 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="bg-white p-1 rounded-lg border border-border shrink-0">
              <Image src="/pics/reg-logo.png" alt="REG Logo" width={32} height={32} className="h-8 w-8 object-contain" />
            </div>
            <span className="font-headline font-bold text-xl tracking-tight text-foreground">REG(Rwanda Energy Group)</span>
          </div>
        )}
        {collapsed && (
          <div className="bg-white p-1 rounded-lg border border-border mx-auto">
            <Image src="/pics/reg-logo.png" alt="REG Logo" width={32} height={32} className="h-8 w-8 object-contain" />
          </div>
        )}
      </div>

      <div className={cn("px-6 mb-4 flex items-center gap-4", collapsed ? "justify-center" : "")}>
        <NotificationBell type={type} />
      </div>

      <ScrollArea className="flex-1 px-4">
        <nav className="space-y-1 py-4">
          {menuItems.map((item) => {
            if (item.permissions?.length && !item.permissions.some((permission) => hasPermission(permission))) return null;
            if (item.permission && !hasPermission(item.permission)) return null;

            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} size={20} />
                {!collapsed && <span className="text-sm">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-border mt-auto bg-secondary/5">
        <div className={cn("flex items-center gap-3 p-2 rounded-xl mb-4 bg-card border border-border shadow-sm", collapsed ? "justify-center" : "")}>
          <Avatar className="h-10 w-10 border border-border shadow-sm">
            <AvatarImage src={getAvatarUrl(user?.avatar_url)} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {user?.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold truncate text-foreground">{user?.name}</span>
              <span className="text-[9px] font-bold text-muted-foreground truncate uppercase tracking-widest">{user?.role}</span>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          className={cn("w-full justify-start gap-3 border-none shadow-none text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-bold text-xs h-10", collapsed ? "px-0 justify-center" : "")}
          onClick={logout}
        >
          <LogOut01 className="h-4 w-4" size={16} />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
