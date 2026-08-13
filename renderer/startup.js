const message = document.querySelector('#message')
const detail = document.querySelector('#detail')
const spinner = document.querySelector('#spinner')
const actions = document.querySelector('#actions')
const versions = document.querySelector('#versions')
const retry = document.querySelector('#retry')
const logs = document.querySelector('#logs')

function render(state) {
  message.textContent = state.message
  const failed = state.phase === 'error'
  spinner.hidden = failed
  actions.hidden = !failed
  detail.hidden = !failed || !state.detail
  detail.textContent = state.detail || ''
}

retry.addEventListener('click', async () => {
  retry.disabled = true
  await window.dshDesktop.retryEngine()
  retry.disabled = false
})
logs.addEventListener('click', () => window.dshDesktop.openLogs())

Promise.all([
  window.dshDesktop.getStartupState(),
  window.dshDesktop.getInfo(),
]).then(([state, info]) => {
  render(state)
  versions.textContent = `Desktop ${info.desktopVersion} · Harness ${info.engineVersion} · ${info.platform} ${info.arch}`
})

window.dshDesktop.onStartupState(render)

