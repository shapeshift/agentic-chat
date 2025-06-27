import type { PortalsResponse } from '@shapeshiftoss/types'
import axios from 'axios'
import qs from 'qs'

const env = import.meta?.env ? import.meta.env : process.env
const PORTALS_BASE_URL = env.VITE_PORTALS_BASE_URL
const PORTALS_API_KEY = env.VITE_PORTALS_API_KEY

export const searchTokens = async ({ searchTerm, network }: { searchTerm: string; network?: string | undefined }) => {
  const tokensUrl = `${PORTALS_BASE_URL}/v2/tokens`
  const params = {
    search: searchTerm,
    networks: network ? [network] : [],
    platforms: ['basic', 'native'],
    sortBy: 'volumeUsd7d',
    limit: 10,
    sortDirection: 'desc',
  }

  const { data } = await axios.get<PortalsResponse>(tokensUrl, {
    paramsSerializer: params => qs.stringify(params, { arrayFormat: 'repeat' }),
    headers: {
      Authorization: `Bearer ${PORTALS_API_KEY}`,
    },
    params,
  })

  return {
    tokens: data.tokens ?? [],
    total: data.total,
  }
}
