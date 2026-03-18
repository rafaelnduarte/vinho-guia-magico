

## Plan: Replace heatmap with line chart in "Consumo por Dia × Horário"

### What changes

Replace the heatmap grid (lines 425-475) with a Recharts `AreaChart` (filled line chart like the reference image) showing hourly access volume.

### Data transformation

In the `kpis` computation (~line 176-207), add `hourlyVolume`: aggregate the existing `heatMatrix` by hour (sum all days per hour), producing `Array<{ hour: string, acessos: number }>` with 24 entries (00h–23h).

### Chart implementation

**File: `src/components/admin/AdminConsumptionKPIs.tsx`**

1. Add imports: `AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer` from `recharts`.

2. Add `hourlyVolume` to kpis return object — derived from existing heatMatrix data:
```ts
const hourlyVolume = Array.from({ length: 24 }, (_, h) => {
  let total = 0;
  for (let d = 0; d < totalDays; d++) {
    total += heatMatrix[`${d}-${h}`] || 0;
  }
  return { hour: `${String(h).padStart(2, '0')}h`, acessos: total };
});
```

3. Replace the heatmap JSX block (lines 425-475) with:
   - Same card wrapper (border, header with Clock icon, title "Consumo por Horário")
   - `ResponsiveContainer` height 300
   - `AreaChart` with smooth green filled area (matching the reference image style)
   - X-axis: hours (00h–23h)
   - Y-axis: access count
   - `CartesianGrid` with `strokeDasharray="3 3"`
   - `Tooltip` showing hour and count
   - Green color (`#22c55e`) matching the reference image

No other components, pages, or functionalities will be modified.

