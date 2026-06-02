<script lang="ts" setup>
import type { Chart } from '@/components/Monitor/index.ts'
import { listen } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { message } from '@tauri-apps/plugin-dialog'
import { exit } from '@tauri-apps/plugin-process'
import { ContractDownLeft16Filled, CursorClick20Filled, CursorClick20Regular, Dismiss16Filled, Pin16Filled, PinOff16Filled, Settings16Filled } from '@vicons/fluent'
import { useEventListener, useInterval } from '@vueuse/core'
import { NButton, NFlex, NPagination } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { binanceProvider } from '@/providers/Binance.ts'
import { gateProvider } from '@/providers/Gate.ts'
import { okxProvider } from '@/providers/OKX.ts'
import { config, initConfig, saveConfig } from '@/stores/ConfigStore'
import { renderIcon } from '@/utils/renderIcon.ts'

const charts = ref(new Map<string, Chart>())
const page = ref(1)
const total = computed(() => Math.ceil(config.value.trade.pairs.length / config.value.preferences.size))
const pagnitedPairs = computed(() => {
  const start = (page.value - 1) * config.value.preferences.size
  const end = start + config.value.preferences.size
  return Array.from(charts.value.values()).slice(start, end)
})
const window = getCurrentWindow()
const compactHidden = ref(false)

const containerHeight = computed(() => (config.value.preferences.size - 1) * 80 + 70)
const height = computed(() => {
  if (config.value.preferences.compactMode && compactHidden.value) {
    return containerHeight.value + 10 * 2
  }
  else {
    return containerHeight.value + 28 * 2 + 10 * 4
  }
})

let mouseInWindow = false
const compactInterval = useInterval(1000, {
  callback: async () => {
    if (compactHidden.value === true) {
      compactInterval.pause()
      return
    }

    compactHidden.value = !mouseInWindow
    await setWindowSize()
  },
  immediate: false,
  controls: true,
})
useEventListener(document, 'mouseenter', async () => {
  mouseInWindow = true

  if (!config.value.preferences.compactMode) {
    return
  }

  compactInterval.pause()
  compactHidden.value = false
  await setWindowSize()
})
useEventListener(document, 'mouseleave', () => {
  mouseInWindow = false
  if (!config.value.preferences.compactMode) {
    return
  }

  compactInterval.reset()
  compactInterval.resume()
})

let closeListener: () => void
async function loadCharts() {
  charts.value.clear()
  if (closeListener) {
    closeListener()
  }

  if (config.value.trade.provider === 'Gate') {
    closeListener = await gateProvider.useCharts({
      charts,
      mark: config.value.trade.mark,
      pairs: config.value.trade.pairs,
      priceBasis: config.value.preferences.priceBasis,
    })
  }
  else if (config.value.trade.provider === 'Binance') {
    closeListener = await binanceProvider.useCharts({
      charts,
      mark: config.value.trade.mark,
      pairs: config.value.trade.pairs,
      priceBasis: config.value.preferences.priceBasis,
    })
  }
  else if (config.value.trade.provider === 'OKX') {
    closeListener = await okxProvider.useCharts({
      charts,
      mark: config.value.trade.mark,
      pairs: config.value.trade.pairs,
      priceBasis: config.value.preferences.priceBasis,
    })
  }
  else {
    message('未找到交易数据提供商，请检查您的设置')
  }
}

async function setWindowSize() {
  await window.setSize(new LogicalSize(170, height.value))
}

async function initMonitor() {
  page.value = 1
  compactHidden.value = false
  await initConfig(true)

  await window.setAlwaysOnTop(config.value.preferences.alwaysOnTop)
  await setWindowSize()

  if (config.value.preferences.compactMode) {
    compactInterval.reset()
    compactInterval.resume()
  }
  else {
    compactInterval.pause()
  }

  await loadCharts()
}

listen('config:updated', async () => {
  await initMonitor()
})

onMounted(async () => {
  await initMonitor()
})

async function pinWindow() {
  config.value.preferences.alwaysOnTop = !config.value.preferences.alwaysOnTop
  await window.setAlwaysOnTop(config.value.preferences.alwaysOnTop)
  await saveConfig()
}

// 监听 Rust 端托盘解除穿透的事件，同步前端状态
listen<boolean>('click-through-changed', async (event) => {
  config.value.preferences.clickThrough = event.payload
  await saveConfig()
})

