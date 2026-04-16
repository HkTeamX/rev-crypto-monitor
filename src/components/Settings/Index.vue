<script lang="ts" setup>
import type { SelectOption } from 'naive-ui'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { NButton, NCard, NDivider, NFlex } from 'naive-ui'
import { ProDigit, ProForm, ProSelect, ProSwitch } from 'pro-naive-ui'
import { onMounted, ref } from 'vue'
import { BinanceProvider } from '@/providers/Binance.ts'
import { GateProvider } from '@/providers/Gate.ts'
import { OKXProvider } from '@/providers/OKX.ts'
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
      pairOptions.value = await GateProvider.getPairs(config.value.trade.mark)
    }
    else if (config.value.trade.provider === 'Binance') {
      pairOptions.value = await BinanceProvider.getPairs(config.value.trade.mark)
    }
    else if (config.value.trade.provider === 'OKX') {
      pairOptions.value = await OKXProvider.getPairs(config.value.trade.mark)
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

const form = useProForm({
  initialValues: config.value,
  rules: () => ({
    'preferences.theme': { required: true, message: '请选择主题' },
    'preferences.colorMode': { required: true, message: '请选择涨跌颜色模式' },
    'preferences.price_basis': { required: true, message: '请选择涨跌幅基准' },
    'preferences.size': { required: true, type: 'number', min: 1, max: 5, message: '每页展示数量必须在 1 到 50 之间' },
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
          title="涨跌幅基准" path="preferences.price_basis" :field-props="{
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
            max: 5,
          }"
        />

        <NDivider title-placement="left" style="margin-top: 0;">
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
          }"
          @change="getPairs(true)"
        />

        <ProSwitch title="是否为合约" path="trade.mark" @change="getPairs(true)" />

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
    </NCard>
  </div>
</template>

<style lang="scss" scoped>
.settings {
  padding: 20px;
}
</style>
