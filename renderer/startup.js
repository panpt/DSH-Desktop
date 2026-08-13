const message = document.querySelector('#message')
const detail = document.querySelector('#detail')
const spinner = document.querySelector('#spinner')
const actions = document.querySelector('#actions')
const versions = document.querySelector('#versions')
const retry = document.querySelector('#retry')
const logs = document.querySelector('#logs')
const localeButtons = [...document.querySelectorAll('[data-locale]')]
let currentState
let currentInfo
let currentLocale = { locale: 'en-US', messages: {} }

function text(key, variables = {}) {
  const template = currentLocale.messages[key] || key
  return template.replaceAll(/\{([A-Za-z0-9_]+)\}/g, (placeholder, name) => (
    variables[name] === undefined ? placeholder : String(variables[name])
  ))
}

function render(state) {
  currentState = state
  message.textContent = text(state.messageKey)
  const failed = state.phase === 'error'
  spinner.hidden = failed
  actions.hidden = !failed
  detail.hidden = !failed || !state.detail
  detail.textContent = state.detail || ''
}

function renderInfo(info) {
  currentInfo = info
  versions.textContent = `${text('desktopLabel')} ${info.desktopVersion} · ${text('harnessLabel')} ${info.engineVersion} · ${info.platform} ${info.arch}`
}

function applyLocale(snapshot) {
  currentLocale = snapshot
  document.documentElement.lang = snapshot.locale
  retry.textContent = text('retry')
  logs.textContent = text('openLogs')
  for (const button of localeButtons) {
    const active = button.dataset.locale === snapshot.locale
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
  }
  if (currentState) render(currentState)
  if (currentInfo) renderInfo(currentInfo)
}

retry.addEventListener('click', async () => {
  retry.disabled = true
  await window.dshDesktop.retryEngine()
  retry.disabled = false
})
logs.addEventListener('click', () => window.dshDesktop.openLogs())
for (const button of localeButtons) {
  button.addEventListener('click', async () => applyLocale(await window.dshDesktop.setLocale(button.dataset.locale)))
}

Promise.all([
  window.dshDesktop.getStartupState(),
  window.dshDesktop.getInfo(),
  window.dshDesktop.getLocale(),
]).then(([state, info, locale]) => {
  applyLocale(locale)
  render(state)
  renderInfo(info)
})

window.dshDesktop.onStartupState(render)
window.dshDesktop.onLocaleChanged(applyLocale)
