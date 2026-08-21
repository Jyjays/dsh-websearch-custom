import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-web'
import { CustomResponsesSearchProvider, type CustomSearchProviderOptions } from './provider.ts'

export { CustomResponsesSearchProvider } from './provider.ts'
export { mapResponsesPayload } from './response.ts'
export type { CustomSearchProviderOptions } from './provider.ts'
export type { ResponsesPayload } from './response.ts'

export const name = 'dsh-websearch-custom'
export const inject = ['web']

/** Settings namespace carrying the provider's editable configuration. */
export const WEBSEARCH_CUSTOM_SETTINGS_NAMESPACE = settingsNamespace('websearch-custom')

export interface Config {
  providerId: string
  apiKey?: string
  apiKeyEnv?: string
  baseURL?: string
  model?: string
  searchToolType: 'web_search_preview' | 'web_search'
  searchContextSize: 'low' | 'medium' | 'high'
  maxOutputTokens: number
  allowedDomains?: string[]
  blockedDomains?: string[]
}

export const Config: z<Config> = z.object({
  providerId: z.string().default('custom-openai'),
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref'),
  baseURL: z.string(),
  model: z.string(),
  searchToolType: z.union(['web_search_preview', 'web_search'] as const).default('web_search'),
  searchContextSize: z.union(['low', 'medium', 'high'] as const).default('low'),
  maxOutputTokens: z.number().step(1).min(1).default(1024),
  allowedDomains: z.array(z.string()),
  blockedDomains: z.array(z.string()),
})

function options(ctx: Context, config: Config): CustomSearchProviderOptions {
  const literalApiKey = config.apiKey !== undefined && config.apiKey.length > 0 ? config.apiKey : undefined
  const reference = config.apiKeyEnv !== undefined && config.apiKeyEnv.length > 0
    ? credentialRef(config.apiKeyEnv)
    : undefined
  return {
    providerId: config.providerId,
    ...literalApiKey === undefined ? {} : { apiKey: literalApiKey },
    resolveApiKey: async () => {
      if (reference === undefined) return undefined
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(reference))?.value
      const ambient = config.apiKeyEnv !== undefined ? launchEnvironmentOf(ctx).get(config.apiKeyEnv) : undefined
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    ...config.apiKeyEnv !== undefined && config.apiKeyEnv.length > 0 ? { apiKeyEnv: config.apiKeyEnv } : {},
    ...config.baseURL !== undefined && config.baseURL.length > 0 ? { baseURL: config.baseURL } : {},
    ...config.model !== undefined && config.model.length > 0 ? { model: config.model } : {},
    searchToolType: config.searchToolType,
    searchContextSize: config.searchContextSize,
    maxOutputTokens: config.maxOutputTokens,
    ...config.allowedDomains !== undefined && config.allowedDomains.length > 0 ? { allowedDomains: config.allowedDomains } : {},
    ...config.blockedDomains !== undefined && config.blockedDomains.length > 0 ? { blockedDomains: config.blockedDomains } : {},
  }
}

export function apply(ctx: Context, config: Partial<Config> = {}): void {
  let current: () => Config = () => config as Config
  installSettingsSection(ctx, WEBSEARCH_CUSTOM_SETTINGS_NAMESPACE, Config, config as Config, {
    setSource: (source) => { current = source },
    onChange: () => {},
  })
  ctx.web.registerSearchProvider(new CustomResponsesSearchProvider(() => options(ctx, current())))
}
