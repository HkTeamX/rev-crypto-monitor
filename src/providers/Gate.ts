import type { SelectOption } from 'naive-ui'
import type { UseChartOptions } from '@/components/Monitor/index.ts'
import { fetch } from '@tauri-apps/plugin-http'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import ReconnectingWebSocket from 'reconnecting-websocket'
import { BaseProvider } from '@/providers/Base.ts'
import { setupHourlyRefresher } from '@/utils/setupHourlyRefresher.ts'

dayjs.extend(utc)

export interface GatePair {
  id: string
}

export interface GateMarkPair {
  name: string
}

export interface GateTicker {
  contract: string
  price: string
}

export interface GateSpotTicker {
  currency_pair: string
  price: string
}

export type GateWebSocketResponse = {
  time: number
  event: string
}&({
  channel: 'futures.trades'
  result: [GateTicker]
} | {
  channel: 'spot.trades'
  result: GateSpotTicker
})

export interface GateCandle {
  o: string
  c: string
}

export class GateProvider extends BaseProvider {
  ws: ReconnectingWebSocket | null = null

  getIconUrl(pair: string) {
    return `https://icon.staticimgs.com/images/coin_icon/64/${pair.toLowerCase()}.png`
  }

  parsePair(pair: string) {
    return pair.split('_')[0] ?? 'UNKNOWN'
  }

  async getPairs(isMark: boolean): Promise<SelectOption[]> {
    if (isMark) {
      return await fetch(`https://api.gateio.ws/api/v4/futures/usdt/contracts`)
        .then(res => res.json())
        .then((data: GateMarkPair[]) => data
          .filter(pair => Boolean(pair.name))
          .map((pair: GateMarkPair) => ({
            label: pair.name,
            value: pair.name,
          })))
    }

    return await fetch(`https://api.gateio.ws/api/v4/spot/currency_pairs`)
      .then(res => res.json())
      .then((data: GatePair[]) => data
        .filter(pair => Boolean(pair.id))
        .map((pair: GatePair) => ({
          label: pair.id,
          value: pair.id,
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

    const from = options.priceBasis === '24h'
      ? dayjs().subtract(24, 'hour').unix()
      : dayjs().utcOffset(options.priceBasis).startOf('day').unix()
    const to = dayjs().unix()

    await Promise.all(
      options.pairs.map(async (ticker) => {
        const pair = this.getDisplayPair(ticker)

        const query = new URLSearchParams({
          contract: `mark_${ticker}`,
          currency_pair: ticker,
          interval: '1h',
          from: from.toString(),
          to: to.toString(),
        })

        const data = await fetch(
          options.mark
            ? `https://api.gateio.ws/api/v4/futures/usdt/candlesticks?${query}`
            : `https://api.gateio.ws/api/v4/spot/candlesticks?${query}`,
        ).then(res => res.json())

        if (!Array.isArray(data) || data.length === 0) {
          return
        }

        const first = data[0]
        const last = data[data.length - 1]
        const startMarketPrice = Number.parseFloat(options.mark ? first.o : first[5])
        const endMarketPrice = Number.parseFloat(options.mark ? last.c : last[2])
        if (Number.isNaN(startMarketPrice) || Number.isNaN(endMarketPrice)) {
          return
        }

        this.cachedPrice.set(ticker, startMarketPrice)
        this.updateChart(options, pair, endMarketPrice, startMarketPrice)
      }),
    )
  }

  async useCharts(options: UseChartOptions) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
      this.ws = null
    }

    // 初始化图表
    await this.refreshCharts(options, true)
    const closeRefresher = setupHourlyRefresher(() => this.refreshCharts(options, false))

    this.ws = new ReconnectingWebSocket(options.mark ? 'wss://fx-ws.gateio.ws/v4/ws/usdt' : 'wss://api.gateio.ws/ws/v4/')

    this.ws.addEventListener('message', (event) => {
      let data: GateWebSocketResponse
      try {
        data = JSON.parse(event.data)
      }
      catch {
        return
      }

      if (data.event !== 'update') {
        return
      }

      if (options.mark && data.channel === 'futures.trades') {
        data.result.forEach((ticker) => {
          const pair = this.getDisplayPair(ticker.contract)
          const price = Number.parseFloat(ticker.price)
          const startMarketPrice = this.cachedPrice.get(ticker.contract) ?? price
          this.updateChart(options, pair, price, startMarketPrice)
        })
      }
      else if (data.channel === 'spot.trades') {
        const result = data.result

        const pair = this.getDisplayPair(result.currency_pair)
        const price = Number.parseFloat(result.price)

        const startMarketPrice = this.cachedPrice.get(result.currency_pair) ?? price
        this.updateChart(options, pair, price, startMarketPrice)
      }
    })

    this.ws.addEventListener('open', () => {
      if (!this.ws) {
        return
      }

      // 订阅所选交易对的价格更新
      this.ws.send(JSON.stringify({
        time: Date.now(),
        channel: options.mark ? 'futures.trades' : 'spot.trades',
        event: 'subscribe',
        payload: options.pairs,
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

export const gateProvider = new GateProvider()
