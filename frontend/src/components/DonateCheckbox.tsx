interface DonateCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function DonateCheckbox({ checked, onChange }: DonateCheckboxProps) {
  return (
    <label
      className={`checkbox-wrapper ${checked ? 'active' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <input
        type="checkbox"
        className="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: checked ? 'var(--accent)' : 'var(--text)' }}>
          🦙 Donate to DefiLlama
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Support DefiLlama with your dust. <strong>0% fee</strong> - all proceeds go to the team.
        </div>
      </div>
    </label>
  );
}
