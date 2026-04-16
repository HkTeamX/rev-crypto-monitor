import type { SelectOption } from 'naive-ui'
import type { UseChartOptions } from '@/components/Monitor/index.ts'
import { fetch } from '@tauri-apps/plugin-http'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import ReconnectingWebSocket from 'reconnecting-websocket'
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
  last: string
  change_percentage: string
  total_size: string
  volume_24h: string
  volume_24h_base: string
  volume_24h_quote: string
  volume_24h_settle: string
  mark_price: string
  funding_rate: string
  funding_rate_indicative: string
  index_price: string
  quanto_base_rate: string
  low_24h: string
  high_24h: string
  price_type: string
  change_from: string
  change_price: string
  t: number
}

export interface GateSpotTicker {
  currency_pair: string
  last: string
  lowest_ask: string
  highest_bid: string
  change_percentage: string
  base_volume: string
  quote_volume: string
  high_24h: string
  low_24h: string
}

let ws: ReconnectingWebSocket | null = null

export class GateProvider {
  static async getPairs(isMark: boolean): Promise<SelectOption[]> {
    if (isMark) {
      return await fetch(`https://api.gateio.ws/api/v4/futures/usdt/contracts`)
        .then(res => res.json())
        .then((data: GateMarkPair[]) => data.map((pair: GateMarkPair) => ({
          label: pair.name,
          value: pair.name,
        })))
    }

    return await fetch(`https://api.gateio.ws/api/v4/spot/currency_pairs`)
      .then(res => res.json())
      .then((data: GatePair[]) => data.map((pair: GatePair) => ({
        label: pair.id,
        value: pair.id,
      })))
  }

  // 缓存的是每小时的开盘价
  static cachedPrice = new Map<string, number>()

  static async refreshCharts(options: UseChartOptions, init: boolean) {
    if (init) {
      options.pairs.forEach((ticker) => {
        const pair = ticker.split('_')[0] ?? 'UNKNOWN'

        options.charts.value.set(pair, {
          pair,
          icon: `https://icon.staticimgs.com/images/coin_icon/64/${pair.toLowerCase()}.png`,
          price: 0,
          precent: 0,
        })
      })
    }

    await Promise.all(
      options.pairs.map((ticker) => {
        const pair = ticker.split('_')[0] ?? 'UNKNOWN'

        const from = options.priceBasis === '24h' ? dayjs().subtract(24, 'hour').unix() : dayjs().utcOffset(options.priceBasis).startOf('day').unix()
        const to = dayjs().unix()

        const query = new URLSearchParams({
          contract: `mark_${ticker}`,
          currency_pair: ticker,
          interval: '1h',
          from: from.toString(),
          to: to.toString(),
        })

        return fetch(
          options.mark
            ? `https://api.gateio.ws/api/v4/futures/usdt/candlesticks?${query}`
            : `https://api.gateio.ws/api/v4/spot/candlesticks?${query}`,
        )
          .then(res => res.json())
          .then((res: { o: string, c: string }[]) => {
            const first = res[0]
            const last = res[res.length - 1]
            const startMarketPrice = Number.parseFloat(first.o)
            const endMarketPrice = Number.parseFloat(last.c)
            this.cachedPrice.set(ticker, startMarketPrice)
            options.charts.value.set(pair, {
              pair,
              icon: `https://icon.staticimgs.com/images/coin_icon/64/${pair.toLowerCase()}.png`,
              price: endMarketPrice,
              precent: ((endMarketPrice - startMarketPrice) / startMarketPrice) * 100,
            })
          })
      }),
    )
  }

  static async useCharts(options: UseChartOptions) {
    // 初始化图表
    await this.refreshCharts(options, true)
    const closeRefresher = setupHourlyRefresher(() => this.refreshCharts(options, false))

    ws = new ReconnectingWebSocket(options.mark ? 'wss://fx-ws.gateio.ws/v4/ws/usdt' : 'wss://api.gateio.ws/ws/v4/')

    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data)
      if (data.event !== 'update') {
        return
      }

      if (options.mark) {
        const result = data.result as GateTicker[]

        result.forEach((ticker) => {
          const pair = ticker.contract.split('_')[0] ?? 'UNKNOWN'
          const price = Number.parseFloat(ticker.mark_price)
          const startMarketPrice = this.cachedPrice.get(ticker.contract) ?? price

          options.charts.value.set(pair, {
            pair,
            icon: `https://icon.staticimgs.com/images/coin_icon/64/${pair.toLowerCase()}.png`,
            price: Number.parseFloat(ticker.mark_price),
            precent: ((price - startMarketPrice) / startMarketPrice) * 100,
          })
        })
      }
      else {
        const result = data.result as GateSpotTicker
        const price = Number.parseFloat(result.last)
        const startMarketPrice = this.cachedPrice.get(result.currency_pair) ?? price

        const pair = result.currency_pair.split('_')[0] ?? 'UNKNOWN'
        options.charts.value.set(pair, {
          pair,
          icon: `https://icon.staticimgs.com/images/coin_icon/64/${pair.toLowerCase()}.png`,
          price: Number.parseFloat(result.last),
          precent: ((price - startMarketPrice) / startMarketPrice) * 100,
        })
      }
    })

    ws.addEventListener('open', () => {
      if (!ws) {
        return
      }

      // 订阅所选交易对的价格更新
      ws.send(JSON.stringify({
        time: Date.now(),
        channel: options.mark ? 'futures.tickers' : 'spot.tickers',
        event: 'subscribe',
        payload: options.pairs,
      }))
    })

    return () => {
      closeRefresher()
      // 清空缓存的数据
      this.cachedPrice.clear()

      if (ws) {
        ws.close()
        ws = null
      }
    }
  }
}
