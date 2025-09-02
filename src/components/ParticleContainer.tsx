import React, { useEffect, useRef } from 'react';
import './ParticleContainer.css';

interface ParticleContainerProps {
  particles: { id: number; x: number; y: number; burstX: number; burstY: number }[];
}

const ParticleContainer: React.FC<ParticleContainerProps> = ({ particles }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div id="particle-container" ref={containerRef}>
      {particles.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            '--burst-x': `${p.burstX}px`,
            '--burst-y': `${p.burstY}px`,
          } as React.CSSProperties}
        ></div>
      ))}
    </div>
  );
};

export default ParticleContainer;
