"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compact } from "@/lib/format";

// Back-to-back population pyramid: males to the left (drawn as negative values), females to the right.
export function Pyramid({ bands, m, f, height = 340, showAxisLabels = true }: { bands: string[]; m: number[]; f: number[]; height?: number; showAxisLabels?: boolean }) {
  const data = bands.map((b, i) => ({ band: b, male: -(m[i] ?? 0), female: f[i] ?? 0 }));
  const raw = Math.max(...data.map((d) => Math.max(-d.male, d.female)), 1);
  // round the half-width up to a tidy 1, 2 or 5 x 10^k so the axis is symmetric and centred on zero
  const pow = 10 ** Math.floor(Math.log10(raw));
  const max = ([1, 2, 5, 10].find((k) => k * pow >= raw) ?? 10) * pow;
  const ticks = [-max, -max / 2, 0, max / 2, max];
  const axis = { fontSize: 10, fill: "var(--ink-3)" };
  return (
    <div style={{ width: "100%", height }} role="img" aria-label="Population pyramid by age and sex">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 10, bottom: 0, left: showAxisLabels ? 0 : -24 }} barCategoryGap={1}>
          <CartesianGrid stroke="var(--line)" horizontal={false} />
          <XAxis type="number" domain={[-max, max]} ticks={ticks} tick={axis} tickFormatter={(v) => compact(Math.abs(v as number))} />
          <YAxis type="category" dataKey="band" tick={axis} width={42} reversed={false} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-strong)", fontSize: 12 }}
            formatter={(v, name) => [Math.abs(v as number).toLocaleString("en-US"), name === "male" ? "Male" : "Female"]}
            labelFormatter={(l) => `Age ${l}`}
          />
          <Bar dataKey="male" name="male" stackId="p" fill="#0ea5c6" />
          <Bar dataKey="female" name="female" stackId="p" fill="#d95b92" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
