interface Chain {
  id: number;
  name: string;
}

interface ChainSelectProps {
  chains: Chain[];
  selectedChain: number;
  onChange: (chainId: number) => void;
}

const CHAIN_ICONS: Record<number, string> = {
  1: '⟠', // Ethereum
  42161: '🔷', // Arbitrum
  10: '🔴', // Optimism
  8453: '🔵', // Base
  137: '💜', // Polygon
  56: '🟡', // BSC
  43114: '🔺', // Avalanche
};

export function ChainSelect({ chains, selectedChain, onChange }: ChainSelectProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {chains.map((chain) => (
        <button
          key={chain.id}
          onClick={() => onChange(chain.id)}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: `2px solid ${selectedChain === chain.id ? 'var(--primary)' : 'var(--border)'}`,
            background: selectedChain === chain.id ? 'var(--primary)' : 'var(--bg-input)',
            color: 'var(--text)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.9rem',
          }}
        >
          <span>{CHAIN_ICONS[chain.id] || '🔗'}</span>
          <span>{chain.name}</span>
        </button>
      ))}
    </div>
  );
}
