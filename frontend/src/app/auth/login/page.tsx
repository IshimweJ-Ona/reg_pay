"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LogIn01, UserPlus01, Eye, EyeOff } from '@untitledui/icons';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWorkingLocations, getDepartments, WorkingLocation, Department } from '@/api/working_locations';
import { AuthShell } from '@/components/auth/auth-shell';
import { Checkbox } from '@/components/ui/checkbox';

const loginSchema = z.object({
  identifier: z.string().min(3, "Email or Phone number is required"),
  password: z.string().min(5, "Password must be at least 5 characters"),
});

const registerSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  email: z.string().regex(/^[a-zA-Z0-9._%+-]+@(gmail\.com|reg\.com|yahoo\.com|reg\.rw)$/, "Email must be @gmail.com, @yahoo.com or @reg.rw"),
  phone_number: z.string().regex(/^7[2389][0-9]{7}$/, "Invalid Rwanda number (e.g. 788000000)"),
  gender: z.enum(['MALE', 'FEMALE']),
  working_location_id: z.string().optional(),
  department_id: z.string().optional(),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d.*\d)(?=.*[^A-Za-z0-9\s])\S{5,}$/, "Min 5 characters, 2 digits, 1 uppercase, 1 lowercase, 1 symbol"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function LoginPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [workingLocations, setWorkingLocations] = useState<WorkingLocation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedWorkingLocation, setSelectedWorkingLocation] = useState<string>('');
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

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
      setLoadingLocations(true);
      setDirectoryError(null);
      try {
        const data = await getWorkingLocations();
        setWorkingLocations(data.working_locations || []);
      } catch (error) {
        console.error('Failed to fetch working locations:', error);
        setDirectoryError('Working locations could not be loaded. You can still sign in, but registration needs this directory.');
      } finally {
        setLoadingLocations(false);
      }
    };
    fetchWorkingLocations();
  }, []);

  const handleWorkingLocationChange = async (locationId: string) => {
    setSelectedWorkingLocation(locationId);
    setDepartments([]);
    registerForm.setValue('department_id', '');
    if (locationId) {
      setLoadingDepartments(true);
      try {
        const data = await getDepartments(locationId, { forAssignment: true });
        setDepartments(data.departments || []);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
        setDirectoryError('Departments could not be loaded for the selected location.');
      } finally {
        setLoadingDepartments(false);
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
      if (error?.response?.data?.message === 'ACCOUNT_NOT_VERIFIED') {
        router.push(`/auth/verify-account?identifier=${encodeURIComponent(values.identifier)}`);
        return;
      }
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error?.response?.data?.message ?? "Please check your credentials.",
      });
    }
  };

  const onRegisterSubmit = async (values: z.infer<typeof registerSchema>) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to exclude it from the request payload
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
    <AuthShell
      illustration="/illustrations/auth-secure-login.svg"
      illustrationAlt="Secure login illustration"
      title="Welcome to REG Payment System"
      subtitle="Sign in to manage payroll, attendance, and workforce payments across Rwanda Energy Group with enterprise-grade security."
    >
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-foreground mb-1">
          {activeTab === "login" ? "Sign in to your account" : "Create your account"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {activeTab === "login" ? "Enter your credentials to continue" : "Fill in your details to request access"}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted mb-6">
          <TabsTrigger value="login" className="data-[state=active]:bg-background text-foreground">Login</TabsTrigger>
          <TabsTrigger value="register" className="data-[state=active]:bg-background text-foreground">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Email / Phone number</FormLabel>
                    <FormControl>
                      <Input placeholder="admin@regnexus.com or +250..." {...field} />
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
                    <FormLabel className="text-foreground">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="pr-10" />
                        <button
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(value) => setRememberMe(Boolean(value))}
                  />
                  <label htmlFor="remember" className="text-sm font-medium text-foreground cursor-pointer">Remember me</label>
                </div>
                <Button asChild variant="link" className="h-auto p-0 text-sm font-medium text-primary">
                  <Link href="/auth/forgot-password">Forgot password?</Link>
                </Button>
              </div>
              <Button type="submit" className="w-full font-semibold h-11 bg-primary hover:bg-primary/90 transition-colors" disabled={loginForm.formState.isSubmitting}>
                <LogIn01 className="mr-2 h-4 w-4 text-white" size={16} /> Sign In
              </Button>
            </form>
          </Form>
        </TabsContent>
        <TabsContent value="register">
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              {directoryError && (
                <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
                  {directoryError}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={registerForm.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">First Name</FormLabel>
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
                      <FormLabel className="text-foreground">Last Name</FormLabel>
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
                    <FormLabel className="text-foreground">Email Address</FormLabel>
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
                    <FormLabel className="text-foreground">Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">+250</span>
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
                    <FormLabel className="text-foreground">Gender</FormLabel>
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
                    <FormLabel className="text-foreground">Working Location</FormLabel>
                    <Select onValueChange={(value) => { field.onChange(value); handleWorkingLocationChange(value); }} value={field.value} disabled={loadingLocations}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingLocations ? "Loading locations..." : "Select working location"} />
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
                    <FormLabel className="text-foreground">Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedWorkingLocation || loadingDepartments}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingDepartments ? "Loading departments..." : selectedWorkingLocation ? "Select department" : "Select location first"} />
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
                    <FormLabel className="text-foreground">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="pr-10" />
                        <button
                          type="button"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    <FormLabel className="text-foreground">Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full font-semibold h-11 bg-primary hover:bg-primary/90 transition-colors" disabled={registerForm.formState.isSubmitting}>
                <UserPlus01 className="mr-2 h-4 w-4 text-white" size={16} /> Create Account
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>

      <p className="text-center mt-8 text-muted-foreground text-xs">
        Protected by AES-256 Enterprise Encryption
      </p>
    </AuthShell>
  );
}
