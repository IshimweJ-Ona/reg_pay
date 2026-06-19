"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { resetPassword } from '@/api/auth';

const resetSchema = z.object({
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{5,}$/, "Min 5 chars, 2 digits, 1 uppercase, 1 lowercase, 1 symbol"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function ResetPasswordPage() {
  const { token } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: z.infer<typeof resetSchema>) => {
    setIsLoading(true);
    try {
      const resetToken = Array.isArray(token) ? token[0] : token;
      if (!resetToken) {
        throw new Error("Missing reset token.");
      }
      await resetPassword(resetToken, values);
      toast({ title: "Success", description: "Password reset successfully. You can now login." });
      router.push('/auth/login');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Reset failed",
        description: error?.response?.data?.message ?? "Invalid or expired token.",
      });
    } finally {
      setIsLoading(false);
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

      <style jsx global>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          25% { transform: translate(100vw, 50vh) scale(1.2); }
          50% { transform: translate(-50vw, 100vh) scale(0.8); }
          75% { transform: translate(-100vw, -50vh) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 20s infinite linear;
          opacity: 0.4;
        }
        .animation-delay-2000 {
          animation-delay: -5s;
        }
        .animation-delay-4000 {
          animation-delay: -10s;
        }
        .animation-delay-6000 {
          animation-delay: -15s;
        }
      `}</style>

      <div className="z-10 w-full max-w-[450px]">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-2 rounded-2xl shadow-xl mb-4 border-2 border-primary/10 overflow-hidden">
            <Image 
              src="/pics/Screenshot 2026-05-19 203312.png" 
              alt="REG Logo" 
              width={60} 
              height={60} 
              className="object-contain"
            />
          </div>
          <h1 className="text-3xl font-headline font-bold text-white mb-2">Change your password</h1>
        </div>

        <Card className="shadow-2xl border-none bg-white">
          <CardHeader>
            <CardTitle className="text-[#1e1b4b] text-center">New Password</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#1e1b4b]">New Password</FormLabel>
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
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#1e1b4b]">Repeat Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} className="border-[#1e1b4b]/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-semibold h-11 bg-red-600 hover:bg-red-700 active:shadow-[0_0_15px_rgba(30,27,75,0.4)] transition-all" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                  Reset Password
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
