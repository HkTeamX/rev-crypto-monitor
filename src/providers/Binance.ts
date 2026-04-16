import type { SelectOption } from 'naive-ui'
import type { UseChartOptions } from '@/components/Monitor/index.ts'
import { fetch } from '@tauri-apps/plugin-http'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import ReconnectingWebSocket from 'reconnecting-websocket'
import { BaseProvider } from '@/providers/Base.ts'
import { setupHourlyRefresher } from '@/utils/setupHourlyRefresher.ts'

dayjs.extend(utc)

export interface BinancePair {
  symbols: { baseAsset: string, quoteAsset: string, status: string, contractType: string }[]
}

export type BinanceCandle = [number, string, string, string, string, string, number, string, number, string, string, string][]

export interface BinanceWebSocketResponse {
  e: 'trade'
  E: number
  T: number
  s: string
  t: number
  p: string
  q: string
  X: string
  m: boolean
}

export class BinanceProvider extends BaseProvider {
  ws: ReconnectingWebSocket | null = null
  cachedIcon = new Map<string, string>()

  async getIconUrl(pair: string) {
    if (this.cachedIcon.has(pair)) {
      return this.cachedIcon.get(pair) ?? ''
    }

    const response = await fetch(`https://bin.bnbstatic.com/static/assets/logos/${pair.toUpperCase()}.png`).then(res => res.arrayBuffer())
    const iconUrl = URL.createObjectURL(new Blob([response], { type: 'image/png' }))
    this.cachedIcon.set(pair, iconUrl)
    return iconUrl
  }

  parsePair(pair: string) {
    return pair.split('_')[0] ?? 'UNKNOWN'
  }

  async getPairs(isMark: boolean): Promise<SelectOption[]> {
    return await fetch(isMark
      ? 'https://fapi.binance.com/fapi/v1/exchangeInfo'
      : 'https://api.binance.com/api/v3/exchangeInfo?symbolStatus=TRADING',
    )
      .then(res => res.json())
      .then(
        (data: BinancePair) => data.symbols
          .filter(pair =>
            pair.status === 'TRADING'
            && (
              !('contractType' in pair)
              || pair.contractType === 'PERPETUAL'
            ),
          )
          .map(pair =>
            ({
              label: `${pair.baseAsset}_${pair.quoteAsset}`,
              value: `${pair.baseAsset}_${pair.quoteAsset}`,
            }),
          ),
      )
  }

  async refreshCharts(options: UseChartOptions, init: boolean) {
    if (init) {
      options.pairs.forEach(async (ticker) => {
        const pair = this.getDisplayPair(ticker)

        options.charts.value.set(pair, {
          pair,
          icon: await this.getIconUrl(pair),
          price: 0,
          precent: 0,
        })
      })
    }

    const from = options.priceBasis === '24h'
      ? dayjs().subtract(24, 'hour').unix()
      : dayjs().utcOffset(options.priceBasis).startOf('day').unix()
    const to = dayjs().unix()

    await Promise.all(options.pairs.map(async (ticker) => {
      const pair = this.getDisplayPair(ticker)

      const query = new URLSearchParams({
        symbol: ticker.replace('_', ''),
        interval: '1h',
        startTime: (from * 1000).toString(),
        endTime: (to * 1000).toString(),
      })

      const url = options.mark
        ? `https://fapi.binance.com/fapi/v1/markPriceKlines?${query}`
        : `https://api.binance.com/api/v3/klines?${query}`

      const data = await fetch(url)
        .then(res => res.json()) as BinanceCandle

      if (!Array.isArray(data) || data.length === 0) {
        return
      }

      const first = data[0]
      const last = data[data.length - 1]
      const startMarketPrice = Number.parseFloat(first[1])
      const endMarketPrice = Number.parseFloat(last[4])

      // 把原始交易对名称缓存起来 K: BTCUSDT, V: BTC
      const connectedPair = ticker.replace('_', '')
      this.displayPairCache.set(connectedPair, this.getDisplayPair(ticker))
      this.cachedPrice.set(connectedPair, startMarketPrice)
      this.updateChart(options, pair, endMarketPrice, startMarketPrice)
    }))
  }

  async useCharts(options: UseChartOptions) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
      this.ws = null
    }

    // 初始化图表
    await this.refreshCharts(options, true)
    const closeRefresher = setupHourlyRefresher(() => this.refreshCharts(options, false))

    this.ws = new ReconnectingWebSocket(options.mark ? 'wss://fstream.binance.com/public/ws' : 'wss://stream.binance.com/ws')

    this.ws.addEventListener('message', (event) => {
      let data: BinanceWebSocketResponse
      try {
        data = JSON.parse(event.data)
      }
      catch {
        return
      }

      if (data.e !== 'trade') {
        return
      }

      const pair = this.getDisplayPair(data.s)
      const price = Number.parseFloat(data.p)

      if (price === 0) {
        return
      }

      const startMarketPrice = this.cachedPrice.get(data.s) ?? price
      this.updateChart(options, pair, price, startMarketPrice)
    })

    this.ws.addEventListener('open', () => {
      if (!this.ws) {
        return
      }

      // 订阅所选交易对的价格更新
      this.ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: options.pairs.map(pair => `${pair.replace('_', '').toLowerCase()}@trade`),
        id: Date.now(),
      }))
    })

    return () => {
      closeRefresher()

      // 清空缓存的数据
      this.cachedPrice.clear()
      this.displayPairCache.clear()

      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    }
  }
}

export const binanceProvider = new BinanceProvider()
