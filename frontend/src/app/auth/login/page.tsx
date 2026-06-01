"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShieldCheck, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWorkingLocations, getDepartments, WorkingLocation, Department } from '@/api/working_locations';

const loginSchema = z.object({
  identifier: z.string().min(3, "Email or Phone number is required"),
  password: z.string().min(5, "Password must be at least 5 characters"),
});

const registerSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  email: z.string().regex(/^[a-zA-Z0-9._%+-]+@(gmail\.com|reg\.com)$/, "Email must be @gmail.com or @reg.com"),
  phone_number: z.string().regex(/^7[2389][0-9]{7}$/, "Invalid Rwanda number (e.g. 788000000)"),
  gender: z.enum(['MALE', 'FEMALE']),
  working_location_id: z.string().optional(),
  department_id: z.string().optional(),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{5,}$/, "Min 5 chars, 2 digits, 1 uppercase, 1 lowercase, 1 symbol"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function LoginPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [workingLocations, setWorkingLocations] = useState<WorkingLocation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedWorkingLocation, setSelectedWorkingLocation] = useState<string>('');

  useEffect(() => {
    // Load remember me data
    const saved = localStorage.getItem('remember_me');
    if (saved) {
      const { identifier, password } = JSON.parse(saved);
      loginForm.setValue('identifier', identifier);
      loginForm.setValue('password', password);
      setRememberMe(true);
    }
    
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
    defaultValues: { identifier: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { first_name: "", last_name: "", email: "", phone_number: "", gender: "MALE", working_location_id: "", department_id: "", password: "", confirmPassword: "" },
  });

  const onLoginSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      if (rememberMe) {
        localStorage.setItem('remember_me', JSON.stringify(values));
      } else {
        localStorage.removeItem('remember_me');
      }
      await login(values.identifier, values.password);
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
      const { confirmPassword, ...data } = values;
      const submissionData = {
        ...data,
        phone_number: `+250${values.phone_number}`
      };
      await register(submissionData);
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Liquid Animation Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/20 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[100px] animate-blob animation-delay-4000" />
        <div className="absolute bottom-[20%] left-[10%] w-[30%] h-[30%] bg-red-500/10 rounded-full blur-[80px] animate-blob animation-delay-6000" />
      </div>
      
      <div className="z-10 w-full max-w-[450px]">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-2 rounded-2xl shadow-xl mb-4 border-2 border-primary/10 overflow-hidden">
            <Image 
              src="/pics/Screenshot 2026-05-19 203312.png" 
              alt="REG Logo" 
              width={60} 
              height={60} 
              className="h-[60px] w-[60px] object-contain"
            />
          </div>
          <h1 className="text-4xl font-headline font-bold mb-2">
            <span className="text-white">Welcome to </span>
            <span className="text-red-600">REG </span>
            <span className="text-[#1e1b4b]">System</span>
          </h1>
          <p className="text-white/80 font-medium">Enterprise Payment Systems</p>
        </div>

        <Card className="shadow-2xl border-none bg-white">
          <CardHeader className="pb-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                <TabsTrigger value="login" className="data-[state=active]:bg-white text-[#1e1b4b]">Login</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-white text-[#1e1b4b]">Register</TabsTrigger>
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
                      name="identifier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#1e1b4b]">Email / Phone number</FormLabel>
                          <FormControl>
                            <Input placeholder="admin@regnexus.com or +250..." {...field} className="border-[#1e1b4b]/20" />
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
                          <FormLabel className="text-[#1e1b4b]">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="border-[#1e1b4b]/20 pr-10" />
                              <button 
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#1e1b4b]"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center space-x-2">
                        <input 
                          type="checkbox" 
                          id="remember" 
                          checked={rememberMe} 
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <label htmlFor="remember" className="text-sm font-medium text-[#1e1b4b] cursor-pointer">Remember me</label>
                      </div>
                      <button type="button" className="text-sm font-medium text-red-600 hover:underline">Forgot password?</button>
                    </div>
                    <Button type="submit" className="w-full font-semibold h-11 bg-red-600 hover:bg-red-700 active:shadow-[0_0_15px_rgba(30,27,75,0.4)] transition-all" disabled={loginForm.formState.isSubmitting}>
                      <LogIn className="mr-2 h-4 w-4" /> Sign In
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="first_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#1e1b4b]">First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="last_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[#1e1b4b]">Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#1e1b4b]">Email Address</FormLabel>
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
                          <FormLabel className="text-[#1e1b4b]">Phone Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">+250</span>
                              <Input placeholder="788000000" {...field} className="pl-14" />
                            </div>
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
                          <FormLabel className="text-[#1e1b4b]">Gender</FormLabel>
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
                          <FormLabel className="text-[#1e1b4b]">Working Location</FormLabel>
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
                          <FormLabel className="text-[#1e1b4b]">Department</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!selectedWorkingLocation}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={selectedWorkingLocation ? "Select department" : "Select location first"} />
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
                          <FormLabel className="text-[#1e1b4b]">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="pr-10" />
                              <button 
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
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
                          <FormLabel className="text-[#1e1b4b]">Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full font-semibold h-11 bg-red-600 hover:bg-red-700 active:shadow-[0_0_15px_rgba(30,27,75,0.4)] transition-all" disabled={registerForm.formState.isSubmitting}>
                      <UserPlus className="mr-2 h-4 w-4" /> Create Account
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <p className="text-center mt-6 text-white/40 text-sm">
          Protected by AES-256 Enterprise Encryption
        </p>
      </div>
    </div>
  );
}
