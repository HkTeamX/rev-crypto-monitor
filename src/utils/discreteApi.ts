import { createDiscreteApi } from 'naive-ui'
import { configProviderProps } from '@/utils/useTheme.ts'

const { notification, message, dialog, loadingBar, modal } = createDiscreteApi(['notification', 'message', 'dialog', 'loadingBar', 'modal'], {
  configProviderProps,
})

export { dialog, loadingBar, message, modal, notification }
