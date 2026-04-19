import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhHK from './locales/zh-HK.json'
import en from './locales/en.json'

const storedLanguage = (() => {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem('lang') } catch { return null }
})()

i18n.use(initReactI18next).init({
  resources: { 'zh-HK': { translation: zhHK }, en: { translation: en } },
  lng: storedLanguage ?? 'zh-HK',
  fallbackLng: 'zh-HK',
  interpolation: { escapeValue: false },
})

export default i18n
