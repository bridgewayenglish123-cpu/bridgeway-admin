import Card from "@/components/ui/Card";
import { C } from "@/lib/constants";

export default function StubPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl md:text-3xl" style={{ color: C.navy, letterSpacing: "0.02em" }}>課程管理</h2>
      <Card title="Coming Soon">
        <div className="text-sm py-6 text-center" style={{ color: C.muted, lineHeight: 1.7 }}>
          此頁面將在後續 session 移植過來。<br />
          在此之前,你可以繼續用 MVP 版本進行日常操作。
        </div>
      </Card>
    </div>
  );
}
