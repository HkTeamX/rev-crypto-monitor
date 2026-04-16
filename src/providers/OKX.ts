import type { SelectOption } from 'naive-ui'
import { fetch } from '@tauri-apps/plugin-http'

export interface OKXSinglePair {
  instId: string
}

export interface OKXPair {
  data: OKXSinglePair[]
}

export class OKXProvider {
  static async getPairs(isMark: boolean): Promise<SelectOption[]> {
    return await fetch(`https://www.okx.com/api/v5/public/instruments?instType=${isMark ? 'SWAP' : 'SPOT'}`)
      .then(res => res.json())
      .then((data: OKXPair) => data.data.map((pair: OKXSinglePair) => ({
        label: pair.instId.replace('-', '_'),
        value: pair.instId.replace('-', '_'),
      })))
  }
}
