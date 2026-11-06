/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 배포 시 저장소 이름이 경로가 됩니다.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/sy-schedule/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '소율이 일정',
        short_name: '소율이',
        description: '소율이 가족 일정 공유 앱',
        theme_color: '#ff8fa3',
        background_color: '#fff8f0',
        display: 'standalone',
        lang: 'ko',
        start_url: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
})
