"use client";
import { C } from "@/lib/constants";

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="-mx-3 md:mx-0 overflow-x-auto bw-scroll">
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
