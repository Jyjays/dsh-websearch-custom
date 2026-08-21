import { useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the client runtime Context merges (ctx.slots, ctx.settingsScope) and the locale merge (ctx.locale).
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'

/**
 * Browser half of dsh-websearch-custom: a Settings → WebSearch Custom page
 * that edits the `websearch-custom` host settings namespace, so the search
 * provider route (endpoint, model, key reference, limits) is configurable in
 * the UI instead of via composition files. Colors come from the DSH theme
 * alias tokens so light/dark modes render correctly; copy follows the active
 * locale (zh / en).
 */

const NAMESPACE = 'websearch-custom'

type LocaleKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'websearch-custom': LocaleKey
  }
  interface SlotMap {
    'settings.section': { kind: 'list'; scope: 'root'; owner: { close: () => void } }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    settingsScope: {
      bind<T = Record<string, unknown>>(spec: { namespace: string }): SettingsScope<T>
    }
  }
}

export const inject = ['slots', 'locale', 'settingsScope']

type Translate = (key: string) => string

const zh = {
  nav: '自定义网页搜索',
  title: '自定义网页搜索',
  intro: '配置内置 web_search 工具使用的 OpenAI Responses 兼容提供方。更改会在下一次搜索时生效，无需重启。',
  providerId: '提供方 ID',
  providerIdHint: 'web 组合行（web.searchProvider）选择的稳定 ID。',
  apiKey: 'API Key',
  apiKeyHint: '以密钥形式保存在宿主设置中，不会回显。留空则使用下面的密钥引用。',
  apiKeyPlaceholder: '留空则使用 API Key Env',
  apiKeyEnv: 'API Key 环境变量',
  apiKeyEnvHint: '每次搜索时解析的环境变量或 DSH 凭据引用。',
  baseUrl: '接口地址',
  baseUrlHint: 'OpenAI Responses 兼容端点基础地址，不含 /responses。',
  model: '模型',
  modelHint: '支持原生网页搜索的 Responses 模型。',
  toolType: '搜索工具类型',
  toolTypeHint: '原生 Responses 搜索工具名；部分网关仅支持 web_search，不支持 web_search_preview。',
  contextSize: '搜索上下文大小',
  contextSizeHint: '服务端检索上下文量。',
  maxTokens: '最大输出 token',
  allowedDomains: '允许的域名',
  allowedDomainsHint: '逗号分隔的 URL 允许列表（原生搜索过滤）。留空表示不限制。',
  blockedDomains: '屏蔽的域名',
  blockedDomainsHint: '逗号分隔的 URL 屏蔽列表。留空表示不限制。',
  save: '保存',
  saving: '保存中…',
  saved: '已保存。下一次 web_search 调用将使用新配置。',
  failed: '保存失败：',
  readOnly: '设置文档为只读。',
  unavailable: '设置暂不可用（需要 DSH 设置传输）。',
}

const en: Record<keyof typeof zh, string> = {
  nav: 'WebSearch Custom',
  title: 'WebSearch Custom',
  intro: 'Configure the OpenAI Responses-compatible provider used by the built-in web_search tool. Changes apply to the next search; no restart is required.',
  providerId: 'Provider ID',
  providerIdHint: 'Stable id selected by the web composition row (web.searchProvider).',
  apiKey: 'API Key',
  apiKeyHint: 'Stored in host settings as a secret and never echoed back. Leave empty to use the key reference below.',
  apiKeyPlaceholder: 'Leave empty to use API Key Env',
  apiKeyEnv: 'API Key Env',
  apiKeyEnvHint: 'Environment variable or DSH credential reference resolved per search.',
  baseUrl: 'Base URL',
  baseUrlHint: 'OpenAI Responses-compatible endpoint base, without /responses.',
  model: 'Model',
  modelHint: 'Responses model expected to support native web search.',
  toolType: 'Search tool type',
  toolTypeHint: 'Native Responses web-search tool name; some gateways support only web_search, not web_search_preview.',
  contextSize: 'Search context size',
  contextSizeHint: 'Amount of server-side retrieval context.',
  maxTokens: 'Max output tokens',
  allowedDomains: 'Allowed domains',
  allowedDomainsHint: 'Comma-separated URL allow list (native search filters). Empty = no restriction.',
  blockedDomains: 'Blocked domains',
  blockedDomainsHint: 'Comma-separated URL block list. Empty = no restriction.',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved. Next web_search call uses the new configuration.',
  failed: 'Failed to save: ',
  readOnly: 'Settings document is read-only.',
  unavailable: 'Settings are unavailable (requires DSH settings transport).',
}

