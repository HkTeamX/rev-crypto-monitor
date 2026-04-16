import type { FormItemRule } from 'naive-ui'
import type { PathKeys } from '@/utils/types.ts'

export type FormRules<T extends object> = {
  [K in PathKeys<T>]?: FormItemRule | FormItemRule[]
}

export function useFormRules<T extends object>(formRules: FormRules<T> = {}) {
  Object.values(formRules).forEach((rules) => {
    const ruleArray = Array.isArray(rules) ? rules : [rules]
    ruleArray.forEach(rule => (rule.trigger ??= 'blur'))
  })
  return formRules
}
