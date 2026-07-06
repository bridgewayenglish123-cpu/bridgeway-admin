"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { C } from "@/lib/constants";
import Btn from "@/components/ui/Btn";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ThreeWayOptions {
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel: string;
  cancelLabel?: string;
  primaryKind?: "gold" | "primary" | "good";
  onPrimary: () => void | Promise<void>;
  onSecondary: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ConfirmContextType {
  askConfirm: (opts: ConfirmOptions) => void;
  askThreeWay: (opts: ThreeWayOptions) => void;
}

const ConfirmContext = createContext<ConfirmContextType>({
  askConfirm: () => {},
  askThreeWay: () => {},
});

export const useConfirm = () => useContext(ConfirmContext);

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const [threeWay, setThreeWay] = useState<ThreeWayOptions | null>(null);
  const [isPending, setIsPending] = useState(false);

  const askConfirm = useCallback((opts: ConfirmOptions) => {
    setConfirm(opts);
  }, []);

  const askThreeWay = useCallback((opts: ThreeWayOptions) => {
    setThreeWay(opts);
  }, []);

  const closeConfirm = () => { setConfirm(null); setIsPending(false); };
  const closeThreeWay = () => { setThreeWay(null); setIsPending(false); };

  // ESC 關閉
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeConfirm(); closeThreeWay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleConfirm = async () => {
    if (!confirm) return;
    setIsPending(true);
    try { await confirm.onConfirm(); } finally { closeConfirm(); }
  };

  const handlePrimary = async () => {
    if (!threeWay) return;
    setIsPending(true);
    try { await threeWay.onPrimary(); } finally { closeThreeWay(); }
  };

  const handleSecondary = async () => {
    if (!threeWay) return;
    setIsPending(true);
    try { await threeWay.onSecondary(); } finally { closeThreeWay(); }
  };

  return (
    <ConfirmContext.Provider value={{ askConfirm, askThreeWay }}>
      {children}

      {/* Standard Confirm Dialog */}
      {confirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { confirm.onCancel?.(); closeConfirm(); } }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 40px rgba(15,42,74,0.22)" }}
          >
            <h3
              className="text-base font-semibold"
              style={{ color: confirm.danger ? C.red : C.navy }}
            >
              {confirm.title}
            </h3>
            <p className="text-sm whitespace-pre-line" style={{ color: C.text, lineHeight: 1.75 }}>
              {confirm.message}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Btn
                kind="ghost"
                size="sm"
                onClick={() => { confirm.onCancel?.(); closeConfirm(); }}
                disabled={isPending}
              >
                {confirm.cancelLabel || "取消"}
              </Btn>
              <Btn
                kind={confirm.danger ? "danger" : "primary"}
                size="sm"
                disabled={isPending}
                onClick={handleConfirm}
              >
                {isPending ? "處理中…" : confirm.confirmLabel}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Three-Way Dialog */}
      {threeWay && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { threeWay.onCancel?.(); closeThreeWay(); } }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 40px rgba(15,42,74,0.22)" }}
          >
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>
              {threeWay.title}
            </h3>
            <p className="text-sm whitespace-pre-line" style={{ color: C.text, lineHeight: 1.75 }}>
              {threeWay.message}
            </p>
            <div className="flex justify-end gap-2 pt-1 flex-wrap">
              <Btn
                kind="ghost"
                size="sm"
                onClick={() => { threeWay.onCancel?.(); closeThreeWay(); }}
                disabled={isPending}
              >
                {threeWay.cancelLabel || "取消"}
              </Btn>
              <Btn
                kind="ghost"
                size="sm"
                disabled={isPending}
                onClick={handleSecondary}
              >
                {isPending ? "處理中…" : threeWay.secondaryLabel}
              </Btn>
              <Btn
                kind={threeWay.primaryKind || "gold"}
                size="sm"
                disabled={isPending}
                onClick={handlePrimary}
              >
                {isPending ? "處理中…" : threeWay.primaryLabel}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
