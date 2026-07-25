import { createContext, useContext, useState, useEffect } from "react";
import { vi } from "../locales/vi";
import { en } from "../locales/en";

const LanguageContext = createContext(null);

const locales = { vi, en };

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("language") || "vi";
  });

  const changeLanguage = (lang) => {
    if (lang === "vi" || lang === "en") {
      setLanguage(lang);
      localStorage.setItem("language", lang);
    }
  };

  const t = (key) => {
    const currentDict = locales[language] || vi;
    return currentDict[key] || vi[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
