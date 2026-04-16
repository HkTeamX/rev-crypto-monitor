import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      './src-tauri/target/**',
      './src-tauri/gen/**',
      '**/vite-env.d.ts',
    ],
  },
)
