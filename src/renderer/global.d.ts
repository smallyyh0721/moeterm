/// <reference types="vite/client" />
import type { MoetermApi } from '../shared/api';

declare global {
  interface Window {
    moeterm: MoetermApi;
    __kittyBootDone?: () => void;
  }
}

export {};
