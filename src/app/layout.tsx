import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nivaran — Student Housing Maintenance & Grievance Platform",
  description:
    "Report, track, and resolve hostel and campus maintenance issues with full transparency and accountability.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
