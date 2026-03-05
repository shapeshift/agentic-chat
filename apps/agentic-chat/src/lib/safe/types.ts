// Matches @safe-global/protocol-kit's internal Eip1193Provider (not publicly exported)
export type SafeProvider = {
  request: (args: { readonly method: string; readonly params?: readonly unknown[] | object }) => Promise<unknown>
}
