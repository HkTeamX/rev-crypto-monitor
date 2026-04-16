export function useDisableContextmenu() {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })
}
