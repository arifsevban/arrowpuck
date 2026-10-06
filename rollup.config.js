import terser from '@rollup/plugin-terser';

export default [
  // 1. UMD / Minified Bundle (for CDN script-tags, window.ArrowPuck / window.ArrowShot)
  {
    input: 'src/ArrowShot.js',
    output: {
      file: 'dist/arrowpuck.min.js',
      format: 'umd',
      name: 'ArrowPuck',
      exports: 'named',
      sourcemap: true
    },
    plugins: [
      terser({
        compress: {
          drop_console: false,
          passes: 2
        },
        format: {
          comments: false
        }
      })
    ]
  },
  // 2. ES Module Bundle (for npm import / bundlers)
  {
    input: 'src/ArrowShot.js',
    output: {
      file: 'dist/arrowpuck.esm.js',
      format: 'es',
      exports: 'named',
      sourcemap: true
    }
  }
];
