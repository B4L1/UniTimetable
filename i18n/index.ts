// i18n configuration

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import hu from './hu';
import en from './en';

const resources = {
    hu: { translation: hu },
    en: { translation: en },
};

// Detect device locale, default to Hungarian
const deviceLanguage = Localization.getLocales()[0]?.languageCode;
const defaultLanguage = deviceLanguage === 'en' ? 'en' : 'hu';

i18n.use(initReactI18next).init({
    resources,
    lng: defaultLanguage,
    fallbackLng: 'hu',
    interpolation: {
        escapeValue: false,
    },
    compatibilityJSON: 'v4',
});

export default i18n;
