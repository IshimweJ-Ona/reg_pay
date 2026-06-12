import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { PageLoader } from "@/components/ui/page-loader";
import { AuthProvider } from "@/context/auth-context";
import { AttendanceSyncProvider } from "@/context/attendance-sync-context";
import "./globals.css";
import { NotificationListener } from "@/components/notification-listener";
import { AttendanceSyncPopover } from "@/components/attendance/attendance-sync-popover";
import { SessionManager } from "@/components/auth/session-manager";

export const metadata: Metadata = {
  title: "REG(Rwanda Energy Group) | Payment System",
  description: "Enterprise Payment and Payroll Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <AttendanceSyncProvider>
            <SessionManager>
              <PageLoader />
              <NotificationListener />
              {children}
              <AttendanceSyncPopover />
              <Toaster />
            </SessionManager>
          </AttendanceSyncProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
