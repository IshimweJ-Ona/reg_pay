"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { Mail01, ArrowLeft, Loading02 } from "@untitledui/icons";

import { forgotPassword } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AuthShell } from "@/components/auth/auth-shell";

const forgotPasswordSchema = z.object({
  identifier: z.string().min(3, "Email or phone number is required"),
});

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  // The backend only ever includes reset_token outside production (a dev
  // convenience so this flow can be tested without a working SMTP setup) -
  // in production this stays null and the dev-only link below never renders.
  const [resetToken, setResetToken] = useState<string | null>(null);

  const resetPath = useMemo(
    () => (resetToken ? `/auth/reset-password/${resetToken}` : ""),
    [resetToken],
  );

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: "" },
  });

  const onSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setSubmitted(false);
    setResetToken(null);

    try {
      const response = await forgotPassword(values);
      setSubmitted(true);
      setResetToken(response.reset_token ?? null);
      toast({
        title: "Check your email",
        description: response.message,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Request failed",
        description: error?.response?.data?.message ?? "Please try again.",
      });
    }
  };

  return (
    <AuthShell
      illustration="/illustrations/auth-forgot-password.svg"
      illustrationAlt="Forgot password illustration"
      title="Forgot your password?"
      subtitle="Enter the email or phone number linked to your account and we'll help you get back in."
    >
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-foreground mb-1">Reset your password</h1>
        <p className="text-muted-foreground text-sm">Enter your account email or phone number.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
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

          <Button type="submit" className="w-full font-semibold h-11 bg-primary hover:bg-primary/90 transition-colors" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <Loading02 className="mr-2 h-4 w-4 text-white animate-spin" size={16} />
            ) : (
              <Mail01 className="mr-2 h-4 w-4 text-white" size={16} />
            )}
            Send Reset Link
          </Button>
        </form>
      </Form>

      {submitted && (
        <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
          <p className="font-semibold">Check your email</p>
          <p className="mt-1 text-muted-foreground">
            If an account exists for that email or phone number, we've sent a password reset link to it. The link expires in 1 hour.
          </p>
          {resetPath && (
            <Link href={resetPath} className="mt-2 inline-flex font-medium text-primary hover:underline">
              (Dev mode) Continue to reset password
            </Link>
          )}
        </div>
      )}

      <Button asChild variant="ghost" className="w-full mt-4 text-foreground">
        <Link href="/auth/login">
          <ArrowLeft className="mr-2 h-4 w-4 text-muted-foreground" size={16} />
          Back to Login
        </Link>
      </Button>
    </AuthShell>
  );
}
