
"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from '@/hooks/use-toast';
import { Save, User as UserIcon, Mail, Building2, MapPin, Camera } from 'lucide-react';

export default function UserProfilePage() {
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
        <h1 className="text-3xl font-headline font-bold">Employee Profile</h1>
        <p className="text-muted-foreground">Manage your personal and professional identity within REG(Rwanda Energy Group).</p>
      </div>

      <div className="space-y-6">
        <Card className="border-none shadow-sm overflow-hidden">
          <div className="h-24 bg-primary/10 relative" />
          <CardContent className="pt-0">
            <div className="flex flex-col md:flex-row items-end gap-6 -mt-12 mb-8">
              <div className="relative">
                <Avatar className="h-32 w-32 border-4 border-white shadow-xl">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="text-3xl font-bold bg-secondary text-primary">
                    {user?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <button className="absolute bottom-2 right-2 h-8 w-8 bg-white rounded-full shadow-lg border flex items-center justify-center hover:bg-secondary transition-colors">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="pb-2">
                <h3 className="text-2xl font-bold">{user?.name}</h3>
                <p className="text-muted-foreground flex items-center gap-1.5 font-medium">
                  {user?.role.replace('_', ' ')}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/20">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Department</Label>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" /> {user?.department ?? 'Unassigned'}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Base Location</Label>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> {user?.location ?? 'Unassigned'}
                  </p>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 shadow-lg shadow-primary/20">
                <Save className="mr-2 h-4 w-4" /> Save Profile Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
