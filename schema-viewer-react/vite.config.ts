import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Note: plugin-react는 설치 후 동작합니다.
export default defineConfig({
  plugins: [react()],
})

