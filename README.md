# arrowpuck

A zero-dependency, non-intrusive interactive archery Easter egg for modern websites.

Add a micro-interaction to your portfolio, blog, or 404 page without breaking clicks, scrolling, or page layout.

<p align="center">
  <img src="./assets/demo.gif" alt="arrowpuck demo preview" width="720" />
</p>

- Zero external dependencies: Pure native HTML5 Canvas and ES6+ (<15KB).
- Non-intrusive: Clicks, scrolling, and text selection pass through uninterrupted.
- Physics-driven: Parabolic arrow flight and dynamic pendulum target swing.
- Ambient prompt: Starts as an elegant text link (*Bored?*) and drops the ceiling target on demand.
- Modern frameworks: Easy integration with Vanilla HTML, React, Next.js, and Vue.

---

## 1. Quick Start (HTML / CDN)

Ideal for Webflow, WordPress, Shopify, or static websites. Paste before `</body>`:

```html
<script src="https://cdn.jsdelivr.net/npm/arrowpuck/dist/arrowpuck.min.js"></script>
<script>
  const widget = new ArrowPuck({
    promptText: 'Bored?',
    onHit: (score) => console.log('Scored:', score)
  });
</script>
```

Alternatively, UNPKG can be used:

```html
<script src="https://unpkg.com/arrowpuck/dist/arrowpuck.min.js"></script>
```

---

## 2. Installation (NPM / Modern Frameworks)

Install the package via npm:

```bash
npm install arrowpuck
```

### React / Next.js

```jsx
import { useEffect } from 'react';
import { ArrowPuck } from 'arrowpuck';

export default function ArcheryWidget() {
  useEffect(() => {
    const widget = new ArrowPuck({
      promptText: 'Bored?'
    });

    return () => {
      widget.destroy(); // Prevents memory leaks on route changes
    };
  }, []);

  return null;
}
```

### Vue 3

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue';
import { ArrowPuck } from 'arrowpuck';

let widget = null;

onMounted(() => {
  widget = new ArrowPuck({
    promptText: 'Bored?'
  });
});

onUnmounted(() => {
  widget?.destroy();
});
</script>

<template>
  <!-- Mounts automatically to document.body -->
</template>
```

---

## 3. Configuration Options

Pass options to `new ArrowPuck(options)`:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `autoOpen` | boolean | `false` | When false, remains parked until visitor clicks the prompt. |
| `showPrompt` | boolean | `true` | Displays a subtle floating prompt link on the page. |
| `promptText` | string | `'Bored?'` | Text displayed in the floating prompt link before opening. |
| `closeText` | string | `'✕ Close'` | Text displayed to close or retract the target while active. |
| `promptPosition` | string \| object | `'bottom-right'` | Position of prompt (`'bottom-right'`, `'bottom-left'`, or custom `{ bottom, right }`). |
| `zIndex` | number | `9999` | Base stacking order for canvas and controls to prevent layer conflicts. |
| `bowPosition` | string \| object | `'bottom-left'` | Launcher position (`'bottom-left'`, `'bottom-right'`, or `{ x, y }`). |
| `targetPosition` | string \| object | `'top-right'` | Target position (`'top-right'`, `'top-left'`, or `{ x, y }`). |
| `theme` | object | `{ primaryColor: '#f59e0b' }` | Accent color token for bullseye, notch, sparks, and glow. |
| `enableSound` | boolean | `false` | Enables Web Audio API synthesized mechanical sounds and chimes. |
| `onHit` | function | `(score, total) => {}` | Callback invoked upon successful collision with the target. |
| `onMiss` | function | `() => {}` | Callback invoked when arrow hits the floor or exits screen bounds. |

---

## 4. API Methods

Instances of `ArrowPuck` expose lifecycle and control methods:

- `widget.open()`: Drops the suspended target from the ceiling with pendulum drop animation.
- `widget.close()`: Retracts the target board back into the ceiling and hides the bow.
- `widget.toggle()`: Toggles between open and closed states.
- `widget.getStats()`: Returns `{ score, shots, hits, accuracy }`.
- `widget.reset()`: Resets score, shot counters, active sparks, and readies arrow.
- `widget.destroy()`: Cancels animation frames, removes all DOM nodes, and cleans up event listeners.

---

## 5. Development

```bash
# Clone and install dependencies
git clone https://github.com/arifsevban/arrowpuck.git
cd arrowpuck
npm install

# Start local demo server
npm run dev

# Run test suite
npm test

# Build production bundles
npm run build
```

---

## License

[MIT License](LICENSE). Created by Arif S.
