import { HelpCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { TourId } from '../../lib/tours';

/** Small replay button placed in each module header. */
export default function TourButton({ id, label = '功能引导' }: { id: TourId; label?: string }) {
  const startTour = useStore(s => s.startTour);
  return (
    <button
      className="btn btn-icon btn-ghost btn-xs tour-replay"
      title={label}
      aria-label={label}
      onClick={() => startTour(id)}
    >
      <HelpCircle size={13} />
    </button>
  );
}
