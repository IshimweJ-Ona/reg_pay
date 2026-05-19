
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PERMISSIONS } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Save, ShieldAlert, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PermissionsManagementPage() {
  const { toast } = useToast();
  const [activePermissions, setActivePermissions] = useState<Record<string, boolean>>({});

  const togglePermission = (key: string) => {
    setActivePermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const savePermissions = () => {
    toast({ title: "Permissions Synchronized", description: "RBAC policies have been updated successfully." });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Role-Based Access Control</h1>
          <p className="text-muted-foreground">Define and distribute system permissions across the organization.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11">
            <RotateCcw className="mr-2 h-4 w-4" /> Reset Changes
          </Button>
          <Button className="h-11 shadow-lg shadow-primary/20" onClick={savePermissions}>
            <Save className="mr-2 h-4 w-4" /> Save Global Policy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(PERMISSIONS).map(([category, perms]) => (
          <Card key={category} className="border-none shadow-sm flex flex-col">
            <CardHeader className="bg-secondary/30 pb-4">
              <CardTitle className="text-lg flex items-center justify-between">
                {category.replace('_', ' ')}
                <ShieldAlert className="h-4 w-4 text-muted-foreground opacity-50" />
              </CardTitle>
              <CardDescription>Access control for {category.toLowerCase()} modules.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 flex-1">
              {perms.map((p) => (
                <div key={p} className="flex items-center justify-between group">
                  <Label htmlFor={p} className="text-sm font-medium cursor-pointer group-hover:text-primary transition-colors">
                    {p.split('.')[1].charAt(0).toUpperCase() + p.split('.')[1].slice(1)} Access
                  </Label>
                  <Switch 
                    id={p} 
                    checked={!!activePermissions[p]} 
                    onCheckedChange={() => togglePermission(p)} 
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
