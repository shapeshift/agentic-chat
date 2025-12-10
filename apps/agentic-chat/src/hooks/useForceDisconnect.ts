import { modal, useDisconnect } from '@reown/appkit/react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

export function useForceDisconnect() {
  const { disconnect } = useDisconnect()
  const queryClient = useQueryClient()

  const forceDisconnect = useCallback(
    async (reason?: string) => {
      // Clear cached data
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      void queryClient.invalidateQueries({ queryKey: ['approvedChains'] })
      void queryClient.invalidateQueries({ queryKey: ['wcSessionHealth'] })
      void queryClient.invalidateQueries({ queryKey: ['connectionType'] })

      // Show toast with reason and reconnect action
      toast.error(reason || 'Your wallet connection has expired. Please reconnect to continue.', {
        duration: 8000,
        action: {
          label: 'Reconnect',
          onClick: () => {
            void modal?.open()
          },
        },
      })

      try {
        await disconnect()
      } catch (error) {
        console.error('[ForceDisconnect] Failed to disconnect:', error)
      }
    },
    [disconnect, queryClient]
  )

  return { forceDisconnect }
}
