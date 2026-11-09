"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateLabel, formatKcal } from "@/lib/utils";

export interface DailyTotal {
  date: string; // YYYY-MM-DD
  calories: number;
}

interface Props {
  data: DailyTotal[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const shortLabel = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${m}/${d}`;
};

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DailyTotal }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="text-sm font-semibold">{formatDateLabel(point.date)}</p>
      <p className="text-sm text-primary">{formatKcal(point.calories)}</p>
    </div>
  );
}

export function CalorieChart({ data, selectedDate, onSelectDate }: Props) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          tickFormatter={shortLabel}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          minTickGap={12}
        />
        <YAxis width={48} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
        <Bar
          dataKey="calories"
          radius={[4, 4, 0, 0]}
          className="cursor-pointer"
          onClick={(entry) => {
            const date = (entry as unknown as { payload?: DailyTotal }).payload?.date;
            if (date) onSelectDate(date);
          }}
        >
          {data.map((d) => (
            <Cell
              key={d.date}
              fill="var(--color-primary)"
              fillOpacity={d.date === selectedDate ? 1 : 0.45}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
