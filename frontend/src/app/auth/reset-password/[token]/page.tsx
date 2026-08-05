"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Lock01, Eye, EyeOff, Loading02 } from '@untitledui/icons';
import { useToast } from '@/hooks/use-toast';
import { useParams, useRouter } from 'next/navigation';
import { resetPassword } from '@/api/auth';
import { AuthShell } from '@/components/auth/auth-shell';

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
    <AuthShell
      illustration="/illustrations/auth-reset-password.svg"
      illustrationAlt="Reset password illustration"
      title="Choose a new password"
      subtitle="Pick a strong password you haven't used before to keep your REG account secure."
    >
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-foreground mb-1">Change your password</h1>
        <p className="text-muted-foreground text-sm">Enter and confirm your new password.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">New Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} className="pr-10" />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} className="text-black" /> : <Eye size={18} className="text-black" />}
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
                <FormLabel className="text-foreground">Repeat Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full font-semibold h-11 bg-primary hover:bg-primary/90 transition-colors" disabled={isLoading}>
            {isLoading ? (
              <Loading02 className="mr-2 h-4 w-4 text-white animate-spin" size={16} />
            ) : (
              <Lock01 className="mr-2 h-4 w-4 text-white" size={16} />
            )}
            Reset Password
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
