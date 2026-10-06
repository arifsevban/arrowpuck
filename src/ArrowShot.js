/**
 * ArrowShot.js - Main Entry and Orchestration Class
 * Implements GDD Section 1-8: Full lifecycle management, non-intrusive Canvas layer,
 * high-DPI scaling, Euler physics, micro-sparks, and responsive layout.
 */

import { MathUtils } from './utils/MathUtils.js';
import { Physics } from './core/Physics.js';
import { Collision } from './core/Collision.js';
import { Bow } from './entities/Bow.js';
import { Slingshot } from './entities/Slingshot.js';
import { Projectile, ProjectileState } from './entities/Projectile.js';
import { Target } from './entities/Target.js';
import { ParticleSystem } from './fx/ParticleSystem.js';
import { ScorePopup } from './fx/ScorePopup.js';

export const GameState = {
  IDLE: 'idle',
  AIMING: 'aiming',
  FLYING: 'flying',
  HIT: 'hit',
  MISS: 'miss',
  RESETTING: 'resetting'
};

export class ArrowShot {
  /**
   * @param {Object} [options] - Configuration options matching GDD Section 8
   */
  constructor(options = {}) {
    this.options = {
      mountTarget: document.body,
      bowPosition: 'bottom-left',
      targetPosition: 'top-right',
      gravity: 0.38,
      powerMultiplier: 0.38,
      maxDragRadius: 110,
      airResistance: 1.0,
      autoOpen: false,
      showPrompt: true,
      promptText: 'Sıkıldınız mı? 🎯',
      closeText: '✕ Kapat',
      promptPosition: 'bottom-right',
      theme: {
        primaryColor: '#f59e0b',
        arrowColor: '#27272a',
        targetRingColors: ['#18181b', '#27272a', '#f59e0b']
      },
      enableTrajectory: true,
      enableSound: false,
      onOpen: () => {},
      onClose: () => {},
      onHit: (score, totalScore) => {},
      onMiss: () => {},
      ...options
    };

    // State & Scores
    this.state = GameState.IDLE;
    this.totalScore = 0;
    this.totalShots = 0;
    this.hits = 0;

    // Open/Closed widget state
    this.isOpen = Boolean(this.options.autoOpen);
    this.openProgress = this.isOpen ? 1 : 0;

    // Time & loop tracking
    this.lastTime = 0;
    this.resetTimer = 0;
    this.rafId = null;

    // Pull tracking
    this.dragData = {
      dx: 0,
      dy: 0,
      distance: 0,
      ratio: 0,
      dragX: 0,
      dragY: 0
    };

    // Initialize audio synthesizer if requested
    this.audioCtx = null;
    if (this.options.enableSound) {
      this.initAudio();
    }

    // Build DOM & Canvas
    this.initDOM();

    // Instantiate Entities
    this.initEntities();

    // Setup input listeners on the non-intrusive trigger
    this.setupInteractions();

    // Start game loop
    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * Sets up full-screen fixed canvas, minimal trigger hotspot, and floating prompt.
   */
  initDOM() {
    this.mountTarget = this.options.mountTarget || document.body;

    // 1. Full-screen fixed canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'arrowshot-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.zIndex = '99999';
    this.canvas.style.pointerEvents = 'none'; // Critical: strictly non-intrusive!
    this.canvas.style.userSelect = 'none';
    this.canvas.style.webkitUserSelect = 'none';

    this.ctx = this.canvas.getContext('2d');
    this.mountTarget.appendChild(this.canvas);

    // 2. Interaction Hotspot Trigger (strictly captures inputs only at the launcher)
    this.triggerZone = document.createElement('div');
    this.triggerZone.id = 'arrowshot-trigger';
    this.triggerZone.style.position = 'fixed';
    this.triggerZone.style.width = '104px';
    this.triggerZone.style.height = '104px';
    this.triggerZone.style.borderRadius = '50%';
    this.triggerZone.style.pointerEvents = 'auto';
    this.triggerZone.style.cursor = 'grab';
    this.triggerZone.style.zIndex = '100000';
    this.triggerZone.style.touchAction = 'none';
    this.triggerZone.style.userSelect = 'none';
    this.triggerZone.style.webkitUserSelect = 'none';
    this.triggerZone.style.display = this.isOpen ? 'block' : 'none';
    this.triggerZone.setAttribute('aria-label', 'ArrowPuck Launcher');
    this.triggerZone.title = 'Tıkla ve yayı geriye çekerek nişan al';

    this.mountTarget.appendChild(this.triggerZone);

    // 3. Floating interactive prompt badge (attention-grabber on host site)
    if (this.options.showPrompt) {
      this.initPromptUI();
    }

    // Resize handling with high-DPI / retina sharpness
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  /**
   * Resizes canvas to exact viewport and recalculates high-DPI scaling.
   */
  handleResize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);

    // Recalculate anchor positions
    const bowCoords = this.calculatePosition(this.options.bowPosition, 'bow');
    const targetCoords = this.calculatePosition(this.options.targetPosition, 'target');

    this.bowPos = bowCoords;
    this.targetPos = targetCoords;

    // Reposition trigger hotspot element
    if (this.triggerZone) {
      this.triggerZone.style.left = `${bowCoords.x - 52}px`;
      this.triggerZone.style.top = `${bowCoords.y - 52}px`;
    }

    if (this.bow) {
      this.bow.setPosition(bowCoords.x, bowCoords.y);
    }
    if (this.target) {
      this.target.setPosition(targetCoords.x, targetCoords.y);
    }
    if (this.projectile && this.state === GameState.IDLE) {
      this.projectile.resetToIdle(bowCoords.x, bowCoords.y, -Math.PI / 4);
    }
  }

