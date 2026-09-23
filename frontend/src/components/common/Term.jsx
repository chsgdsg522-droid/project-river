import { useId } from 'react';
import { TERMS } from '../../lib/terms.js';

export function Term({ id, compact = false, className = '' }) {
  const descriptionId = useId();
  const term = TERMS[id];
  if (!term) return null;
  const [chinese, international] = term;

  if (compact) {
    return (
      <span className={className} aria-describedby={descriptionId}>
        {chinese}
        <span id={descriptionId} className="sr-only">{international}</span>
      </span>
    );
  }

  return (
    <span className={`term ${className}`.trim()}>
      <span className="term__zh">{chinese}</span>
      <span className="term__en" lang="en">{international}</span>
    </span>
  );
}
