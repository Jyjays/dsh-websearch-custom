import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebError } from '@deepseek-ai/dsh-web'
import { CustomResponsesSearchProvider } from '../src/provider.ts'
import { mapResponsesPayload } from '../src/response.ts'

const options = {
  providerId: 'custom-openai',
  apiKey: 'test-key',
  apiKeyEnv: 'TEST_KEY',
  baseURL: 'https://gateway.test/v1/',
  model: 'cheap-search-model',
  searchToolType: 'web_search_preview' as const,
  searchContextSize: 'low' as const,
  maxOutputTokens: 321,
  allowedDomains: ['arxiv.org'],
}

function provider(overrides: Partial<typeof options> = {}): CustomResponsesSearchProvider {
  return new CustomResponsesSearchProvider(() => ({ ...options, ...overrides }))
}

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

afterEach(() => vi.unstubAllGlobals())

describe('mapResponsesPayload', () => {
  it('uses native URL citations and enclosing text only', () => {
    expect(mapResponsesPayload({
      output: [{ type: 'message', content: [{
        type: 'output_text',
        text: 'A cited result.',
        annotations: [{ type: 'url_citation', url: 'https://a.test', title: 'A' }],
      }] }],
    })).toEqual({
      content: 'A cited result.',
      sources: [{ url: 'https://a.test', title: 'A', snippet: 'A cited result.' }],
      truncated: false,
    })
  })

  it('deduplicates citations and accepts native call sources', () => {
    expect(mapResponsesPayload({
      output: [
        { type: 'web_search_call', sources: [{ url: 'https://a.test', title: 'first', snippet: 'server snippet' }] },
        { type: 'message', content: [{ type: 'output_text', text: 'same', annotations: [{ type: 'url_citation', url: 'https://a.test', title: 'second' }] }] },
      ],
    }).sources).toEqual([{ url: 'https://a.test', title: 'first', snippet: 'server snippet' }])
  })

  it('rejects ordinary uncited model prose', () => {
    expect(() => mapResponsesPayload({ output_text: 'No web results.' }))
      .toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })
})

describe('CustomResponsesSearchProvider', () => {
  it('maps the OpenAI Responses request and normalized output', async () => {
    const fetchMock = vi.fn(async () => response({
      output_text: 'Found one source.',
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Found one source.', annotations: [{ type: 'url_citation', url: 'https://a.test', title: 'A' }] }] }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(provider().search({ query: 'vector databases' })).resolves.toMatchObject({
      content: 'Found one source.', sources: [{ url: 'https://a.test', title: 'A' }],
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://gateway.test/v1/responses')
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' })
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-key' })
    expect(JSON.parse(init.body as string)).toEqual({
      model: 'cheap-search-model',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'Search the web for: vector databases' }] }],
      tools: [{ type: 'web_search_preview', search_context_size: 'low', filters: { allowed_domains: ['arxiv.org'] } }],
      max_output_tokens: 321,
    })
  })

  it('omits empty domain filters from the request', async () => {
    const fetchMock = vi.fn(async () => response({
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'Result', annotations: [{ type: 'url_citation', url: 'https://a.test' }] }] }],
    }))
    vi.stubGlobal('fetch', fetchMock)
    await provider({ allowedDomains: [], blockedDomains: [] }).search({ query: 'q' })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { tools: [{ filters?: unknown }] }
    expect(body.tools[0].filters).toBeUndefined()
  })

  it('forwards cancellation to fetch', async () => {
    const fetchMock = vi.fn(async () => response({ output: [{ sources: [{ url: 'https://a.test' }] }] }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    await provider().search({ query: 'q' }, controller.signal)
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal).toBe(controller.signal)
  })

  it('reports missing credentials and HTTP errors clearly', async () => {
    await expect(provider({ apiKey: '', resolveApiKey: async () => undefined }).search({ query: 'q' }))
      .rejects.toMatchObject({ code: 'WEB_PROVIDER_CREDENTIAL_MISSING' })
    vi.stubGlobal('fetch', async () => response({ error: 'bad tool' }, { status: 400 }))
    await expect(provider().search({ query: 'q' })).rejects.toBeInstanceOf(WebError)
  })

  it('has a local availability check', () => {
    expect(provider().available()).toBe(true)
    expect(provider({ baseURL: 'not a url' }).available()).toBe(false)
    expect(provider({ maxOutputTokens: 0 }).available()).toBe(false)
  })
})
