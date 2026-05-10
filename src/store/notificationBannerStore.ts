// src/store/notificationBannerStore.ts
import { create } from 'zustand'

type BannerData = {
  title: string
  body: string
}

type BannerState = {
  banner: BannerData | null
  isVisible: boolean
  showBanner: (data: BannerData) => void
  hideBanner: () => void
}

export const useNotificationBannerStore = create<BannerState>((set) => ({
  banner: null,
  isVisible: false,
  showBanner: (data) => set({ banner: data, isVisible: true }),
  hideBanner: () => set({ isVisible: false }),
}))