import { CATEGORIES } from '@/lib/types'

interface CategoryBadgeProps {
  category: string
  size?: 'sm' | 'md'
}

export function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const config = CATEGORIES.find(c => c.value === category)
  if (!config) return null

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.color} ${
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
    }`}>
      {config.label}
    </span>
  )
}

interface CategoryFilterProps {
  selected: string[]
  onChange: (categories: string[]) => void
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(c => c !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map(cat => (
        <button
          key={cat.value}
          onClick={() => toggle(cat.value)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
            selected.includes(cat.value)
              ? cat.color + ' ring-2 ring-offset-1 ring-current opacity-100'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}
