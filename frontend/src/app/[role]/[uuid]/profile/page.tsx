"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { updateProfile } from '@/api/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { useToast } from '@/hooks/use-toast';
import { Key01 as KeyRound, Loading02 as Loader2, Mail01 as Mail, Save01 as Save, User01 as UserIcon } from '@untitledui/icons';
import { uploadUserAvatar } from '@/api/users';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingState } from '@/components/layout/page-state';

const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' ') || parts[0] || '',
  };
};

export default function AdminProfilePage() {
  const { user, refreshSession } = useAuth();
  const { toast } = useToast();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
    });
  }, [user?.name, user?.email]);

  if (!user) {
    return (
      <LoadingState
        title="Loading profile"
        description="Preparing your account information and security controls."
      />
    );
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { first_name, last_name } = splitName(formData.name);
    if (!first_name || !last_name) {
      toast({ variant: 'destructive', title: 'Name required', description: 'Please enter first and last name.' });
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        first_name,
        last_name,
        email: formData.email,
      });
      await refreshSession();
      toast({ title: "Profile saved", description: "Your name and email were updated." });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Profile update failed',
        description: error?.response?.data?.message ?? 'Please check the profile details.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match', description: 'Please confirm the same password.' });
      return;
    }

    setSavingPassword(true);
    try {
      await updateProfile({ password: passwordData.password });
      setPasswordData({ password: '', confirmPassword: '' });
      toast({ title: "Password updated", description: "Use the new password on your next login." });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Password update failed',
        description: error?.response?.data?.message ?? 'Password must include uppercase, lowercase, two digits, and a symbol.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <PageHeader
        title="Profile"
        description="Manage your name, email, password, and account photo."
      />

      <div className="space-y-6">
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>These details are used across system records and notifications.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="flex items-center gap-6 mb-8">
                {user && (
                  <AvatarUpload
                    avatarUrl={user.avatar_url}
                    fallbackText={user.name}
                    onUpload={(file) => uploadUserAvatar(user.uuid, file)}
                    onUploaded={() => refreshSession()}
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-xl font-bold truncate">{user?.name}</h3>
                  <p className="text-sm font-bold text-muted-foreground">{user?.role}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-name" className="flex items-center gap-2"><UserIcon className="h-4 w-4" size={16} /> Full Name</Label>
                  <Input
                    id="profile-name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email" className="flex items-center gap-2"><Mail className="h-4 w-4" size={16} /> Email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 shadow-sm shadow-primary/20" disabled={savingProfile}>
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" size={16} /> : <Save className="mr-2 h-4 w-4" size={16} />}
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-primary" size={20} /> Reset Password</CardTitle>
            <CardDescription>Choose a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-new-password">New Password</Label>
                <Input
                  id="profile-new-password"
                  type="password"
                  value={passwordData.password}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-confirm-password">Confirm Password</Label>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={savingPassword}>
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" size={16} /> : <KeyRound className="mr-2 h-4 w-4" size={16} />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
