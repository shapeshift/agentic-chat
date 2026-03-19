---
id: tic-93f0
status: open
type: chore
priority: 4
assignee: Jibles
created: 2026-03-19T09:49:10.195588513Z
---
# Generic error messages for backend failures lack actionable detail

## Summary

When the backend API is unavailable, multiple tools show one of two generic error messages with no actionable detail:

1. Portfolio tool: "Failed to fetch portfolio details" (red text)
2. All other wallet tools: "Something went wrong — The service is temporarily unavailable. Please try again." (red error banner)

Neither message helps the user understand what's wrong or what to do beyond "try again."

## Affected Tools

All wallet-dependent tools when backend is down: portfolioTool, receiveTool, transactionHistoryTool, and likely others.

## Suggested Improvement

- Differentiate between network errors (backend unreachable), auth errors (session expired), and API errors (bad request)
- For backend-down scenarios, surface something like "Unable to reach the ShapeShift API. Check your connection or try again in a moment."
- Consider adding retry logic for transient failures

## Acceptance Criteria

- [ ] Error messages distinguish between different failure types
- [ ] Users get actionable guidance when errors occur

