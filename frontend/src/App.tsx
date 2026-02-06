import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { SweepPanel } from './components/SweepPanel';

function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <h1 className="header-title">LlamaSweep</h1>
        <p className="header-subtitle">Consolidate dust across all chains in one click</p>
      </header>

      {/* Wallet Connection */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Wallet</span>
          {isConnected && (
            <button className="btn btn-secondary" onClick={() => disconnect()}>
              Disconnect
            </button>
          )}
        </div>

        {!isConnected ? (
          <div className="connect-prompt">
            <div className="connect-icon">🦙</div>
            <p className="connect-text">Connect your wallet to scan for dust</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  className="btn btn-primary"
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                >
                  {connector.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="summary-row">
              <span className="summary-label">Connected</span>
              <span className="summary-value">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sweep Panel */}
      {isConnected && address && <SweepPanel userAddress={address} />}

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
        <p>Powered by DefiLlama</p>
        <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>
          Standard fee: 10% | Donate to DefiLlama: 0%
        </p>
      </footer>
    </div>
  );
}

export default App;
