import type { DayPoint } from '@/lib/admin/queries'

export function BarChart({
  data,
  color = 'bg-blue-500',
  format,
}: {
  data: DayPoint[]
  color?: string
  format?: (n: number) => string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((d) => (
        <div
          key={d.date}
          className="group relative flex flex-1 flex-col items-center justify-end"
        >
          <div
            className={`w-full rounded-t ${color}`}
            style={{
              height: `${(d.value / max) * 100}%`,
              minHeight: d.value > 0 ? 2 : 0,
            }}
          />
          <span className="pointer-events-none absolute -top-6 z-10 hidden whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            {d.date.slice(5)}: {format ? format(d.value) : d.value}
          </span>
        </div>
      ))}
    </div>
  )
}
