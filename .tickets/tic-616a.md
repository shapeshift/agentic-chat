---
id: tic-616a
status: open
type: bug
priority: 2
assignee: Jibles
created: 2026-03-19T09:48:28.499128674Z
---
# Dollar sign stripped from chat input messages

## Summary

The `$` character is silently stripped from chat messages when sent. Typing `$2 worth of ETH` results in the message appearing as `worth of ETH` — the `$2` portion is completely removed.

## Impact

This makes the USD-based swap tool (`initiateSwapUsdTool`) effectively unusable, since users cannot specify dollar amounts. The agent then misinterprets the message (e.g., "1 worth is ambiguous").

## Steps to Reproduce

1. Connect wallet and open a new chat
2. Type: `Swap $2 worth of ETH to USDC on Arbitrum`
3. Send the message
4. Observe: the message bubble shows `Swap  worth of ETH to USDC on Arbitrum` — `$2` is gone

## Expected Behavior

The `$` character should be preserved in messages. Dollar amounts are a core part of the crypto trading UX.

## Likely Location

Chat input component text handling — possibly overzealous sanitization or a template literal issue stripping `$`.

## Acceptance Criteria

- [ ] Dollar sign characters are preserved in sent messages
- [ ] USD-based swap requests like 'Swap $2 of ETH to USDC' work correctly
- [ ] No XSS or injection regressions from allowing $

