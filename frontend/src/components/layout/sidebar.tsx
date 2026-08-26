"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Grid01, Users01, MarkerPin01, Building02, UserCircle, Briefcase01, Briefcase02,
  Calendar, File02, Settings01, LogOut01, Bell01, Percent01, Activity, Coins01,
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
  adminName?: string;
  userName?: string;
  href: string;
  icon: NavIcon;
  permission?: string;
  permissions?: string[];
  variants?: ('admin' | 'user')[];
}

interface SidebarSection {
  title: string;
  items: SidebarMenuItem[];
}

export function Sidebar({ type }: SidebarProps) {
  const pathname = usePathname();
  const params = useParams();
  const { user, logout, hasPermission } = useAuth();

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  const sections: SidebarSection[] = [
    {
      title: 'Overview',
      items: [
        { name: 'Dashboard', href: `${basePath}`, icon: Grid01 },
      ],
    },
    {
      title: 'People',
      items: [
        { name: 'Users', userName: 'Team Access', href: `${basePath}/users`, icon: Users01, permission: 'users.read' },
        { name: 'Employees', href: `${basePath}/employees`, icon: Briefcase01, permission: 'employees.read' },
        { name: 'Positions', href: `${basePath}/positions`, icon: Briefcase02, permission: 'positions.read' },
      ],
    },
    {
      title: 'Organization',
      items: [
        { name: 'Branches', href: `${basePath}/locations`, icon: MarkerPin01, permission: 'branches.read_all', variants: ['admin'] },
        { name: 'Departments', href: `${basePath}/departments`, icon: Building02, permission: 'departments.manage', variants: ['admin'] },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'Attendance', href: `${basePath}/attendance`, icon: Calendar, permission: 'attendance.read' },
        { name: 'Payroll', adminName: 'Payroll Engine', userName: 'My Payroll', href: `${basePath}/payroll`, icon: File02, permission: 'payroll.read' },
        { name: 'Ikimina Savings', href: `${basePath}/ikimina`, icon: Coins01, permission: 'ikimina.read', variants: ['admin'] },
      ],
    },
    {
      title: 'Administration',
      items: [
        { name: 'Tax Setup', href: `${basePath}/payments`, icon: Percent01, permission: 'system-config.manage', variants: ['admin'] },
        { name: 'Allowance Setup', href: `${basePath}/allowances`, icon: Coins01, permission: 'allowances.manage', variants: ['admin'] },
        { name: 'Audit Logs', href: `${basePath}/audit-logs`, icon: Activity, permission: 'audit.view' },
        { name: 'Settings', href: `${basePath}/settings`, icon: Settings01, permissions: ['roles.manage', 'roles.manage_own_location', 'system-config.manage'], variants: ['admin'] },
      ],
    },
    {
      title: 'Account',
      items: [
        { name: 'Notifications', href: `${basePath}/notifications`, icon: Bell01 },
        { name: 'Profile', href: `${basePath}/profile`, icon: UserCircle },
      ],
    },
  ];

  const isItemVisible = (item: SidebarMenuItem) => {
    if (item.variants && !item.variants.includes(type)) return false;
    if (item.permissions?.length && !item.permissions.some((permission) => hasPermission(permission))) return false;
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  };

  const visibleSections = sections
    .map((section) => ({ ...section, items: section.items.filter(isItemVisible) }))
    .filter((section) => section.items.length > 0);

  const mobileItems = visibleSections.flatMap((section) => section.items);

  return (
    <aside className="sticky top-0 z-30 flex w-full shrink-0 flex-col border-b border-border bg-card lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2 px-4 py-3 lg:p-5">
        <div className="shrink-0 rounded-lg border border-border bg-white p-1">
          <Image src="/pics/reg-logo.png" alt="REG Logo" width={32} height={32} className="h-8 w-8 object-contain" />
        </div>
        <div className="min-w-0">
          <span className="block truncate text-base font-semibold text-foreground lg:text-lg">REG Pay</span>
          <span className="hidden truncate text-xs text-muted-foreground lg:block">Rwanda Energy Group</span>
        </div>
      </div>

      <div className="mb-4 hidden items-center gap-4 px-5 lg:flex">
        <NotificationBell type={type} />
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
        {mobileItems.map((item) => {
          const label = (type === 'admin' ? item.adminName : item.userName) ?? item.name;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>

      <ScrollArea className="hidden flex-1 px-3 lg:block">
        <nav className="space-y-5 py-2 pb-6">
          {visibleSections.map((section) => {
            return (
              <div key={section.title}>
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase text-muted-foreground/70">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const label = (type === 'admin' ? item.adminName : item.userName) ?? item.name;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} size={20} />
                        <span className="text-sm">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="mt-auto hidden border-t border-border bg-secondary/5 p-3 lg:block">
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card p-2 shadow-sm">
          <Avatar className="h-10 w-10 border border-border shadow-sm">
            <AvatarImage src={getAvatarUrl(user?.avatar_url)} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {user?.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold truncate text-foreground">{user?.name}</span>
            <span className="text-[9px] font-bold text-muted-foreground truncate uppercase">{user?.role}</span>
          </div>
        </div>
        <Button
          variant="outline"
          className="h-10 w-full justify-start gap-3 border border-border text-xs font-semibold text-muted-foreground shadow-none hover:bg-destructive/5 hover:text-destructive"
          onClick={logout}
        >
          <LogOut01 className="h-4 w-4" size={16} />
          <span>Logout</span>
        </Button>
      </div>
    </aside>
  );
}
