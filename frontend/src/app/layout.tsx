import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { PageLoader } from "@/components/ui/page-loader";
import { AuthProvider } from "@/context/auth-context";
import "./globals.css";
import { NotificationListener } from "@/components/notification-listener";
import { SessionManager } from "@/components/auth/session-manager";

export const metadata: Metadata = {
  title: "REG(Rwanda Energy Group) | Payment System",
  description: "Enterprise Payment and Payroll Management System",
  icons: {
    icon: "/pics/reg-logo.png",
    shortcut: "/pics/reg-logo.png",
    apple: "/pics/reg-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-body antialiased">
        <AuthProvider>
          <SessionManager>
            <PageLoader />
            <NotificationListener />
            {children}
            <Toaster />
          </SessionManager>
        </AuthProvider>
      </body>
    </html>
  );
}
