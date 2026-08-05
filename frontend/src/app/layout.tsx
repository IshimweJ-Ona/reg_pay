import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { PageLoader } from "@/components/ui/page-loader";
import { AuthProvider } from "@/context/auth-context";
import { AttendanceSyncProvider } from "@/context/attendance-sync-context";
import "./globals.css";
import { NotificationListener } from "@/components/notification-listener";
import { AttendanceSyncPopover } from "@/components/attendance/attendance-sync-popover";
import { SessionManager } from "@/components/auth/session-manager";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} ${ibmPlexSans.variable}`}>
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
