import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { AppShell } from "@/components/layout";

export const metadata: Metadata = {
  title: "Hyperscape Admin",
  description: "Admin panel for Hyperscape MMORPG and Asset Forge",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <NotificationProvider>
            <AppShell>{children}</AppShell>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
