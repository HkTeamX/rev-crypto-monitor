import dayjs from 'dayjs'

export function setupHourlyRefresher(refreshCallback: () => void) {
  let id: number

  const scheduleNext = () => {
    const now = dayjs()
    // 1. 计算下一个整点
    const nextHour = now.add(1, 'hour').startOf('hour')
    // 2. 计算毫秒差（额外加 1000ms 冗余，防止服务器数据未准时更新）
    const delay = nextHour.diff(now) + 1000

    id = setTimeout(() => {
      // 3. 执行刷新逻辑
      refreshCallback()
      // 4. 递归调用，实现整点循环
      scheduleNext()
    }, delay)
  }

  scheduleNext()

  return () => {
    clearTimeout(id)
  }
}
