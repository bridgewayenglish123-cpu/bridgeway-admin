"use client";
import { C } from "@/lib/constants";

type Tone = "gold" | "green" | "red" | "amber" | "gray" | "navy";

const styleFor = (tone: Tone): React.CSSProperties => {
  switch (tone) {
    case "gold":
      return { background: "#FBF3E0", color: C.gold };
    case "green":
      return { background: C.greenSoft, color: C.green };
    case "red":
      return { background: C.redSoft, color: C.red };
    case "amber":
      return { background: C.amberSoft, color: C.amber };
    case "navy":
      return { background: "#EAF0F6", color: C.navy };
    default:
      return { background: "#F3F4F6", color: "#6B7280" };
  }
};

export default function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ ...styleFor(tone), letterSpacing: "0.02em" }}
    >
      {children}
    </span>
  );
}
