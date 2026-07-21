"use client";
import { useState, useMemo, useEffect } from "react";
import { C } from "@/lib/constants";
import { useRouter } from "next/navigation";
import UploadReportModal from "../lessons/UploadReportModal";

type Row = {
  id: string;
  date: string;
  time: string | null;
  duration: number | null;
  teacherId: string | null;
  teacherName: string;
  studentName: string;
  hasReport: boolean;
  reportedAt: string | null;
};

const PAGE_SIZE = 20;

export function ReportsClient({ rows, teachers }: {
  rows: Row[];
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "uploaded" | "pending">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<Row | null>(null);
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(
    new Set(rows.filter(r => r.hasReport).map(r => r.id))
  );

  const pendingCount = rows.filter(r => !uploadedIds.has(r.id)).length;
  const uploadedCount = rows.length - pendingCount;

  const filtered = useMemo(() => {
    let list = [...rows];
    if (filterStatus === "uploaded") list = list.filter(r => uploadedIds.has(r.id));
    if (filterStatus === "pending") list = list.filter(r => !uploadedIds.has(r.id));
    if (filterTeacher !== "all") list = list.filter(r => r.teacherId === filterTeacher);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.studentName.toLowerCase().includes(q) ||
        r.teacherName.toLowerCase().includes(q) ||
        r.date.includes(q)
      );
    }
    list.sort((a, b) => sort === "newest"
      ? b.date.localeCompare(a.date) || (b.time ?? "").localeCompare(a.time ?? "")
      : a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")
    );
    return list;
  }, [rows, search, filterTeacher, filterStatus, sort, uploadedIds]);

  useEffect(() => { setPage(1); }, [search, filterTeacher, filterStatus, sort]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-8 sm:py-8">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="font-serif text-[26px] font-medium" style={{ color: C.navy }}>
          報告管理
        </h1>
        <div className="text-[13px]" style={{ color: C.muted }}>
          {pendingCount > 0 && <span className="mr-2 font-medium" style={{ color: C.red }}>{pendingCount} 待上傳</span>}
          共 {rows.length} 堂
        </div>
      </div>

      {/* 統計卡 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "全部完課", value: rows.length, color: C.navy },
          { label: "待上傳", value: pendingCount, color: C.red },
          { label: "已上傳", value: uploadedCount, color: C.green },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-white p-3 text-center shadow-sm">
            <div className="font-serif text-[28px] font-medium" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 搜尋 */}
      <input type="text" placeholder="搜尋學生或老師姓名..."
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none mb-3"
        style={{ borderColor: C.line, color: C.navy }} />

      {/* 篩選 */}
      <div className="flex gap-2 flex-wrap mb-4">
        {/* 狀態 */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "#EAF0F6" }}>
          {(["all", "pending", "uploaded"] as const).map(v => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition"
              style={{ background: filterStatus === v ? C.navy : "transparent", color: filterStatus === v ? "#fff" : C.muted }}>
              {v === "all" ? "全部" : v === "pending" ? "待上傳" : "已上傳"}
            </button>
          ))}
        </div>

        {/* 老師 */}
        <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
          className="rounded-xl border px-3 py-1.5 text-[12px] outline-none"
          style={{ borderColor: C.line, color: C.navy }}>
          <option value="all">所有老師</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* 排序 */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "#EAF0F6" }}>
          {(["newest", "oldest"] as const).map(v => (
            <button key={v} onClick={() => setSort(v)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-medium transition"
              style={{ background: sort === v ? C.navy : "transparent", color: sort === v ? "#fff" : C.muted }}>
              {v === "newest" ? "最新" : "最舊"}
            </button>
          ))}
        </div>
      </div>

      {/* 結果數 */}
      {(search || filterTeacher !== "all" || filterStatus !== "all") && (
        <div className="text-[12px] mb-3" style={{ color: C.muted }}>找到 {filtered.length} 筆</div>
      )}

      {/* 列表 */}
      <div className="flex flex-col gap-2 mb-6">
        {paginated.map(r => {
          const uploaded = uploadedIds.has(r.id);
          return (
            <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm flex items-center gap-3"
              style={{ borderLeft: `3px solid ${uploaded ? C.green : C.amber}` }}>
              <div className="flex-shrink-0 text-center w-10">
                <div className="text-[10px]" style={{ color: C.muted }}>{r.date.slice(5, 7)}月</div>
                <div className="font-serif text-[20px] font-medium" style={{ color: C.navy }}>{r.date.slice(8)}</div>
              </div>
              <div className="w-px self-stretch" style={{ background: C.line }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14px]" style={{ color: C.navy }}>{r.studentName}</div>
                <div className="text-[12px] mt-0.5" style={{ color: C.muted }}>
                  {r.teacherName}
                  {r.time && <span> · {r.time.slice(0, 5)}</span>}
                  {r.duration && <span> · {r.duration} 分鐘</span>}
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {uploaded ? (
                  <span className="text-[11px] px-2.5 py-1.5 rounded-full font-medium"
                    style={{ background: "#E8F5E9", color: "#2E7D32" }}>✓ 已上傳</span>
                ) : (
                  <button onClick={() => setModal(r)}
                    className="text-[11px] px-2.5 py-1.5 rounded-full font-medium transition"
                    style={{ background: C.gold, color: "#fff" }}>
                    上傳報告
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {paginated.length === 0 && (
          <div className="rounded-xl border border-dashed py-12 text-center" style={{ borderColor: C.line }}>
            <p className="text-sm" style={{ color: C.muted }}>找不到符合的課程</p>
          </div>
        )}
      </div>

      {/* 分頁 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl text-[13px] font-medium disabled:opacity-40"
            style={{ background: "#fff", color: C.navy, border: `1px solid ${C.line}` }}>
            ← 上一頁
          </button>
          <div className="text-[12px]" style={{ color: C.muted }}>第 {page} 頁，共 {totalPages} 頁</div>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 rounded-xl text-[13px] font-medium disabled:opacity-40"
            style={{ background: "#fff", color: C.navy, border: `1px solid ${C.line}` }}>
            下一頁 →
          </button>
        </div>
      )}

      {modal && (
        <UploadReportModal
          lessonId={modal.id}
          studentName={modal.studentName}
          lessonDate={modal.date}
          teacherName={modal.teacherName}
          onGenerated={() => {
            setUploadedIds(prev => { const n = new Set(Array.from(prev)); n.add(modal!.id); return n; });
            setModal(null);
            router.refresh();
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
