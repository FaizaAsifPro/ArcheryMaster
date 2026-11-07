import React, { useRef, useEffect, useCallback } from 'react';
import { Arrow, Difficulty, DIFFICULTY_CONFIGS, FloatingText, Particle, Target } from '../types/game';
import { soundManager } from '../utils/audio';

interface ArcheryCanvasProps {
  difficulty: Difficulty;
  round: number;
  score: number;
  arrowsRemaining: number;
  streak: number;
  onArrowShot: () => void;
  onScoreEarned: (points: number, hitType: 'bullseye' | 'hit' | 'outer' | 'bonus' | 'miss') => void;
  onRoundComplete: () => void;
  isPaused: boolean;
}

export const ArcheryCanvas: React.FC<ArcheryCanvasProps> = ({
  difficulty,
  round,
  arrowsRemaining,
  streak,
  onArrowShot,
  onScoreEarned,
  onRoundComplete,
  isPaused,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game internal state stored in refs to avoid React re-render lag in the 60fps loop
  const gameStateRef = useRef({
    bowX: 130,
    bowY: 380,
    isPulling: false,
    pullStartX: 0,
    pullStartY: 0,
    pullCurrentX: 0,
    pullCurrentY: 0,
    pullTension: 0, // 0 to 1
    aimAngle: 0,
    wind: 0, // m/s
    windGustTimer: 0,
    targetWind: 0,
    arrows: [] as Arrow[],
    activeArrow: null as Arrow | null,
    targets: [] as Target[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    ambientLeaves: [] as { x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; size: number }[],
    flagWave: 0,
    screenShake: 0,
    nextId: 1,
    time: 0,
    roundCompletedTriggered: false,
  });

  const config = DIFFICULTY_CONFIGS[difficulty];

  // Helper to generate a new wind value
  const generateNewWind = useCallback(() => {
    const max = config.maxWind;
    if (max <= 0.1) return 0;
    // Weighted wind
    return Math.round((Math.random() * 2 - 1) * max * 10) / 10;
  }, [config.maxWind]);

  // Spawn targets for the current round
  const setupRoundTargets = useCallback(() => {
    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 1200;
    const height = canvas ? canvas.height : 675;

    const baseDistance = width * (0.65 + config.distanceMultiplier * 0.22);
    const mainTargetX = Math.min(width - 120, baseDistance);
    const mainTargetY = height * 0.52;

    const newTargets: Target[] = [
      {
        id: 'main-target',
        x: mainTargetX,
        y: mainTargetY,
        baseY: mainTargetY,
        radius: config.targetRadius,
        speed: config.targetSpeed,
        amplitude: 80 + round * 12,
        phase: 0,
        type: 'standard',
        pointsMultiplier: 1,
        active: true,
      },
    ];

    // Optional bonus apple or balloon based on round / difficulty
    if (Math.random() < config.bonusAppleChance + round * 0.08) {
      const bonusType = Math.random() > 0.4 ? 'apple' : 'balloon';
      const bonusX = mainTargetX - 90 - Math.random() * 80;
      const bonusY = height * 0.35 + Math.random() * (height * 0.3);
      newTargets.push({
        id: 'bonus-target',
        x: bonusX,
        y: bonusY,
        baseY: bonusY,
        radius: bonusType === 'apple' ? 18 : 24,
        speed: config.targetSpeed * 0.8 + 25,
        amplitude: 50,
        phase: Math.PI / 2,
        type: bonusType,
        pointsMultiplier: 1.5,
        active: true,
      });
    }

    gameStateRef.current.targets = newTargets;
    gameStateRef.current.wind = generateNewWind();
    gameStateRef.current.targetWind = gameStateRef.current.wind;
    gameStateRef.current.roundCompletedTriggered = false;
  }, [config, round, generateNewWind]);

  // Initialize targets when round or difficulty changes
  useEffect(() => {
    setupRoundTargets();
    gameStateRef.current.arrows = [];
    gameStateRef.current.activeArrow = null;
    gameStateRef.current.floatingTexts = [];
    gameStateRef.current.particles = [];
  }, [difficulty, round, setupRoundTargets]);

  // Ambient particles (wind leaves)
  useEffect(() => {
    const leaves = [];
    for (let i = 0; i < 20; i++) {
      leaves.push({
        x: Math.random() * 1200,
        y: Math.random() * 600,
        vx: 1 + Math.random() * 2,
        vy: 0.5 + Math.random() * 0.8,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        size: 3 + Math.random() * 4,
      });
    }
    gameStateRef.current.ambientLeaves = leaves;
  }, []);

  // Spawn visual particles
  const addParticles = (x: number, y: number, color: string, count: number, shape: 'circle' | 'spark' | 'splinter' = 'circle') => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 180;
      gameStateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        color,
        radius: 2 + Math.random() * 3,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.4,
        shape,
      });
    }
  };

  // Add floating feedback text
  const addFloatingText = (text: string, x: number, y: number, color: string, subText?: string) => {
    gameStateRef.current.floatingTexts.push({
      id: gameStateRef.current.nextId++,
      text,
      subText,
      x,
      y,
      color,
      size: 26,
      life: 0,
      maxLife: 1.4,
    });
  };

  // Handle pointer down (starting to pull bow)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPaused || arrowsRemaining <= 0 || gameStateRef.current.activeArrow) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    // Bow position
    const bowX = gameStateRef.current.bowX;
    const bowY = gameStateRef.current.bowY;

    // Allow user to click anywhere around the bow or screen
    gameStateRef.current.isPulling = true;
    gameStateRef.current.pullStartX = px;
    gameStateRef.current.pullStartY = py;
    gameStateRef.current.pullCurrentX = px;
    gameStateRef.current.pullCurrentY = py;

    // Calculate initial aim
    const dx = bowX - px;
    const dy = bowY - py;
    const dist = Math.hypot(dx, dy);
    gameStateRef.current.pullTension = Math.min(1, dist / 140);
    gameStateRef.current.aimAngle = Math.atan2(bowY - py, bowX - px);

    soundManager.playDraw(0.1);
  };

  // Handle pointer move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!gameStateRef.current.isPulling) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    gameStateRef.current.pullCurrentX = px;
    gameStateRef.current.pullCurrentY = py;

    const bowX = gameStateRef.current.bowX;
    const bowY = gameStateRef.current.bowY;

    // User pulls back from bow or drag vector:
    // If pulling behind the bow (px < bowX), pull distance = distance from (bowX, bowY)
    const pullVectorX = bowX - px;
    const pullVectorY = bowY - py;
    const dist = Math.hypot(pullVectorX, pullVectorY);

    // Max draw distance 160px
    const tension = Math.min(1, Math.max(0.1, dist / 150));
    gameStateRef.current.pullTension = tension;

    // Aim angle is in direction the arrow will fly (opposite of pull)
    // If pulling back to the left, arrow shoots to the right
    gameStateRef.current.aimAngle = Math.atan2(pullVectorY, pullVectorX);

    // Subtle audio feedback during tension build
    if (Math.random() < 0.15) {
      soundManager.playDraw(tension);
    }
  };

  // Handle pointer up (shoot arrow)
  const handlePointerUp = () => {
    if (!gameStateRef.current.isPulling) return;
    gameStateRef.current.isPulling = false;

    const tension = gameStateRef.current.pullTension;
    if (tension < 0.15) {
      // Released too weakly, cancel shot
      return;
    }

    const bowX = gameStateRef.current.bowX;
    const bowY = gameStateRef.current.bowY;
    const angle = gameStateRef.current.aimAngle;

    // Arrow release speed depends on tension
    const baseSpeed = 750 + tension * 650;
    const vx = Math.cos(angle) * baseSpeed;
    const vy = Math.sin(angle) * baseSpeed;

    const newArrow: Arrow = {
      id: gameStateRef.current.nextId++,
      x: bowX + Math.cos(angle) * 30,
      y: bowY + Math.sin(angle) * 30,
      vx,
      vy,
      length: 56,
      angle,
      isFlying: true,
      isStuck: false,
      trail: [],
    };

    gameStateRef.current.activeArrow = newArrow;
    onArrowShot();
    soundManager.playRelease();

    // Bow recoil shake
    gameStateRef.current.screenShake = 4;
  };

  // Main Canvas Animation and Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.04, (currentTime - lastTime) / 1000); // capped delta time
      lastTime = currentTime;

      const state = gameStateRef.current;
      state.time += dt;

      // Update wind gusts
      state.windGustTimer += dt;
      if (state.windGustTimer > 3.5) {
        state.windGustTimer = 0;
        state.targetWind = generateNewWind();
      }
      // Smoothly interpolate wind
      state.wind += (state.targetWind - state.wind) * dt * 1.5;

      // Screen shake decay
      if (state.screenShake > 0) {
        state.screenShake = Math.max(0, state.screenShake - dt * 18);
      }

      // Update flag wave
      state.flagWave += dt * (3 + Math.abs(state.wind) * 1.5);

      // --- Update Target Positions ---
      state.targets.forEach((target) => {
        if (!target.active) return;
        if (target.speed > 0) {
          target.phase += dt * (target.speed / 50);
          target.y = target.baseY + Math.sin(target.phase) * target.amplitude;
        }
      });

      // --- Update Active Flying Arrow ---
      if (state.activeArrow && state.activeArrow.isFlying) {
        const arrow = state.activeArrow;

        // Physics constants
        const gravity = 880; // px/s^2
        const windEffect = state.wind * 28; // horizontal wind acceleration

        arrow.vy += gravity * dt;
        arrow.vx += windEffect * dt;
        arrow.x += arrow.vx * dt;
        arrow.y += arrow.vy * dt;

        // Smoothly orient arrow to velocity vector
        arrow.angle = Math.atan2(arrow.vy, arrow.vx);

        // Record trail
        arrow.trail.push({ x: arrow.x, y: arrow.y, alpha: 1.0 });
        if (arrow.trail.length > 12) {
          arrow.trail.shift();
        }

        // --- Collision Check: Targets ---
        let arrowHit = false;
        for (const target of state.targets) {
          if (!target.active) continue;

          // Target distance to arrow tip
          const tipX = arrow.x;
          const tipY = arrow.y;

          const dx = tipX - target.x;
          const dy = tipY - target.y;
          const distance = Math.hypot(dx, dy);

          // Standard target is tilted slightly; check circular radius
          if (distance <= target.radius) {
            arrowHit = true;
            arrow.isFlying = false;
            arrow.isStuck = true;
            arrow.stuckTargetId = target.id;
            arrow.stuckOffset = { x: dx, y: dy };
            state.arrows.push(arrow);
            state.activeArrow = null;

            // Determine score based on target type and concentric ring
            if (target.type === 'apple' || target.type === 'balloon') {
              // Bonus target hit!
              target.active = false;
              const bonusScore = Math.round(75 * (1 + streak * 0.2));
              onScoreEarned(bonusScore, 'bonus');
              soundManager.playHit('bonus');
              addParticles(target.x, target.y, target.type === 'apple' ? '#ef4444' : '#38bdf8', 35, 'spark');
              addFloatingText(`BONUS! +${bonusScore}`, target.x, target.y - 30, '#facc15', target.type === 'apple' ? 'Golden Apple!' : 'Balloon Pop!');
              state.screenShake = 6;
            } else {
              // Standard Target Rings Calculation
              const normalizedDist = distance / target.radius; // 0 (dead center) to 1.0 (outer edge)

              let ringScore = 10;
              let hitType: 'bullseye' | 'hit' | 'outer' = 'outer';
              let ringName = 'OUTER WHITE +10';
              let textColor = '#ffffff';

              if (normalizedDist <= 0.18) {
                // Perfect Bullseye!
                ringScore = 100;
                hitType = 'bullseye';
                ringName = 'PERFECT BULLSEYE!';
                textColor = '#facc15';
                addParticles(tipX, tipY, '#facc15', 45, 'spark');
                state.screenShake = 9;
              } else if (normalizedDist <= 0.38) {
                // Inner Yellow Bullseye
                ringScore = 60;
                hitType = 'bullseye';
                ringName = 'BULLSEYE!';
                textColor = '#fef08a';
                addParticles(tipX, tipY, '#fde047', 30, 'spark');
                state.screenShake = 6;
              } else if (normalizedDist <= 0.58) {
                // Red Ring
                ringScore = 40;
                hitType = 'hit';
                ringName = 'RED RING +40';
                textColor = '#f87171';
                addParticles(tipX, tipY, '#dc2626', 20, 'splinter');
                state.screenShake = 4;
              } else if (normalizedDist <= 0.78) {
                // Blue Ring
                ringScore = 25;
                hitType = 'hit';
                ringName = 'BLUE RING +25';
                textColor = '#60a5fa';
                addParticles(tipX, tipY, '#2563eb', 15, 'splinter');
                state.screenShake = 3;
              } else if (normalizedDist <= 0.92) {
                // Black Ring
                ringScore = 15;
                hitType = 'outer';
                ringName = 'BLACK RING +15';
                textColor = '#9ca3af';
                addParticles(tipX, tipY, '#475569', 12, 'splinter');
                state.screenShake = 2;
              } else {
                // Outer White Ring
                ringScore = 10;
                hitType = 'outer';
                ringName = 'WHITE RING +10';
                textColor = '#f3f4f6';
                addParticles(tipX, tipY, '#94a3b8', 10, 'splinter');
                state.screenShake = 2;
              }

              // Apply combo multiplier
              const multiplier = streak > 0 ? 1 + streak * 0.25 : 1;
              const finalPoints = Math.round(ringScore * multiplier);

              onScoreEarned(finalPoints, hitType);
              soundManager.playHit(hitType);

              const subMsg = streak > 1 ? `x${multiplier.toFixed(1)} Combo (${streak} in a row!)` : undefined;
              addFloatingText(`+${finalPoints} ${ringName}`, tipX, tipY - 35, textColor, subMsg);
            }

            break;
          }
        }

        // --- Ground or Wall Collision ---
        const groundY = canvas.height * 0.88;
        if (!arrowHit && arrow.y >= groundY) {
          // Stuck in dirt
          arrow.isFlying = false;
          arrow.isStuck = true;
          arrow.y = groundY;
          state.arrows.push(arrow);
          state.activeArrow = null;

          onScoreEarned(0, 'miss');
          soundManager.playHit('miss');
          addParticles(arrow.x, arrow.y, '#78350f', 12, 'splinter');
          addFloatingText('MISS!', arrow.x, arrow.y - 20, '#ef4444');
        } else if (!arrowHit && (arrow.x > canvas.width + 50 || arrow.y < -300)) {
          // Flew off screen
          state.activeArrow = null;
          onScoreEarned(0, 'miss');
          soundManager.playHit('miss');
          addFloatingText('OFF TARGET!', canvas.width - 150, 150, '#ef4444');
        }
      }

      // Check if all arrows fired and no arrow is flying -> trigger round complete
      if (arrowsRemaining <= 0 && !state.activeArrow && !state.roundCompletedTriggered) {
        state.roundCompletedTriggered = true;
        setTimeout(() => {
          onRoundComplete();
        }, 1200);
      }

      // --- Update Particles ---
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 220 * dt; // slight gravity
        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
        }
      }

      // --- Update Floating Texts ---
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const t = state.floatingTexts[i];
        t.life += dt;
        t.y -= 40 * dt; // float upwards
        if (t.life >= t.maxLife) {
          state.floatingTexts.splice(i, 1);
        }
      }

      // --- Update Ambient Leaves ---
      state.ambientLeaves.forEach((leaf) => {
        leaf.x += (leaf.vx + state.wind * 4) * dt * 45;
        leaf.y += leaf.vy * dt * 35;
        leaf.rot += leaf.rotSpeed;
        if (leaf.x > canvas.width + 40) leaf.x = -30;
        if (leaf.x < -40) leaf.x = canvas.width + 30;
        if (leaf.y > canvas.height * 0.9) leaf.y = 50;
      });

      // ==========================================
      // RENDERING SECTION
      // ==========================================
      ctx.save();

      // Screen shake translation
      if (state.screenShake > 0) {
        const sx = (Math.random() * 2 - 1) * state.screenShake;
        const sy = (Math.random() * 2 - 1) * state.screenShake;
        ctx.translate(sx, sy);
      }

      // Clear & Background Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#38bdf8'); // sky blue
      skyGrad.addColorStop(0.5, '#bae6fd');
      skyGrad.addColorStop(0.75, '#fef08a'); // golden warm horizon
      skyGrad.addColorStop(1, '#86efac'); // grass transition
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Distant Mountain Silhouettes
      ctx.fillStyle = '#64748b';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height * 0.72);
      ctx.lineTo(180, canvas.height * 0.48);
      ctx.lineTo(390, canvas.height * 0.65);
      ctx.lineTo(600, canvas.height * 0.42);
      ctx.lineTo(840, canvas.height * 0.62);
      ctx.lineTo(1050, canvas.height * 0.46);
      ctx.lineTo(canvas.width, canvas.height * 0.68);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Midground Pine Forest Line
      ctx.fillStyle = '#1e3a2b';
      ctx.globalAlpha = 0.55;
      for (let x = 0; x < canvas.width; x += 36) {
        const treeH = 50 + Math.sin(x * 0.05) * 20;
        const groundBase = canvas.height * 0.78;
        ctx.beginPath();
        ctx.moveTo(x, groundBase);
        ctx.lineTo(x + 18, groundBase - treeH);
        ctx.lineTo(x + 36, groundBase);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Grass Ground
      const groundGrad = ctx.createLinearGradient(0, canvas.height * 0.75, 0, canvas.height);
      groundGrad.addColorStop(0, '#22c55e'); // vibrant grass
      groundGrad.addColorStop(0.2, '#16a34a');
      groundGrad.addColorStop(1, '#15803d');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, canvas.height * 0.78, canvas.width, canvas.height * 0.22);

      // Archery Range Distance Markers & Yard lines
      const groundY = canvas.height * 0.88;
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 2;
      [250, 450, 650, 850, 1050].forEach((lineX) => {
        if (lineX < canvas.width - 60) {
          ctx.beginPath();
          ctx.moveTo(lineX, groundY - 12);
          ctx.lineTo(lineX + 35, groundY + 12);
          ctx.stroke();

          // Distance label in grass
          ctx.fillStyle = '#f0fdf4';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          const distanceMeters = Math.round((lineX - 100) / 18);
          ctx.fillText(`${distanceMeters}m`, lineX + 16, groundY + 28);
        }
      });

      // Wind pennant / flag post on shooting line
      const flagX = 65;
      const flagPoleTop = canvas.height * 0.42;
      const flagPoleBottom = canvas.height * 0.82;
      // Pole
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(flagX, flagPoleBottom);
      ctx.lineTo(flagX, flagPoleTop);
      ctx.stroke();

      // Fluttering triangular wind pennant
      const flagDir = state.wind >= 0 ? 1 : -1;
      const flagSpeedMagnitude = Math.abs(state.wind);
      const flagLength = Math.max(25, Math.min(65, 25 + flagSpeedMagnitude * 4));
      const waveOffset = Math.sin(state.flagWave) * (4 + flagSpeedMagnitude);

      ctx.fillStyle = flagSpeedMagnitude > 7 ? '#ef4444' : flagSpeedMagnitude > 3 ? '#eab308' : '#22c55e';
      ctx.beginPath();
      ctx.moveTo(flagX, flagPoleTop);
      ctx.lineTo(flagX + flagLength * flagDir, flagPoleTop + 10 + waveOffset);
      ctx.lineTo(flagX, flagPoleTop + 24);
      ctx.closePath();
      ctx.fill();

      // Flag pole gold topper
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(flagX, flagPoleTop - 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Shooting platform / mat
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath();
      ctx.ellipse(state.bowX - 10, groundY - 6, 70, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Quiver with arrows sitting on the ground
      ctx.fillStyle = '#78350f';
      ctx.fillRect(state.bowX - 55, groundY - 45, 18, 40);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(state.bowX - 57, groundY - 48, 22, 6);
      // Fletchings sticking out of quiver
      const quiverArrows = Math.min(8, arrowsRemaining);
      for (let i = 0; i < quiverArrows; i++) {
        const qx = state.bowX - 52 + (i % 3) * 6;
        const qy = groundY - 55 - (i * 3);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(qx, groundY - 45);
        ctx.lineTo(qx + (i - 2) * 2, qy);
        ctx.stroke();
      }

      // Draw Ambient Wind Leaves / Dust motes
      state.ambientLeaves.forEach((leaf) => {
        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(leaf.rot);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.size, leaf.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // --- Draw Targets ---
      state.targets.forEach((target) => {
        if (!target.active) return;

        if (target.type === 'apple') {
          // Golden/Red Bonus Apple
          ctx.save();
          ctx.translate(target.x, target.y);

          // Shadow below apple
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.beginPath();
          ctx.ellipse(0, 40, target.radius * 0.8, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Apple Body
          const appleGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, target.radius);
          appleGrad.addColorStop(0, '#fef08a');
          appleGrad.addColorStop(0.3, '#f59e0b');
          appleGrad.addColorStop(1, '#dc2626');
          ctx.fillStyle = appleGrad;
          ctx.beginPath();
          ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#b91c1c';
          ctx.stroke();

          // Stem & Leaf
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, -target.radius);
          ctx.quadraticCurveTo(4, -target.radius - 10, 8, -target.radius - 8);
          ctx.stroke();

          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.ellipse(6, -target.radius - 5, 6, 3, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();

          // Sparkle glint
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-target.radius * 0.35, -target.radius * 0.35, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
          return;
        }

        if (target.type === 'balloon') {
          // Floating Sky Balloon
          ctx.save();
          ctx.translate(target.x, target.y);

          // Balloon body
          const balloonGrad = ctx.createRadialGradient(-6, -8, 3, 0, 0, target.radius);
          balloonGrad.addColorStop(0, '#bae6fd');
          balloonGrad.addColorStop(0.4, '#38bdf8');
          balloonGrad.addColorStop(1, '#0284c7');
          ctx.fillStyle = balloonGrad;
          ctx.beginPath();
          ctx.ellipse(0, 0, target.radius * 0.85, target.radius, 0, 0, Math.PI * 2);
          ctx.fill();

          // Balloon knot & string
          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.moveTo(-3, target.radius);
          ctx.lineTo(3, target.radius);
          ctx.lineTo(0, target.radius + 4);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, target.radius + 4);
          ctx.quadraticCurveTo(4, target.radius + 20, -2, target.radius + 35);
          ctx.stroke();

          ctx.restore();
          return;
        }

        // Standard Archery Target Stand (Wood tripod easel)
        const easelY = target.y;
        const easelGroundY = groundY;

        ctx.strokeStyle = '#573315';
        ctx.lineWidth = 5;

        // Front left leg
        ctx.beginPath();
        ctx.moveTo(target.x - 4, easelY);
        ctx.lineTo(target.x - 22, easelGroundY);
        ctx.stroke();

        // Front right leg
        ctx.beginPath();
        ctx.moveTo(target.x + 4, easelY);
        ctx.lineTo(target.x + 22, easelGroundY);
        ctx.stroke();

        // Back support leg
        ctx.strokeStyle = '#3d230d';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(target.x, easelY - 10);
        ctx.lineTo(target.x + 12, easelGroundY - 8);
        ctx.stroke();

        // Crossbar
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(target.x - 20, easelY + 35);
        ctx.lineTo(target.x + 20, easelY + 35);
        ctx.stroke();

        // Target Board Shadow on Ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(target.x, easelGroundY - 2, target.radius * 0.85, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Target Board (Concentric Circles)
        const r = target.radius;

        // Wooden back rim
        ctx.fillStyle = '#a16207';
        ctx.beginPath();
        ctx.arc(target.x, target.y, r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Ring 1 (Outer White) 10 pts
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ring 2 (Black) 15 pts
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(target.x, target.y, r * 0.82, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        // Ring 3 (Blue) 25 pts
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(target.x, target.y, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1d4ed8';
        ctx.stroke();

        // Ring 4 (Red) 40 pts
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(target.x, target.y, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b91c1c';
        ctx.stroke();

        // Ring 5 (Yellow - Gold Bullseye) 60 pts
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(target.x, target.y, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.stroke();

        // Inner X-Ring (Dead Center Bullseye) 100 pts
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(target.x, target.y, r * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Tiny crosshair in center
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(target.x - 4, target.y);
        ctx.lineTo(target.x + 4, target.y);
        ctx.moveTo(target.x, target.y - 4);
        ctx.lineTo(target.x, target.y + 4);
        ctx.stroke();
      });

      // --- Draw Stuck Arrows on Targets/Ground ---
      state.arrows.forEach((arrow) => {
        ctx.save();
        let ax = arrow.x;
        let ay = arrow.y;

        // If stuck on a moving target, move with target
        if (arrow.stuckTargetId && arrow.stuckOffset) {
          const target = state.targets.find((t) => t.id === arrow.stuckTargetId);
          if (target && target.active) {
            ax = target.x + arrow.stuckOffset.x;
            ay = target.y + arrow.stuckOffset.y;
          }
        }

        ctx.translate(ax, ay);
        ctx.rotate(arrow.angle);

        // Arrow Shaft (Wood)
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrow.length * 0.75, 0);
        ctx.stroke();

        // Arrow Fletching Feathers
        const fletchStart = -arrow.length * 0.75;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(fletchStart, 0);
        ctx.lineTo(fletchStart - 8, -5);
        ctx.lineTo(fletchStart - 14, -5);
        ctx.lineTo(fletchStart - 8, 0);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(fletchStart, 0);
        ctx.lineTo(fletchStart - 8, 5);
        ctx.lineTo(fletchStart - 14, 5);
        ctx.lineTo(fletchStart - 8, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      });

      // --- Draw Active In-Flight Arrow ---
      if (state.activeArrow && state.activeArrow.isFlying) {
        const arrow = state.activeArrow;

        // Arrow Trail (Whistle effect / motion blur)
        if (arrow.trail.length > 1) {
          for (let i = 0; i < arrow.trail.length - 1; i++) {
            const p1 = arrow.trail[i];
            const p2 = arrow.trail[i + 1];
            const alpha = (i / arrow.trail.length) * 0.45;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        ctx.save();
        ctx.translate(arrow.x, arrow.y);
        ctx.rotate(arrow.angle);

        // Steel Arrowhead
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-12, -4);
        ctx.lineTo(-8, 0);
        ctx.lineTo(-12, 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Wooden Shaft
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-arrow.length, 0);
        ctx.stroke();

        // Dual Fletching (Red & White Feathers)
        const fletchStart = -arrow.length + 18;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(fletchStart, 0);
        ctx.lineTo(fletchStart - 12, -7);
        ctx.lineTo(fletchStart - 18, -7);
        ctx.lineTo(fletchStart - 12, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(fletchStart, 0);
        ctx.lineTo(fletchStart - 12, 7);
        ctx.lineTo(fletchStart - 18, 7);
        ctx.lineTo(fletchStart - 12, 0);
        ctx.closePath();
        ctx.fill();

        // Nock
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-arrow.length - 2, -2, 3, 4);

        ctx.restore();
      }

      // --- Draw Trajectory Prediction Guide (when pulling) ---
      if (state.isPulling && state.pullTension > 0.15) {
        const tension = state.pullTension;
        const angle = state.aimAngle;
        const baseSpeed = 750 + tension * 650;
        let simX = state.bowX + Math.cos(angle) * 30;
        let simY = state.bowY + Math.sin(angle) * 30;
        let simVx = Math.cos(angle) * baseSpeed;
        let simVy = Math.sin(angle) * baseSpeed;

        const maxSteps = Math.round(55 * config.trajectoryGuideRatio);
        const simDt = 0.025;
        const gravity = 880;
        const windEffect = state.wind * 28;

        for (let step = 0; step < maxSteps; step++) {
          simVy += gravity * simDt;
          simVx += windEffect * simDt;
          simX += simVx * simDt;
          simY += simVy * simDt;

          if (simY > groundY || simX > canvas.width) break;

          const dotAlpha = (1 - step / maxSteps) * 0.75;
          ctx.fillStyle = step % 4 === 0 ? `rgba(250, 204, 21, ${dotAlpha})` : `rgba(255, 255, 255, ${dotAlpha})`;
          ctx.beginPath();
          ctx.arc(simX, simY, 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- Draw Archer & Bow Rig ---
      const bowX = state.bowX;
      const bowY = state.bowY;
      const tension = state.isPulling ? state.pullTension : 0;
      const bowAngle = state.isPulling ? state.aimAngle : -0.1;

      ctx.save();
      ctx.translate(bowX, bowY);
      ctx.rotate(bowAngle);

      // Bow Limbs (Recurve curve)
      const bowRadius = 55;
      const drawPullX = -tension * 40; // string pulls back along local X

      // Top Limb
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(bowRadius * 0.45, -bowRadius * 0.5, 5, -bowRadius);
      ctx.stroke();

      // Bottom Limb
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(bowRadius * 0.45, bowRadius * 0.5, 5, bowRadius);
      ctx.stroke();

      // Gold Limb Tip Reinforcements
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(2, -bowRadius + 8);
      ctx.lineTo(5, -bowRadius);
      ctx.moveTo(2, bowRadius - 8);
      ctx.lineTo(5, bowRadius);
      ctx.stroke();

      // Grip Handle (Leather wrap)
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(0, 12);
      ctx.stroke();

      // Bowstring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(5, -bowRadius);
      ctx.lineTo(drawPullX, 0); // Knock point pulled back
      ctx.lineTo(5, bowRadius);
      ctx.stroke();

      // Nocked Arrow on String (when drawing or ready to shoot)
      if (arrowsRemaining > 0 && !state.activeArrow) {
        ctx.save();
        ctx.translate(drawPullX, 0);

        // Arrow Shaft
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(54, 0);
        ctx.stroke();

        // Tip
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(54, 0);
        ctx.lineTo(44, -3);
        ctx.lineTo(44, 3);
        ctx.closePath();
        ctx.fill();

        // Feathers
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-10, -5, 10, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-10, 1, 10, 4);

        ctx.restore();
      }

      ctx.restore();

      // --- Draw Pulling Tension Arc & Power Indicator Around Bow ---
      if (state.isPulling) {
        ctx.save();
        ctx.translate(bowX, bowY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 75, -Math.PI * 0.7, Math.PI * 0.7);
        ctx.stroke();

        // Filled power arc
        const powerColor = tension > 0.8 ? '#ef4444' : tension > 0.5 ? '#eab308' : '#22c55e';
        ctx.strokeStyle = powerColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        const startA = -Math.PI * 0.5;
        ctx.arc(0, 0, 75, startA, startA + tension * Math.PI, false);
        ctx.stroke();

        // Tension text
        ctx.fillStyle = powerColor;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(tension * 100)}%`, 0, -85);

        ctx.restore();
      }

      // --- Draw Particles ---
      state.particles.forEach((p) => {
        const progress = p.life / p.maxLife;
        const alpha = 1 - progress;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;

        if (p.shape === 'spark') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * (1 - progress * 0.5), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'splinter') {
          ctx.translate(p.x, p.y);
          ctx.rotate(progress * 10);
          ctx.fillRect(-p.radius, -p.radius * 0.4, p.radius * 2, p.radius * 0.8);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // --- Draw Floating Score Texts ---
      state.floatingTexts.forEach((t) => {
        const progress = t.life / t.maxLife;
        const alpha = Math.max(0, 1 - progress);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.font = `900 ${t.size}px system-ui, -apple-system, sans-serif`;

        // Dark text outline for readability
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(t.text, t.x, t.y);

        // Fill color
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);

        // Subtext (like combo info)
        if (t.subText) {
          ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#fef08a';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.strokeText(t.subText, t.x, t.y + 22);
          ctx.fillText(t.subText, t.x, t.y + 22);
        }
        ctx.restore();
      });

      ctx.restore();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [arrowsRemaining, streak, config, generateNewWind, onArrowShot, onRoundComplete, onScoreEarned]);

  return (
    <div className="relative w-full aspect-[16/9] max-h-[72vh] select-none rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-950/20 bg-slate-900">
      <canvas
        ref={canvasRef}
        width={1200}
        height={675}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full cursor-crosshair touch-none"
      />

      {/* Touch / Drag instructional prompt when idle and arrows remaining */}
      {arrowsRemaining > 0 && (
        <div className="absolute bottom-4 left-6 pointer-events-none text-white/90 drop-shadow-md text-xs sm:text-sm font-medium flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Click &amp; pull back the bow to aim and shoot</span>
        </div>
      )}
    </div>
  );
};
