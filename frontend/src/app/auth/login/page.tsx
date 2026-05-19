"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWorkingLocations, getDepartments, WorkingLocation, Department } from '@/api/working_locations';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone_number: z.string().min(8),
  gender: z.enum(['MALE', 'FEMALE']),
  working_location_id: z.string().optional(),
  department_id: z.string().optional(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function LoginPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('login');
  const [workingLocations, setWorkingLocations] = useState<WorkingLocation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedWorkingLocation, setSelectedWorkingLocation] = useState<string>('');

  useEffect(() => {
    const fetchWorkingLocations = async () => {
      try {
        const data = await getWorkingLocations();
        setWorkingLocations(data.working_locations || []);
      } catch (error) {
        console.error('Failed to fetch working locations:', error);
      }
    };
    fetchWorkingLocations();
  }, []);

  const handleWorkingLocationChange = async (locationId: string) => {
    setSelectedWorkingLocation(locationId);
    setDepartments([]);
    registerForm.setValue('department_id', '');
    if (locationId) {
      try {
        const data = await getDepartments(locationId);
        setDepartments(data.departments || []);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    }
  };

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", phone_number: "", gender: "MALE", working_location_id: "", department_id: "", password: "", confirmPassword: "" },
  });

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      await login(values.email, values.password);
      toast({ title: "Welcome back!", description: "Successfully logged in." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error?.response?.data?.message ?? "Please check your credentials.",
      });
    }
  };

  const onRegisterSubmit = async (values: z.infer<typeof registerSchema>) => {
    try {
      await register(values);
      toast({ title: "Account Created", description: "Your account is pending approval." });
      setActiveTab('login');
      registerForm.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error?.response?.data?.message ?? "Please verify your account information.",
      });
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-pearl-fog px-4">
      <div className="wave-bg" />
      
      <div className="z-10 w-full max-w-[450px]">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-3 rounded-2xl shadow-xl mb-4 border-2 border-primary/10">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-headline font-bold text-white mb-2">REG(Rwanda Energy Group)</h1>
          <p className="text-white/80 font-medium">Enterprise Payment Systems</p>
        </div>

        <Card className="shadow-2xl border-none backdrop-blur-sm bg-white/95">
          <CardHeader className="pb-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
                <TabsTrigger value="login" className="data-[state=active]:bg-white">Login</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-white">Register</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs value={activeTab}>
              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Corporate Email</FormLabel>
                          <FormControl>
                            <Input placeholder="admin@regnexus.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full font-semibold h-11" disabled={loginForm.formState.isSubmitting}>
                      <LogIn className="mr-2 h-4 w-4" /> Sign In
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="john@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="phone_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="+250788000000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MALE">Male</SelectItem>
                              <SelectItem value="FEMALE">Female</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="working_location_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Working Location</FormLabel>
                          <Select onValueChange={(value) => { field.onChange(value); handleWorkingLocationChange(value); }} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select working location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {workingLocations.map((location) => (
                                <SelectItem key={location.uuid} value={location.uuid}>
                                  {location.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="department_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!selectedWorkingLocation}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={selectedWorkingLocation ? "Select department" : "Select working location first"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept.uuid} value={dept.uuid}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full font-semibold h-11" disabled={registerForm.formState.isSubmitting}>
                      <UserPlus className="mr-2 h-4 w-4" /> Create Account
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <p className="text-center mt-6 text-white/60 text-sm">
          Protected by AES-256 Enterprise Encryption
        </p>
      </div>
    </div>
  );
}
