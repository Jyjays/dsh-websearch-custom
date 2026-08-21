import { WebError } from '@deepseek-ai/dsh-web'
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web'
import { mapResponsesPayload, type ResponsesPayload } from './response.ts'

export interface CustomSearchProviderOptions {
  readonly providerId: string
  readonly apiKey?: string
  readonly resolveApiKey?: () => Promise<string | undefined>
  readonly apiKeyEnv?: string
  readonly baseURL?: string
  readonly model?: string
  readonly searchToolType: 'web_search_preview' | 'web_search'
  readonly searchContextSize: 'low' | 'medium' | 'high'
  readonly maxOutputTokens: number
  readonly allowedDomains?: readonly string[]
  readonly blockedDomains?: readonly string[]
}

function endpoint(baseURL: string): string {
  return `${baseURL.replace(/\/+$/u, '')}/responses`
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

function abortError(signal?: AbortSignal, cause?: unknown): WebError {
  return new WebError('Custom web search aborted', 'WEB_ABORTED', {
    cause: signal?.aborted === true ? signal.reason : cause,
  })
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw abortError(signal)
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export class CustomResponsesSearchProvider implements WebSearchProvider {
  constructor(private readonly resolveOptions: () => CustomSearchProviderOptions) {}

  get id(): string {
    return this.resolveOptions().providerId
  }

  available(): boolean {
    const options = this.resolveOptions()
    const baseURL = options.baseURL ?? ''
    return options.providerId.length > 0
      && ((options.apiKey?.length ?? 0) > 0 || options.resolveApiKey !== undefined)
      && baseURL.length > 0
      && URL.canParse(baseURL)
      && isPositiveInteger(options.maxOutputTokens)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const options = this.resolveOptions()
    throwIfAborted(signal)
    const baseURL = options.baseURL ?? ''
    const model = options.model ?? ''
    if (baseURL.length === 0 || model.length === 0) {
      throw new WebError(
        'Custom web search is not configured: set a base URL and a model in Settings -> WebSearch Custom',
        'WEB_PROVIDER_CONFIGURED_MISSING',
      )
    }
    const apiKey = await this.resolveApiKey(options, signal)
    const filters = {
      ...options.allowedDomains !== undefined && options.allowedDomains.length > 0 ? { allowed_domains: options.allowedDomains } : {},
      ...options.blockedDomains !== undefined && options.blockedDomains.length > 0 ? { blocked_domains: options.blockedDomains } : {},
    }
    const body = {
      model,
      input: [{ role: 'user', content: [{ type: 'input_text', text: `Search the web for: ${request.query}` }] }],
      tools: [{ type: options.searchToolType, search_context_size: options.searchContextSize, ...Object.keys(filters).length === 0 ? {} : { filters } }],
      max_output_tokens: options.maxOutputTokens,
    }
    let response: Response
    try {
      response = await fetch(endpoint(baseURL), {
        method: 'POST',
        redirect: 'error',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          accept: 'application/json',
          'user-agent': 'dsh-websearch-custom/0.1.0',
        },
        body: JSON.stringify(body),
        ...signal === undefined ? {} : { signal },
      })
    } catch (error: unknown) {
      if (signal?.aborted === true || isAbort(error)) throw abortError(signal, error)
      throw new WebError(`Custom web search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      let detail = ''
      try { detail = (await response.text()).trim().slice(0, 1000) } catch { /* HTTP status remains useful. */ }
      throw new WebError(`Custom web search API error (HTTP ${response.status})${detail.length === 0 ? '' : `: ${detail}`}`, 'WEB_PROVIDER_ERROR')
    }

    try {
      return mapResponsesPayload(await response.json() as ResponsesPayload)
    } catch (error: unknown) {
      if (signal?.aborted === true || isAbort(error)) throw abortError(signal, error)
      if (error instanceof WebError) throw error
      throw new WebError(`Custom web search returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }

  private async resolveApiKey(options: CustomSearchProviderOptions, signal?: AbortSignal): Promise<string> {
    if (options.apiKey !== undefined && options.apiKey.length > 0) return options.apiKey
    try {
      const key = await options.resolveApiKey?.()
      throwIfAborted(signal)
      if (key !== undefined && key.length > 0) return key
    } catch (error: unknown) {
      if (signal?.aborted === true || isAbort(error)) throw abortError(signal, error)
      throw new WebError(`Custom web search credential resolution failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
    throw new WebError(`Custom web search has no API key for "${options.apiKeyEnv ?? '(no key reference configured)'}"`, 'WEB_PROVIDER_CREDENTIAL_MISSING')
  }
}
