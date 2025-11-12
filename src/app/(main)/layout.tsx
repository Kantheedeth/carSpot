import Sidebar from "./sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[auto_1fr] bg-[#020817] text-white">
      <Sidebar />
      <main className="min-w-0 p-4 sm:p-6 lg:p-10">
        {children}
        <footer className="mt-10 text-center text-xs text-white/40">
          © {new Date().getFullYear()} <b>CarSpot</b> — built with Next.js
        </footer>
      </main>
    </div>
  );
}
