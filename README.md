# dsh-websearch-custom

`dsh-websearch-custom` registers a configurable `ctx.web` provider that calls any OpenAI Responses-compatible endpoint with its native web-search tool. Point it at a gateway that exposes a model with Responses API web search; endpoint, model, key reference, and limits are all configured by the user — the package ships no vendor-specific defaults.

It does not scrape the web, call ordinary chat completions, or turn uncited model prose into search evidence. A response must contain native URL citations or search sources; otherwise the provider returns `WEB_PROVIDER_ERROR`.

## Install

Install from a checkout or a Git repository into the running DSH profile:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-websearch-custom
```

For a Git-hosted package, pin a reviewed commit. Git installs need this package's `prepare` script to build `dist/`; pnpm may require adding `dsh-websearch-custom: true` to the profile's `pnpm-workspace.yaml` `allowBuilds` section.

Restart the DSH Host after installation.

## Settings UI

The bundle ships a browser settings page (Settings → **WebSearch Custom**) that
edits the same configuration at runtime — no restart or composition edit is
needed after saving:

- **Provider ID** — the stable id the `web` composition row selects
  (`web.searchProvider`).
- **API Key** — optional; stored as a settings secret and never echoed back.
- **API Key Env** — environment variable or DSH credential reference resolved
  per search. No default; leave empty when the API Key is entered directly.
- **Base URL** — OpenAI Responses-compatible endpoint base, without
  `/responses`. Required.
- **Model** — Responses model expected to support native web search. Required.
- **Search tool type** — `web_search` or `web_search_preview` (which tool your
  gateway supports; check its documentation).
- **Search context size** — `low` / `medium` / `high`.
- **Max output tokens** — Responses output-token ceiling.
- **Allowed / Blocked domains** — comma-separated native search filters.

Values are persisted to the `websearch-custom` settings namespace and are read
on every search, so a saved change applies to the next `web_search` call.

## Configure

The bundle only registers `custom-openai`; it intentionally does not replace
DSH's default `deepseek-official` provider. In a user-owned Host/profile
overlay, point the `web` row at it:

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: custom-openai
```

Mount the provider row. Without explicit values the endpoint, model, and key
reference must be supplied through the Settings UI before the first search:

```yaml
- id: web-search-custom
  name: dsh-websearch-custom
```

To pin values in composition (as the base layer the UI edits), replace the
row with explicit configuration — the example below uses neutral placeholders:

```yaml
- id: web-search-custom
  name: dsh-websearch-custom
  config:
    providerId: custom-openai
    apiKeyEnv: MY_PROVIDER_API_KEY
    baseURL: https://api.example.com/v1
    model: my-search-enabled-model
    searchToolType: web_search
    searchContextSize: low
    maxOutputTokens: 1024
    allowedDomains:
      - arxiv.org
      - openreview.net
```

`apiKey` is also accepted but should be avoided because it would place a secret in composition. `apiKeyEnv` is resolved through DSH credentials first, then the launch environment.

Supported configuration (no vendor defaults — endpoint, model, and key reference are user-supplied):

| Field | Default | Meaning |
|---|---|---|
| `providerId` | `custom-openai` | Stable provider id selected by `web.searchProvider`. |
| `apiKeyEnv` | unset | Credential reference or fallback environment variable. |
| `baseURL` | unset (required) | OpenAI-compatible API base, without `/responses`. |
| `model` | unset (required) | Responses model that supports native web search. |
| `searchToolType` | `web_search` | Provider-specific native Responses tool name. |
| `searchContextSize` | `low` | `low`, `medium`, or `high` server retrieval context. |
| `maxOutputTokens` | `1024` | Responses API output-token ceiling. |
| `allowedDomains` | unset | Optional URL allow list passed as native search filters. |
| `blockedDomains` | unset | Optional URL block list passed as native search filters. |

## Compatibility and limits

OpenAI-compatible endpoints differ substantially. Before making this the default provider, confirm that the exact endpoint and model accept `POST /responses` with a native `web_search_preview` or `web_search` tool and return URL citations. The package deliberately fails rather than silently producing synthetic citations when an endpoint supports Responses text but not native search.

The request uses an OpenAI Responses shape with `input`, `tools`, and `max_output_tokens`. Some gateways accept only `web_search`, not `web_search_preview`; change `searchToolType` accordingly. Some gateways use different filter field names, in which case leave domain filters unset or adapt the provider to that gateway.

## Development

```sh
pnpm install
pnpm test
pnpm run typecheck
pnpm run build
```

The test suite mocks `fetch`; it does not call a real search endpoint.
