export interface TokenBalance {
  /**
   *
   * @type {string}
   * @memberof TokenBalance
   */
  contract: string
  /**
   *
   * @type {number}
   * @memberof TokenBalance
   */
  decimals: number
  /**
   *
   * @type {string}
   * @memberof TokenBalance
   */
  name: string
  /**
   *
   * @type {string}
   * @memberof TokenBalance
   */
  symbol: string
  /**
   *
   * @type {string}
   * @memberof TokenBalance
   */
  type: string
  /**
   * nft or multi token id
   * @type {string}
   * @memberof TokenBalance
   */
  id?: string
  /**
   *
   * @type {string}
   * @memberof TokenBalance
   */
  balance: string
}

export interface Account {
  /**
   *
   * @type {string}
   * @memberof Account
   */
  balance: string
  /**
   *
   * @type {string}
   * @memberof Account
   */
  unconfirmedBalance: string
  /**
   *
   * @type {string}
   * @memberof Account
   */
  pubkey: string
  /**
   *
   * @type {number}
   * @memberof Account
   */
  nonce: number
  /**
   *
   * @type {Array<TokenBalance>}
   * @memberof Account
   */
  tokens: Array<TokenBalance>
}
