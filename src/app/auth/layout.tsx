export const metadata = { title: "Log in • CarSpot" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center bg-[#0b0f14] text-white p-6">
      {children}
    </main>
  );
}
