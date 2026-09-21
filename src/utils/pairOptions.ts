import type { SelectOption } from 'naive-ui'

export function buildPairOptions(options: SelectOption[], selected: string[], search: string): SelectOption[] {
  const result = [...options]
  const values = new Set(options.map(option => option.value))
  const input = search.trim().toUpperCase()

  for (const value of [...selected, input]) {
    if (value && !values.has(value)) {
      result.push({ label: value, value })
      values.add(value)
    }
  }

  return result
}
