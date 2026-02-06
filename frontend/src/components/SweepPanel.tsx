import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { TokenList } from './TokenList';
import { ChainSelect } from './ChainSelect';
import { DonateCheckbox } from './DonateCheckbox';

interface SweepPanelProps {
  userAddress: `0x${string}`;
}

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
}

interface DustSummary {
  totalValueUsd: number;
  tokenCount: number;
  chainCount: number;
  balances: TokenBalance[];
  timestamp: number;
}

interface SweepQuote {
  quoteId: string;
  totalInputValueUsd: number;
  estimatedOutputAmountFormatted: string;
  estimatedOutputValueUsd: number;
  feePercent: number;
  feeAmountUsd: number;
  isDonation: boolean;
  recipient: string;
  expiresAt: number;
}

const CHAINS = [
  { id: 1, name: 'Ethereum' },
  { id: 42161, name: 'Arbitrum' },
  { id: 10, name: 'Optimism' },
  { id: 8453, name: 'Base' },
  { id: 137, name: 'Polygon' },
  { id: 56, name: 'BSC' },
  { id: 43114, name: 'Avalanche' },
];

const DESTINATION_TOKENS: Record<number, { address: string; symbol: string }[]> = {
  1: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH' },
  ],
  42161: [
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH' },
  ],
  10: [
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH' },
  ],
  8453: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH' },
  ],
  137: [
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'MATIC' },
  ],
  56: [
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'BNB' },
  ],
  43114: [
    { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC' },
    { address: '0x0000000000000000000000000000000000000000', symbol: 'AVAX' },
  ],
};

async function fetchBalances(address: string): Promise<DustSummary> {
  const response = await fetch(`/api/balances/${address}`);
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

async function fetchQuote(params: {
  userAddress: string;
  destinationChainId: number;
  destinationToken: string;
  donateToDefillama: boolean;
}): Promise<SweepQuote> {
  const response = await fetch('/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export function SweepPanel({ userAddress }: SweepPanelProps) {
  const [destinationChain, setDestinationChain] = useState(1);
  const [destinationToken, setDestinationToken] = useState(DESTINATION_TOKENS[1][0].address);
  const [donateToDefillama, setDonateToDefillama] = useState(false);
  const [showQuote, setShowQuote] = useState(false);

  // Fetch dust balances
  const {
    data: dustSummary,
    isLoading: isLoadingBalances,
    error: balancesError,
    refetch: refetchBalances,
  } = useQuery({
    queryKey: ['balances', userAddress],
    queryFn: () => fetchBalances(userAddress),
    enabled: !!userAddress,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch quote
  const {
    data: quote,
    isLoading: isLoadingQuote,
    error: quoteError,
    refetch: refetchQuote,
  } = useQuery({
    queryKey: ['quote', userAddress, destinationChain, destinationToken, donateToDefillama],
    queryFn: () =>
      fetchQuote({
        userAddress,
        destinationChainId: destinationChain,
        destinationToken,
        donateToDefillama,
      }),
    enabled: showQuote && !!dustSummary && dustSummary.tokenCount > 0,
  });

  const handleChainChange = (chainId: number) => {
    setDestinationChain(chainId);
    setDestinationToken(DESTINATION_TOKENS[chainId][0].address);
    setShowQuote(false);
  };

  const handleGetQuote = () => {
    setShowQuote(true);
    refetchQuote();
  };

  const handleSweep = async () => {
    // In production: sign EIP-7702 authorization and submit to solver
    alert('Sweep execution not yet implemented. Quote ID: ' + quote?.quoteId);
  };

  const selectedTokenSymbol = DESTINATION_TOKENS[destinationChain]?.find(
    (t) => t.address === destinationToken
  )?.symbol;

  return (
    <>
      {/* Dust Summary */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Your Dust</span>
          <button className="btn btn-secondary" onClick={() => refetchBalances()}>
            Refresh
          </button>
        </div>

        {isLoadingBalances && (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        )}

        {balancesError && (
          <div className="error">Failed to load balances: {(balancesError as Error).message}</div>
        )}

        {dustSummary && (
          <>
            <div className="summary-row">
              <span className="summary-label">Total Dust Value</span>
              <span className="summary-value accent">${dustSummary.totalValueUsd.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Tokens Found</span>
              <span className="summary-value">{dustSummary.tokenCount}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Across Chains</span>
              <span className="summary-value">{dustSummary.chainCount}</span>
            </div>

            {dustSummary.tokenCount > 0 && (
              <div style={{ marginTop: '16px' }}>
                <TokenList balances={dustSummary.balances} />
              </div>
            )}

            {dustSummary.tokenCount === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                No dust found. Balances under $10 will appear here.
              </div>
            )}
          </>
        )}
      </div>

      {/* Destination Selection */}
      {dustSummary && dustSummary.tokenCount > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Destination</span>
          </div>

          <div className="form-group">
            <label className="form-label">Chain</label>
            <ChainSelect
              chains={CHAINS}
              selectedChain={destinationChain}
              onChange={handleChainChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Token</label>
            <select
              className="select"
              value={destinationToken}
              onChange={(e) => {
                setDestinationToken(e.target.value);
                setShowQuote(false);
              }}
            >
              {DESTINATION_TOKENS[destinationChain]?.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>

          <DonateCheckbox
            checked={donateToDefillama}
            onChange={(checked) => {
              setDonateToDefillama(checked);
              setShowQuote(false);
            }}
          />

          <button
            className="btn btn-primary btn-full"
            onClick={handleGetQuote}
            disabled={isLoadingQuote}
            style={{ marginTop: '16px' }}
          >
            {isLoadingQuote ? 'Getting Quote...' : 'Get Quote'}
          </button>
        </div>
      )}

      {/* Quote Display */}
      {quote && showQuote && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Quote</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">You Send</span>
            <span className="summary-value">${quote.totalInputValueUsd.toFixed(2)} in dust</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">You Receive</span>
            <span className="summary-value accent">
              {quote.estimatedOutputAmountFormatted} {selectedTokenSymbol}
            </span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Estimated Value</span>
            <span className="summary-value">${quote.estimatedOutputValueUsd.toFixed(2)}</span>
          </div>

          <div className="summary-row">
            <span className="summary-label">Fee</span>
            <span className={`summary-value ${quote.isDonation ? 'accent' : 'warning'}`}>
              {quote.feePercent}% (${quote.feeAmountUsd.toFixed(2)})
            </span>
          </div>

          {quote.isDonation && (
            <div className="success" style={{ marginTop: '16px' }}>
              Thank you for donating to DefiLlama! 0% fee applied.
            </div>
          )}

          <button
            className="btn btn-accent btn-full"
            onClick={handleSweep}
            style={{ marginTop: '16px' }}
          >
            {quote.isDonation ? 'Donate & Sweep' : 'Sweep Now'}
          </button>

          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: '12px',
            }}
          >
            Quote expires in{' '}
            {Math.max(0, Math.floor((quote.expiresAt - Date.now()) / 1000))}s
          </p>
        </div>
      )}

      {quoteError && showQuote && (
        <div className="card">
          <div className="error">Failed to get quote: {(quoteError as Error).message}</div>
        </div>
      )}
    </>
  );
}
