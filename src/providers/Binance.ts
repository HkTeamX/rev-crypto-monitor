import type { SelectOption } from 'naive-ui'
import { fetch } from '@tauri-apps/plugin-http'

export interface BinanceSymbolPair {
  baseAsset: string
  quoteAsset: string
}

export interface BinancePair {
  symbols: BinanceSymbolPair[]
}

export class BinanceProvider {
  static async getPairs(isMark: boolean): Promise<SelectOption[]> {
    return await fetch(isMark
      ? `https://api.binance.com/api/v3/exchangeInfo?symbolStatus=TRADING`
      : `https://fapi.binance.com/fapi/v1/exchangeInfo`)
      .then(res => res.json())
      .then((data: BinancePair) => data.symbols.map((pair: BinanceSymbolPair) => ({
        label: `${pair.baseAsset}_${pair.quoteAsset}`,
        value: `${pair.baseAsset}_${pair.quoteAsset}`,
      })))
  }
}
