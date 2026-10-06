# arrowpuck

A lightweight, non-intrusive interactive Easter egg micro-widget built with pure Vanilla JavaScript (ES6+) and HTML5 Canvas.

arrowpuck allows developers and designers to add an elegant archery bow interaction to any webpage (portfolios, agency websites, blogs, 404 pages) without obstructing page interactions, clicking, text selection, or scrolling.

---

## Features

- Zero external dependencies: Built with native HTML5 2D Canvas and ES6+. No physics engines or bulky libraries.
- Non-intrusive by design: The full-screen canvas maintains `pointer-events: none` by default. Clicks, text selection, and scrolling pass through uninterrupted to the underlying website. Only the bow handle captures drag events.
- Physical Euler integration: Realistic parabolic arrow flight calculated with gravity acceleration and aerodynamic drag.
- Accurate trajectory preview: Real-time dotted parabolic trajectory forecast rendered dynamically while drawing the bow.
- Suspended target board scoring: Ceiling-suspended vertical archery board evaluates impact height into 5 graded challenge intervals (500 points for razor bullseye core, 300 points for inner master, 150 points for middle, 75 points for mid-outer, 25 points for outer edge) and sways realistically with pendulum physics based on arrow velocity and hit height.
- Minimalist visual aesthetics: Clean industrial design with monochrome palettes, crisp vector-sharp geometry, high-DPI retina display scaling, damped harmonic target shake, and physical micro-sparks.
- Dual distribution: Available as both an ES Module for modern bundlers and a minified UMD standalone bundle for instant CDN script-tag usage.

---

## Quick Start (CDN)

Add the standalone minified script to any HTML document before the closing `</body>` tag:

```html
<!-- Load arrowpuck from CDN -->
<script src="https://cdn.jsdelivr.net/npm/arrowpuck/dist/arrowpuck.min.js"></script>

<script>
  // Initialize widget
  const widget = new ArrowPuck({
    bowPosition: 'bottom-left',
    targetPosition: 'top-right'
  });
</script>
```

Alternatively, UNPKG can be used:

```html
<script src="https://unpkg.com/arrowpuck/dist/arrowpuck.min.js"></script>
```

---

## Installation (NPM)

Install the package via npm:

```bash
npm install arrowpuck
```

Import and initialize in your application:

```javascript
import { ArrowPuck } from 'arrowpuck';

const widget = new ArrowPuck({
  bowPosition: 'bottom-left',
  targetPosition: 'top-right',
  onHit: (score, totalScore) => {
    console.log(`Hit! Score: ${score}, Total: ${totalScore}`);
  }
});
```

---

## Configuration Options

Pass a configuration object to `new ArrowPuck(options)`:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `mountTarget` | HTMLElement | `document.body` | DOM container element where the fixed canvas is appended. |
| `bowPosition` | string \| object | `'bottom-left'` | Launcher placement. Accepts `'bottom-left'`, `'bottom-right'`, or `{ x, y }`. |
| `targetPosition` | string \| object | `'top-right'` | Target placement. Accepts `'top-right'`, `'top-left'`, or `{ x, y }`. |
| `gravity` | number | `0.38` | Vertical gravitational acceleration in pixels per frame squared. |
| `powerMultiplier` | number | `0.36` | Velocity scale factor applied to the clamped pull displacement vector. |
| `maxDragRadius` | number | `110` | Maximum pull radius in pixels. Pull distance beyond this is clamped. |
| `airResistance` | number | `0.998` | Horizontal velocity multiplier applied each frame. |
| `theme` | object | `{ ... }` | Color tokens for customization (see Theme Object below). |
| `enableTrajectory` | boolean | `true` | Enables dotted trajectory forecast line during aiming. |
| `enableSound` | boolean | `false` | Enables Web Audio API synthesized mechanical and impact sound effects. |
| `onHit` | function | `(score, total) => {}` | Callback invoked upon successful collision with the target. |
| `onMiss` | function | `() => {}` | Callback invoked when the arrow hits the floor or exits screen bounds. |

### Theme Object

```javascript
theme: {
  primaryColor: '#f59e0b',     // Accent color used for bullseye, arrowhead, and sparks
  arrowColor: '#27272a',       // Carbon arrow shaft color
  targetRingColors: [          // Colors for target concentric rings
    '#18181b',
    '#27272a',
    '#f59e0b'
  ]
}
```

---

## API Methods

Instances of `ArrowPuck` expose the following methods:

- `widget.getStats()`: Returns an object containing `{ score, shots, hits, accuracy }`.
- `widget.reset()`: Resets score, shot counters, active particles, and places the projectile in ready state.
- `widget.destroy()`: Cancels animation frames, removes DOM elements (canvas and trigger handle), and closes audio contexts.

---

## Development and Testing

Clone the repository and install developer dependencies:

```bash
git clone https://github.com/arifsevban/arrowpuck.git
cd arrowpuck
npm install
```

### Run Local Development Server

```bash
npm run dev
```

Starts the local test server at `http://localhost:3000`.

### Run Test Suite

```bash
npm test
```

Executes the automated unit and integration tests verifying vector clamping, velocity scaling, Euler flight integration, trajectory sampling, and collision tier scoring.

### Build Production Bundles

```bash
npm run build
```

Compiles the library into `dist/`:
- `dist/arrowpuck.min.js`: Minified UMD bundle with sourcemap.
- `dist/arrowpuck.esm.js`: ES Module bundle with sourcemap.

---

## License

MIT License. Created by Arif S.
