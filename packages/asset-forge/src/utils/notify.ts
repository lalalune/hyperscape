type NotifyLevel = 'info' | 'success' | 'warning' | 'error'

interface NotifyOptions {
  durationMs?: number
}

function showToast(message: string, level: NotifyLevel, opts?: NotifyOptions) {
  if (typeof document === 'undefined') {
    const prefix = level === 'error' ? '[ERROR]' : level === 'warning' ? '[WARN]' : '[INFO]'
    // eslint-disable-next-line no-console
    console.log(prefix, message)
    return
  }

  const containerId = '__app_toast_container__'
  let container = document.getElementById(containerId)
  if (!container) {
    container = document.createElement('div')
    container.id = containerId
    container.style.position = 'fixed'
    container.style.top = '16px'
    container.style.right = '16px'
    container.style.display = 'flex'
    container.style.flexDirection = 'column'
    container.style.gap = '8px'
    container.style.zIndex = '9999'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.textContent = message
  toast.style.padding = '10px 12px'
  toast.style.borderRadius = '8px'
  toast.style.color = '#fff'
  toast.style.fontSize = '14px'
  toast.style.boxShadow = '0 6px 18px rgba(0,0,0,0.18)'
  toast.style.maxWidth = '420px'
  toast.style.wordBreak = 'break-word'
  toast.style.background = level === 'error'
    ? '#ef4444'
    : level === 'warning'
      ? '#f59e0b'
      : level === 'success'
        ? '#10b981'
        : '#3b82f6'

  container.appendChild(toast)

  const duration = opts?.durationMs ?? 3500
  setTimeout(() => {
    toast.style.transition = 'opacity 200ms ease'
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 250)
  }, duration)
}

export const notify = {
  info: (m: string, o?: NotifyOptions) => showToast(m, 'info', o),
  success: (m: string, o?: NotifyOptions) => showToast(m, 'success', o),
  warning: (m: string, o?: NotifyOptions) => showToast(m, 'warning', o),
  error: (m: string, o?: NotifyOptions) => showToast(m, 'error', o)
} 