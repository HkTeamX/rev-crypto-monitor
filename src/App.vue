<script lang="ts" setup>
import { getCurrentWindow } from '@tauri-apps/api/window'
import { NGlobalStyle } from 'naive-ui'
import { ProConfigProvider } from 'pro-naive-ui'
import { onMounted } from 'vue'
import { initConfig } from '@/stores/ConfigStore.ts'
import { proConfigProviderProps } from '@/utils/useTheme.ts'

const appWindow = getCurrentWindow()

onMounted(async () => {
  await initConfig()

  appWindow.show()

  requestAnimationFrame(() => {
    const loadingElement = document.getElementById('app-loading')
    if (loadingElement) {
      loadingElement.classList.add('loaded')
      // 动画结束后移除元素
      setTimeout(() => {
        loadingElement.remove()
      }, 300)
    }
  })
})
</script>

<template>
  <ProConfigProvider v-bind="proConfigProviderProps">
    <NGlobalStyle />
    <RouterView />
  </ProConfigProvider>
</template>

<style lang="scss" scoped></style>
