import type { GarageCard as GarageCardData } from '../../types';
import { fmt } from '../../lib/format';

interface GarageCardProps {
  card: GarageCardData;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onReopen: () => void;
  onListCar: () => void;
}

export default function GarageCard({
  card,
  selected,
  onToggle,
  onRemove,
  onReopen,
  onListCar,
}: GarageCardProps) {
  return (
    <div className={'gcard' + (selected ? ' sel' : '')}>
      <div className="gcard-check" onClick={onToggle}>
        {selected ? '✓' : ''}
      </div>
      <button className="gcard-del" title="remove" onClick={onRemove}>
        ×
      </button>
      <div className="gcard-veh">{card.label}</div>
      <div className="gcard-meta">{card.meta}</div>
      <div className="gcard-est">{fmt(card.estimate)}</div>
      <div className="gcard-band">
        band {fmt(card.low)}–{fmt(card.high)}
      </div>
      <div className="gcard-foot">
        <button onClick={onReopen}>↻ reopen report</button>
        <button onClick={onListCar}>List this car →</button>
      </div>
    </div>
  );
}
