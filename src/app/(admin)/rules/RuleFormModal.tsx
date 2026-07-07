"use client";

import { useState, useTransition } from "react";
import { C } from "@/lib/constants";
import { money } from "@/lib/utils";
import type { PriceRule, TeacherType, BillingType } from "@/lib/supabase/types";
import Btn from "@/components/ui/Btn";
import { createPriceRule, updatePriceRule } from "@/app/actions/rules";

interface Props {
  rule: PriceRule | null;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

const EMPTY = {
  price_rule_code: "",
  display_name: "",
  teacher_type: "Other" as TeacherType,
  course_family: "General",
  duration_type: "Short25",
  billing_type: "Package" as BillingType,
  lesson_count: "",
  price_ntd: "",
  teacher_payout_ntd: "",
  hanne_share_ntd: "0",
};

export default function RuleFormModal({ rule, onDone, onError, onClose }: Props) {
  const isEdit = !!rule;
  const [form, setForm] = useState({
    price_rule_code: rule?.price_rule_code || "",
    display_name: rule?.display_name || "",
    teacher_type: (rule?.teacher_type || "Other") as TeacherType,
    course_family: rule?.course_family || "General",
    duration_type: rule?.duration_type || "Short25",
    billing_type: (rule?.billing_type || "Package") as BillingType,
    lesson_count: String(rule?.lesson_count || ""),
    price_ntd: String(rule?.price_ntd || ""),
    teacher_payout_ntd: String(rule?.teacher_payout_ntd || ""),
    hanne_share_ntd: String(rule?.hanne_share_ntd || "0"),
    validity_days: String(rule?.validity_days || ""),
  });
  const [isPending, startTransition] = useTransition();

  const set = (k: keyof typeof EMPTY, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const price = parseInt(form.price_ntd) || 0;
  const payout = parseInt(form.teacher_payout_ntd) || 0;
  const hanne = parseInt(form.hanne_share_ntd) || 0;
  const count = parseInt(form.lesson_count) || 1;
  const lee = price - (payout * count) - (hanne * count);

  const canSave =
    form.price_rule_code.trim() &&
    form.display_name.trim() &&
    form.lesson_count &&
    form.price_ntd &&
    form.teacher_payout_ntd;

  const handleSave = () => {
    if (!canSave) return;
    startTransition(async () => {
      const data = {
        display_name: form.display_name,
        teacher_type: form.teacher_type,
        course_family: form.course_family,
        duration_type: form.duration_type,
        billing_type: form.billing_type,
        lesson_count: parseInt(form.lesson_count),
        price_ntd: parseInt(form.price_ntd),
        teacher_payout_ntd: parseInt(form.teacher_payout_ntd),
        hanne_share_ntd: parseInt(form.hanne_share_ntd) || 0,
        validity_days: null,
      };
      const res = isEdit
        ? await updatePriceRule(rule.id, data)
        : await createPriceRule({ ...data, price_rule_code: form.price_rule_code });
      if (res.error) onError(res.error);
      else onDone(isEdit ? "已更新價格規則" : "已新增價格規則");
    });
  };

  const F = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
        {label}{required && <span style={{ color: C.red }}> *</span>}
      </label>
      {children}
    </div>
  );

  const inp = (k: keyof typeof EMPTY, placeholder = "", type = "text") => (
    <input
      type={type}
      className="w-full rounded-lg border px-3 py-2 text-sm"
      style={{ borderColor: C.line, color: C.text }}
      value={form[k]}
      onChange={(e) => set(k, e.target.value)}
      placeholder={placeholder}
      disabled={isEdit && k === "price_rule_code"}
    />
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,54,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-5 space-y-3 overflow-y-auto"
        style={{ background: "white", boxShadow: "0 8px 32px rgba(15,42,74,0.18)", maxHeight: "92vh" }}
      >
        <h3 className="text-base font-semibold" style={{ color: C.navy }}>
          {isEdit ? `編輯規則 · ${rule.price_rule_code}` : "新增價格規則"}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <F label="代碼" required>{inp("price_rule_code", "e.g. OT_S25_P8")}</F>
          <F label="方案名稱" required>{inp("display_name", "e.g. Other 短課 8堂")}</F>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <F label="老師類型" required>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: C.line, color: C.text }}
              value={form.teacher_type}
              onChange={(e) => set("teacher_type", e.target.value as TeacherType)}
            >
              <option value="Hanne">Hanne</option>
              <option value="Other">Other</option>
            </select>
          </F>
          <F label="課程族群" required>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: C.line, color: C.text }}
              value={form.course_family}
              onChange={(e) => set("course_family", e.target.value)}
            >
              <option value="General">General</option>
              <option value="Trial">Trial</option>
            </select>
          </F>
          <F label="時長類型" required>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: C.line, color: C.text }}
              value={form.duration_type}
              onChange={(e) => set("duration_type", e.target.value)}
            >
              <option value="Short25">Short25</option>
              <option value="Long55">Long55</option>
              <option value="Trial25">Trial25</option>
            </select>
          </F>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <F label="計費類型" required>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: C.line, color: C.text }}
              value={form.billing_type}
              onChange={(e) => set("billing_type", e.target.value as BillingType)}
            >
              <option value="Trial">Trial 試聽</option>
              <option value="Single">Single 單堂</option>
              <option value="Package">Package 套裝</option>
            </select>
          </F>
          <F label="堂數" required>{inp("lesson_count", "e.g. 8", "number")}</F>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <F label="售價 NTD" required>{inp("price_ntd", "e.g. 2700", "number")}</F>
          <F label="老師抽成 NTD(每堂)" required>{inp("teacher_payout_ntd", "e.g. 150", "number")}</F>
          <F label="Hanne 抽成 NTD(每堂)">{inp("hanne_share_ntd", "0", "number")}</F>
        </div>

        {/* Lee 利潤自動顯示 */}
        <div
          className="rounded-lg p-3 flex items-center justify-between"
          style={{ background: lee >= 0 ? C.greenSoft : C.redSoft }}
        >
          <span className="text-sm" style={{ color: lee >= 0 ? C.green : C.red }}>
            Lee 利潤(總額,自動計算)
          </span>
          <span className="text-base font-bold" style={{ color: lee >= 0 ? C.green : C.red }}>
            NT$ {money(lee)}
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Btn kind="ghost" size="sm" onClick={onClose} disabled={isPending}>取消</Btn>
          <Btn kind="primary" size="sm" disabled={!canSave || isPending} onClick={handleSave}>
            {isPending ? "儲存中…" : isEdit ? "更新規則" : "新增規則"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
