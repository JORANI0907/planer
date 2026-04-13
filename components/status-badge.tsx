import { STATUS_CONFIG, PRIORITY_CONFIG, type PlanStatus, type PlanPriority } from '@/lib/types'

interface StatusBadgeProps {
  status: PlanStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

interface PriorityDotProps {
  priority: PlanPriority
}

export function PriorityDot({ priority }: PriorityDotProps) {
  const config = PRIORITY_CONFIG[priority]
  const dotColor = {
    high: 'bg-red-500',
    medium: 'bg-yellow-400',
    low: 'bg-gray-300',
  }[priority]

  return (
    <span className="flex items-center gap-1" title={`우선순위: ${config.label}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className={`text-xs ${config.color}`}>{config.label}</span>
    </span>
  )
}

interface StatusSelectProps {
  value: PlanStatus
  onChange: (status: PlanStatus) => void
}

export function StatusSelect({ value, onChange }: StatusSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PlanStatus)}
      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
    >
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <option key={key} value={key}>{cfg.label}</option>
      ))}
    </select>
  )
}
