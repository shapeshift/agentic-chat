import React from 'react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { Button } from './ui/button';

export const ConnectWallet: React.FC = () => {
  const { connectors, connect, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{address}</span>
        <Button variant="ghost" size="icon" onClick={() => disconnect()} title="Disconnect">
          ×
        </Button>
      </div>
    );
  }

  // Just Rabby for testing
  const _connectors = connectors.filter((c => c.id === 'io.rabby'))

  return (
    <div className="flex gap-2">
      {_connectors.map((connector) => (
        <Button
          key={connector.id}
          variant="secondary"
          size="sm"
          onClick={() => connect({ connector })}
          className="mr-2"
        >
          {isPending ? 'Connecting...' : `Connect ${connector.name}`}
        </Button>
      ))}
    </div>
  );
};
