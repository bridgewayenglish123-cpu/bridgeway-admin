"use client";
import { C } from "@/lib/constants";

export function Table({
  head,
  children,
  mobileCard = false,
}: {
  head: string[];
  children: React.ReactNode;
  mobileCard?: boolean;
}) {
  return (
    <div className={mobileCard ? "hidden md:block" : "-mx-3 md:mx-0 overflow-x-auto bw-scroll"}>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: "min-content" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.line}` }}>
            {head.map((h, i) => (
              <th
                key={i}
                className="text-left font-semibold px-3 py-2.5 whitespace-nowrap"
                style={{ color: C.muted, fontSize: 12, letterSpacing: "0.03em" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...p} className="px-3 py-2.5 align-middle" style={{ color: C.text }}>
      {children}
    </td>
  );
}

// 手機卡片容器
export function MobileCardList({ children }: { children: React.ReactNode }) {
  return <div className="md:hidden flex flex-col gap-2">{children}</div>;
}

// 手機卡片
export function MobileCard({
  children,
  onClick,
  faded,
  selected,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  faded?: boolean;
  selected?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="rounded-xl p-3.5 space-y-1.5 border"
      style={{
        background: selected ? "#EAF0F6" : "#fff",
        borderColor: selected ? C.navy : C.line,
        opacity: faded ? 0.45 : 1,
        cursor: onClick ? "pointer" : "default",
        boxShadow: "0 1px 4px rgba(26,34,54,0.06)",
      }}
    >
      {children}
    </div>
  );
}

// 卡片內的一行 label + value
export function MobileRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[11px] font-semibold w-14 flex-shrink-0 pt-0.5"
        style={{ color: C.muted }}>
        {label}
      </span>
      <div className="flex-1 text-[13px]" style={{ color: C.text }}>
        {children}
      </div>
    </div>
  );
}
