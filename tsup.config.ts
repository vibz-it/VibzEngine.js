import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/react/index.ts' },
  outDir: 'react-dist',
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  external: ['react', 'react-dom'],
});
