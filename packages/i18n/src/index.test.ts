import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  MESSAGES,
  SUPPORTED_LOCALES,
  detectLocale,
  interpolate,
  localeDirection,
  localeLabel,
  normalizeLocale,
  translate
} from './index'

describe('normalizeLocale', () => {
  it('把各种英文标记收敛到 en-US', () => {
    expect(normalizeLocale('en')).toBe('en-US')
    expect(normalizeLocale('EN_us')).toBe('en-US')
    expect(normalizeLocale('en-GB')).toBe('en-US')
  })

  it('把西班牙语、法语标记收敛到各自的语言', () => {
    expect(normalizeLocale('es')).toBe('es-ES')
    expect(normalizeLocale('es-419')).toBe('es-ES')
    expect(normalizeLocale('fr')).toBe('fr-FR')
    expect(normalizeLocale('fr-CA')).toBe('fr-FR')
  })

  it('把日语、韩语标记收敛到 ja-JP / ko-KR', () => {
    expect(normalizeLocale('ja')).toBe('ja-JP')
    expect(normalizeLocale('ja_jp')).toBe('ja-JP')
    expect(normalizeLocale('JA-JP')).toBe('ja-JP')
    expect(normalizeLocale('ko')).toBe('ko-KR')
    expect(normalizeLocale('ko-KP')).toBe('ko-KR')
  })

  it('欧洲语言按前缀收敛，地区差异归到主变体', () => {
    expect(normalizeLocale('de')).toBe('de-DE')
    expect(normalizeLocale('de-AT')).toBe('de-DE')
    expect(normalizeLocale('de-CH')).toBe('de-DE')
    expect(normalizeLocale('it')).toBe('it-IT')
    expect(normalizeLocale('it-CH')).toBe('it-IT')
    expect(normalizeLocale('pt-BR')).toBe('pt-BR')
    expect(normalizeLocale('pt-PT')).toBe('pt-BR')
    expect(normalizeLocale('ru')).toBe('ru-RU')
    expect(normalizeLocale('ru-UA')).toBe('ru-RU')
    expect(normalizeLocale('pl')).toBe('pl-PL')
    expect(normalizeLocale('cs')).toBe('cs-CZ')
    expect(normalizeLocale('cs-SK')).toBe('cs-CZ')
    expect(normalizeLocale('tr')).toBe('tr-TR')
  })

  it('越南语、印尼语、阿拉伯语各自独立，不被相邻前缀吃掉', () => {
    expect(normalizeLocale('vi')).toBe('vi-VN')
    expect(normalizeLocale('vi-VN')).toBe('vi-VN')
    expect(normalizeLocale('id')).toBe('id-ID')
    expect(normalizeLocale('id-ID')).toBe('id-ID')
    expect(normalizeLocale('in-ID')).toBe('id-ID')
    expect(normalizeLocale('ar')).toBe('ar-SA')
    expect(normalizeLocale('ar-EG')).toBe('ar-SA')
  })

  it('简体与繁体分别收敛到 zh-CN / zh-TW', () => {
    expect(normalizeLocale('zh')).toBe('zh-CN')
    expect(normalizeLocale('zh-Hans-CN')).toBe('zh-CN')
    expect(normalizeLocale('zh-SG')).toBe('zh-CN')
    expect(normalizeLocale('zh-TW')).toBe('zh-TW')
    expect(normalizeLocale('zh-Hant')).toBe('zh-TW')
    expect(normalizeLocale('zh-HK')).toBe('zh-TW')
    expect(normalizeLocale('zh-MO')).toBe('zh-TW')
  })

  it('空值与未支持的语言回退到默认语言', () => {
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale('')).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale('th-TH')).toBe(DEFAULT_LOCALE)
    expect(normalizeLocale('he-IL')).toBe(DEFAULT_LOCALE)
  })
})

describe('detectLocale', () => {
  it('取第一个受支持的浏览器语言', () => {
    expect(detectLocale(['th-TH', 'en-US', 'zh-CN'])).toBe('en-US')
    expect(detectLocale(['zh-Hant', 'en-US'])).toBe('zh-TW')
    expect(detectLocale(['ja-JP', 'en-US'])).toBe('ja-JP')
    expect(detectLocale(['fr-CA', 'en-GB'])).toBe('fr-FR')
    expect(detectLocale(['ko-KR', 'en-US'])).toBe('ko-KR')
    expect(detectLocale(['ar-EG', 'en-US'])).toBe('ar-SA')
    expect(detectLocale([])).toBe(DEFAULT_LOCALE)
    expect(detectLocale(undefined)).toBe(DEFAULT_LOCALE)
  })
})

describe('interpolate', () => {
  it('替换占位符并保留未知占位符', () => {
    expect(interpolate('{count} 本', { count: 3 })).toBe('3 本')
    expect(interpolate('{a} 与 {b}', { a: 1 })).toBe('1 与 {b}')
    expect(interpolate('没有占位符')).toBe('没有占位符')
  })
})

