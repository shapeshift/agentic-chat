# Interrupted-tool conversation

The [fixture](../apps/agentic-server/src/lib/fixtures/interrupted-tool-conversation.json) represents an ETH price lookup interrupted while its tool input was streaming. It contains no wallet data or completed tool result. The server regression test validates this same fixture and converts it with incomplete tool calls ignored.

## Engineering setup

Open the chat app on the origin Operations will test (currently `http://localhost:4200`). Wait for any active response to finish, then run this snippet in that tab's browser developer console. It adds or resets only the named QA conversation and preserves other conversations and settings. Re-run it to reset the fixture before another test.

```js
const fixture = await fetch(
  'https://raw.githubusercontent.com/shapeshift/agentic-chat/security/ai01/apps/agentic-server/src/lib/fixtures/interrupted-tool-conversation.json'
).then(response => {
  if (!response.ok) throw new Error('Could not load the QA fixture')
  return response.json()
})
const db = await new Promise((resolve, reject) => {
  const request = indexedDB.open('keyval-store')
  request.onupgradeneeded = () => request.result.createObjectStore('keyval')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})
await new Promise((resolve, reject) => {
  const tx = db.transaction('keyval', 'readwrite')
  const store = tx.objectStore('keyval')
  const request = store.get('shapeshift-chat-store')
  request.onsuccess = () => {
    try {
      const saved = request.result ? JSON.parse(request.result) : { version: 4, state: {} }
      if (saved.version !== 4) throw new Error('Unexpected chat storage version')
      const state = saved.state
      state.conversations = [
        ...(state.conversations || []).filter(item => item.id !== fixture.conversation.id),
        fixture.conversation,
      ]
      state.messagesByConversation = {
        ...state.messagesByConversation,
        [fixture.conversation.id]: fixture.messages,
      }
      store.put(JSON.stringify(saved), 'shapeshift-chat-store')
    } catch (error) {
      tx.abort()
      reject(error)
    }
  }
  tx.oncomplete = () => resolve()
  tx.onabort = () => reject(tx.error || new Error('Fixture setup aborted'))
  tx.onerror = () => reject(tx.error)
})
db.close()
location.assign('/chats')
```

Chat history is stored per browser profile and origin. A URL alone does not install the fixture on another device; Engineering must seed the browser Operations will use.

## Operations check

1. Wait for the sidebar to load, then open **QA: interrupted ETH price lookup**. Confirm the original question and “I will look up the current ETH price.” are visible before continuing.
2. Send: **The lookup was interrupted. Please look up the current ETH price again.**
3. Confirm the tool result and answer finish without a conversation-format error. Refresh, reopen the conversation, and send another message; it should still work.

This is a synthetic persisted-history fixture, not a recording of a live cancellation. The separate Stop-button check exercises live cancellation.
