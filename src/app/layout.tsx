import type { Metadata } from "next";
import { Poppins, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Agnes",
  description: "Employee capacity and resource planning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${sourceSans.variable} antialiased`}
      >
        <TooltipProvider>
          <div className="flex h-screen">
            <AppSidebar />
            <main className="flex-1 overflow-auto bg-[#f5f6f7]">
              {children}
            </main>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
