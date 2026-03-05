// Matches @safe-global/protocol-kit's Eip1193Provider. Uses `any` for the request
// args so viem WalletClient (which uses narrow method unions) is assignable without casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SafeProvider = { request: (args: any) => Promise<unknown> }
