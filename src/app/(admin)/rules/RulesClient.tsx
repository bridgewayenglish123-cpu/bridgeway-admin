"use client";

import { useState, useTransition } from "react";
import { C } from "@/lib/constants";
import { money } from "@/lib/utils";
import type { PriceRule, ActiveStatus } from "@/lib/supabase/types";
import PageIntro from "@/components/ui/PageIntro";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import Empty from "@/components/ui/Empty";
import RuleFormModal from "./RuleFormModal";
import { useConfirm } from "@/components/ConfirmProvider";
import { togglePriceRule } from "@/app/actions/rules";

interface Props {
  rules: PriceRule[];
  usageCounts: Record<string, number>;
}

type ModalState =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "edit"; rule: PriceRule }

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
      style={{ background: ok ? C.green : C.red, color: "#fff", maxWidth: 340 }}
    >
      {msg}
    </div>
  );
}

const DURATION_LABEL: Record<string, string> = {
  Short25: "25 分鐘",
  Long55: "55 分鐘",
  Trial25: "試聽 25 分",
};
const BILLING_LABEL: Record<string, string> = {
  Trial: "試聽",
  Single: "單堂",
  Package: "套裝",
};

export default function RulesClient({ rules, usageCounts }: Props) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showInactive, setShowInactive] = useState(false);

  const { askConfirm } = useConfirm();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };
  const closeModal = () => setModal({ kind: "none" });

  const filtered = showInactive ? rules : rules.filter((r) => r.active_status === "Active");

  const handleToggle = (rule: PriceRule) => {
    const isActive = rule.active_status === "Active";
    const usageCount = usageCounts[rule.price_rule_code] || 0;
    askConfirm({
      title: isActive ? "停用價格規則" : "啟用價格規則",
      message: isActive
        ? `即將停用「${rule.display_name}」(${rule.price_rule_code})

目前有 ${usageCount} 個帳戶使用這個規則(這些帳戶的 snapshot 已凍結,不受影響)

停用後開課選單不會出現這個方案。`
        : `即將啟用「${rule.display_name}」,之後開課選單會出現。`,
      confirmLabel: isActive ? "確認停用" : "確認啟用",
      onConfirm: async () => {
        const newStatus: ActiveStatus = isActive ? "Inactive" : "Active";
        const res = await togglePriceRule(rule.id, newStatus);
        if (res.error) showToast(res.error, false);
        else showToast(isActive ? `已停用 ${rule.display_name}` : `已啟用 ${rule.display_name}`);
        closeModal();
      },
    });
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 頁首 */}
      <div className="pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-xs uppercase mb-1.5 bw-display-en" style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}>
          Bridgeway English · Admin
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="text-2xl md:text-3xl" style={{ color: C.navy }}>價格規則</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: C.muted }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              顯示停用
            </label>
            <Btn kind="primary" size="md" onClick={() => setModal({ kind: "add" })}>＋ 新增規則</Btn>
          </div>
        </div>
      </div>

      <PageIntro storageKey="rules" title="價格規則 · 說明">
        <p>所有可販售的課程方案。開課時從這裡選一個方案,價格會被快照凍結到帳戶。</p>
        <p>• <strong>快照凍結</strong>:開課後改規則不影響已開的帳戶,歷史數字永遠準確。</p>
        <p>• <strong>停用 vs 刪除</strong>:不再賣的方案請用「停用」,這樣歷史帳戶仍可對照。此頁不提供刪除按鈕。</p>
        <p>• <strong>Lee 利潤</strong>:售價 − 老師抽成 − Hanne 抽成,自動計算。</p>
      </PageIntro>

      <Card title={`價格規則(${filtered.length}${filtered.length !== rules.length ? ` / ${rules.length}` : ""})`}>
        {filtered.length === 0 ? (
          <Empty action={<Btn kind="primary" onClick={() => setModal({ kind: "add" })}>＋ 新增規則</Btn>}>
            {rules.length === 0 ? "還沒有任何價格規則。" : "沒有符合條件的規則。"}
          </Empty>
        ) : (
          <Table head={["代碼", "方案名稱", "老師類型", "時長", "計費", "堂數", "售價", "老師抽成", "Hanne 抽成", "Lee 利潤", "使用", "狀態", "操作"]}>
            {filtered.map((r) => {
              const lee = r.price_ntd - r.teacher_payout_ntd - r.hanne_share_ntd;
              const usage = usageCounts[r.price_rule_code] || 0;
              const isActive = r.active_status === "Active";
              return (
                <tr
                  key={r.id}
                  style={{ borderBottom: `1px solid ${C.line}`, opacity: isActive ? 1 : 0.5 }}
                >
                  <Td>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: "#EAF0F6", color: C.navy }}>
                      {r.price_rule_code}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm font-medium" style={{ color: C.navy }}>{r.display_name}</span>
                  </Td>
                  <Td>
                    <Badge tone={r.teacher_type === "Hanne" ? "gold" : "navy"}>
                      {r.teacher_type}
                    </Badge>
                  </Td>
                  <Td><span className="text-xs" style={{ color: C.muted }}>{DURATION_LABEL[r.duration_type] || r.duration_type}</span></Td>
                  <Td><span className="text-xs" style={{ color: C.muted }}>{BILLING_LABEL[r.billing_type] || r.billing_type}</span></Td>
                  <Td><span className="text-sm">{r.lesson_count}</span></Td>
                  <Td><span className="text-sm">NT$ {money(r.price_ntd)}</span></Td>
                  <Td><span className="text-sm" style={{ color: C.text }}>NT$ {money(r.teacher_payout_ntd)}</span></Td>
                  <Td><span className="text-sm" style={{ color: C.muted }}>NT$ {money(r.hanne_share_ntd)}</span></Td>
                  <Td>
                    <span className="text-sm font-medium" style={{ color: lee >= 0 ? C.green : C.red }}>
                      NT$ {money(lee)}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs" style={{ color: usage > 0 ? C.navy : C.muted }}>
                      {usage > 0 ? `${usage} 個帳戶` : "—"}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={isActive ? "green" : "gray"}>{isActive ? "啟用" : "停用"}</Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      <Btn kind="ghost" size="sm" onClick={() => setModal({ kind: "edit", rule: r })}>編輯</Btn>
                      <Btn
                        kind={isActive ? "ghost" : "good"}
                        size="sm"
                        onClick={() => handleToggle(r)}
                      >
                        {isActive ? "停用" : "啟用"}
                      </Btn>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {(modal.kind === "add" || modal.kind === "edit") && (
        <RuleFormModal
          rule={modal.kind === "edit" ? modal.rule : null}
          onDone={(msg) => { showToast(msg); closeModal(); }}
          onError={(msg) => showToast(msg, false)}
          onClose={closeModal}
        />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
