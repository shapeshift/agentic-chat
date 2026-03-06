---
id: sa-crfa
status: closed
deps: []
links: []
created: 2026-03-05T09:03:51Z
type: bug
priority: 1
assignee: Jibles
---
# Chat route: add Zod validation for POST /chat request body

## Problem
`routes/chat.ts:430-453` accepts the request body via `c.req.json()` and casts it directly with `as { messages: unknown; ... }`. No server-side validation of `evmAddress`, `solanaAddress`, `safeAddress`, `safeDeploymentState`, `registryOrders`, or `messages`. A malicious client can send arbitrary data.

## Solution
- Create a Zod schema for the full POST /chat request body
- Replace unsafe `as` casts with `schema.parse(body)` 
- Return 400 with clear error for invalid payloads

## Files
- `apps/agentic-server/src/routes/chat.ts`
- Possibly new shared schema file

## Acceptance Criteria

- [ ] Zod schema validates all fields (messages, evmAddress, solanaAddress, safeAddress, safeDeploymentState, registryOrders)
- [ ] Invalid payloads return 400 with descriptive error
- [ ] No unsafe `as` casts remain for request body fields
- [ ] Existing tests pass
