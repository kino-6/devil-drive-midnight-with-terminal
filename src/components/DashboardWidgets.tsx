type LampTone = 'green' | 'red' | 'amber' | 'cyan';
type MeterTone = 'fuel' | 'armor' | 'signal' | 'ammo' | 'seammo';

export function StatusLamp({ label, active = false, tone = 'green' }: { label: string; active?: boolean; tone?: LampTone }) {
  return <span className={`status-lamp status-lamp--${tone} ${active ? 'is-active' : ''}`}>
    <span className="status-lamp__bulb" />
    <span>{label}</span>
  </span>;
}

export function ResourceMeter({ label, value, max, tone }: { label: string; value: number; max: number; tone: MeterTone }) {
  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const isLow = tone !== 'signal' && pct <= 35;
  const blockCount = Math.min(safeMax, 12);
  const filledBlocks = Math.round((pct / 100) * blockCount);
  const blocks = Array.from({ length: blockCount }, (_, index) => index < filledBlocks);
  return <div className={`resource-meter resource-meter--${tone} ${isLow ? 'resource-meter--low' : ''}`}>
    <div className="resource-meter__head">
      <span>{label.toUpperCase()}</span>
      <span>{String(Math.max(0, value)).padStart(2, '0')} / {String(safeMax).padStart(2, '0')}</span>
    </div>
    <div className="resource-meter__bar" aria-label={`${label} ${value} of ${safeMax}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
    <div className="resource-meter__blocks" aria-hidden="true">
      {blocks.map((filled, index) => <span key={index} className={filled ? 'is-filled' : ''} />)}
    </div>
  </div>;
}
