import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "./sidebar";

export const metadata: Metadata = {
  title: "CarSpot",
  description: "Cars • Ratings • Bookmarks",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="grid min-h-screen grid-cols-1 md:grid-cols-[auto_1fr]">
          {/* Client sidebar lives here */}
          <Sidebar />

          {/* Main content */}
          <main className="min-w-0 p-4 sm:p-6 lg:p-10">
            {children}
            <footer className="mt-10 text-center text-xs text-white/50">
              © {new Date().getFullYear()} <b>CarSpot</b> — built with Next.js
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
