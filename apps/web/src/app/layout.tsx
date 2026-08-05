import type { Metadata } from "next";
import { DM_Sans, Fraunces, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { RootAuthHeader } from "@/components/root-auth-header";
import { isClerkConfigured } from "@/lib/auth-guards";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Seren SOS — University dashboards",
  description:
    "University operations control room and Seren platform super-admin foundation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const content = (
    <TooltipProvider>
      <RootAuthHeader />
      {children}
      <Toaster />
    </TooltipProvider>
  );

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {isClerkConfigured() ? (
          <ClerkProvider
            appearance={{
              variables: {
                colorPrimary: "oklch(0.36 0.07 175)",
                colorBackground: "oklch(0.995 0.004 200)",
                borderRadius: "0.625rem",
              },
              elements: {
                formButtonPrimary: "bg-primary hover:bg-primary/90",
                card: "bg-card border-border",
              },
            }}
            dynamic
          >
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