  /**
   * Resolves preset strings ('bottom-left', 'top-right') or explicit {x, y} coordinates.
   */
  calculatePosition(posConfig, type) {
    if (typeof posConfig === 'object' && posConfig !== null) {
      return { x: posConfig.x, y: posConfig.y };
    }

    if (type === 'bow') {
      const marginX = Math.max(50, Math.min(100, this.width * 0.08));
      const marginY = Math.max(60, Math.min(110, this.height * 0.12));

      switch (posConfig) {
        case 'bottom-right':
          return { x: this.width - marginX, y: this.height - marginY };
        case 'bottom-left':
        default:
          return { x: marginX, y: this.height - marginY };
      }
    } else {
      // Suspended side-profile target board hanging from the ceiling (not glued to edge)
      const marginFromEdge = Math.max(100, Math.min(160, this.width * 0.12));
      const boardX = this.width - marginFromEdge;
      const boardY = Math.max(160, Math.min(this.height * 0.38, this.height - 180));

      switch (posConfig) {
        case 'top-left':
          return { x: marginFromEdge, y: boardY };
        case 'top-right':
        default:
          return { x: boardX, y: boardY };
      }
    }
  }

  /**
   * Instantiates Bow, Projectile, Target, and Particle System.
   */
  initEntities() {
    this.bow = new Bow({
      x: this.bowPos.x,
      y: this.bowPos.y,
      maxDragRadius: this.options.maxDragRadius,
      theme: this.options.theme
    });
    this.slingshot = this.bow; // Backward compatibility alias

    this.projectile = new Projectile({
      length: 42,
      theme: this.options.theme
    });
    this.projectile.resetToIdle(this.bowPos.x, this.bowPos.y, -Math.PI / 4);

    this.target = new Target({
      x: this.targetPos.x,
      y: this.targetPos.y,
      height: 250,
      width: 26,
      theme: this.options.theme,
      initiallyDeployed: this.isOpen
    });

    this.particles = new ParticleSystem({
      theme: this.options.theme
    });

    this.popups = new ScorePopup({
      theme: this.options.theme
    });
  }

