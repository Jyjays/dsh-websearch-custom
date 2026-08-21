import { WebError } from '@deepseek-ai/dsh-web'
import type { WebSearchResult, WebSearchSource } from '@deepseek-ai/dsh-web'

export interface ResponsesCitation {
  readonly type?: string
  readonly url?: string
  readonly title?: string
}

export interface ResponsesContentPart {
  readonly type?: string
  readonly text?: string
  readonly annotations?: readonly ResponsesCitation[]
}

export interface ResponsesOutputItem {
  readonly type?: string
  readonly content?: readonly ResponsesContentPart[]
  readonly sources?: readonly {
    readonly url?: string
    readonly title?: string
    readonly snippet?: string
  }[]
}

export interface ResponsesPayload {
  readonly output?: readonly ResponsesOutputItem[]
  readonly output_text?: string
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function addSource(
  sources: WebSearchSource[],
  seen: Set<string>,
  source: { url?: unknown; title?: unknown; snippet?: unknown },
): void {
  const url = optionalString(source.url)
  if (url === undefined || seen.has(url)) return
  seen.add(url)
  const title = optionalString(source.title)
  const snippet = optionalString(source.snippet)
  sources.push({
    url,
    ...title === undefined ? {} : { title },
    ...snippet === undefined ? {} : { snippet },
  })
}

/** Normalize OpenAI Responses native-search output without inventing citations. */
export function mapResponsesPayload(payload: ResponsesPayload): WebSearchResult {
  const sources: WebSearchSource[] = []
  const seen = new Set<string>()
  const textParts: string[] = []

  for (const item of payload.output ?? []) {
    for (const source of item.sources ?? []) addSource(sources, seen, source)
    for (const part of item.content ?? []) {
      const text = optionalString(part.text)
      if (text !== undefined) textParts.push(text)
      for (const annotation of part.annotations ?? []) {
        if (annotation.type !== 'url_citation') continue
        addSource(sources, seen, { url: annotation.url, title: annotation.title, snippet: text })
      }
    }
  }

  if (sources.length === 0) {
    throw new WebError(
      'OpenAI Responses endpoint returned no URL citations or web-search sources; native web search may be unsupported by this provider or model',
      'WEB_PROVIDER_ERROR',
    )
  }

  const outputText = optionalString(payload.output_text)
  const content = outputText ?? (textParts.length > 0 ? textParts.join('\n') : undefined)
  return {
    ...content === undefined ? {} : { content },
    sources,
    truncated: false,
  }
}
