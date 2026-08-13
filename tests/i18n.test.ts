import { describe, expect, it } from 'vitest'
import { catalogKeys, normalizeLocale, resolvePreferredLocale, translate } from '../src/i18n.js'

describe('desktop localization', () => {
  it('keeps the Chinese and English catalogs in sync', () => {
    expect(catalogKeys('zh-CN')).toEqual(catalogKeys('en-US'))
  })

  it('maps Chinese system locales to Simplified Chinese and falls back to English', () => {
    expect(normalizeLocale('zh-Hans-CN')).toBe('zh-CN')
    expect(normalizeLocale('zh-TW')).toBe('zh-CN')
    expect(normalizeLocale('fr-FR')).toBe('en-US')
  })

  it('prefers a saved supported locale over the system locale', () => {
    expect(resolvePreferredLocale({ locale: 'en-US' }, 'zh-CN')).toBe('en-US')
    expect(resolvePreferredLocale({ locale: 'invalid' }, 'zh-CN')).toBe('zh-CN')
  })

  it('interpolates localized variables', () => {
    expect(translate('en-US', 'updaterVersionDownloaded', { version: '1.2.3' }))
      .toBe('Version 1.2.3 has been downloaded')
    expect(translate('zh-CN', 'updaterVersionDownloaded', { version: '1.2.3' }))
      .toBe('版本 1.2.3 已下载完成')
  })
})
