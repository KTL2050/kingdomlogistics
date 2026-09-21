"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Shipment } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  on_time: "#17864f",
  delayed: "#d0361c",
  not_started: "#b6650a",
  completed: "#2563eb",
};

function groupCount<T extends string>(items: T[]) {
  const map = new Map<string, number>();
  items.forEach((i) => map.set(i, (map.get(i) ?? 0) + 1));
  return Array.from(map, ([name, value]) => ({ name, value }));
}

export function ReportsCharts({ shipments }: { shipments: Shipment[] }) {
  const byDestination = groupCount(shipments.map((s) => s.destination));
  const byOrigin = groupCount(shipments.map((s) => s.origin));
  const byStatus = groupCount(shipments.map((s) => s.health)).map((d) => ({
    ...d,
    name:
      d.name === "on_time"
        ? "On Time"
        : d.name === "delayed"
        ? "Delayed"
        : d.name === "not_started"
        ? "Not Started"
        : "Completed",
    key: d.name,
  }));

  const byMonth = groupCount(
    shipments.map((s) =>
      new Date(s.etd).toLocaleDateString("en-GB", { month: "short" })
    )
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">
          Container status distribution
        </h3>
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={byStatus}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {byStatus.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">
          Monthly shipment volume (by ETD)
        </h3>
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ec" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#667085" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#667085" }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">Shipments by destination</h3>
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDestination}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ec" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#667085" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#667085" }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-text-primary">Shipments by origin</h3>
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byOrigin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e8ec" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#667085" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#667085" }} />
              <Tooltip />
              <Bar dataKey="value" fill="#17864f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
