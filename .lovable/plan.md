

## Plan: Add "Quantidade por Semana" bar chart

### What changes

Add a new bar chart below "Consumo por Horário" (after line 489) showing access count per day of week (Dom–Sáb), using green bars matching the reference image.

### Data transformation

In the `kpis` computation (around line 219), add `weekdayVolume`: aggregate the filtered `progresso` data by day of week (0=Dom to 6=Sáb), producing `Array<{ day: string, quantidade: number }>` with 7 entries.

```ts
const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const weekdayVolume = dayNames.map((name, idx) => {
  let total = 0;
  progresso.forEach((p) => {
    if (new Date(p.updated_at).getDay() === idx) total++;
  });
  return { day: name, quantidade: total };
});
```

### Chart implementation

**File: `src/components/admin/AdminConsumptionKPIs.tsx`**

1. Add `BarChart, Bar` to the recharts import.

2. Add `weekdayVolume` to kpis return object.

3. Insert new chart block after line 489 (after "Consumo por Horário" closing div), before "Detalhamento por Aula":
   - Card with `BarChart3` icon and title "Quantidade por Semana"
   - `ResponsiveContainer` height 300
   - `BarChart` with green bars (`#22c55e`, `radius={[4,4,0,0]}`)
   - X-axis: day names (Dom–Sáb)
   - Y-axis: count
   - `CartesianGrid` with `strokeDasharray="3 3"`
   - Tooltip showing day and count

No other components or functionalities will be modified.