// Theme alias tokens keep the page legible in light and dark mode.
const rowStyle: CSSProperties = { marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }
const labelStyle: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }
const hintStyle: CSSProperties = { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' }
const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 6,
  border: '1px solid var(--dsw-alias-border-l1)',
  fontSize: 13,
  background: 'var(--dsw-alias-bg-layer-2)',
  color: 'var(--dsw-alias-label-primary)',
}
const selectStyle: CSSProperties = { ...inputStyle, width: 'auto' }
const sectionStyle: CSSProperties = { maxWidth: 560 }
const buttonStyle: CSSProperties = {
  padding: '7px 16px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1)',
  background: 'var(--dsw-alias-bg-layer-1)', fontSize: 13, cursor: 'pointer',
  color: 'var(--dsw-alias-label-primary)',
}
const statusStyle: CSSProperties = { fontSize: 12, marginTop: 8, minHeight: 16 }

function Field(props: { label: string; hint?: string; children: ReactNode }): JSX.Element {
  return (
    <div style={rowStyle}>
      <label style={labelStyle}>{props.label}</label>
      {props.children}
      {props.hint !== undefined ? <span style={hintStyle}>{props.hint}</span> : null}
    </div>
  )
}

function splitList(text: string): string[] {
  return text.split(',').map(part => part.trim()).filter(part => part.length > 0)
}

