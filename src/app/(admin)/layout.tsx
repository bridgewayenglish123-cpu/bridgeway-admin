import Sidebar from "@/components/Sidebar";
import { C } from "@/lib/constants";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: C.bg }}>
      <Sidebar />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-3 md:p-5">{children}</div>
      </main>
    </div>
  );
}
