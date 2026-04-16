import type { Ref } from 'vue'
import type { Config } from '@/stores/ConfigStore.ts'

export interface Chart {
  pair: string
  icon: string
  price: number
  precent: number
}

export interface UseChartOptions {
  charts: Ref<Map<string, Chart>>
  mark: boolean
  pairs: string[]
  priceBasis: Config['preferences']['priceBasis']
}
