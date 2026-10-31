import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite is only used to build the frontend (and as dev middleware inside Express); it never runs its own server.
export default defineConfig({
  plugins: [react()],
});
