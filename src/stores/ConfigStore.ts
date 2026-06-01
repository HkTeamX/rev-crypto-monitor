import type { BasicColorSchema } from '@vueuse/core'
import { emit } from '@tauri-apps/api/event'
import { message } from '@tauri-apps/plugin-dialog'
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { exit } from '@tauri-apps/plugin-process'
import { ref } from 'vue'
import { setMode } from '@/utils/useTheme.ts'

export interface Config {
  preferences: {
    theme: BasicColorSchema
    // 1 = 绿涨红跌
    // 2 = 红涨绿跌
    colorMode: 1 | 2
    // 每页数量
    size: number
    // 涨跌幅基准
    priceBasis: '24h' | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | -1 | -2 | -3 | -4 | -5 | -6 | -7 | -8 | -9 | -10 | -11 | -12
    // 是否开启窗口置顶
    alwaysOnTop: boolean
  }
  trade: {
    provider: 'OKX' | 'Binance' | 'Gate'
    mark: boolean
    pairs: string[]
  }
}

export const defaultConfig: Config = {
  preferences: {
    theme: 'auto',
    colorMode: 1,
    size: 3,
    priceBasis: 8,
    alwaysOnTop: true,
  },
  trade: {
    provider: 'Gate',
    mark: false,
    pairs: ['BTC_USDT', 'ETH_USDT', 'SOL_USDT'],
  },
}

export const config = ref(structuredClone(defaultConfig))

let isInitialized = false
export async function initConfig(force = false) {
  if (isInitialized && !force) {
    return
  }
  isInitialized = true

  try {
    const content = await readTextFile('config.json', { baseDir: BaseDirectory.AppData })
    Object.assign(config.value, JSON.parse(content))

    if (config.value.preferences.priceBasis === undefined) {
      config.value.preferences.priceBasis = defaultConfig.preferences.priceBasis
    }

    if (config.value.preferences.alwaysOnTop === undefined) {
      config.value.preferences.alwaysOnTop = defaultConfig.preferences.alwaysOnTop
    }
  }
  catch (error) {
    if (!await exists('', { baseDir: BaseDirectory.AppData })) {
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true })
    }

    if (!await exists('config.json', { baseDir: BaseDirectory.AppData })) {
      await writeTextFile('config.json', JSON.stringify(config.value, null, 2), { baseDir: BaseDirectory.AppData })
    }
    else {
      // 读取失败, 报错提示
      await message(`读取配置失败, 错误信息: ${error instanceof Error ? error.message : String(error)}`, {
        title: '错误',
        kind: 'error',
      })
      exit(1)
    }
  }

  setMode(config.value.preferences.theme)
}

export async function saveConfig(currentConfig?: Config) {
  await writeTextFile('config.json', JSON.stringify(currentConfig ?? config.value, null, 2), { baseDir: BaseDirectory.AppData })
  emit('config:updated')
}
