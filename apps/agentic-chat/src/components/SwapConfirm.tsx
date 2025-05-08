import React, { useEffect, useMemo } from 'react';
import { useAccount, useSendTransaction, useReadContract } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { erc20Abi, encodeFunctionData, getAddress } from 'viem';
import { AIMessage } from '@langchain/core/messages';
import { BebopQuote } from '../../../../tools/src/lib/types';

type SwapConfirmProps = {
  quote: BebopQuote,
  llmMessage?: string,
  onSwapComplete?: (message: AIMessage) => void
}

export const SwapConfirm: React.FC<SwapConfirmProps> = ({ quote, llmMessage, onSwapComplete }) => {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const { sendTransaction: sendApproval, isPending: isApprovalPending, isSuccess: isApprovalSuccess } = useSendTransaction();
  const { sendTransaction: sendSwap, isPending: isSwapPending, isSuccess: isSwapSuccess, isError: isSwapError, error: swapError, data: swapData } = useSendTransaction();

  const { data: allowance, isLoading: isAllowanceLoading } = useReadContract({
    address: getAddress(Object.keys(quote?.sellTokens)[0]),
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address as `0x${string}`, quote?.approvalTarget as `0x${string}`],
  });

  const needsApproval = useMemo(() => {
  if (isAllowanceLoading) return false

  return BigInt(allowance ?? 0n) < BigInt((Object.values(quote?.sellTokens)[0].amount));
  }, [allowance, quote, isAllowanceLoading]);


  const handleApprove = async () => {
    if (!quote || !address) return;

    try {
      const approvalData = {
        to: getAddress(Object.keys(quote?.sellTokens)[0]),
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [quote.approvalTarget as `0x${string}`, BigInt((Object.values(quote?.sellTokens)[0].amount))],
          }),
      };

      sendApproval(approvalData);
    } catch (error) {
      console.error('Approval error:', error);
    }
  };

  const handleSwap = async () => {
    if (!quote || !address) return;
    const tx = quote?.tx;
    if (!tx) return;

    sendSwap({
      to: tx.to as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value),
    });
  };

  useEffect(() => {
    if (isApprovalSuccess) {
      // Invalidate the allowance query to trigger a refetch
      queryClient.invalidateQueries({
        queryKey: ['readContract', {
          address: quote?.sellTokens?.[0]?.address,
          functionName: 'allowance',
          args: [address, quote?.approvalTarget],
        }],
      });
    }
  }, [isApprovalSuccess, queryClient, quote, address]);

  useEffect(() => {
    if (isSwapSuccess && swapData && onSwapComplete) {
      const message = new AIMessage({
        content: `Swap completed successfully! Transaction hash: ${swapData}`,
        additional_kwargs: {
          swapData: {
            hash: swapData,
            from: quote.sellTokens[0].symbol,
            to: quote.buyTokens[0].symbol,
            amount: quote.sellTokens[0].amount,
            received: quote.buyTokens[0].amount,
          }
        }
      });
      onSwapComplete(message);
    }
  }, [isSwapSuccess, swapData, onSwapComplete, quote]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-100 rounded-lg">
      <div className="text-sm text-gray-600">{llmMessage}</div>

      {needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={isApprovalPending}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {isApprovalPending ? 'Approving...' : 'Approve Token'}
        </button>
      ) : (
        <button
          onClick={handleSwap}
          disabled={isSwapPending}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          {isSwapPending ? 'Swapping...' : 'Confirm Swap'}
        </button>
      )}

      {isApprovalSuccess && (
        <div className="text-green-600">Token approved successfully!</div>
      )}

      {isSwapSuccess && (
        <div className="text-green-600">Swap completed successfully!</div>
      )}

      {isSwapError && (
        <div className="text-red-600">Error: {swapError?.message}</div>
      )}
    </div>
  );
};
