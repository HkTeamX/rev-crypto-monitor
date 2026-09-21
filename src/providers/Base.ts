import type { SelectOption } from 'naive-ui'
import type { UseChartOptions } from '@/components/Monitor/index.ts'
import type { MaybePromise } from '@/utils/types.ts'

export abstract class BaseProvider {
  cachedPrice = new Map<string, number>()
  displayPairCache = new Map<string, string>()

  abstract getIconUrl(pair: string): MaybePromise<string>
  abstract parsePair(pair: string): string
  getDisplayPair(pair: string) {
    const cachedPair = this.displayPairCache.get(pair)
    if (cachedPair) {
      return cachedPair
    }

    const displayPair = this.parsePair(pair)
    this.displayPairCache.set(pair, displayPair)
    return displayPair
  }

  getPercent(currentPrice: number, startMarketPrice: number) {
    if (startMarketPrice <= 0) {
      return 0
    }

    return ((currentPrice - startMarketPrice) / startMarketPrice) * 100
  }

  async getSafeIconUrl(pair: string) {
    try {
      return await this.getIconUrl(pair)
    }
    catch {
      return ''
    }
  }

  async updateChart(options: UseChartOptions, pair: string, currentPrice: number, startMarketPrice: number) {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(startMarketPrice)) {
      return
    }

    options.charts.value.set(pair, {
      pair,
      icon: await this.getSafeIconUrl(pair),
      price: currentPrice,
      precent: this.getPercent(currentPrice, startMarketPrice),
    })
  }

  abstract getTradeUrl(originalPair: string, isMark: boolean): string
  abstract getPairs(isMark: boolean): MaybePromise<SelectOption[]>
  abstract refreshCharts(options: UseChartOptions, init: boolean): MaybePromise<void>
  abstract useCharts(options: UseChartOptions): MaybePromise<() => MaybePromise<void>>
}
