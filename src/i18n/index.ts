import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './en/common.json';
import enDashboard from './en/dashboard.json';
import enAlerts from './en/alerts.json';
import enMarkets from './en/markets.json';
import enUsers from './en/users.json';
import enAdmin from './en/admin.json';

import deCommon from './de/common.json';
import deDashboard from './de/dashboard.json';
import deAlerts from './de/alerts.json';
import deMarkets from './de/markets.json';
import deUsers from './de/users.json';
import deAdmin from './de/admin.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        dashboard: enDashboard,
        alerts: enAlerts,
        markets: enMarkets,
        users: enUsers,
        admin: enAdmin,
      },
      de: {
        common: deCommon,
        dashboard: deDashboard,
        alerts: deAlerts,
        markets: deMarkets,
        users: deUsers,
        admin: deAdmin,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'dashboard', 'alerts', 'markets', 'users', 'admin'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
