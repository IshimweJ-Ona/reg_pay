"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSearchParams } from "next/navigation";
import { ShieldTick, Loading02 } from "@untitledui/icons";

import { resendVerificationCode } from "@/api/auth";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoadingState } from "@/components/layout/page-state";

const verifySchema = z.object({
  identifier: z.string().min(3, "Email or phone number is required"),
  code: z.string().length(6, "Enter the 6-digit code from your email"),
});

function VerifyAccountForm() {
  const { toast } = useToast();
  const { verifyAccount } = useAuth();
  const searchParams = useSearchParams();
  const [isResending, setIsResending] = useState(false);

  const form = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { identifier: searchParams.get("identifier") ?? "", code: "" },
  });

  const onSubmit = async (values: z.infer<typeof verifySchema>) => {
    try {
      await verifyAccount(values.identifier, values.code);
      toast({ title: "Account verified", description: "You're all set — welcome to REG Pay." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error?.response?.data?.message ?? "The code is invalid or has expired.",
      });
    }
  };

  const handleResend = async () => {
    const identifier = form.getValues("identifier");
    if (!identifier) {
      form.setError("identifier", { message: "Enter your email or phone number first" });
      return;
    }
    setIsResending(true);
    try {
      const response = await resendVerificationCode(identifier);
      toast({ title: "Code sent", description: response.message });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not resend code",
        description: error?.response?.data?.message ?? "Please try again.",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthShell
      illustration="/illustrations/auth-pending-approval.svg"
      illustrationAlt="Verify account illustration"
      title="Almost there"
      subtitle="Your account was approved — enter the verification code we emailed you to finish signing in."
    >
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-foreground mb-1">Verify your account</h1>
        <p className="text-muted-foreground text-sm">Check your email for a 6-digit code. It expires after 30 minutes.</p>
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
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground">Verification code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="123456"
                    inputMode="numeric"
                    maxLength={6}
                    className="text-center font-mono text-lg font-bold"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full font-semibold h-11 bg-primary hover:bg-primary/90 transition-colors" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <Loading02 className="mr-2 h-4 w-4 text-white animate-spin" size={16} />
            ) : (
              <ShieldTick className="mr-2 h-4 w-4 text-white" size={16} />
            )}
            Verify & Sign In
          </Button>
        </form>
      </Form>

      <Button
        variant="ghost"
        className="w-full mt-4 text-foreground"
        onClick={handleResend}
        disabled={isResending}
      >
        {isResending ? "Resending..." : "Didn't get a code? Resend it"}
      </Button>
    </AuthShell>
  );
}

export default function VerifyAccountPage() {
  return (
    <Suspense
      fallback={
        <LoadingState
          title="Loading verification"
          description="Preparing the account verification form."
          className="min-h-screen rounded-none border-0"
        />
      }
    >
      <VerifyAccountForm />
    </Suspense>
  );
}
