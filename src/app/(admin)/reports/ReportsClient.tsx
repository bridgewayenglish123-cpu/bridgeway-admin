"use client";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { C } from "@/lib/constants";

type Report = {
  id: string;
  lesson_id: string;
  student_id: string;
  analysis_zh: { headline: string; body: string } | null;
  analysis_en: { headline: string; body: string } | null;
  vocabulary: { word: string; definition_en: string; definition_zh: string }[] | null;
  next_focus: string | null;
  milestone: string | null;
  created_at: string;
};

type Student = { id: string; zh_name: string; en_name: string | null };
type Lesson = { id: string; date: string; time: string | null; duration: number | null; teacher_id: string | null; account_id: string };
type Teacher = { id: string; teacher_name: string };

export default function ReportsClient({
  reports, students, lessons, teachers,
}: {
  reports: Report[];
  students: Student[];
  lessons: Lesson[];
  teachers: Teacher[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const reportId = searchParams.get("report");
    if (reportId) {
      const found = reports.find(r => r.id === reportId);
      if (found) setSelected(found);
    }
  }, [searchParams, reports]);

  const studentById = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);
  const lessonById = useMemo(() => Object.fromEntries(lessons.map(l => [l.id, l])), [lessons]);
  const teacherById = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, t])), [teachers]);

  const filtered = useMemo(() => {
    if (!search) return reports;
    const q = search.toLowerCase();
    return reports.filter(r => {
      const s = studentById[r.student_id];
      return s?.zh_name.toLowerCase().includes(q) || s?.en_name?.toLowerCase().includes(q);
    });
  }, [reports, search, studentById]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6" style={{ color: C.navy, fontFamily: "Cormorant Garamond, serif" }}>
        報告管理
      </h1>

      {/* 搜尋 */}
      <input
        type="text"
        placeholder="搜尋學生姓名..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border px-3 py-2 text-sm mb-6"
        style={{ borderColor: C.line, color: C.text }}
      />

      {/* 報告列表 */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: C.line }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#EAF0F6" }}>
              {["日期", "學生", "老師", "標題", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: C.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const lesson = lessonById[r.lesson_id];
              const student = studentById[r.student_id];
              const teacher = lesson?.teacher_id ? teacherById[lesson.teacher_id] : null;
              return (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-4 py-3 text-xs" style={{ color: C.muted }}>
                    {lesson?.date || r.created_at.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: C.navy }}>
                    {student?.zh_name || "—"}
                    {student?.en_name && <span className="text-xs ml-1" style={{ color: C.muted }}>({student.en_name})</span>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: C.text }}>
                    {teacher?.teacher_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: C.text }}>
                    {r.analysis_zh?.headline || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(r)}
                      className="text-xs px-3 py-1 rounded-lg font-medium"
                      style={{ background: "#EAF0F6", color: C.navy }}
                    >
                      查看
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: C.muted }}>
                  沒有找到報告
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 報告 Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* 標題 */}
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs mb-1" style={{ color: C.muted }}>
                  {lessonById[selected.lesson_id]?.date} · {studentById[selected.student_id]?.zh_name}
                </div>
                <div className="text-lg font-semibold" style={{ color: C.navy, fontFamily: "Cormorant Garamond, serif" }}>
                  {selected.analysis_zh?.headline}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ color: C.muted }}>✕</button>
            </div>

            {/* 中文分析 */}
            {selected.analysis_zh && (
              <div className="rounded-xl p-4" style={{ background: "#F8F6F0" }}>
                <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>課堂總結</div>
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>{selected.analysis_zh.body}</p>
              </div>
            )}

            {/* 英文分析 */}
            {selected.analysis_en && (
              <div className="rounded-xl p-4" style={{ background: "#EAF0F6" }}>
                <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>English Summary</div>
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>{selected.analysis_en.body}</p>
              </div>
            )}

            {/* 詞彙 */}
            {selected.vocabulary && selected.vocabulary.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>本堂詞彙</div>
                <div className="space-y-2">
                  {selected.vocabulary.map((v, i) => (
                    <div key={i} className="rounded-lg px-3 py-2" style={{ background: "#F8F6F0" }}>
                      <span className="font-semibold text-sm" style={{ color: C.navy }}>{v.word}</span>
                      <span className="text-xs ml-2" style={{ color: C.muted }}>{v.definition_zh}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 下堂課建議 */}
            {selected.next_focus && (
              <div className="rounded-xl p-4" style={{ background: "#FBF8EF", border: `1px solid rgba(194,153,47,0.3)` }}>
                <div className="text-xs font-semibold mb-2" style={{ color: C.gold }}>下堂課建議</div>
                <p className="text-sm leading-relaxed" style={{ color: C.text }}>{selected.next_focus}</p>
              </div>
            )}

            {/* 里程碑 */}
            {selected.milestone && (
              <div className="rounded-xl p-4" style={{ background: "#E8F5E9" }}>
                <div className="text-xs font-semibold mb-1" style={{ color: "#2E7D32" }}>🎉 里程碑</div>
                <p className="text-sm" style={{ color: "#2E7D32" }}>{selected.milestone}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
