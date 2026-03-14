import { useEffect, type ReactNode } from 'react';
import { RULES_SECTIONS, TURN_STEPS } from '../content/rulesContent';

interface RulesModalProps {
  onClose: () => void;
}

/** Simple formatter: **bold** and line breaks */
function formatRuleText(text: string): ReactNode[] {
  const parts: React.ReactNode[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) parts.push(<br key={`br-${i}`} />);
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let m;
    const lineParts: React.ReactNode[] = [];
    while ((m = boldRegex.exec(line)) !== null) {
      if (m.index > lastIndex) {
        lineParts.push(line.slice(lastIndex, m.index));
      }
      lineParts.push(<strong key={m.index}>{m[1]}</strong>);
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < line.length) {
      lineParts.push(line.slice(lastIndex));
    }
    parts.push(<span key={i}>{lineParts.length > 0 ? lineParts : line}</span>);
  });
  return parts;
}

export function RulesModal({ onClose }: RulesModalProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="rules-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
    >
      <div className="rules-modal">
        <div className="rules-modal-header">
          <h2 id="rules-title">📜 How to Play</h2>
          <button
            type="button"
            className="rules-close-btn"
            onClick={onClose}
            aria-label="Close rules"
          >
            ✕
          </button>
        </div>

        <div className="rules-modal-body">
          {/* Visual: How a turn works */}
          <section className="rules-section rules-visual">
            <h3>🔄 How a Turn Works</h3>
            <div className="turn-steps">
              {TURN_STEPS.map(({ step, icon, text }) => (
                <div key={step} className="turn-step">
                  <span className="turn-step-num">{step}</span>
                  <span className="turn-step-icon">{icon}</span>
                  <span className="turn-step-text">{text}</span>
                  {step < TURN_STEPS.length && (
                    <span className="turn-step-arrow">→</span>
                  )}
                </div>
              ))}
            </div>
            <div className="rules-mini-legend">
              <span>🏠</span> house
              <span>🍬</span> candy
              <span>👻</span> monster
              <span>🎁</span> item
              <span>🏚️</span> mansion
            </div>
          </section>

          {/* Written rules sections */}
          {RULES_SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="rules-section"
            >
              <h3>
                <span className="rules-section-icon">{section.icon}</span>
                {section.title}
              </h3>
              <div className="rules-section-content">
                {formatRuleText(section.content)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
