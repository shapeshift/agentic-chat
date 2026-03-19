---
id: tic-78e5
status: open
type: feature
priority: 3
assignee: Jibles
created: 2026-03-19T09:48:42.234098894Z
---
# External address lookup does not support ENS names

## Summary

The `lookupExternalAddressTool` only accepts raw hex Ethereum addresses. ENS names like `vitalik.eth` are rejected with "invalid format for direct lookup."

## Current Behavior

Asking "Look up the balance of vitalik.eth" returns:
> The address "vitalik.eth" couldn't be resolved (invalid format for direct lookup). Provide the resolved Ethereum address (e.g., 0xd8dA6BF...) to check its portfolio balance.

## Expected Behavior

The tool should resolve ENS names to addresses before performing the lookup, or the agent should resolve ENS first and then call the tool with the hex address.

## Notes

- This is a common user expectation — ENS names are widely used
- Resolution could happen server-side in the tool or client-side before the tool call

## Acceptance Criteria

- [ ] ENS names (e.g., vitalik.eth) resolve to addresses and return balances
- [ ] Invalid ENS names return a clear error message