  /**
   * Initializes floating interactive trigger pill on host website.
   */
  initPromptUI() {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('arrowshot-prompt-styles')) {
      const style = document.createElement('style');
      style.id = 'arrowshot-prompt-styles';
      style.textContent = `
        @keyframes arrowshot-breathe {
          0%, 100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45), 0 0 14px rgba(245, 158, 11, 0.18);
          }
          50% {
            transform: translateY(-2.5px) scale(1.025);
            box-shadow: 0 14px 34px rgba(0, 0, 0, 0.55), 0 0 22px rgba(245, 158, 11, 0.32);
          }
        }
        @keyframes arrowshot-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.8); }
        }
        .arrowshot-prompt-btn {
          position: fixed;
          z-index: 100001;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          background: rgba(18, 18, 22, 0.90);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(245, 158, 11, 0.32);
          border-radius: 9999px;
          padding: 10px 18px;
          color: #f4f4f5;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
          font-size: 13.5px;
          font-weight: 500;
          line-height: 1;
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.22s ease,
                      background-color 0.22s ease,
                      box-shadow 0.22s ease;
          animation: arrowshot-breathe 3.2s infinite ease-in-out;
        }
        .arrowshot-prompt-btn:hover {
          border-color: rgba(245, 158, 11, 0.7);
          background: rgba(24, 24, 30, 0.96);
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.6), 0 0 24px rgba(245, 158, 11, 0.38);
        }
        .arrowshot-prompt-btn:active {
          transform: translateY(0) scale(0.97);
        }
        .arrowshot-prompt-btn.is-active {
          animation: none;
          background: rgba(24, 24, 28, 0.88);
          border-color: rgba(255, 255, 255, 0.16);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          padding: 8px 14px;
          font-size: 12.5px;
          color: #a1a1aa;
        }
        .arrowshot-prompt-btn.is-active:hover {
          border-color: rgba(239, 68, 68, 0.5);
          color: #f4f4f5;
          background: rgba(30, 24, 26, 0.94);
        }
        .arrowshot-prompt-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f59e0b;
          box-shadow: 0 0 8px #f59e0b;
          display: inline-block;
          animation: arrowshot-dot-pulse 2s infinite ease-in-out;
        }
        .arrowshot-prompt-tag {
          font-size: 11px;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.28);
          padding: 3px 8px;
          border-radius: 9999px;
          letter-spacing: 0.02em;
          font-weight: 600;
        }
      `;
      document.head.appendChild(style);
    }

    this.promptBtn = document.createElement('button');
    this.promptBtn.id = 'arrowshot-prompt';
    this.promptBtn.className = 'arrowshot-prompt-btn' + (this.isOpen ? ' is-active' : '');

    // Positioning
    const pos = this.options.promptPosition;
    if (typeof pos === 'object' && pos !== null) {
      Object.assign(this.promptBtn.style, pos);
    } else {
      switch (pos) {
        case 'bottom-left':
          this.promptBtn.style.bottom = '24px';
          this.promptBtn.style.left = '24px';
          break;
        case 'top-right':
          this.promptBtn.style.top = '24px';
          this.promptBtn.style.right = '24px';
          break;
        case 'top-left':
          this.promptBtn.style.top = '24px';
          this.promptBtn.style.left = '24px';
          break;
        case 'bottom-right':
        default:
          this.promptBtn.style.bottom = '24px';
          this.promptBtn.style.right = '28px';
          break;
      }
    }

    this.updatePromptButtonUI();