function SettingsSection(props: { scope: SettingsScope<Record<string, unknown>>; t: Translate }): JSX.Element | null {
  const { scope, t } = props
  const snapshot = useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const stored = (snapshot.value ?? {}) as Record<string, unknown>
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (snapshot.status === 'unavailable') {
    return <p style={statusStyle}>{t('unavailable')}</p>
  }

  const get = (key: string, fallback = ''): string => {
    const typed = form[key]
    if (typed !== undefined) return typed
    const raw = stored[key]
    return raw === undefined || raw === null ? fallback : String(raw)
  }
  const set = (key: string, value: string): void => setForm(prev => ({ ...prev, [key]: value }))

  const toolType = get('searchToolType', 'web_search')
  const contextSize = get('searchContextSize', 'low')

  async function save(): Promise<void> {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const writes: Array<[string, unknown]> = [
        ['providerId', get('providerId', 'custom-openai').trim() || 'custom-openai'],
        ['searchToolType', toolType],
        ['searchContextSize', contextSize],
        ['maxOutputTokens', Number(get('maxOutputTokens', '1024'))],
        ['allowedDomains', splitList(get('allowedDomains'))],
        ['blockedDomains', splitList(get('blockedDomains'))],
      ]
      // Endpoint, model, and key reference have no defaults: only write them
      // when the user actually entered a value.
      for (const key of ['apiKeyEnv', 'baseURL', 'model'] as const) {
        const value = get(key).trim()
        if (value.length > 0) writes.push([key, value])
      }
      const apiKey = get('apiKey').trim()
      if (apiKey.length > 0) writes.push(['apiKey', apiKey])
      for (const [field, value] of writes) await scope.set(field, value)
      setForm({})
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={sectionStyle}>
      <h2 style={{ fontSize: 16, margin: '0 0 4px', color: 'var(--dsw-alias-label-primary)' }}>{t('title')}</h2>
      <p style={hintStyle}>{t('intro')}</p>

      <Field label={t('providerId')} hint={t('providerIdHint')}>
        <input className="dsh-websearch-custom-input" style={inputStyle} value={get('providerId', 'custom-openai')} disabled={busy} onChange={e => set('providerId', e.target.value)} />
      </Field>

      <Field label={t('apiKey')} hint={t('apiKeyHint')}>
        <input className="dsh-websearch-custom-input" style={inputStyle} type="password" placeholder={t('apiKeyPlaceholder')} value={get('apiKey')} disabled={busy} onChange={e => set('apiKey', e.target.value)} />
      </Field>

      <Field label={t('apiKeyEnv')} hint={t('apiKeyEnvHint')}>
        <input className="dsh-websearch-custom-input" style={inputStyle} placeholder="MY_PROVIDER_API_KEY" value={get('apiKeyEnv')} disabled={busy} onChange={e => set('apiKeyEnv', e.target.value)} />
      </Field>

      <Field label={t('baseUrl')} hint={t('baseUrlHint')}>
        <input className="dsh-websearch-custom-input" style={inputStyle} placeholder="https://..." value={get('baseURL')} disabled={busy} onChange={e => set('baseURL', e.target.value)} />
      </Field>

      <Field label={t('model')} hint={t('modelHint')}>
        <input className="dsh-websearch-custom-input" style={inputStyle} placeholder="search-enabled-model" value={get('model')} disabled={busy} onChange={e => set('model', e.target.value)} />
      </Field>

      <Field label={t('toolType')} hint={t('toolTypeHint')}>
        <select style={selectStyle} value={toolType} disabled={busy} onChange={e => set('searchToolType', e.target.value)}>
          <option value="web_search">web_search</option>
          <option value="web_search_preview">web_search_preview</option>
        </select>
      </Field>

      <Field label={t('contextSize')} hint={t('contextSizeHint')}>
        <select style={selectStyle} value={contextSize} disabled={busy} onChange={e => set('searchContextSize', e.target.value)}>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </Field>

      <Field label={t('maxTokens')}>
        <input className="dsh-websearch-custom-input" style={inputStyle} type="number" min={1} value={get('maxOutputTokens', '1024')} disabled={busy} onChange={e => set('maxOutputTokens', e.target.value)} />
      </Field>

      <Field label={t('allowedDomains')} hint={t('allowedDomainsHint')}>
        <input className="dsh-websearch-custom-input" style={inputStyle} value={get('allowedDomains')} disabled={busy} onChange={e => set('allowedDomains', e.target.value)} />
      </Field>

      <Field label={t('blockedDomains')} hint={t('blockedDomainsHint')}>
        <input className="dsh-websearch-custom-input" style={inputStyle} value={get('blockedDomains')} disabled={busy} onChange={e => set('blockedDomains', e.target.value)} />
      </Field>

      <button type="button" style={buttonStyle} disabled={busy || !snapshot.writable} onClick={() => void save()}>
        {busy ? t('saving') : t('save')}
      </button>
      <div style={statusStyle}>
        {error !== null ? <span style={{ color: 'var(--dsw-alias-state-error-primary)' }}>{t('failed')}{error}</span> : null}
        {saved ? <span style={{ color: 'var(--dsw-alias-state-success-primary)' }}>{t('saved')}</span> : null}
        {!snapshot.writable ? <span style={{ color: 'var(--dsw-alias-state-warn-primary)' }}>{t('readOnly')}</span> : null}
      </div>
    </div>
  )
}

export function apply(ctx: Context): void {
  const scope = ctx.settingsScope.bind<Record<string, unknown>>({ namespace: NAMESPACE })
  const t = ctx.locale.bind(NAMESPACE) as Translate
  ctx.effect(() => ctx.locale.register(NAMESPACE, { zh, en }), 'dsh-websearch-custom: dictionaries')
  // Theme-aware placeholder legibility in both color schemes.
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = '.dsh-websearch-custom-input::placeholder { color: var(--dsw-alias-label-secondary); opacity: 0.7; }'
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'dsh-websearch-custom: placeholder theme')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'websearch-custom',
    order: 90,
    label: () => t('nav'),
    inject: () => ({ scope, t }),
  }, SettingsSection))
}