describe('translate', () => {
  it('每种语言都命中自己的字典', () => {
    expect(translate('zh-CN', 'common.save')).toBe('保存')
    expect(translate('zh-TW', 'common.save')).toBe('儲存')
    expect(translate('en-US', 'common.save')).toBe('Save')
    expect(translate('ja-JP', 'common.save')).toBe('保存')
    expect(translate('ko-KR', 'common.save')).toBe('저장')
    expect(translate('es-ES', 'common.save')).toBe('Guardar')
    expect(translate('fr-FR', 'common.save')).toBe('Enregistrer')
    expect(translate('de-DE', 'common.save')).toBe('Speichern')
    expect(translate('it-IT', 'common.save')).toBe('Salva')
    expect(translate('pt-BR', 'common.save')).toBe('Salvar')
    expect(translate('ru-RU', 'common.save')).toBe('Сохранить')
    expect(translate('tr-TR', 'common.save')).toBe('Kaydet')
    expect(translate('pl-PL', 'common.save')).toBe('Zapisz')
    expect(translate('cs-CZ', 'common.save')).toBe('Uložit')
    expect(translate('vi-VN', 'common.save')).toBe('Lưu')
    expect(translate('id-ID', 'common.save')).toBe('Simpan')
    expect(translate('ar-SA', 'common.save')).toBe('حفظ')
  })

  it('支持插值', () => {
    expect(translate('zh-CN', 'library.import.doneCount', { count: 6 })).toBe('已导入 6 本书')
    expect(translate('en-US', 'library.import.doneCount', { count: 6 })).toBe('Imported 6 books')
    expect(translate('zh-TW', 'library.import.doneCount', { count: 6 })).toBe('已匯入 6 本書')
    expect(translate('de-DE', 'library.import.doneCount', { count: 6 })).toContain('6')
    expect(translate('ar-SA', 'library.import.doneCount', { count: 6 })).toContain('6')
  })

  it('未知 key 回退到 key 本身，不出现空串', () => {
    expect(translate('en-US', 'no.such.key')).toBe('no.such.key')
    expect(translate('fr-FR', 'no.such.key')).toBe('no.such.key')
    expect(translate('ar-SA', 'no.such.key')).toBe('no.such.key')
  })
})

describe('localeLabel', () => {
  it('返回语言自称', () => {
    expect(localeLabel('zh-CN')).toBe('简体中文')
    expect(localeLabel('zh-TW')).toBe('繁體中文')
    expect(localeLabel('en-US')).toBe('English')
    expect(localeLabel('ja-JP')).toBe('日本語')
    expect(localeLabel('ko-KR')).toBe('한국어')
    expect(localeLabel('es-ES')).toBe('Español')
    expect(localeLabel('fr-FR')).toBe('Français')
    expect(localeLabel('de-DE')).toBe('Deutsch')
    expect(localeLabel('it-IT')).toBe('Italiano')
    expect(localeLabel('pt-BR')).toBe('Português (Brasil)')
    expect(localeLabel('ru-RU')).toBe('Русский')
    expect(localeLabel('tr-TR')).toBe('Türkçe')
    expect(localeLabel('pl-PL')).toBe('Polski')
    expect(localeLabel('cs-CZ')).toBe('Čeština')
    expect(localeLabel('vi-VN')).toBe('Tiếng Việt')
    expect(localeLabel('id-ID')).toBe('Bahasa Indonesia')
    expect(localeLabel('ar-SA')).toBe('العربية')
  })
})

describe('localeDirection', () => {
  it('只有阿拉伯语是右到左，其余都是左到右', () => {
    expect(localeDirection('ar-SA')).toBe('rtl')
    for (const option of SUPPORTED_LOCALES.filter(item => item.value !== 'ar-SA')) {
      expect(localeDirection(option.value), option.value).toBe('ltr')
    }
  })
})

describe('译文词典', () => {
  const base = MESSAGES['zh-CN']
  const baseKeys = Object.keys(base).sort()
  const languages = SUPPORTED_LOCALES.filter(option => option.value !== 'zh-CN')
  const placeholders = (text: string) => (text.match(/\{(\w+)\}/gu) ?? []).sort().join(',')

  it('源语言字典非空', () => {
    expect(baseKeys.length).toBeGreaterThan(500)
  })

  it('每种非源语言词条与源语言一一对应', () => {
    for (const option of languages) {
      expect(Object.keys(MESSAGES[option.value]).sort(), option.value).toEqual(baseKeys)
    }
  })

  it('不存在空翻译', () => {
    for (const option of SUPPORTED_LOCALES) {
      const empty = Object.entries(MESSAGES[option.value]).filter(([, value]) => !value.trim())
      expect(empty, option.value).toEqual([])
    }
  })

  it('译文保留了原文里的全部占位符', () => {
    for (const option of languages) {
      const broken = Object.entries(MESSAGES[option.value]).filter(([key, value]) => {
        const expected = placeholders(base[key])
        return expected && placeholders(value) !== expected
      })
      expect(broken, option.value).toEqual([])
    }
  })

  it('每种受支持语言都有字典入口', () => {
    for (const option of SUPPORTED_LOCALES) expect(MESSAGES[option.value]).toBeTypeOf('object')
  })
})