    this.promptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.mountTarget.appendChild(this.promptBtn);
  }

  /**
   * Updates prompt pill content according to open/closed state.
   */
  updatePromptButtonUI() {
    if (!this.promptBtn) return;
    if (this.isOpen) {
      this.promptBtn.classList.add('is-active');
      this.promptBtn.innerHTML = `
        <span style="font-size: 12px; opacity: 0.75;">✕</span>
        <span>${this.options.closeText}</span>
      `;
      this.promptBtn.setAttribute('aria-label', this.options.closeText);
      this.promptBtn.title = 'Oyunu kapat';
    } else {
      this.promptBtn.classList.remove('is-active');
      this.promptBtn.innerHTML = `
        <span class="arrowshot-prompt-dot"></span>
        <span>${this.options.promptText}</span>
        <span class="arrowshot-prompt-tag">Ok At</span>
      `;
      this.promptBtn.setAttribute('aria-label', this.options.promptText);
      this.promptBtn.title = 'Oyunu başlat';
    }
  }

  /**
   * Public API: Activates and opens the widget.
   * Target plunges down from the ceiling with pendulum drop animation.
   */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.openProgress = 0;
    this.triggerZone.style.display = 'block';

    this.updatePromptButtonUI();
    this.target.startDrop();

    this.options.onOpen?.();
  }

  /**
   * Public API: Closes and retracts the widget.
   * Target retracts back into the ceiling, bow fades away.
   */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.triggerZone.style.display = 'none';

    this.updatePromptButtonUI();
    this.target.startRetract();

    if (this.state === GameState.AIMING || this.state === GameState.FLYING) {
      this.resetCycle();
    }

    this.options.onClose?.();
  }

  /**
   * Public API: Toggles widget open/closed state.
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Configures non-intrusive pointer interactions via pointer capture.
   */
  setupInteractions() {
    const trigger = this.triggerZone;

    trigger.addEventListener('pointerenter', () => {
      if (this.state === GameState.IDLE) {
        this.bow.isHovered = true;
      }
    });

    trigger.addEventListener('pointerleave', () => {
      if (this.state === GameState.IDLE) {
        this.bow.isHovered = false;
      }
    });

    trigger.addEventListener('pointerdown', (e) => {
      if (this.state !== GameState.IDLE) return;

      trigger.setPointerCapture(e.pointerId);
      trigger.style.cursor = 'grabbing';
      this.state = GameState.AIMING;
      this.bow.isHovered = true;

      this.updateDrag(e.clientX, e.clientY);
      this.playSound('aim');
    });

    trigger.addEventListener('pointermove', (e) => {
      if (this.state !== GameState.AIMING) return;
      this.updateDrag(e.clientX, e.clientY);
    });

    const releaseHandler = (e) => {
      if (this.state !== GameState.AIMING) return;

      try {
        trigger.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignore if already released
      }
      trigger.style.cursor = 'grab';
      this.bow.isHovered = false;

      // Minimum pull threshold to avoid accidental micro-clicks
      if (this.dragData.distance >= 12) {
        this.fireProjectile();
      } else {
        // Cancel pull smoothly
        this.state = GameState.IDLE;
        this.projectile.resetToIdle(this.bowPos.x, this.bowPos.y, -Math.PI / 4);
      }
    };

    trigger.addEventListener('pointerup', releaseHandler);
    trigger.addEventListener('pointercancel', releaseHandler);
  }

  /**
   * Computes clamped drag displacement and updates projectile aiming pose.
   */
  updateDrag(clientX, clientY) {
    this.dragData = Physics.calculatePullVector(
      this.bowPos.x,
      this.bowPos.y,
      clientX,
      clientY,
      this.options.maxDragRadius
    );

    this.projectile.updateAiming(
      this.dragData.dragX,
      this.dragData.dragY,
      this.dragData.dx,
      this.dragData.dy
    );
  }

  /**
   * Fires arrow with calculated initial velocity.
   */
  fireProjectile() {
    this.state = GameState.FLYING;
    this.totalShots++;

    const vel = Physics.calculateLaunchVelocity(
      this.dragData.dx,
      this.dragData.dy,
      this.options.powerMultiplier
    );

    this.projectile.launch(vel.vx, vel.vy);
    this.bow.triggerSnapBack(this.dragData.dx, this.dragData.dy);

    // Disable trigger hotspot while projectile is active
    this.triggerZone.style.pointerEvents = 'none';

    this.playSound('release');
  }

  /**
   * Handles target hit event.
   */
  onTargetHit(hitResult) {
    this.state = GameState.HIT;
    this.hits++;
    this.totalScore += hitResult.score;

    const impactX = hitResult.impactX ?? this.projectile.x;
    const impactY = hitResult.impactY ?? this.projectile.y;

    // Record relative coordinate on target board for swinging follow
    this.stuckRelY = impactY - this.target.y;
    this.stuckBaseAngle = this.projectile.angle;

    // Stick arrow into front face of target
    this.projectile.stick(impactX, impactY, this.projectile.angle);

    // Trigger physical pendulum swing on suspended target
    const impactSpeed = Math.hypot(this.projectile.vx, this.projectile.vy);
    this.target.hit(impactY, Math.max(12, impactSpeed));

    // Emit minimalist micro-sparks leftward from impact face
    this.particles.emitSparks(impactX, impactY, this.projectile.angle, 24);

    // Spawn floating score pill
    this.popups.spawn(this.target.x - 36, impactY, hitResult.score, hitResult.tier);

    this.playSound('hit');

    // Callback notification
    if (typeof this.options.onHit === 'function') {
      this.options.onHit(hitResult.score, this.totalScore);
    }

    // Schedule reset (allows full visual enjoyment of the pendulum swing)
    this.resetTimer = 1.45;
  }

  /**
   * Handles miss or out-of-bounds event.
   */
  onMiss() {
    if (this.state === GameState.FLYING) {
      this.state = GameState.MISS;

      this.playSound('miss');

      if (typeof this.options.onMiss === 'function') {
        this.options.onMiss();
      }

      this.resetTimer = 0.9;
    }
  }

  /**
   * Resets game state smoothly back to IDLE.
   */
  resetCycle() {
    this.state = GameState.IDLE;
    this.stuckRelY = null;
    this.projectile.resetToIdle(this.bowPos.x, this.bowPos.y, -Math.PI / 4);
    this.triggerZone.style.pointerEvents = 'auto';
  }

  /**
   * Synthesizes minimalist mechanical UI audio tones via Web Audio API.
   */
  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    } catch (e) {
      this.audioCtx = null;
    }
  }

  playSound(type) {
    if (!this.options.enableSound || !this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (type === 'release') {
      // Crisp whip / snap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'hit') {
      // Minimalist metallic chime / chime click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'miss') {
      // Dull floor thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.14);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    }
  }

  /**
   * Main game animation loop.
   */
  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * Per-frame updates.
   */
  update(dt) {
    // Smooth transition tracking for bow and arrow entrance
    if (this.isOpen && this.openProgress < 1) {
      this.openProgress = Math.min(1, this.openProgress + dt / 0.45);
    } else if (!this.isOpen && this.openProgress > 0) {
      this.openProgress = Math.max(0, this.openProgress - dt / 0.35);
    }

    this.bow.update(dt);
    this.target.update(dt);
    this.particles.update(dt);
    this.popups.update(dt);

    if (this.state === GameState.FLYING) {
      const prevX = this.projectile.x;
      this.projectile.update(this.options.gravity, this.options.airResistance, dt);

      // Check collision with side-profile vertical target board
      const hitResult = Collision.checkBoardHit(
        this.projectile.x,
        this.projectile.y,
        prevX,
        this.target.x + this.target.offsetX,
        this.target.y + this.target.offsetY,
        this.target.height,
        this.target.width
      );

      if (hitResult.hit) {
        this.onTargetHit(hitResult);
        return;
      }

      // Check floor ground collision
      if (Collision.checkGroundHit(this.projectile.y, this.height, 16)) {
        this.projectile.stick(this.projectile.x, this.height - 16, this.projectile.angle);
        this.onMiss();
        return;
      }

      // Check out of bounds
      if (Collision.isOutOfBounds(this.projectile.x, this.projectile.y, this.width, this.height)) {
        this.onMiss();
        return;
      }
    } else if (this.state === GameState.HIT) {
      this.projectile.update(this.options.gravity, this.options.airResistance, dt);

      // Embedded arrow swings and tilts in unison with the suspended board
      if (typeof this.stuckRelY === 'number') {
        const worldCoords = this.target.toWorldCoords(0, this.stuckRelY);
        this.projectile.x = worldCoords.x;
        this.projectile.y = worldCoords.y;
        this.projectile.angle = this.stuckBaseAngle + worldCoords.angleDelta;
      }

      this.resetTimer -= dt;
      if (this.resetTimer <= 0) {
        this.resetCycle();
      }
    } else if (this.state === GameState.MISS) {
      this.projectile.update(this.options.gravity, this.options.airResistance, dt);
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) {
        this.resetCycle();
      }
    }
  }

  /**
   * Renders trajectory guide dots.
   */
  renderTrajectory() {
    if (!this.options.enableTrajectory || this.state !== GameState.AIMING) return;
    if (this.dragData.distance < 12) return;

    const vel = Physics.calculateLaunchVelocity(
      this.dragData.dx,
      this.dragData.dy,
      this.options.powerMultiplier
    );

    const points = Physics.predictTrajectory(
      this.bowPos.x,
      this.bowPos.y,
      vel.vx,
      vel.vy,
      this.options.gravity,
      this.options.airResistance,
      80,
      2
    );

    const ctx = this.ctx;
    ctx.save();

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const radius = MathUtils.clamp(2.4 - (i / points.length) * 1.2, 1.1, 2.4);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 158, 11, ${pt.alpha * 0.75})`;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Master render routine.
   */
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // If completely closed and target is not in motion, skip rendering
    if (!this.isOpen && this.openProgress <= 0 && !this.target.isDropping && !this.target.isRetracting) {
      return;
    }

    // 1. Target Board (Renders ceiling mount, suspension cord & swinging board)
    this.target.render(ctx);

    // 2. Bow & Arrow with smooth entrance fade and slide
    const isAiming = this.state === GameState.AIMING;
    const bowAlpha = MathUtils.clamp(this.openProgress, 0, 1);
    const bowSlide = (1 - Math.sin(bowAlpha * Math.PI / 2)) * 48;

    if (bowAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = bowAlpha;
      ctx.translate(0, bowSlide);

      // Back layer of bow (bowstring and draw guide)
      this.bow.renderBack(
        ctx,
        isAiming,
        this.dragData.dragX,
        this.dragData.dragY,
        this.dragData.ratio
      );

      // Trajectory prediction dots
      this.renderTrajectory();

      // Front layer of bow (recurve limbs, riser grip, arrow shelf)
      this.bow.renderFront(
        ctx,
        isAiming,
        this.dragData.dragX,
        this.dragData.dragY,
        this.dragData.ratio
      );

      ctx.restore();
    }

    // 3. Arrow Projectile
    // Rendered independently so stuck or flying arrows maintain exact coordinates
    if (this.state === GameState.HIT || this.state === GameState.MISS || this.state === GameState.FLYING) {
      this.projectile.render(ctx);
    } else if (bowAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = bowAlpha;
      ctx.translate(0, bowSlide);
      this.projectile.render(ctx);
      ctx.restore();
    }

    // 4. FX Micro-Sparks
    this.particles.render(ctx);

    // 5. FX Score Popups
    this.popups.render(ctx);
  }

  /**
   * Public API: reset game score and projectile.
   */
  reset() {
    this.totalScore = 0;
    this.totalShots = 0;
    this.hits = 0;
    this.particles.clear();
    this.popups.clear();
    this.resetCycle();
  }

  /**
   * Public API: get current game metrics.
   */
  getStats() {
    return {
      score: this.totalScore,
      shots: this.totalShots,
      hits: this.hits,
      accuracy: this.totalShots > 0 ? Math.round((this.hits / this.totalShots) * 100) : 0
    };
  }

  /**
   * Cleanup method to remove DOM elements and listeners.
   */
  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.handleResize);
    this.canvas?.remove();
    this.triggerZone?.remove();
    this.promptBtn?.remove();
    if (this.audioCtx) this.audioCtx.close();
  }
}

// Auto-register to window in browser environments for direct CDN/script-tag usage
if (typeof window !== 'undefined') {
  window.ArrowPuck = ArrowShot;
  window.ArrowShot = ArrowShot;
}

export const ArrowPuck = ArrowShot;
export default ArrowPuck;
