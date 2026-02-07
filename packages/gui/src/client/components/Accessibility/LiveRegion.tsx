import { memo, useEffect, useState } from 'react';

interface LiveRegionProps {
  message: string;
  role?: 'status' | 'alert' | 'log';
  clearAfter?: number;
}

function LiveRegionComponent({ message, role = 'status', clearAfter = 5000 }: LiveRegionProps) {
  const [current, setCurrent] = useState(message);

  useEffect(() => {
    setCurrent(message);
    if (clearAfter > 0 && message) {
      const timer = setTimeout(() => setCurrent(''), clearAfter);
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div aria-live={role === 'alert' ? 'assertive' : 'polite'} aria-atomic="true" role={role} className="sr-only">
      {current}
    </div>
  );
}

export const LiveRegion = memo(LiveRegionComponent);
