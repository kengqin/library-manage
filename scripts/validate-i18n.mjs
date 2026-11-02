#!/usr/bin/env node
// 校验多语言文案：
// 1) 源码里 t('key') 用到的每条 key，在所有语言字典里都存在；
// 2) 各语言词条与 zh-CN（源语言）完全一致，避免新增文案只补了部分语言；
// 3) 源码里不再出现 t('中文原文') 这种旧写法。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

const CJK = /[\u3400-\u9fff]/
const SOURCE_ROOTS = ['apps/desktop/src', 'apps/mobile/src', 'apps/web/.vitepress/theme']
const MESSAGE_DIR = 'packages/i18n/src/messages'
/** 参照语言：源语言，key 集合以它为基准 */
const BASE_LOCALE = 'zh-CN'
const SKIP_DIRS = new Set(['node_modules', 'dist', 'target'])
const LOCALE_NAMES = {
  'zh-CN': '简体中文',
  'zh-TW': '繁体中文',
  'en-US': '英文',
  'ja-JP': '日文',
  'ko-KR': '韩文',
  'es-ES': '西班牙文',
  'fr-FR': '法文',
  'de-DE': '德文',
  'it-IT': '意大利文',
  'pt-BR': '葡萄牙文（巴西）',
  'ru-RU': '俄文',
  'tr-TR': '土耳其文',
  'pl-PL': '波兰文',
  'cs-CZ': '捷克文',
  'vi-VN': '越南文',
  'id-ID': '印尼文',
  'ar-SA': '阿拉伯文'
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(path, files)
    } else if (/\.(vue|ts)$/u.test(name) && !name.includes('.test.')) {
      files.push(path)
    }
  }
  return files
}

/** 源码里被 t('key') / translate(x, 'key') 引用的 key */
function collectUsedKeys() {
  const used = new Map()
  const legacy = []
  for (const file of SOURCE_ROOTS.flatMap(root => walk(root))) {
    const source = readFileSync(file, 'utf8')
    const pattern = /(?:\bt|\btranslate)\(\s*(?:[\w.]+\s*,\s*)?'((?:\\.|[^'\\])*)'/gu
    for (const match of source.matchAll(pattern)) {
      const key = match[1].replace(/\\'/gu, "'")
      if (CJK.test(key)) {
        legacy.push(`${relative(process.cwd(), file)}: ${key.slice(0, 30)}`)
        continue
      }
      if (!used.has(key)) used.set(key, relative(process.cwd(), file))
    }
  }
  return { used, legacy }
}

/** 字典中已声明的 key */
function collectDictionaryKeys(file) {
  const source = readFileSync(file, 'utf8')
  const keys = new Set()
  for (const match of source.matchAll(/^ {2}'((?:\\.|[^'\\])*)':\s*'/gmu)) {
    keys.add(match[1].replace(/\\'/gu, "'"))
  }
  return keys
}

function listDictionaries() {
  const dictionaries = new Map()
  for (const name of readdirSync(MESSAGE_DIR)) {
    if (!name.endsWith('.ts') || name.includes('.test.')) continue
    const locale = basename(name, '.ts')
    dictionaries.set(locale, collectDictionaryKeys(join(MESSAGE_DIR, name)))
  }
  return dictionaries
}

const { used, legacy } = collectUsedKeys()
const dictionaries = listDictionaries()
const base = dictionaries.get(BASE_LOCALE)
if (!base) {
  console.error(`缺少参照字典 ${MESSAGE_DIR}/${BASE_LOCALE}.ts`)
  process.exit(1)
}

const summary = [...dictionaries].map(([locale, keys]) => `${locale} ${keys.size}`).join(' / ')
console.log(`i18n: ${used.size} 条界面 key，字典 ${summary} 条`)

const unused = [...base].filter(key => !used.has(key))
// 动态 key（按变量查表）无法静态识别，默认只提示数量，--verbose 时列出明细
if (unused.length) {
  console.log(`\n字典中有 ${unused.length} 条未被静态引用（动态取词，可用 --verbose 查看）`)
  if (process.argv.includes('--verbose')) {
    for (const key of unused) console.log(`  - ${key}`)
  }
}

let failed = false

// 1. 源码用到的 key，每种语言都要有
for (const [locale, keys] of dictionaries) {
  const missing = [...used].filter(([key]) => !keys.has(key))
  if (!missing.length) continue
  failed = true
  console.error(`\n${LOCALE_NAMES[locale] ?? locale}缺少 ${missing.length} 条 key：`)
  for (const [key, file] of missing) console.error(`  - ${key}  (${file})`)
}

// 2. 各语言词条与源语言一一对应
for (const [locale, keys] of dictionaries) {
  if (locale === BASE_LOCALE) continue
  const gaps = [...base].filter(key => !keys.has(key))
  const extras = [...keys].filter(key => !base.has(key))
  if (!gaps.length && !extras.length) continue
  failed = true
  const name = LOCALE_NAMES[locale] ?? locale
  if (gaps.length) {
    console.error(`\n${name}缺少 ${gaps.length} 条词条（${BASE_LOCALE} 有而它没有）：`)
    for (const key of gaps) console.error(`  - ${key}`)
  }
  if (extras.length) {
    console.error(`\n${name}多出 ${extras.length} 条词条（${BASE_LOCALE} 没有）：`)
    for (const key of extras) console.error(`  - ${key}`)
  }
}

// 3. 不允许再把中文原文当作 key
if (legacy.length) {
  failed = true
  console.error(`\n仍有 ${legacy.length} 处 t('中文原文') 未改成命名 key：`)
  for (const item of legacy) console.error(`  - ${item}`)
}

if (failed) process.exit(1)
const names = [...dictionaries.keys()].filter(locale => locale !== BASE_LOCALE)
console.log(names.length ? `文案齐全（${[BASE_LOCALE, ...names].join('、')}）` : '文案齐全')
