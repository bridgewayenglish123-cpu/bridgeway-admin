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
type Lesson = { id: string; date: string; time: string | null; teacher_id: string | null };
type Teacher = { id: string; teacher_name: string };

export default function ReportsClient({
  reports, students, lessons, teachers,
}: {
  reports: Report[];
  students: Student[];
  lessons: Lesson[];
  teachers: Teacher[];
}) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  // mobile: "list" | "reports" | "detail"
  const [mobileView, setMobileView] = useState<"list" | "reports" | "detail">("list");

  const lessonById = useMemo(() => Object.fromEntries(lessons.map(l => [l.id, l])), [lessons]);
  const teacherById = useMemo(() => Object.fromEntries(teachers.map(t => [t.id, t])), [teachers]);
  const studentById = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);

  // 每位學生最新報告日期
  const studentLastDate = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of reports) {
      const date = lessonById[r.lesson_id]?.date || r.created_at.slice(0, 10);
      if (!map[r.student_id] || date > map[r.student_id]) map[r.student_id] = date;
    }
    return map;
  }, [reports, lessonById]);

  // 有報告的學生列表，依最新上課日排序
  const studentList = useMemo(() => {
    const ids = [...new Set(reports.map(r => r.student_id))];
    return ids
      .map(id => studentById[id])
      .filter(Boolean)
      .filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.zh_name.toLowerCase().includes(q) || s.en_name?.toLowerCase().includes(q);
      })
      .sort((a, b) => (studentLastDate[b.id] || "").localeCompare(studentLastDate[a.id] || ""));
  }, [reports, studentById, search, studentLastDate]);

  // 選定學生的報告列表
  const studentReports = useMemo(() => {
    if (!selectedStudentId) return [];
    return reports
      .filter(r => r.student_id === selectedStudentId)
      .sort((a, b) => {
        const da = lessonById[a.lesson_id]?.date || a.created_at;
        const db = lessonById[b.lesson_id]?.date || b.created_at;
        return db.localeCompare(da);
      });
  }, [reports, selectedStudentId, lessonById]);

  // URL 參數直接展開
  useEffect(() => {
    const reportId = searchParams.get("report");
    if (reportId) {
      const found = reports.find(r => r.id === reportId);
      if (found) {
        setSelectedStudentId(found.student_id);
        setSelectedReport(found);
        setMobileView("detail");
      }
    }
  }, [searchParams, reports]);

  const selectStudent = (id: string) => {
    setSelectedStudentId(id);
    setSelectedReport(null);
    setMobileView("reports");
  };

  const selectReport = (r: Report) => {
    setSelectedReport(r);
    setMobileView("detail");
  };

  const formatDate = (ymd: string) => {
    const [y, m, d] = ymd.split("-");
    return `${m}/${d}`;
  };

  // ── 報告詳情 ────────────────────────────────────────────────────────────────
  const ReportDetail = ({ report }: { report: Report }) => {
    const lesson = lessonById[report.lesson_id];
    const teacher = lesson?.teacher_id ? teacherById[lesson.teacher_id] : null;
    const student = studentById[report.student_id];
    return (
      <div className="space-y-4 p-4 md:p-6">
        {/* Header */}
        <div className="pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-xs mb-1" style={{ color: C.muted }}>
            {lesson?.date} · {teacher?.teacher_name || "—"} · {lesson?.time || ""}
          </div>
          <div className="text-xl font-semibold leading-snug"
            style={{ color: C.navy, fontFamily: "Cormorant Garamond, serif" }}>
            {report.analysis_zh?.headline}
          </div>
        </div>

        {/* 里程碑 */}
        {report.milestone && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: "#FFF8E1", color: "#F57F17", border: "1px solid #FFE082" }}>
            🎉 {report.milestone}
          </div>
        )}

        {/* 中文總結 */}
        {report.analysis_zh && (
          <div className="rounded-xl p-4 space-y-1" style={{ background: "#F8F6F0" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>課堂總結</div>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{report.analysis_zh.body}</p>
          </div>
        )}

        {/* 英文總結 */}
        {report.analysis_en && (
          <div className="rounded-xl p-4" style={{ background: "#EAF0F6" }}>
            <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>English Summary</div>
            <p className="text-sm leading-relaxed italic" style={{ color: C.text }}>{report.analysis_en.body}</p>
          </div>
        )}

        {/* 詞彙 */}
        {report.vocabulary && report.vocabulary.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>本堂詞彙 ({report.vocabulary.length})</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {report.vocabulary.map((v, i) => (
                <div key={i} className="rounded-lg px-3 py-2" style={{ background: "#F8F6F0" }}>
                  <div className="font-semibold text-sm" style={{ color: C.navy }}>{v.word}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>{v.definition_zh}</div>
                  <div className="text-xs" style={{ color: C.text, opacity: 0.7 }}>{v.definition_en}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 下堂課建議 */}
        {report.next_focus && (
          <div className="rounded-xl p-4" style={{ background: "#FBF8EF", border: `1px solid rgba(194,153,47,0.3)` }}>
            <div className="text-xs font-semibold mb-2" style={{ color: C.gold }}>📌 下堂課建議</div>
            <p className="text-sm leading-relaxed" style={{ color: C.text }}>{report.next_focus}</p>
          </div>
        )}
      </div>
    );
  };

  // ── 學生列表欄 ───────────────────────────────────────────────────────────────
  const StudentList = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 pb-2">
        <input
          type="text"
          placeholder="搜尋學生..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {studentList.length === 0 && (
          <div className="p-6 text-center text-sm" style={{ color: C.muted }}>沒有報告</div>
        )}
        {studentList.map(s => {
          const count = reports.filter(r => r.student_id === s.id).length;
          const lastDate = studentLastDate[s.id];
          const isActive = selectedStudentId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => selectStudent(s.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between transition-colors"
              style={{
                background: isActive ? "#EAF0F6" : "transparent",
                borderLeft: isActive ? `3px solid ${C.navy}` : "3px solid transparent",
              }}
            >
              <div>
                <div className="font-medium text-sm" style={{ color: C.navy }}>{s.zh_name}</div>
                {s.en_name && <div className="text-xs" style={{ color: C.muted }}>{s.en_name}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs" style={{ color: C.muted }}>{lastDate ? formatDate(lastDate) : "—"}</div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{count} 份</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── 報告列表欄 ───────────────────────────────────────────────────────────────
  const ReportList = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 pb-2 flex items-center gap-2">
        <button
          className="md:hidden text-sm"
          style={{ color: C.navy }}
          onClick={() => setMobileView("list")}
        >← 返回</button>
        <div className="font-semibold text-sm" style={{ color: C.navy }}>
          {selectedStudentId ? studentById[selectedStudentId]?.zh_name : ""} 的報告
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {studentReports.map(r => {
          const lesson = lessonById[r.lesson_id];
          const teacher = lesson?.teacher_id ? teacherById[lesson.teacher_id] : null;
          const isActive = selectedReport?.id === r.id;
          return (
            <button
              key={r.id}
              onClick={() => selectReport(r)}
              className="w-full text-left px-4 py-3 transition-colors"
              style={{
                background: isActive ? "#EAF0F6" : "transparent",
                borderLeft: isActive ? `3px solid ${C.gold}` : "3px solid transparent",
                borderBottom: `1px solid ${C.line}`,
              }}
            >
              <div className="flex justify-between items-start">
                <div className="text-sm font-medium" style={{ color: C.navy }}>
                  {lesson?.date || r.created_at.slice(0, 10)}
                </div>
                <div className="text-xs" style={{ color: C.muted }}>{teacher?.teacher_name || "—"}</div>
              </div>
              <div className="text-xs mt-1 line-clamp-2" style={{ color: C.text }}>
                {r.analysis_zh?.headline || "—"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-3">
          {mobileView === "detail" && (
            <button className="md:hidden text-sm" style={{ color: C.navy }}
              onClick={() => setMobileView("reports")}>←</button>
          )}
          <h1 className="text-xl font-semibold" style={{ color: C.navy, fontFamily: "Cormorant Garamond, serif" }}>
            報告管理
          </h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#EAF0F6", color: C.muted }}>
            {reports.length} 份
          </span>
        </div>
      </div>

      {/* 三欄佈局 (desktop) / 三層導航 (mobile) */}
      <div className="flex flex-1 overflow-hidden">

        {/* 欄 1：學生列表 */}
        <div
          className={`${mobileView === "list" ? "flex" : "hidden"} md:flex flex-col`}
          style={{ width: "100%", maxWidth: "220px", borderRight: `1px solid ${C.line}`, minWidth: 0 }}
        >
          <StudentList />
        </div>

        {/* 欄 2：報告列表 */}
        <div
          className={`${mobileView === "reports" ? "flex" : "hidden"} md:flex flex-col`}
          style={{ width: "100%", maxWidth: "280px", borderRight: `1px solid ${C.line}`, minWidth: 0 }}
        >
          {selectedStudentId ? (
            <ReportList />
          ) : (
            <div className="p-6 text-sm hidden md:block" style={{ color: C.muted }}>
              ← 選擇學生查看報告
            </div>
          )}
        </div>

        {/* 欄 3：報告內容 */}
        <div
          className={`${mobileView === "detail" ? "flex" : "hidden"} md:flex flex-col flex-1 overflow-y-auto`}
          style={{ minWidth: 0 }}
        >
          {mobileView === "detail" && selectedReport === null && (
            <button className="md:hidden p-4 text-sm text-left" style={{ color: C.navy }}
              onClick={() => setMobileView("reports")}>← 返回報告列表</button>
          )}
          {selectedReport ? (
            <ReportDetail report={selectedReport} />
          ) : (
            <div className="p-6 text-sm hidden md:block" style={{ color: C.muted }}>
              ← 選擇報告查看內容
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
