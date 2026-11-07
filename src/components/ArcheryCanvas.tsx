import React, { useRef, useEffect, useCallback } from 'react';
import { Arrow, Difficulty, DIFFICULTY_CONFIGS, FloatingText, Particle, Shockwave, Target } from '../types/game';
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

  // Game internal state stored in refs for silky smooth 60fps loop
  const gameStateRef = useRef({
    bowX: 135,
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
    shockwaves: [] as Shockwave[],
    floatingTexts: [] as FloatingText[],
    ambientLeaves: [] as { x: number; y: number; vx: number; vy: number; rot: number; rotSpeed: number; size: number }[],
    flagWave: 0,
    screenShake: 0,
    stringVibration: 0, // for bowstring snapback oscillation
    stringVibPhase: 0,
    nextId: 1,
    time: 0,
    roundCompletedTriggered: false,
  });

  const config = DIFFICULTY_CONFIGS[difficulty];

  // Helper to generate a new wind value
  const generateNewWind = useCallback(() => {
    const max = config.maxWind;
    if (max <= 0.1) return 0;
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
        recoilX: 0,
        recoilAngle: 0,
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
        radius: bonusType === 'apple' ? 20 : 26,
        speed: config.targetSpeed * 0.8 + 25,
        amplitude: 50,
        phase: Math.PI / 2,
        type: bonusType,
        pointsMultiplier: 1.5,
        active: true,
        recoilX: 0,
        recoilAngle: 0,
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
    gameStateRef.current.shockwaves = [];
  }, [difficulty, round, setupRoundTargets]);

  // Ambient particles (wind leaves)
  useEffect(() => {
    const leaves = [];
    for (let i = 0; i < 24; i++) {
      leaves.push({
        x: Math.random() * 1200,
        y: Math.random() * 600,
        vx: 1.2 + Math.random() * 2,
        vy: 0.5 + Math.random() * 0.8,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.06,
        size: 3.5 + Math.random() * 4,
      });
    }
    gameStateRef.current.ambientLeaves = leaves;
  }, []);

  // Spawn visual particles
  const addParticles = (x: number, y: number, color: string, count: number, shape: 'circle' | 'spark' | 'splinter' = 'circle') => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 220;
      gameStateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        color,
        radius: 2.5 + Math.random() * 4,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.45,
        shape,
      });
    }
  };

  // Spawn shockwave ring on impact
  const addShockwave = (x: number, y: number, color: string, maxRadius: number = 65) => {
    gameStateRef.current.shockwaves.push({
      id: gameStateRef.current.nextId++,
      x,
      y,
      radius: 5,
      maxRadius,
      color,
      life: 0,
      maxLife: 0.45,
    });
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
      size: 28,
      life: 0,
      maxLife: 1.5,
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

    const bowX = gameStateRef.current.bowX;
    const bowY = gameStateRef.current.bowY;

    gameStateRef.current.isPulling = true;
    gameStateRef.current.pullStartX = px;
    gameStateRef.current.pullStartY = py;
    gameStateRef.current.pullCurrentX = px;
    gameStateRef.current.pullCurrentY = py;

    const pullVectorX = bowX - px;
    const pullVectorY = bowY - py;
    const dist = Math.hypot(pullVectorX, pullVectorY);
    gameStateRef.current.pullTension = Math.min(1, Math.max(0.1, dist / 150));
    gameStateRef.current.aimAngle = Math.atan2(pullVectorY, pullVectorX);

    soundManager.playDraw(0.15);
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

    const pullVectorX = bowX - px;
    const pullVectorY = bowY - py;
    const dist = Math.hypot(pullVectorX, pullVectorY);

    const tension = Math.min(1, Math.max(0.1, dist / 155));
    gameStateRef.current.pullTension = tension;
    gameStateRef.current.aimAngle = Math.atan2(pullVectorY, pullVectorX);

    if (Math.random() < 0.18) {
      soundManager.playDraw(tension);
    }
  };

  // Handle pointer up (shoot arrow)
  const handlePointerUp = () => {
    if (!gameStateRef.current.isPulling) return;
    gameStateRef.current.isPulling = false;

    const tension = gameStateRef.current.pullTension;
    if (tension < 0.15) {
      return;
    }

    const bowX = gameStateRef.current.bowX;
    const bowY = gameStateRef.current.bowY;
    const angle = gameStateRef.current.aimAngle;

    // Arrow release speed depends on tension
    const baseSpeed = 780 + tension * 680;
    const vx = Math.cos(angle) * baseSpeed;
    const vy = Math.sin(angle) * baseSpeed;

    // Arrow is now noticeably bigger: length 76px (was 56px)
    const newArrow: Arrow = {
      id: gameStateRef.current.nextId++,
      x: bowX + Math.cos(angle) * 35,
      y: bowY + Math.sin(angle) * 35,
      vx,
      vy,
      length: 76,
      angle,
      isFlying: true,
      isStuck: false,
      trail: [],
    };

    gameStateRef.current.activeArrow = newArrow;
    // Trigger bowstring snap-back vibration animation
    gameStateRef.current.stringVibration = 1.0;
    gameStateRef.current.stringVibPhase = 0;

    onArrowShot();
    soundManager.playRelease();

    // Bow recoil shake
    gameStateRef.current.screenShake = 5;
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
      const dt = Math.min(0.04, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const state = gameStateRef.current;
      state.time += dt;

      // Update wind gusts
      state.windGustTimer += dt;
      if (state.windGustTimer > 3.5) {
        state.windGustTimer = 0;
        state.targetWind = generateNewWind();
      }
      state.wind += (state.targetWind - state.wind) * dt * 1.5;

      // Screen shake decay
      if (state.screenShake > 0) {
        state.screenShake = Math.max(0, state.screenShake - dt * 20);
      }

      // Bowstring vibration decay on release
      if (state.stringVibration > 0) {
        state.stringVibPhase += dt * 55;
        state.stringVibration = Math.max(0, state.stringVibration - dt * 4.2);
      }

      // Update flag wave
      state.flagWave += dt * (3 + Math.abs(state.wind) * 1.5);

      // --- Update Target Positions and Impact Recoil ---
      state.targets.forEach((target) => {
        if (!target.active) return;
        if (target.speed > 0) {
          target.phase += dt * (target.speed / 50);
          target.y = target.baseY + Math.sin(target.phase) * target.amplitude;
        }
        // Smoothly dampen impact recoil
        if (target.recoilX && target.recoilX > 0) {
          target.recoilX = Math.max(0, target.recoilX - dt * 50);
        }
        if (target.recoilAngle && Math.abs(target.recoilAngle) > 0.001) {
          target.recoilAngle *= Math.max(0, 1 - dt * 12);
        }
      });

      // --- Update Stuck Arrows Quiver Animation ---
      state.arrows.forEach((arrow) => {
        if (arrow.isStuck && arrow.quiverAmount && arrow.quiverAmount > 0.001) {
          arrow.quiverPhase = (arrow.quiverPhase || 0) + dt * 40;
          arrow.quiverAmount = Math.max(0, arrow.quiverAmount - dt * 0.65);
        }
      });

      // --- Update Active Flying Arrow ---
      if (state.activeArrow && state.activeArrow.isFlying) {
        const arrow = state.activeArrow;

        const gravity = 880;
        const windEffect = state.wind * 28;

        arrow.vy += gravity * dt;
        arrow.vx += windEffect * dt;
        arrow.x += arrow.vx * dt;
        arrow.y += arrow.vy * dt;

        arrow.angle = Math.atan2(arrow.vy, arrow.vx);

        arrow.trail.push({ x: arrow.x, y: arrow.y, alpha: 1.0 });
        if (arrow.trail.length > 16) {
          arrow.trail.shift();
        }

        // --- Collision Check: Targets ---
        let arrowHit = false;
        for (const target of state.targets) {
          if (!target.active) continue;

          const tipX = arrow.x;
          const tipY = arrow.y;

          const dx = tipX - target.x;
          const dy = tipY - target.y;
          const distance = Math.hypot(dx, dy);

          if (distance <= target.radius) {
            arrowHit = true;
            arrow.isFlying = false;
            arrow.isStuck = true;
            arrow.stuckTargetId = target.id;
            arrow.stuckOffset = { x: dx, y: dy };
            // Set initial quiver vibration on arrow
            arrow.quiverAmount = 0.22;
            arrow.quiverPhase = 0;
            state.arrows.push(arrow);
            state.activeArrow = null;

            // Target recoil kick
            target.recoilX = 14;
            target.recoilAngle = 0.12;

            if (target.type === 'apple' || target.type === 'balloon') {
              target.active = false;
              const bonusScore = Math.round(75 * (1 + streak * 0.2));
              onScoreEarned(bonusScore, 'bonus');
              soundManager.playHit('bonus');
              addParticles(target.x, target.y, target.type === 'apple' ? '#ef4444' : '#38bdf8', 40, 'spark');
              addShockwave(target.x, target.y, target.type === 'apple' ? '#f59e0b' : '#38bdf8', 85);
              addFloatingText(`BONUS! +${bonusScore}`, target.x, target.y - 30, '#facc15', target.type === 'apple' ? 'Golden Apple!' : 'Balloon Pop!');
              state.screenShake = 7;
            } else {
              const normalizedDist = distance / target.radius;

              let ringScore = 10;
              let hitType: 'bullseye' | 'hit' | 'outer' = 'outer';
              let ringName = 'OUTER WHITE +10';
              let textColor = '#ffffff';

              if (normalizedDist <= 0.18) {
                ringScore = 100;
                hitType = 'bullseye';
                ringName = 'PERFECT BULLSEYE!';
                textColor = '#facc15';
                addParticles(tipX, tipY, '#facc15', 55, 'spark');
                addShockwave(tipX, tipY, '#facc15', 95);
                state.screenShake = 10;
              } else if (normalizedDist <= 0.38) {
                ringScore = 60;
                hitType = 'bullseye';
                ringName = 'BULLSEYE!';
                textColor = '#fef08a';
                addParticles(tipX, tipY, '#fde047', 35, 'spark');
                addShockwave(tipX, tipY, '#fde047', 75);
                state.screenShake = 7;
              } else if (normalizedDist <= 0.58) {
                ringScore = 40;
                hitType = 'hit';
                ringName = 'RED RING +40';
                textColor = '#f87171';
                addParticles(tipX, tipY, '#dc2626', 25, 'splinter');
                addShockwave(tipX, tipY, '#ef4444', 55);
                state.screenShake = 5;
              } else if (normalizedDist <= 0.78) {
                ringScore = 25;
                hitType = 'hit';
                ringName = 'BLUE RING +25';
                textColor = '#60a5fa';
                addParticles(tipX, tipY, '#2563eb', 18, 'splinter');
                addShockwave(tipX, tipY, '#3b82f6', 45);
                state.screenShake = 4;
              } else if (normalizedDist <= 0.92) {
                ringScore = 15;
                hitType = 'outer';
                ringName = 'BLACK RING +15';
                textColor = '#9ca3af';
                addParticles(tipX, tipY, '#475569', 14, 'splinter');
                state.screenShake = 3;
              } else {
                ringScore = 10;
                hitType = 'outer';
                ringName = 'WHITE RING +10';
                textColor = '#f3f4f6';
                addParticles(tipX, tipY, '#94a3b8', 12, 'splinter');
                state.screenShake = 2;
              }

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
          arrow.isFlying = false;
          arrow.isStuck = true;
          arrow.y = groundY;
          arrow.quiverAmount = 0.18;
          arrow.quiverPhase = 0;
          state.arrows.push(arrow);
          state.activeArrow = null;

          onScoreEarned(0, 'miss');
          soundManager.playHit('miss');
          addParticles(arrow.x, arrow.y, '#78350f', 16, 'splinter');
          addShockwave(arrow.x, arrow.y, '#78350f', 35);
          addFloatingText('MISS!', arrow.x, arrow.y - 20, '#ef4444');
        } else if (!arrowHit && (arrow.x > canvas.width + 50 || arrow.y < -300)) {
          state.activeArrow = null;
          onScoreEarned(0, 'miss');
          soundManager.playHit('miss');
          addFloatingText('OFF TARGET!', canvas.width - 150, 150, '#ef4444');
        }
      }

      // Check if round complete
      if (arrowsRemaining <= 0 && !state.activeArrow && !state.roundCompletedTriggered) {
        state.roundCompletedTriggered = true;
        setTimeout(() => {
          onRoundComplete();
        }, 1200);
      }

      // --- Update Shockwaves ---
      for (let i = state.shockwaves.length - 1; i >= 0; i--) {
        const sw = state.shockwaves[i];
        sw.life += dt;
        sw.radius = (sw.life / sw.maxLife) * sw.maxRadius;
        if (sw.life >= sw.maxLife) {
          state.shockwaves.splice(i, 1);
        }
      }

      // --- Update Particles ---
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 220 * dt;
        if (p.life >= p.maxLife) {
          state.particles.splice(i, 1);
        }
      }

      // --- Update Floating Texts ---
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const t = state.floatingTexts[i];
        t.life += dt;
        t.y -= 40 * dt;
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
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.5, '#bae6fd');
      skyGrad.addColorStop(0.75, '#fef08a');
      skyGrad.addColorStop(1, '#86efac');
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
      groundGrad.addColorStop(0, '#22c55e');
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
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(flagX, flagPoleBottom);
      ctx.lineTo(flagX, flagPoleTop);
      ctx.stroke();

      const flagDir = state.wind >= 0 ? 1 : -1;
      const flagSpeedMagnitude = Math.abs(state.wind);
      const flagLength = Math.max(28, Math.min(68, 28 + flagSpeedMagnitude * 4));
      const waveOffset = Math.sin(state.flagWave) * (5 + flagSpeedMagnitude);

      ctx.fillStyle = flagSpeedMagnitude > 7 ? '#ef4444' : flagSpeedMagnitude > 3 ? '#eab308' : '#22c55e';
      ctx.beginPath();
      ctx.moveTo(flagX, flagPoleTop);
      ctx.lineTo(flagX + flagLength * flagDir, flagPoleTop + 12 + waveOffset);
      ctx.lineTo(flagX, flagPoleTop + 26);
      ctx.closePath();
      ctx.fill();

      // Flag pole gold topper
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(flagX, flagPoleTop - 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Shooting platform / mat
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath();
      ctx.ellipse(state.bowX - 10, groundY - 6, 75, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Quiver with arrows sitting on the ground
      ctx.fillStyle = '#78350f';
      ctx.fillRect(state.bowX - 58, groundY - 48, 20, 44);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(state.bowX - 60, groundY - 51, 24, 7);
      const quiverArrows = Math.min(8, arrowsRemaining);
      for (let i = 0; i < quiverArrows; i++) {
        const qx = state.bowX - 55 + (i % 3) * 7;
        const qy = groundY - 60 - (i * 3.5);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(qx, groundY - 48);
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

        const recoilX = target.recoilX || 0;
        const recoilAngle = target.recoilAngle || 0;

        ctx.save();
        ctx.translate(target.x + recoilX, target.y);
        ctx.rotate(recoilAngle);

        if (target.type === 'apple') {
          // Apple Body
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.ellipse(0, 42, target.radius * 0.85, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          const appleGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, target.radius);
          appleGrad.addColorStop(0, '#fef08a');
          appleGrad.addColorStop(0.3, '#f59e0b');
          appleGrad.addColorStop(1, '#dc2626');
          ctx.fillStyle = appleGrad;
          ctx.beginPath();
          ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 2.5;
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
          ctx.ellipse(6, -target.radius - 5, 7, 3.5, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();

          // Sparkle glint
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-target.radius * 0.35, -target.radius * 0.35, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
          return;
        }

        if (target.type === 'balloon') {
          // Balloon Body
          const balloonGrad = ctx.createRadialGradient(-6, -8, 3, 0, 0, target.radius);
          balloonGrad.addColorStop(0, '#bae6fd');
          balloonGrad.addColorStop(0.4, '#38bdf8');
          balloonGrad.addColorStop(1, '#0284c7');
          ctx.fillStyle = balloonGrad;
          ctx.beginPath();
          ctx.ellipse(0, 0, target.radius * 0.88, target.radius, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#0369a1';
          ctx.beginPath();
          ctx.moveTo(-4, target.radius);
          ctx.lineTo(4, target.radius);
          ctx.lineTo(0, target.radius + 5);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, target.radius + 5);
          ctx.quadraticCurveTo(5, target.radius + 22, -2, target.radius + 38);
          ctx.stroke();

          ctx.restore();
          return;
        }

        // Standard Archery Target Stand (Wood tripod easel)
        const easelY = 0;
        const easelGroundY = groundY - target.y;

        ctx.strokeStyle = '#573315';
        ctx.lineWidth = 6;

        // Front left leg
        ctx.beginPath();
        ctx.moveTo(-5, easelY);
        ctx.lineTo(-24, easelGroundY);
        ctx.stroke();

        // Front right leg
        ctx.beginPath();
        ctx.moveTo(5, easelY);
        ctx.lineTo(24, easelGroundY);
        ctx.stroke();

        // Back support leg
        ctx.strokeStyle = '#3d230d';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, easelY - 12);
        ctx.lineTo(14, easelGroundY - 8);
        ctx.stroke();

        // Crossbar
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-22, easelY + 38);
        ctx.lineTo(22, easelY + 38);
        ctx.stroke();

        // Target Board Shadow on Ground
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(0, easelGroundY - 2, target.radius * 0.9, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Target Board (Concentric Circles)
        const r = target.radius;

        // Wooden back rim
        ctx.fillStyle = '#a16207';
        ctx.beginPath();
        ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Ring 1 (Outer White) 10 pts
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Ring 2 (Black) 15 pts
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        // Ring 3 (Blue) 25 pts
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1d4ed8';
        ctx.stroke();

        // Ring 4 (Red) 40 pts
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b91c1c';
        ctx.stroke();

        // Ring 5 (Yellow - Gold Bullseye) 60 pts
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.stroke();

        // Inner X-Ring (Dead Center Bullseye) 100 pts
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Crosshair
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.moveTo(0, -5);
        ctx.lineTo(0, 5);
        ctx.stroke();

        ctx.restore();
      });

      // --- Draw Shockwaves ---
      state.shockwaves.forEach((sw) => {
        const progress = sw.life / sw.maxLife;
        const alpha = Math.max(0, 1 - progress);
        ctx.save();
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3.5 * alpha;
        ctx.globalAlpha = alpha * 0.85;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      // --- Helper to Render High-Detail Larger Arrow ---
      const drawArrowObject = (arrowLength: number, isStuck: boolean = false, quiverOffset: number = 0) => {
        ctx.save();
        if (quiverOffset !== 0) {
          ctx.rotate(quiverOffset);
        }

        // Drop shadow for crisp visibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;

        // Steel Broadhead Arrowhead (Bigger, sleek triangular tip with metal shine)
        const headLength = 22;
        const headWidth = 6.5;

        // Blade Fill
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-headLength, -headWidth);
        ctx.lineTo(-headLength + 5, 0);
        ctx.lineTo(-headLength, headWidth);
        ctx.closePath();
        ctx.fill();

        // Edge highlight & outline
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Blade center rib line
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-headLength + 4, 0);
        ctx.stroke();

        // Steel Ferrule / Collar
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-headLength + 2, -3.2, 5, 6.4);

        // Substantial Wooden Shaft (Bigger: width 5.5px)
        const shaftStart = -headLength + 6;
        const shaftEnd = -arrowLength;
        const shaftW = 5.5;

        // Dark shaft outline
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(shaftStart, -shaftW / 2 - 0.75, shaftEnd - shaftStart, shaftW + 1.5);

        // Wood grain body
        const shaftGrad = ctx.createLinearGradient(0, -shaftW / 2, 0, shaftW / 2);
        shaftGrad.addColorStop(0, '#f59e0b');
        shaftGrad.addColorStop(0.4, '#d97706');
        shaftGrad.addColorStop(1, '#92400e');
        ctx.fillStyle = shaftGrad;
        ctx.fillRect(shaftStart, -shaftW / 2, shaftEnd - shaftStart, shaftW);

        // Fletching Feathers (Bigger & Dual-tone: Red & Golden-Yellow with notch lines)
        const fletchLen = 22;
        const fletchHeight = 10;
        const fletchStart = shaftEnd + 26;

        // Top Feather (Crimson Red)
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(fletchStart, -shaftW / 2);
        ctx.lineTo(fletchStart - 8, -shaftW / 2 - fletchHeight);
        ctx.lineTo(fletchStart - fletchLen, -shaftW / 2 - fletchHeight);
        ctx.lineTo(fletchStart - fletchLen + 4, -shaftW / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Top Feather feather accent stripe
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(fletchStart - 10, -shaftW / 2);
        ctx.lineTo(fletchStart - 13, -shaftW / 2 - fletchHeight * 0.7);
        ctx.lineTo(fletchStart - 16, -shaftW / 2 - fletchHeight * 0.7);
        ctx.lineTo(fletchStart - 13, -shaftW / 2);
        ctx.closePath();
        ctx.fill();

        // Bottom Feather (Vivid Golden Orange / White)
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(fletchStart, shaftW / 2);
        ctx.lineTo(fletchStart - 8, shaftW / 2 + fletchHeight);
        ctx.lineTo(fletchStart - fletchLen, shaftW / 2 + fletchHeight);
        ctx.lineTo(fletchStart - fletchLen + 4, shaftW / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Bottom Feather accent
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(fletchStart - 10, shaftW / 2);
        ctx.lineTo(fletchStart - 13, shaftW / 2 + fletchHeight * 0.7);
        ctx.lineTo(fletchStart - 16, shaftW / 2 + fletchHeight * 0.7);
        ctx.lineTo(fletchStart - 13, shaftW / 2);
        ctx.closePath();
        ctx.fill();

        // Nock (Arrow back notch)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(shaftEnd - 4, -2.5, 4, 5);

        ctx.restore();
      };

      // --- Draw Stuck Arrows on Targets/Ground with Quiver Animation ---
      state.arrows.forEach((arrow) => {
        ctx.save();
        let ax = arrow.x;
        let ay = arrow.y;

        if (arrow.stuckTargetId && arrow.stuckOffset) {
          const target = state.targets.find((t) => t.id === arrow.stuckTargetId);
          if (target && target.active) {
            const recoilX = target.recoilX || 0;
            ax = target.x + recoilX + arrow.stuckOffset.x;
            ay = target.y + arrow.stuckOffset.y;
          }
        }

        ctx.translate(ax, ay);
        ctx.rotate(arrow.angle);

        // Arrow Quiver wobble
        const quiverAngle = (arrow.quiverAmount || 0) * Math.sin(arrow.quiverPhase || 0);
        drawArrowObject(arrow.length, true, quiverAngle);

        ctx.restore();
      });

      // --- Draw Active In-Flight Arrow with Dynamic Motion Ribbon ---
      if (state.activeArrow && state.activeArrow.isFlying) {
        const arrow = state.activeArrow;

        // Flowing Motion Ribbon / Air stream trail
        if (arrow.trail.length > 1) {
          for (let i = 0; i < arrow.trail.length - 1; i++) {
            const p1 = arrow.trail[i];
            const p2 = arrow.trail[i + 1];
            const progress = i / arrow.trail.length;
            const alpha = progress * 0.65;
            const width = 1 + progress * 4.5;

            ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Inner bright core
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            ctx.lineWidth = width * 0.4;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        ctx.save();
        ctx.translate(arrow.x, arrow.y);
        ctx.rotate(arrow.angle);

        drawArrowObject(arrow.length, false, 0);

        ctx.restore();
      }

      // --- HIGH VISIBILITY TRAJECTORY PREDICTION GUIDE (ANIMATED & CONTRASTED) ---
      if (state.isPulling && state.pullTension > 0.15) {
        const tension = state.pullTension;
        const angle = state.aimAngle;
        const baseSpeed = 780 + tension * 680;
        let simX = state.bowX + Math.cos(angle) * 35;
        let simY = state.bowY + Math.sin(angle) * 35;
        let simVx = Math.cos(angle) * baseSpeed;
        let simVy = Math.sin(angle) * baseSpeed;

        const maxSteps = Math.round(55 * config.trajectoryGuideRatio);
        const simDt = 0.025;
        const gravity = 880;
        const windEffect = state.wind * 28;

        let endX = simX;
        let endY = simY;

        // Animated marching offset
        const marchingOffset = (state.time * 28) % 4;

        for (let step = 0; step < maxSteps; step++) {
          simVy += gravity * simDt;
          simVx += windEffect * simDt;
          simX += simVx * simDt;
          simY += simVy * simDt;

          if (simY > groundY || simX > canvas.width) {
            endX = simX;
            endY = simY;
            break;
          }
          endX = simX;
          endY = simY;

          const progress = step / maxSteps;
          const fadeAlpha = 1 - progress * 0.7;

          // Pulse effect based on marching animation
          const pulseIndex = (step + marchingOffset) % 4;
          const isPulsing = pulseIndex < 1.5;
          const dotRadius = isPulsing ? 5.8 : 4.5;

          // High visibility dual-layer dots:
          // 1. Dark outer border for strong contrast against bright sky and clouds
          ctx.fillStyle = `rgba(15, 23, 42, ${fadeAlpha * 0.95})`;
          ctx.beginPath();
          ctx.arc(simX, simY, dotRadius + 1.8, 0, Math.PI * 2);
          ctx.fill();

          // 2. High-intensity glowing yellow-amber core
          const coreColor = isPulsing
            ? `rgba(254, 240, 138, ${fadeAlpha})` // bright lemon
            : `rgba(245, 158, 11, ${fadeAlpha})`; // deep amber
          ctx.fillStyle = coreColor;
          ctx.beginPath();
          ctx.arc(simX, simY, dotRadius, 0, Math.PI * 2);
          ctx.fill();

          // 3. Crisp white center highlight
          ctx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha * 0.9})`;
          ctx.beginPath();
          ctx.arc(simX, simY, dotRadius * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }

        // Animated Trajectory Endpoint / Impact Reticle
        const reticlePulse = 1 + Math.sin(state.time * 8) * 0.25;
        ctx.save();
        ctx.translate(endX, Math.min(groundY, endY));

        // Dark back ring
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 10 * reticlePulse, 0, Math.PI * 2);
        ctx.stroke();

        // Bright golden target ring
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 10 * reticlePulse, 0, Math.PI * 2);
        ctx.stroke();

        // Cross lines
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.moveTo(0, -5);
        ctx.lineTo(0, 5);
        ctx.stroke();

        ctx.restore();
      }

      // --- Draw Archer & Bow Rig with Dynamic Limb Flex and String Snap ---
      const bowX = state.bowX;
      const bowY = state.bowY;
      const tension = state.isPulling ? state.pullTension : 0;
      const bowAngle = state.isPulling ? state.aimAngle : -0.1;

      // Micro tremble at extreme draw tension (>85%)
      const tensionTremble = tension > 0.85 ? (Math.random() - 0.5) * 1.5 : 0;

      ctx.save();
      ctx.translate(bowX, bowY + tensionTremble);
      ctx.rotate(bowAngle);

      // Bow Limbs bend back deeper as tension increases!
      const baseBowRadius = 60;
      const limbFlex = tension * 16; // tips pull slightly inward/back
      const limbTipX = -limbFlex;
      const limbTipY = baseBowRadius - limbFlex * 0.3;

      // Bowstring snapback oscillation
      const stringSnapOffset = state.stringVibration > 0
        ? Math.sin(state.stringVibPhase) * state.stringVibration * 12
        : 0;

      const drawPullX = state.isPulling ? -tension * 45 : stringSnapOffset;

      // Shadow behind bow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      // Top Limb (Wood recurve)
      ctx.strokeStyle = '#572b0c';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(baseBowRadius * 0.45 - limbFlex * 0.5, -baseBowRadius * 0.5, limbTipX, -limbTipY);
      ctx.stroke();

      // Top Limb Belly Highlight (Warm amber strip)
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(baseBowRadius * 0.45 - limbFlex * 0.5, -baseBowRadius * 0.5, limbTipX + 1, -limbTipY + 4);
      ctx.stroke();

      // Bottom Limb
      ctx.strokeStyle = '#572b0c';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(baseBowRadius * 0.45 - limbFlex * 0.5, baseBowRadius * 0.5, limbTipX, limbTipY);
      ctx.stroke();

      // Bottom Limb Highlight
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(baseBowRadius * 0.45 - limbFlex * 0.5, baseBowRadius * 0.5, limbTipX + 1, limbTipY - 4);
      ctx.stroke();

      // Golden Limb Tips (Nocks for bowstring)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(limbTipX - 2, -limbTipY + 8);
      ctx.lineTo(limbTipX, -limbTipY);
      ctx.moveTo(limbTipX - 2, limbTipY - 8);
      ctx.lineTo(limbTipX, limbTipY);
      ctx.stroke();

      // Leather Bow Grip Handle
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 9.5;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(0, 14);
      ctx.stroke();

      // Golden Arrow Shelf
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-2, -4, 5, 8);

      // Bowstring (Vivid White with slight glow)
      ctx.shadowBlur = 2;
      ctx.shadowColor = '#ffffff';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(limbTipX, -limbTipY);
      ctx.lineTo(drawPullX, 0);
      ctx.lineTo(limbTipX, limbTipY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Nocked Arrow on String (when drawing or waiting to shoot)
      if (arrowsRemaining > 0 && !state.activeArrow) {
        ctx.save();
        ctx.translate(drawPullX + 76 - 15, 0);
        drawArrowObject(76, false, 0);
        ctx.restore();
      }

      ctx.restore();

      // --- Draw Pulling Tension Arc & Power Indicator Around Bow ---
      if (state.isPulling) {
        ctx.save();
        ctx.translate(bowX, bowY);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, 80, -Math.PI * 0.7, Math.PI * 0.7);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 80, -Math.PI * 0.7, Math.PI * 0.7);
        ctx.stroke();

        const powerColor = tension > 0.8 ? '#ef4444' : tension > 0.5 ? '#f59e0b' : '#10b981';
        ctx.strokeStyle = powerColor;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const startA = -Math.PI * 0.5;
        ctx.arc(0, 0, 80, startA, startA + tension * Math.PI, false);
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(tension * 100)}%`, 0, -90);

        ctx.fillStyle = powerColor;
        ctx.fillText(`${Math.round(tension * 100)}%`, 0, -91);

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
          ctx.arc(p.x, p.y, p.radius * (1 - progress * 0.4), 0, Math.PI * 2);
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

      // --- Draw Floating Score Texts (with Bouncy Punch Animation) ---
      state.floatingTexts.forEach((t) => {
        const progress = t.life / t.maxLife;
        const alpha = Math.max(0, 1 - progress);
        // Spring punch scale on spawn
        const scale = progress < 0.2 ? 1 + (0.2 - progress) * 1.5 : 1;

        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.font = `900 ${t.size}px system-ui, -apple-system, sans-serif`;

        // Heavy dark text outline for instant contrast
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 5;
        ctx.strokeText(t.text, 0, 0);

        // Fill color
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, 0, 0);

        if (t.subText) {
          ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
          ctx.fillStyle = '#fef08a';
          ctx.strokeStyle = '#020617';
          ctx.lineWidth = 3.5;
          ctx.strokeText(t.subText, 0, 24);
          ctx.fillText(t.subText, 0, 24);
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
        <div className="absolute bottom-4 left-6 pointer-events-none text-white/90 drop-shadow-md text-xs sm:text-sm font-medium flex items-center gap-2 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>Click &amp; pull back the bow to aim and shoot</span>
        </div>
      )}
    </div>
  );
};
