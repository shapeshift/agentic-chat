import React from 'react';

interface SwapConfirmProps {
  quote: any;
  llmMessage?: string;
}

export const SwapConfirm: React.FC<SwapConfirmProps> = ({ quote, llmMessage }) => (
  <div className="p-4 border rounded bg-muted">
    {llmMessage && <div className="mb-4 whitespace-pre-line">{llmMessage}</div>}
    <div className="flex gap-2 mt-4">
      <button
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
        onClick={() => console.log('Approve Swap:', quote)}
      >
        Approve Swap
      </button>
      <button
        className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded border border-red-300 transition-colors"
        onClick={() => console.log('Cancel Swap')}
      >
        Cancel
      </button>
    </div>
  </div>
); 