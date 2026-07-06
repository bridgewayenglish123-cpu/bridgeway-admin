"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { C } from "@/lib/constants";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl md:text-5xl bw-display-en" style={{ color: C.navy, letterSpacing: "0.03em", fontWeight: 500 }}>
            Bridgeway
          </div>
          <div className="text-xs mt-2 bw-display-en" style={{ color: C.gold, letterSpacing: "0.32em", textTransform: "uppercase", fontStyle: "italic" }}>
            English Admin
          </div>
        </div>

        <form onSubmit={handleLogin} className="rounded-xl p-6 md:p-7" style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadowSoft }}>
          <div className="mb-4">
            <label className="block text-xs mb-1.5 font-medium" style={{ color: C.muted }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${C.line}`, background: "#fff" }}
              autoComplete="email"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs mb-1.5 font-medium" style={{ color: C.muted }}>密碼</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${C.line}`, background: "#fff" }}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg p-2.5 text-xs" style={{ background: C.redSoft, color: C.red }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: C.gold, color: "#fff", letterSpacing: "0.03em" }}
          >
            {loading ? "登入中..." : "登入"}
          </button>
        </form>

        <div className="text-xs text-center mt-6" style={{ color: C.muted }}>
          Bridgeway English · 內部管理系統
        </div>
      </div>
    </div>
  );
}
