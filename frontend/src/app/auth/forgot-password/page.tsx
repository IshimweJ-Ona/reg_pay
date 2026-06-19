"use client";

import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";

import { forgotPassword } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const forgotPasswordSchema = z.object({
  identifier: z.string().min(3, "Email or phone number is required"),
});

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const resetPath = useMemo(
    () => (resetToken ? `/auth/reset-password/${resetToken}` : ""),
    [resetToken],
  );

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: "" },
  });

  const onSubmit = async (values: z.infer<typeof forgotPasswordSchema>) => {
    setResetToken(null);
    setUserName(null);

    try {
      const response = await forgotPassword(values);
      setResetToken(response.reset_token ?? null);
      setUserName(response.user_name ?? null);
      toast({
        title: "Reset request sent",
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/20 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[100px] animate-blob animation-delay-4000" />
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
      `}</style>

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
          <h1 className="text-3xl font-headline font-bold text-white mb-2">Reset your password</h1>
          <p className="text-center text-white/80 font-medium">Enter your account email or phone number.</p>
        </div>

        <Card className="shadow-2xl border-none bg-white">
          <CardHeader>
            <CardTitle className="text-[#1e1b4b] text-center">Forgot Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
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

                <Button type="submit" className="w-full font-semibold h-11 bg-red-600 hover:bg-red-700" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send Reset Link
                </Button>
              </form>
            </Form>

            {resetPath && (
              <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-[#1e1b4b]">
                <p className="font-semibold">{userName ? `Reset link for ${userName}` : "Reset link generated"}</p>
                <Link href={resetPath} className="mt-2 inline-flex font-medium text-red-600 hover:underline">
                  Continue to reset password
                </Link>
              </div>
            )}

            <Button asChild variant="ghost" className="w-full text-[#1e1b4b]">
              <Link href="/auth/login">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
