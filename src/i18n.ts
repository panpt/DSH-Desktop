import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DesktopLocale, DesktopTranslations, LocaleSnapshot, TranslationKey } from './contracts.js'

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const satisfies readonly DesktopLocale[]

const localeDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales')

function readCatalog(locale: DesktopLocale): DesktopTranslations {
  return JSON.parse(readFileSync(join(localeDirectory, `${locale}.json`), 'utf8')) as DesktopTranslations
}

const catalogs: Record<DesktopLocale, DesktopTranslations> = {
  'zh-CN': readCatalog('zh-CN'),
  'en-US': readCatalog('en-US'),
}

export function normalizeLocale(value: string | null | undefined): DesktopLocale {
  return value?.toLowerCase().startsWith('zh') === true ? 'zh-CN' : 'en-US'
}

export function resolvePreferredLocale(preferences: unknown, systemLocale: string): DesktopLocale {
  if (typeof preferences === 'object' && preferences !== null && 'locale' in preferences) {
    const value = (preferences as { locale?: unknown }).locale
    if (value === 'zh-CN' || value === 'en-US') return value
  }
  return normalizeLocale(systemLocale)
}

export function localeSnapshot(locale: DesktopLocale): LocaleSnapshot {
  return { locale, messages: catalogs[locale] }
}

export function translate(
  locale: DesktopLocale,
  key: TranslationKey,
  variables: Readonly<Record<string, string | number>> = {},
): string {
  const template = catalogs[locale][key] ?? catalogs['en-US'][key] ?? key
  return template.replaceAll(/\{([A-Za-z0-9_]+)\}/g, (placeholder, name: string) => {
    const value = variables[name]
    return value === undefined ? placeholder : String(value)
  })
}

export function catalogKeys(locale: DesktopLocale): string[] {
  return Object.keys(catalogs[locale]).sort()
}
