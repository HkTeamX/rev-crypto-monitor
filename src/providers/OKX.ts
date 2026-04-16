import type { SelectOption } from 'naive-ui'
import type { UseChartOptions } from '@/components/Monitor/index.ts'
import { fetch } from '@tauri-apps/plugin-http'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import ReconnectingWebSocket from 'reconnecting-websocket'
import { BaseProvider } from '@/providers/Base.ts'
import { setupHourlyRefresher } from '@/utils/setupHourlyRefresher.ts'

dayjs.extend(utc)

export interface OKXPair {
  data: {
    instId: string
  }[]
}

export interface OKXWebSocketResponse {
  arg: {
    channel: string
    instId: string
  }
  data: [
    {
      instType: string
      instId: string
      last: string
      lastSz: string
      askPx: string
      askSz: string
      bidPx: string
      bidSz: string
      open24h: string
      high24h: string
      low24h: string
      sodUtc0: string
      sodUtc8: string
      volCcy24h: string
      vol24h: string
      ts: string
    },
  ]
}

export interface OKXCandleResponse {
  code: '0'
  msg: ''
  data: [string, string, string, string, string, string, string, string, string][]
}

export class OKXProvider extends BaseProvider {
  ws: ReconnectingWebSocket | null = null

  getIconUrl(pair: string) {
    return `https://static.okx.com/cdn/oksupport/asset/currency/icon/${pair.toLowerCase()}.png`
  }

  parsePair(pair: string) {
    if (pair.includes('_')) {
      return pair.split('_')[0] ?? 'UNKNOWN'
    }
    else if (pair.includes('-')) {
      return pair.split('-')[0] ?? 'UNKNOWN'
    }
    return pair
  }

  async getPairs(isMark: boolean): Promise<SelectOption[]> {
    return await fetch(`https://www.okx.com/api/v5/public/instruments?instType=${isMark ? 'SWAP' : 'SPOT'}`)
      .then(res => res.json())
      .then((data: OKXPair) => data.data.map(pair => ({
        label: pair.instId.split('-').join('_'),
        value: pair.instId.split('-').join('_'),
      })))
  }

  async refreshCharts(options: UseChartOptions, init: boolean) {
    if (init) {
      options.pairs.forEach((ticker) => {
        const pair = this.getDisplayPair(ticker)

        options.charts.value.set(pair, {
          pair,
          icon: this.getIconUrl(pair),
          price: 0,
          precent: 0,
        })
      })
    }

    await Promise.all(options.pairs.map(async (ticker) => {
      const pair = this.getDisplayPair(ticker)

      const query = new URLSearchParams({
        instId: ticker.replace(/_/g, '-'),
        bar: '1H',
        limit: '24',
      })

      const data = await fetch(`https://www.okx.com/api/v5/market/candles?${query}`)
        .then(res => res.json()) as OKXCandleResponse

      if (data.code !== '0') {
        return
      }

      const targetTime = dayjs().utcOffset(options.priceBasis).set('hour', 0).format('YYYY-MM-DD HH')

      // 查找今天的第一条数据作为24h的起始价格
      const first = options.priceBasis === '24h'
        ? data.data[data.data.length - 1]
        : data.data.find(candle => dayjs(Number.parseFloat(candle[0])).format('YYYY-MM-DD HH') === targetTime)
          ?? data.data[data.data.length - 1]
      // OKX数据是反向的
      const last = data.data[0]

      const startMarketPrice = Number.parseFloat(first[1])
      const endMarketPrice = Number.parseFloat(last[4])
      if (Number.isNaN(startMarketPrice) || Number.isNaN(endMarketPrice)) {
        return
      }

      this.cachedPrice.set(pair, startMarketPrice)
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

    this.ws = new ReconnectingWebSocket('wss://ws.okx.com/ws/v5/public')

    this.ws.addEventListener('message', (event) => {
      let data: OKXWebSocketResponse
      try {
        data = JSON.parse(event.data)
      }
      catch {
        return
      }

      if (!('data' in data)) {
        return
      }

      const ticker = data.data[0]

      const pair = this.getDisplayPair(ticker.instId)
      const price = Number.parseFloat(ticker.last)
      const startMarketPrice = this.cachedPrice.get(pair) ?? price
      this.updateChart(options, pair, price, startMarketPrice)
    })

    this.ws.addEventListener('open', () => {
      if (!this.ws) {
        return
      }

      // 订阅所选交易对的价格更新
      this.ws.send(JSON.stringify({
        op: 'subscribe',
        args: options.pairs.map(pair => ({
          channel: 'tickers',
          instId: pair.replace(/_/g, '-'),
        })),
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

export const okxProvider = new OKXProvider()
