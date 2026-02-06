interface TokenBalance {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  priceUsd: number;
  valueUsd: number;
  logoUrl?: string;
}

interface TokenListProps {
  balances: TokenBalance[];
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  42161: 'Arbitrum',
  10: 'Optimism',
  8453: 'Base',
  137: 'Polygon',
  56: 'BSC',
  43114: 'Avalanche',
};

const CHAIN_COLORS: Record<number, string> = {
  1: '#627EEA',
  42161: '#28A0F0',
  10: '#FF0420',
  8453: '#0052FF',
  137: '#8247E5',
  56: '#F3BA2F',
  43114: '#E84142',
};

export function TokenList({ balances }: TokenListProps) {
  if (balances.length === 0) {
    return null;
  }

  return (
    <div className="token-list">
      {balances.map((token, index) => (
        <div key={`${token.chainId}-${token.address}-${index}`} className="token-item">
          <div className="token-info">
            <div
              className="token-icon"
              style={{
                background: `linear-gradient(135deg, ${CHAIN_COLORS[token.chainId] || '#666'}, #333)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              {token.symbol.slice(0, 2)}
            </div>
            <div className="token-details">
              <span className="token-symbol">{token.symbol}</span>
              <span className="token-chain">{CHAIN_NAMES[token.chainId] || `Chain ${token.chainId}`}</span>
            </div>
          </div>
          <div className="token-value">
            <div className="token-amount">
              {parseFloat(token.balanceFormatted).toFixed(4)}
            </div>
            <div className="token-usd">${token.valueUsd.toFixed(2)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