async function toggleClickThrough() {
  if (config.value.preferences.isFirstSwitchClickThrough === true || config.value.preferences.isFirstSwitchClickThrough === undefined) {
    await message('点击穿透已开启，窗口将无法被鼠标点击选中。可通过点击托盘图标进行恢复。')
    config.value.preferences.isFirstSwitchClickThrough = false
  }

  config.value.preferences.clickThrough = !config.value.preferences.clickThrough
  await window.setIgnoreCursorEvents(config.value.preferences.clickThrough)
  await saveConfig()
}

async function openSettings() {
  const webview = new WebviewWindow('settings', {
    url: '/settings',
    title: '设置',
    width: 376,
    height: 600,
    visible: false,
    resizable: false,
    decorations: false,
    alwaysOnTop: true,
  })

  webview.once('tauri://webview-created', () => {
    webview.show()
  })
}

async function minimumMonitor() {
  await window.hide()
}

async function quitMonitor() {
  await exit(0)
}

function computeClass(precent: number) {
  if (precent === 0) {
    return ''
  }
  else if (config.value.preferences.colorMode === 1) {
    return precent > 0 ? 'green' : 'red'
  }
  else if (config.value.preferences.colorMode === 2) {
    return precent > 0 ? 'red' : 'green'
  }
  else {
    return ''
  }
}
</script>

<template>
  <div
    data-tauri-drag-region
    class="monitor"
    :style="{ '--monitor-opacity': config.preferences.opacity / 100 }"
  >
    <NFlex v-show="!compactHidden" justify="center" :size="1">
      <NButton
        quaternary
        circle
        :render-icon="renderIcon(config.preferences.alwaysOnTop ? PinOff16Filled : Pin16Filled)"
        size="small"
        @click="pinWindow"
      />

      <NButton
        quaternary
        circle
        :render-icon="renderIcon(config.preferences.clickThrough ? CursorClick20Regular : CursorClick20Filled)"
        size="small"
        @click="toggleClickThrough"
      />

      <NButton
        quaternary
        circle
        :render-icon="renderIcon(Settings16Filled)"
        size="small"
        @click="openSettings"
      />

      <NButton
        quaternary
        circle
        :render-icon="renderIcon(ContractDownLeft16Filled)"
        size="small"
        @click="minimumMonitor"
      />

      <NButton
        quaternary
        circle
        :render-icon="renderIcon(Dismiss16Filled)"
        size="small"
        @click="quitMonitor"
      />
    </NFlex>

    <div data-tauri-drag-region class="charts-container" :style="{ height: `${containerHeight}px` }">
      <div
        v-for="chart in pagnitedPairs"
        :key="chart.pair"
        class="panel"
      >
        <p class="l1">
          <img :src="chart.icon" :alt="chart.pair">
          <span class="pair">{{ chart.pair }}</span>
          <span :class="[computeClass(chart.precent), Math.abs(chart.precent) > 10 ? 'large' : '']">{{ chart.precent.toFixed(2) }}%</span>
        </p>
        <p class="l2" :class="computeClass(chart.precent)">
          <span>{{ chart.price }} {{ chart.precent === 0 ? '' : chart.precent > 0 ? "↑" : "↓" }}</span>
        </p>
      </div>
    </div>

    <NPagination v-show="!compactHidden" v-model:page="page" simple :page-count="total" class="pagination" />
  </div>
</template>

<style lang="scss" scoped>
.monitor {
  padding: 10px;
  border-radius: 5px;
  background: rgb(27, 38, 54);
  opacity: var(--monitor-opacity);
  width: 170px;
  height: 100%;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  :deep(.n-pagination--simple) {
    justify-content: center;

    .n-input {
      width: 55px;
    }
  }
}

.charts-container {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .panel {
    background: rgb(39, 49, 64);
    border-radius: 10px;
    padding: 5px;
    width: 100%;
    height: 70px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    pointer-events: none;

    p {
      margin: 0;
    }

    img {
      width: 22px;
      height: 22px;
    }

    span {
      background: rgb(26, 37, 53);
      border-radius: 15px;
      padding: 0 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .red {
      color: #f44336;
    }

    .green {
      color: #4caf50;
    }

    .large {
      font-size: 12px;
      line-height: 22px;
    }

    .l1 {
      display: flex;
      justify-content: space-between;

      .pair {
        font-weight: bold;
        line-height: 22px;
        max-width: 35px;
        font-size: 10px;
      }
    }

    .l2 {
      height: 25px;

      >span {
        display: block;
        width: 100%;
        height: 100%;
        line-height: 25px;
        font-size: 16px;
        padding: 0;
        text-align: center;
        font-weight: bold;
      }
    }
  }
}
</style>
