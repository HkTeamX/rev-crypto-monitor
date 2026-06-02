<script lang="ts" setup>
import type { SelectOption } from 'naive-ui'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { NButton, NCard, NDivider, NFlex, NSlider, NTag } from 'naive-ui'
import { ProDigit, ProForm, ProSelect, ProSwitch } from 'pro-naive-ui'
import { onMounted, ref, watch } from 'vue'
import { useDraggable } from 'vue-draggable-plus'
import { binanceProvider } from '@/providers/Binance.ts'
import { gateProvider } from '@/providers/Gate.ts'
import { okxProvider } from '@/providers/OKX.ts'
import { saveConfig as _saveConfig, config, defaultConfig } from '@/stores/ConfigStore.ts'
import { notification } from '@/utils/discreteApi.ts'
import { useProForm } from '@/utils/useProForm.ts'

const appWindow = getCurrentWindow()

const getParidsLoading = ref(false)
const pairOptions = ref<SelectOption[]>([])
async function getPairs(clean = false) {
  if (clean) {
    config.value.trade.pairs = []
  }

  getParidsLoading.value = true
  try {
    if (config.value.trade.provider === 'Gate') {
      pairOptions.value = await gateProvider.getPairs(config.value.trade.mark)
    }
    else if (config.value.trade.provider === 'Binance') {
      pairOptions.value = await binanceProvider.getPairs(config.value.trade.mark)
    }
    else if (config.value.trade.provider === 'OKX') {
      pairOptions.value = await okxProvider.getPairs(config.value.trade.mark)
    }

    notification.success({
      content: '交易对列表获取成功',
      duration: 3000,
    })
  }
  catch {
    notification.error({
      content: '获取交易对列表失败',
      duration: 3000,
    })
  }
  finally {
    getParidsLoading.value = false
  }
}

onMounted(getPairs)

async function saveConfig() {
  await _saveConfig()
  notification.success({
    content: '配置已保存',
    duration: 3000,
  })
}

async function restoreDefaults() {
  config.value = structuredClone(defaultConfig)
  await _saveConfig()
  notification.success({
    content: '配置已恢复默认',
    duration: 3000,
  })
}

function closeWindow() {
  appWindow.close()
}

// 拖拽排序
const sortableRef = ref<HTMLElement | null>(null)
const draggedPairs = ref<string[]>([])

useDraggable(sortableRef, draggedPairs, {
  animation: 150,
  forceFallback: true,
  onEnd() {
    config.value.trade.pairs = [...draggedPairs.value]
  },
})

// 同步交易对列表到拖拽数组
watch(
  () => config.value.trade.pairs,
  (val) => { draggedPairs.value = [...val] },
  { immediate: true },
)

const form = useProForm({
  initialValues: config.value,
  rules: () => ({
    'preferences.theme': { required: true, message: '请选择主题' },
    'preferences.colorMode': { required: true, message: '请选择涨跌颜色模式' },
    'preferences.priceBasis': { required: true, message: '请选择涨跌幅基准' },
    'preferences.size': { required: true, type: 'number', min: 1, max: 10, message: '每页展示数量必须在 1 到 10 之间' },
    'trade.provider': { required: true, message: '请选择交易所' },
    'trade.mark': { required: true, type: 'boolean', message: '请选择交易类型' },
    'trade.pairs': { required: true, type: 'array', min: 1, message: '请至少选择一个交易对' },
  }),
})
</script>

<template>
  <div data-tauri-drag-region class="settings">
    <NCard>
      <template #action>
        <NFlex justify="end">
          <NButton type="primary" @click="restoreDefaults">
            恢复默认
          </NButton>
          <NButton type="info" @click="saveConfig">
            保存
          </NButton>
          <NButton type="error" @click="closeWindow">
            退出
          </NButton>
        </NFlex>
      </template>

      <ProForm v-bind="form" :label-width="110">
        <NDivider title-placement="left" style="margin-top: 0;">
          偏好设置
        </NDivider>

        <ProSelect
          title="主题" path="preferences.theme" :field-props="{
            options: [
              { label: '跟随系统', value: 'system' },
              { label: '浅色', value: 'light' },
              { label: '深色', value: 'dark' },
            ],
          }"
        />

        <ProSelect
          title="涨跌颜色模式" path="preferences.colorMode" :field-props="{
            options: [
              { label: '绿涨 / 红跌', value: 1 },
              { label: '红涨 / 绿跌', value: 2 },
            ],
          }"
        />

        <ProSelect
          title="涨跌幅基准" path="preferences.priceBasis" :field-props="{
            options: [
              { label: '24小时', value: '24h' },
              ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12]
                .map((v) => ({
                  label: v >= 0 ? `UTC+${v}` : `UTC${v}`,
                  value: v,
                })),
            ],
          }"
        />

        <ProDigit
          title="每页展示数量" path="preferences.size" :field-props="{
            min: 1,
            max: 10,
          }"
        />

        <NFlex align="center" :style="{ padding: '0 11px' }">
          <span :style="{ width: '110px', flexShrink: 0, textAlign: 'start' }">背景透明度</span>
          <NSlider
            v-model:value="config.preferences.opacity"
            :min="10"
            :max="100"
            :step="1"
            :style="{ flex: 1 }"
          />
          <span :style="{ width: '40px', textAlign: 'right' }">{{ config.preferences.opacity }}%</span>
        </NFlex>

        <NDivider title-placement="left">
          行情设置
        </NDivider>

        <ProSelect
          title="交易所" path="trade.provider"
          :field-props="{
            options: [
              { label: 'OKX', value: 'OKX' },
              { label: 'Binance', value: 'Binance' },
              { label: 'Gate', value: 'Gate' },
            ],
            disabled: getParidsLoading,
          }"
          @change="getPairs(true)"
        />

        <ProSwitch
          title="是否为合约" path="trade.mark" :field-props="{
            disabled: getParidsLoading,
          }" @change="getPairs(true)"
        />

        <ProSelect
          title="交易对"
          path="trade.pairs"
          :field-props="{
            multiple: true,
            filterable: true,
            loading: getParidsLoading,
            disabled: getParidsLoading,
            options: pairOptions,
          }"
        />
      </ProForm>

      <div
        v-if="config.trade.pairs.length > 1"
        class="pair-sort-list"
      >
        <div class="pair-sort-header">
          <span :style="{ width: '110px', flexShrink: 0 }">排序交易对</span>
          <span :style="{ fontSize: '12px', color: '#999' }">拖拽调整顺序</span>
        </div>
        <div ref="sortableRef" class="pair-sort-items">
          <div
            v-for="pair in draggedPairs"
            :key="pair"
            class="pair-sort-item"
          >
            <span class="pair-sort-handle">⠿</span>
            <NTag size="small" :bordered="false" type="info">
              {{ pair }}
            </NTag>
          </div>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style lang="scss" scoped>
.settings {
  padding: 20px;
}

.pair-sort-list {
  padding: 0 11px;
  margin-top: -8px;
}

.pair-sort-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.pair-sort-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: grab;
}

.pair-sort-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.08);
  cursor: grab;
  user-select: auto;

  * {
    cursor: inherit;
  }

  .pair-sort-handle {
    color: #999;
    font-size: 14px;
    user-select: none;
    flex-shrink: 0;
  }

  &.sortable-ghost {
    opacity: 0.4;
    background: rgba(32, 128, 240, 0.15);
  }

  &.sortable-drag {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
}
</style>
