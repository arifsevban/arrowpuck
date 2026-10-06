/**
 * ArrowShot.js - Main Entry and Orchestration Class
 * Implements GDD Section 1-8: Full lifecycle management, non-intrusive Canvas layer,
 * high-DPI scaling, Euler physics, micro-sparks, and responsive layout.
 */

import { MathUtils } from './utils/MathUtils.js';
import { Physics } from './core/Physics.js';
import { Collision } from './core/Collision.js';
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
      gravity: 0.42,
      powerMultiplier: 0.22,
      maxDragRadius: 90,
      airResistance: 0.998,
      theme: {
        primaryColor: '#f59e0b',
        arrowColor: '#27272a',
        targetRingColors: ['#18181b', '#27272a', '#f59e0b']
      },
      enableTrajectory: true,
      enableSound: false,
      onHit: (score, totalScore) => {},
      onMiss: () => {},
      ...options
    };

    // State & Scores
    this.state = GameState.IDLE;
    this.totalScore = 0;
    this.totalShots = 0;
    this.hits = 0;

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
   * Sets up full-screen fixed canvas and minimal trigger hotspot.
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
    this.triggerZone.style.width = '96px';
    this.triggerZone.style.height = '96px';
    this.triggerZone.style.borderRadius = '50%';
    this.triggerZone.style.pointerEvents = 'auto';
    this.triggerZone.style.cursor = 'grab';
    this.triggerZone.style.zIndex = '100000';
    this.triggerZone.style.touchAction = 'none';
    this.triggerZone.style.userSelect = 'none';
    this.triggerZone.style.webkitUserSelect = 'none';
    this.triggerZone.setAttribute('aria-label', 'ArrowShot Launcher');
    this.triggerZone.title = 'Tıkla ve geriye çekerek nişan al';

    this.mountTarget.appendChild(this.triggerZone);

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
      this.triggerZone.style.left = `${bowCoords.x - 48}px`;
      this.triggerZone.style.top = `${bowCoords.y - 48}px`;
    }

    if (this.slingshot) {
      this.slingshot.setPosition(bowCoords.x, bowCoords.y);
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
      const marginX = Math.max(60, Math.min(120, this.width * 0.10));
      const marginY = Math.max(60, Math.min(110, this.height * 0.14));

      switch (posConfig) {
        case 'top-left':
          return { x: marginX, y: marginY };
        case 'top-right':
        default:
          return { x: this.width - marginX, y: marginY };
      }
    }
  }

  /**
   * Instantiates Slingshot, Projectile, Target, and Particle System.
   */
  initEntities() {
    this.slingshot = new Slingshot({
      x: this.bowPos.x,
      y: this.bowPos.y,
      maxDragRadius: this.options.maxDragRadius,
      theme: this.options.theme
    });

    this.projectile = new Projectile({
      length: 42,
      theme: this.options.theme
    });
    this.projectile.resetToIdle(this.bowPos.x, this.bowPos.y, -Math.PI / 4);

    this.target = new Target({
      x: this.targetPos.x,
      y: this.targetPos.y,
      radius: 40,
      theme: this.options.theme
    });

    this.particles = new ParticleSystem({
      theme: this.options.theme
    });

    this.popups = new ScorePopup({
      theme: this.options.theme
    });
  }

  /**
   * Configures non-intrusive pointer interactions via pointer capture.
   */
  setupInteractions() {
    const trigger = this.triggerZone;

    trigger.addEventListener('pointerenter', () => {
      if (this.state === GameState.IDLE) {
        this.slingshot.isHovered = true;
      }
    });

    trigger.addEventListener('pointerleave', () => {
      if (this.state === GameState.IDLE) {
        this.slingshot.isHovered = false;
      }
    });

    trigger.addEventListener('pointerdown', (e) => {
      if (this.state !== GameState.IDLE) return;

      trigger.setPointerCapture(e.pointerId);
      trigger.style.cursor = 'grabbing';
      this.state = GameState.AIMING;
      this.slingshot.isHovered = true;

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
      this.slingshot.isHovered = false;

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
    this.slingshot.triggerSnapBack(this.dragData.dx, this.dragData.dy);

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

    // Stick arrow into target
    this.projectile.stick(this.projectile.x, this.projectile.y, this.projectile.angle);

    // Recoil shake on target
    const impactSpeed = Math.hypot(this.projectile.vx, this.projectile.vy);
    this.target.hit(this.projectile.angle, Math.max(10, impactSpeed * 0.8));

    // Emit minimalist micro-sparks
    this.particles.emitSparks(this.projectile.x, this.projectile.y, this.projectile.angle, 24);

    // Spawn floating score pill
    this.popups.spawn(this.target.x, this.target.y, hitResult.score, hitResult.tier);

    this.playSound('hit');

    // Callback notification
    if (typeof this.options.onHit === 'function') {
      this.options.onHit(hitResult.score, this.totalScore);
    }

    // Schedule reset
    this.resetTimer = 1.3;
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
    this.slingshot.update(dt);
    this.target.update(dt);
    this.particles.update(dt);
    this.popups.update(dt);

    if (this.state === GameState.FLYING) {
      this.projectile.update(this.options.gravity, this.options.airResistance, dt);

      // Check collision with target
      const hitResult = Collision.checkTargetHit(
        this.projectile.x,
        this.projectile.y,
        this.target.x + this.target.offsetX,
        this.target.y + this.target.offsetY,
        this.target.radius
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
    } else if (this.state === GameState.HIT || this.state === GameState.MISS) {
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
      52,
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

    const isAiming = this.state === GameState.AIMING;

    // 1. Back layer of slingshot (left band, max-drag bounds)
    this.slingshot.renderBack(
      ctx,
      isAiming,
      this.dragData.dragX,
      this.dragData.dragY,
      this.dragData.ratio
    );

    // 2. Trajectory prediction dots
    this.renderTrajectory();

    // 3. Arrow Projectile
    if (this.state === GameState.HIT) {
      this.projectile.render(ctx, this.target.offsetX, this.target.offsetY);
    } else {
      this.projectile.render(ctx);
    }

    // 4. Front layer of slingshot (right band, handle, pouch)
    this.slingshot.renderFront(
      ctx,
      isAiming,
      this.dragData.dragX,
      this.dragData.dragY,
      this.dragData.ratio
    );

    // 5. Target Board
    this.target.render(ctx);

    // 6. FX Micro-Sparks
    this.particles.render(ctx);

    // 7. FX Score Popups
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
    if (this.audioCtx) this.audioCtx.close();
  }
}

// Auto-register to window in browser environments for direct CDN/script-tag usage
if (typeof window !== 'undefined') {
  window.ArrowShot = ArrowShot;
  window.ArrowPuck = ArrowShot;
}

export default ArrowShot;
