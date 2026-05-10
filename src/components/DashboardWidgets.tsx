type LampTone = 'green' | 'red' | 'amber' | 'cyan';
type MeterTone = 'fuel' | 'armor' | 'signal' | 'ammo' | 'seammo';

export function StatusLamp({ label, active = false, tone = 'green' }: { label: string; active?: boolean; tone?: LampTone }) {
  return <span className={`status-lamp status-lamp--${tone} ${active ? 'is-active' : ''}`}>
    <span className="status-lamp__bulb" />
    <span>{label}</span>
  </span>;
}

export function ResourceMeter({
  label,
  value,
  max,
  tone,
  description,
}: {
  label: string;
  value: number;
  max: number;
  tone: MeterTone;
  description?: string;
}) {
  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const isLow = tone !== 'signal' && pct <= 35;
  const blockCount = Math.min(12, safeMax);
  const filledBlocks = Math.min(blockCount, Math.max(0, value));
  const blocks = Array.from({ length: blockCount }, (_, index) => index < filledBlocks);
  const meterLabel = description ? `${label}: ${description}` : `${label} ${value} of ${safeMax}`;
  return <div className={`resource-meter resource-meter--${tone} ${isLow ? 'resource-meter--low' : ''}`} title={description}>
    <div className="resource-meter__head">
      <span>{label.toUpperCase()}</span>
      <span>{String(Math.max(0, value)).padStart(2, '0')} / {String(safeMax).padStart(2, '0')}</span>
    </div>
    <div className="resource-meter__bar" aria-label={meterLabel}>
      <span style={{ width: `${pct}%` }} />
    </div>
    <div className="resource-meter__blocks" aria-hidden="true">
      {blocks.map((filled, index) => <span key={index} className={filled ? 'is-filled' : ''} />)}
    </div>
    {description && <p className="resource-meter__hint">{description}</p>}
  </div>;
}
