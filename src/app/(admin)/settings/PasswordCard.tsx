"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { C } from "@/lib/constants";
import Btn from "@/components/ui/Btn";

export default function PasswordCard({ email }: { email: string | null }) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const tooShort = pw1.length > 0 && pw1.length < 8;
  const mismatch = pw2.length > 0 && pw1 !== pw2;
  const canSave = pw1.length >= 8 && pw1 === pw2 && !isPending;

  const save = () => {
    setMsg(null);
    startTransition(async () => {
      // updateUser 改的是「當前登入者自己」的密碼,
      // 不需要 service role key,也不可能誤改到其他帳號。
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) {
        setMsg({ text: error.message, ok: false });
      } else {
        setMsg({ text: "密碼已更新,下次登入請使用新密碼", ok: true });
        setPw1("");
        setPw2("");
      }
    });
  };

  return (
    <div
      className="rounded-xl p-4 sm:p-5"
      style={{ background: C.card, border: `1px solid ${C.line}` }}
    >
      <div className="text-sm font-semibold" style={{ color: C.navy }}>
        修改我的密碼
      </div>
      <div className="text-xs mt-0.5 mb-4" style={{ color: C.muted }}>
        {email ? `目前登入:${email}` : "管理員帳號"}
      </div>

      <div className="space-y-3 max-w-sm">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            新密碼
          </label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: tooShort ? C.red : C.line, color: C.text }}
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            placeholder="至少 8 字元"
          />
          {tooShort && (
            <div className="text-xs mt-1" style={{ color: C.red }}>
              密碼至少 8 字元
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            再次輸入
          </label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: mismatch ? C.red : C.line, color: C.text }}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="確認新密碼"
          />
          {mismatch && (
            <div className="text-xs mt-1" style={{ color: C.red }}>
              兩次輸入不一致
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Btn kind="primary" size="sm" disabled={!canSave} onClick={save}>
            {isPending ? "更新中…" : "更新密碼"}
          </Btn>
        </div>

        {msg && (
          <div
            className="rounded-lg px-3 py-2 text-xs"
            style={{
              background: msg.ok ? "#E8F5E9" : "#FDECEA",
              color: msg.ok ? "#2E7D32" : C.red,
            }}
          >
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
