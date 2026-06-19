
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from '@/hooks/use-toast';
import { Save, User as UserIcon, Mail, Shield, Camera } from 'lucide-react';
import { getAvatarUrl } from '@/lib/utils';

export default function AdminProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) toast({ title: "Profile Saved", description: "Profile edits are ready for backend profile update support." });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">Administrative Profile</h1>
        <p className="text-muted-foreground">Manage your corporate identity and security parameters.</p>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Primary identification details for system logs.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="flex items-center gap-6 mb-8">
                <div className="relative group">
                  <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
                    <AvatarImage src={getAvatarUrl(user?.avatar_url)} />
                    <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                      {user?.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <button type="button" className="absolute bottom-0 right-0 h-8 w-8 bg-white rounded-full shadow-lg border flex items-center justify-center hover:bg-secondary transition-colors">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-bold">{user?.name}</h3>
                  <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold">{user?.role}</p>
                  <p className="text-xs text-muted-foreground mt-1">ID: {user?.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Full Name</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Corporate Email</Label>
                  <Input 
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 shadow-lg shadow-primary/20">
                <Save className="mr-2 h-4 w-4" /> Synchronize Identity
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Security & Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border bg-secondary/20">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-bold">Global Bypass Mode</p>
                  <p className="text-xs text-muted-foreground">Admins have implicit access to all platform modules.</p>
                </div>
              </div>
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
