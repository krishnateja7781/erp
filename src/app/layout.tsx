import type { Metadata, Viewport } from "next";
import { GeistSans } from 'geist/font/sans';
// import { GeistMono } from 'geist/font/mono'; // Correctly removed in previous steps
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "EduSphere Connect",
  description: "Student and Staff Portal for the Institution",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#3498db",
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`} suppressHydrationWarning>
       <head />
      <body className={`antialiased font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
