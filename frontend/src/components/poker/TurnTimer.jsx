import { useEffect, useRef, useState } from 'react';

export function TurnTimer({ deadline, now = Date.now }) {
  const remaining = () => Math.max(0, Math.ceil(((deadline ?? now()) - now()) / 1_000));
  const [seconds, setSeconds] = useState(remaining);
  const announced = useRef(false);

  useEffect(() => {
    setSeconds(remaining());
    announced.current = false;
    if (!deadline) return undefined;
    const timer = setInterval(() => setSeconds(remaining()), 250);
    return () => clearInterval(timer);
  }, [deadline]);

  const urgent = seconds <= 5;
  const announcement = urgent && !announced.current ? '还剩 5 秒' : '';
  if (urgent) announced.current = true;
  return (
    <div className={`turn-timer ${urgent ? 'is-urgent' : ''}`} aria-label={`行动时间剩余 ${seconds} 秒`}>
      <span>{seconds}</span><small>秒</small>
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
