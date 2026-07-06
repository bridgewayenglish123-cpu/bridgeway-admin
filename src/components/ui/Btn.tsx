"use client";
import { C } from "@/lib/constants";

type Kind = "primary" | "gold" | "good" | "ghost" | "danger";
type Size = "sm" | "md";

interface Props {
  kind?: Kind;
  size?: Size;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  children: React.ReactNode;
  className?: string;
}

const styleFor = (kind: Kind): React.CSSProperties => {
  switch (kind) {
    case "gold":
      return { background: C.gold, color: "#fff", border: "1px solid transparent" };
    case "good":
      return { background: C.green, color: "#fff", border: "1px solid transparent" };
    case "danger":
      return { background: C.red, color: "#fff", border: "1px solid transparent" };
    case "ghost":
      return { background: "transparent", color: C.navy, border: `1px solid ${C.line}` };
    default:
      return { background: C.navy, color: "#fff", border: "1px solid transparent" };
  }
};

export default function Btn({ kind = "primary", size = "md", onClick, disabled, type = "button", children, className = "" }: Props) {
  const sz = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-medium transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${sz} ${className}`}
      style={styleFor(kind)}
    >
      {children}
    </button>
  );
}
