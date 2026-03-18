import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StatusPing — Simple Uptime Monitoring",
  description: "Know when your site goes down. Free uptime monitoring with public status pages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0f] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
