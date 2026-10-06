import { MathUtils } from '../src/utils/MathUtils.js';
import { Physics } from '../src/core/Physics.js';
import { Collision } from '../src/core/Collision.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('--- Testing MathUtils ---');
assert(MathUtils.clamp(150, 0, 100) === 100, 'clamp upper bound');
assert(MathUtils.clamp(-20, 0, 100) === 0, 'clamp lower bound');
assert(MathUtils.clamp(45, 0, 100) === 45, 'clamp within bounds');
assert(MathUtils.lerp(10, 20, 0.5) === 15, 'lerp 50%');
assert(Math.abs(MathUtils.distance(0, 0, 3, 4) - 5) < 0.0001, 'distance 3-4-5 triangle');

console.log('\n--- Testing Physics Pull & Clamping ---');
const anchorX = 100;
const anchorY = 500;

// Pulling to (50, 550) -> raw displacement is (100 - 50, 500 - 550) = (50, -50), dist = sqrt(5000) ~ 70.71 (< 90)
const pull1 = Physics.calculatePullVector(anchorX, anchorY, 50, 550, 90);
assert(pull1.dx === 50 && pull1.dy === -50, 'pull within radius dx, dy match');
assert(Math.abs(pull1.distance - 70.71) < 0.1, 'pull distance calculation');
assert(pull1.ratio === pull1.distance / 90, 'pull ratio calculation');

// Pulling far away: to (-100, 700) -> distance ~ 282.8 > 90
const pullClamped = Physics.calculatePullVector(anchorX, anchorY, -100, 700, 90);
assert(Math.abs(pullClamped.distance - 90) < 0.001, 'pull distance clamped to maxDragRadius');
assert(pullClamped.ratio === 1.0, 'clamped pull ratio is 1.0');

console.log('\n--- Testing Launch Velocity ---');
const vel = Physics.calculateLaunchVelocity(pull1.dx, pull1.dy, 0.22);
assert(vel.vx === 50 * 0.22, 'vel.vx computed properly');
assert(vel.vy === -50 * 0.22, 'vel.vy computed properly');

console.log('\n--- Testing Flight Euler Integration ---');
const state = { x: 100, y: 500, vx: vel.vx, vy: vel.vy, angle: 0 };
Physics.stepFlight(state, 0.42, 0.998);
assert(state.x === 100 + vel.vx * 0.998, 'state.x Euler step with drag');
assert(state.vy === vel.vy + 0.42, 'state.vy Euler step with gravity');
assert(state.y === 500 + state.vy, 'state.y updated with new vy');
assert(Math.abs(state.angle - Math.atan2(state.vy, state.vx)) < 0.0001, 'angle tangent to velocity');

console.log('\n--- Testing Trajectory Prediction ---');
const traj = Physics.predictTrajectory(anchorX, anchorY, vel.vx, vel.vy, 0.42, 0.998, 30, 3);
assert(traj.length === 10, 'trajectory sampled every 3 frames over 30 frames produces 10 points');
assert(traj[0].x > anchorX, 'trajectory moves forward in x');
assert(traj[0].alpha <= 1.0 && traj[traj.length - 1].alpha < traj[0].alpha, 'trajectory alpha fades along arc');

console.log('\n--- Testing Collision & Scoring ---');
const targetX = 800;
const targetY = 150;
const targetRadius = 40;

// Bullseye hit (distance <= 0.33 * 40 = 13.2)
const hitBullseye = Collision.checkTargetHit(targetX + 5, targetY + 5, targetX, targetY, targetRadius);
assert(hitBullseye.hit === true, 'bullseye hit is true');
assert(hitBullseye.score === 300, 'bullseye score is 300');
assert(hitBullseye.tier === 'bullseye', 'bullseye tier');

// Middle ring hit (distance = 20, which is > 13.2 and <= 26.4)
const hitMiddle = Collision.checkTargetHit(targetX + 20, targetY, targetX, targetY, targetRadius);
assert(hitMiddle.hit === true, 'middle ring hit is true');
assert(hitMiddle.score === 150, 'middle ring score is 150');
assert(hitMiddle.tier === 'inner', 'inner tier');

// Outer ring hit (distance = 35, <= 40)
const hitOuter = Collision.checkTargetHit(targetX + 35, targetY, targetX, targetY, targetRadius);
assert(hitOuter.hit === true, 'outer ring hit is true');
assert(hitOuter.score === 50, 'outer ring score is 50');
assert(hitOuter.tier === 'outer', 'outer tier');

// Complete miss (distance = 55 > 40)
const miss = Collision.checkTargetHit(targetX + 55, targetY, targetX, targetY, targetRadius);
assert(miss.hit === false, 'miss hit is false');

console.log('\n🎉 ALL PHYSICS & COLLISION VERIFICATIONS PASSED 100%!');
