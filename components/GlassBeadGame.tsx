
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Orb, Word, LinePath, Particle, CenterOrbState, Point, CenterOrbColor } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PALETTE, WORD_LIST, CENTER_ORB_RADIUS, SOURCE_ORB_RADIUS } from '../constants';
import { distance, distToSegment, getPointOnPath } from '../utils/physics';

const GlassBeadGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Game State ---
  const [sourceOrbs, setSourceOrbs] = useState<Orb[]>([]);
  const [activeOrb, setActiveOrb] = useState<Orb | null>(null);
  // We don't need deep React state for high-freq animation objects, 
  // but we keep sourceOrbs in state for interactivity.
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
  
  // Refs for animation loop
  const stateRef = useRef({
    words: [] as Word[],
    lines: [] as LinePath[],
    particles: [] as Particle[],
    centerOrb: { colors: [], scale: 1 } as CenterOrbState,
    time: 0,
    attractors: [{x: 0, y: 0}, {x: 0, y: 0}, {x: 0, y: 0}] // For chaotic motion
  });

  // --- Initialization ---
  useEffect(() => {
    // Initialize Source Orbs
    const newSourceOrbs: Orb[] = PALETTE.orbs.map((color, index) => ({
      id: `source-${index}`,
      color,
      x: (CANVAS_WIDTH / 2) - ((PALETTE.orbs.length * 60) / 2) + (index * 60) + 30,
      y: CANVAS_HEIGHT - 60,
      radius: SOURCE_ORB_RADIUS,
      isDragging: false,
      baseX: (CANVAS_WIDTH / 2) - ((PALETTE.orbs.length * 60) / 2) + (index * 60) + 30,
      baseY: CANVAS_HEIGHT - 60,
    }));
    setSourceOrbs(newSourceOrbs);

    // Initialize Words with chaotic offsets
    const initialWords: Word[] = WORD_LIST.map((text, i) => ({
      id: `word-${i}`,
      text,
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT * 0.7,
      vx: 0,
      vy: 0,
      radius: 30,
      isCaught: false,
      opacity: 0,
      tOffset: Math.random() * 1000
    }));
    stateRef.current.words = initialWords;

    // Initialize Background Particles
    const initialParticles: Particle[] = [];
    for(let i=0; i<60; i++) {
        initialParticles.push(createParticle('background'));
    }
    stateRef.current.particles = initialParticles;

  }, []);

  const createParticle = (type: 'background' | 'negative' | 'sparkle' | 'trail', x?: number, y?: number, color?: string): Particle => {
    const isNegative = type === 'negative';
    const baseColor = color ?? (isNegative ? '#1a1a1a' : PALETTE.background[Math.floor(Math.random() * PALETTE.background.length)]);
    
    return {
      x: x ?? Math.random() * CANVAS_WIDTH,
      y: y ?? Math.random() * CANVAS_HEIGHT,
      vx: (Math.random() - 0.5) * (isNegative ? 0.5 : 0.2), // Slower, more floating
      vy: (Math.random() - 0.5) * (isNegative ? 0.5 : 0.2),
      life: 1.0,
      maxLife: 1.0 + Math.random(),
      size: isNegative ? Math.random() * 15 + 5 : Math.random() * 100 + 50,
      color: baseColor,
      type,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1
    };
  };

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // 1. Check Source Orbs
    const clickedSource = sourceOrbs.find(orb => distance({x, y}, {x: orb.x, y: orb.y}) < orb.radius * 2);
    if (clickedSource) {
      // Create a visual ripple at source to indicate "spawn"
      for(let i=0; i<5; i++) {
        stateRef.current.particles.push({
            ...createParticle('sparkle', clickedSource.x, clickedSource.y, clickedSource.color),
            size: 5,
            life: 0.5,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2
        });
      }

      setActiveOrb({
        ...clickedSource,
        id: `active-${Date.now()}`,
        x,
        y,
        isDragging: true
      });
      return;
    }

    // 2. Start Line
    setCurrentLine([{ x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (activeOrb) {
      setActiveOrb(prev => prev ? { ...prev, x, y } : null);
      return;
    }

    if (currentLine.length > 0) {
      const lastPoint = currentLine[currentLine.length - 1];
      if (distance(lastPoint, { x, y }) > 5) {
        const newLine = [...currentLine, { x, y }];
        setCurrentLine(newLine);
        checkWordIntersections(newLine);
      }
    }
  };

  const handleMouseUp = () => {
    if (activeOrb) {
      const distToCenter = distance(activeOrb, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
      
      if (distToCenter < CENTER_ORB_RADIUS + 20) {
        // Absorbed into center
        const newColorEntry: CenterOrbColor = {
          color: activeOrb.color,
          angle: Math.random() * Math.PI * 2,
          radius: Math.random() * (CENTER_ORB_RADIUS * 0.6),
          speed: (Math.random() - 0.5) * 0.05,
          blobSize: 40 + Math.random() * 40
        };
        stateRef.current.centerOrb.colors.push(newColorEntry);
        
        // Splash
        for(let i=0; i<30; i++) {
           stateRef.current.particles.push({
               ...createParticle('sparkle', activeOrb.x, activeOrb.y, activeOrb.color),
               vx: (Math.random() - 0.5) * 5,
               vy: (Math.random() - 0.5) * 5,
               size: Math.random() * 8 + 2
           });
        }
      } 
      setActiveOrb(null);
    }

    if (currentLine.length > 1) {
      const newLineObj: LinePath = {
        id: `line-${Date.now()}`,
        points: currentLine,
        color: PALETTE.line,
        timestamp: Date.now()
      };
      
      const updatedWords = stateRef.current.words.map(w => {
        if (w.isCaught && !w.caughtLineId) {
          return { ...w, caughtLineId: newLineObj.id, pathProgress: 0 };
        }
        return w;
      });
      stateRef.current.words = updatedWords;
      stateRef.current.lines.push(newLineObj);
    }
    setCurrentLine([]);
  };

  const checkWordIntersections = (points: Point[]) => {
    if (points.length < 2) return;
    const p1 = points[points.length - 2];
    const p2 = points[points.length - 1];

    stateRef.current.words = stateRef.current.words.map(word => {
      // Stage 2.2: Line crosses word
      const dist = distToSegment(word, p1, p2);
      if (dist < word.radius) {
        return { ...word, isCaught: true };
      }
      return word;
    });
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (canvasRef.current) {
        // Stage 2.4: Save effect
        for(let i=0; i<50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 200;
            stateRef.current.particles.push({
                ...createParticle('sparkle', CANVAS_WIDTH/2 + Math.cos(angle)*dist, CANVAS_HEIGHT/2 + Math.sin(angle)*dist, '#FFFFFF'),
                vx: Math.cos(angle) * 5,
                vy: Math.sin(angle) * 5,
                size: 5,
                life: 1.5
            });
        }

        const dataUrl = canvasRef.current.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `glasperlenspiel-breath-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
    }
  };

  // --- Main Render Loop ---

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Trail effect (Stage 1.2)
    ctx.fillStyle = 'rgba(5, 5, 16, 0.25)'; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    stateRef.current.time += 0.005;
    const t = stateRef.current.time;

    // Update Attractors (Stage 2.1 - chaotic motion)
    stateRef.current.attractors = [
        { x: CANVAS_WIDTH/2 + Math.cos(t) * 300, y: CANVAS_HEIGHT/2 + Math.sin(t * 0.7) * 200 },
        { x: CANVAS_WIDTH/2 + Math.cos(t + 2) * 400, y: CANVAS_HEIGHT/2 + Math.sin(t * 1.3 + 1) * 300 },
        { x: CANVAS_WIDTH/2 + Math.cos(t * 0.5 + 4) * 200, y: CANVAS_HEIGHT/2 + Math.sin(t * 0.9 + 2) * 400 }
    ];

    // 1. Draw Background Particles & Negative Particles
    stateRef.current.particles.forEach((p, index) => {
      p.life -= 0.005;

      if (p.type === 'background') {
        p.x += p.vx;
        p.y += p.vy;
        // Wrap around
        if (p.x < -p.size) p.x = CANVAS_WIDTH + p.size;
        if (p.x > CANVAS_WIDTH + p.size) p.x = -p.size;
        if (p.y < -p.size) p.y = CANVAS_HEIGHT + p.size;
        if (p.y > CANVAS_HEIGHT + p.size) p.y = -p.size;

        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(0, p.size));
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      } 
      else if (p.type === 'negative') {
        // Stage 3.1: More impactful negative particles
        // Jittery movement
        p.x += p.vx + (Math.random() - 0.5) * 2;
        p.y += p.vy + (Math.random() - 0.5) * 2;
        if(p.rotation !== undefined) p.rotation += p.rotationSpeed || 0;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        
        ctx.strokeStyle = `rgba(40, 40, 40, ${Math.max(0, p.life)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Spiky shape
        const spikes = 5;
        const outerRadius = Math.max(0, p.size);
        const innerRadius = Math.max(0, p.size / 3);
        for (let i = 0; i < spikes * 2; i++) {
             const r = i % 2 === 0 ? outerRadius : innerRadius;
             const a = (Math.PI * i) / spikes;
             ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = `rgba(20, 20, 20, ${Math.max(0, p.life * 0.8)})`;
        ctx.fill();
        ctx.restore();

        if (p.life <= 0) stateRef.current.particles.splice(index, 1);
      }
      else if (p.type === 'sparkle') {
          p.x += p.vx;
          p.y += p.vy;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.beginPath();
          // FIX: Clamp radius to 0 to prevent index size error
          ctx.arc(p.x, p.y, Math.max(0, p.size * p.life), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          if (p.life <= 0) stateRef.current.particles.splice(index, 1);
      }
    });

    // Spawn random negative particles
    if (Math.random() < 0.02) {
       stateRef.current.particles.push(createParticle('negative'));
    }

    // 2. Draw Center Orb (Stage 1.3)
    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const cOrb = stateRef.current.centerOrb;

    // Glass shell background
    ctx.beginPath();
    ctx.arc(cx, cy, CENTER_ORB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'; // Transparent initially
    ctx.fill();

    // Fluid colors inside
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, CENTER_ORB_RADIUS - 5, 0, Math.PI * 2);
    ctx.clip(); // Keep fluid inside

    // Composite colors
    cOrb.colors.forEach(col => {
      col.angle += col.speed;
      // Lissajous-like movement for organic feel
      const ox = cx + Math.cos(col.angle) * col.radius;
      const oy = cy + Math.sin(col.angle * 1.5) * col.radius;
      
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, col.blobSize);
      g.addColorStop(0, col.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.globalCompositeOperation = 'screen'; // Additive color mixing
      ctx.fillStyle = g;
      ctx.fillRect(cx - CENTER_ORB_RADIUS, cy - CENTER_ORB_RADIUS, CENTER_ORB_RADIUS * 2, CENTER_ORB_RADIUS * 2);
    });
    ctx.restore();

    // Glass reflections / rim
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(cx, cy, CENTER_ORB_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Highlight
    ctx.beginPath();
    ctx.ellipse(cx - CENTER_ORB_RADIUS*0.4, cy - CENTER_ORB_RADIUS*0.4, CENTER_ORB_RADIUS*0.2, CENTER_ORB_RADIUS*0.1, Math.PI/4, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();


    // 3. Draw Lines
    for (let i = stateRef.current.lines.length - 1; i >= 0; i--) {
      const line = stateRef.current.lines[i];
      const age = Date.now() - line.timestamp;
      
      if (age > 10000) { // Longer life
        // Line disappears, release words (Stage 2.3)
        stateRef.current.words.forEach(w => {
            if (w.caughtLineId === line.id) {
                w.isCaught = false;
                w.caughtLineId = undefined;
                // Special effect when released
                for(let k=0; k<5; k++) {
                   stateRef.current.particles.push(createParticle('sparkle', w.x, w.y, '#FFF'));
                }
            }
        });
        stateRef.current.lines.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 5;
      ctx.shadowColor = line.color;
      ctx.globalAlpha = Math.max(0, 1 - age / 10000);
      if (line.points.length > 0) {
        ctx.moveTo(line.points[0].x, line.points[0].y);
        for (let p of line.points) ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    if (currentLine.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = PALETTE.line;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = PALETTE.line;
      ctx.moveTo(currentLine[0].x, currentLine[0].y);
      for (let p of currentLine) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 4. Words
    stateRef.current.words.forEach(word => {
      if (word.opacity < 1) word.opacity += 0.01;

      if (word.isCaught && word.caughtLineId) {
        const line = stateRef.current.lines.find(l => l.id === word.caughtLineId);
        if (line) {
          word.pathProgress = (word.pathProgress || 0) + 0.003;
          if (word.pathProgress > 1) word.pathProgress = 0;
          const pos = getPointOnPath(line.points, word.pathProgress);
          word.x += (pos.x - word.x) * 0.2;
          word.y += (pos.y - word.y) * 0.2;
        } else {
             word.isCaught = false;
             word.caughtLineId = undefined;
        }
      } else {
        // Chaotic floating (Stage 2.1)
        // Sum of forces from attractors + noise
        let fx = 0, fy = 0;
        stateRef.current.attractors.forEach(att => {
            const dx = att.x - word.x;
            const dy = att.y - word.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d > 10) {
                fx += (dx / d) * 0.02;
                fy += (dy / d) * 0.02;
            }
        });

        // Perlin-ish noise using sin/cos of time and offset
        const noiseX = Math.cos(t * 0.5 + word.tOffset) * 0.3;
        const noiseY = Math.sin(t * 0.3 + word.tOffset) * 0.3;

        word.vx += fx + noiseX * 0.05;
        word.vy += fy + noiseY * 0.05;
        word.vx *= 0.96; // drag
        word.vy *= 0.96;

        word.x += word.vx;
        word.y += word.vy;

        // Soft Screen Boundaries
        const margin = 50;
        if (word.x < margin) word.vx += 0.05;
        if (word.x > CANVAS_WIDTH - margin) word.vx -= 0.05;
        if (word.y < margin) word.vy += 0.05;
        if (word.y > CANVAS_HEIGHT - margin) word.vy -= 0.05;
      }

      ctx.font = '16px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (word.isCaught) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FFFFFF';
        ctx.fillStyle = '#FFFFFF';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(224, 224, 224, ${word.opacity})`;
      }
      ctx.fillText(word.text, word.x, word.y);
      ctx.shadowBlur = 0;
    });

    // 5. Source Orbs
    sourceOrbs.forEach(orb => {
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fillStyle = orb.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = orb.color;
      ctx.fill();
      // Ring
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // 6. Active Orb
    if (activeOrb) {
      ctx.beginPath();
      ctx.arc(activeOrb.x, activeOrb.y, activeOrb.radius, 0, Math.PI * 2);
      ctx.fillStyle = activeOrb.color;
      ctx.shadowBlur = 25;
      ctx.shadowColor = activeOrb.color;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(render);
  }, [sourceOrbs, activeOrb, currentLine]);

  useEffect(() => {
    const animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [render]);

  return (
    <div 
        ref={containerRef}
        className="relative w-full h-screen bg-[#050510] cursor-crosshair overflow-hidden touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onContextMenu={handleRightClick}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block"
      />
      <div className="absolute top-4 left-4 text-white/40 text-xs font-light pointer-events-none select-none">
        <h1 className="text-xl text-white/70 mb-2 tracking-[0.2em] uppercase">Glasperlenspiel</h1>
        <p>1. Drag Colors to Center</p>
        <p>2. Weave Lines & Catch Words</p>
        <p>3. Right Click to Save</p>
      </div>
    </div>
  );
};

export default GlassBeadGame;
