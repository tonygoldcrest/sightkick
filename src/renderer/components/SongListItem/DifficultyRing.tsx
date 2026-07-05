import { times } from 'es-toolkit/compat';

export function DifficultyRing({ value }: { value: number }) {
  const size = 44;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 15;
  const innerR = 11;
  const count = 5;
  const gapDeg = 6;
  const segDeg = (360 - gapDeg * count) / count;
  const toXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;

    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const segments = times(count, (i) => {
    const startAngle = -90 + i * (segDeg + gapDeg);
    const endAngle = startAngle + segDeg;
    const o1 = toXY(startAngle, outerR);
    const o2 = toXY(endAngle, outerR);
    const i1 = toXY(startAngle, innerR);
    const i2 = toXY(endAngle, innerR);
    const large = segDeg > 180 ? 1 : 0;

    return (
      <path
        key={i}
        d={`M ${o1.x} ${o1.y} A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y} L ${i2.x} ${i2.y} A ${innerR} ${innerR} 0 ${large} 0 ${i1.x} ${i1.y} Z`}
        fill={i < value ? 'var(--color-accent)' : 'var(--color-surface-sunken)'}
      />
    );
  });

  return (
    <svg width={size} height={size}>
      {segments}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-text-muted)"
        fontSize="12"
        fontFamily="var(--font-ui)"
        fontWeight="600"
      >
        {value}
      </text>
    </svg>
  );
}
