import { makeAssistantToolUI } from "@assistant-ui/react";

// Types for bebopRate tool args and result
export type BebopRateArgs = {
  chain: string;
  fromAsset: {
    address: string;
    decimals: number;
    symbol?: string;
  };
  toAsset: {
    address: string;
    decimals: number;
    symbol: string;
  };
  sellAmountCryptoPrecision: string;
  fromAddress: string;
};

export type BebopRateResult = {
  sellAmountCryptoPrecision: string;
  buyAmountCryptoPrecision: string;
  sellAsset: {
    symbol: string;
  };
  buyAsset: {
    symbol: string;
  };
  approvalTarget: string;
};

const BebopQuoteUI = makeAssistantToolUI<BebopRateArgs, BebopRateResult>({
  toolName: "bebopRate",
  render: ({ args, result }) => {
    console.log({result})
    if (!result) return null;
    return (
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 32,
          maxWidth: 400,
          margin: "0 auto",
          boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
        }}
      >
        <h2 style={{ textAlign: "center", fontWeight: 700, marginBottom: 32 }}>
          Confirm Trade
        </h2>
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: "#888", fontWeight: 500, marginBottom: 8 }}>
            Sell Amount
          </div>
          <div
            style={{
              background: "#f5f5f5",
              borderRadius: 8,
              padding: "16px 20px",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#aaa",
            }}
          >
            <span>{result.sellAmountCryptoPrecision}</span>
            <span style={{ color: "#444", fontWeight: 600 }}>
              {result.sellAsset.symbol}
            </span>
          </div>
        </div>
        <div>
          <div style={{ color: "#888", fontWeight: 500, marginBottom: 8 }}>
            Buy Amount
          </div>
          <div
            style={{
              background: "#f5f5f5",
              borderRadius: 8,
              padding: "16px 20px",
              fontSize: 20,
              color: "#aaa",
            }}
          >
            <span>
              {result.buyAmountCryptoPrecision} {result.buyAsset.symbol}
            </span>
          </div>
        </div>
      </div>
    );
  },
});

export default BebopQuoteUI;
