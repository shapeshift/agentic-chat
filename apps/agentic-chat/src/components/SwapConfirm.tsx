import React from 'react';
import { useAccount, useSendTransaction } from 'wagmi';
import { BebopQuote } from '../../../../tools/src/lib/types';
import { hexToBigInt,  } from 'viem';

interface SwapConfirmProps {
  quote: BebopQuote;
  llmMessage?: string;
}

export const SwapConfirm: React.FC<SwapConfirmProps> = ({ quote, llmMessage }) => {
  const { address } = useAccount();
  const { sendTransaction, isPending, isSuccess, isError, error, data } = useSendTransaction();

  const handleApprove = () => {
    if (!quote || !address) return;
    const tx = quote?.tx;
    if (!tx) return;
    sendTransaction({
      to: tx.to,
      data: tx.data,
      value: hexToBigInt(tx.value),
      chainId: tx.chainId,
    });
  };

  return (
    <div className="p-4 border rounded bg-muted">
      {llmMessage && <div className="mb-4 whitespace-pre-line">{llmMessage}</div>}
      <div className="flex gap-2 mt-4">
        <button
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
          onClick={handleApprove}
          disabled={isPending || !address}
        >
          {isPending ? 'Sending...' : isSuccess ? 'Swap Sent!' : 'Approve Swap'}
        </button>
        <button
          className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded border border-red-300 transition-colors"
          onClick={() => console.log('Cancel Swap')}
          disabled={isPending}
        >
          Cancel
        </button>
      </div>
      {isError && (
        <div className="mt-2 text-red-600 text-sm">{error?.message || 'Transaction failed.'}</div>
      )}
      {isSuccess && data && (
        <div className="mt-2 text-green-600 text-sm">
          Transaction sent!{' '}
          <a
            href={`https://etherscan.io/tx/${data.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on Etherscan
          </a>
        </div>
      )}
    </div>
  );
};
