import React from 'react';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/dark-mode.css";
import { initializeTheme } from './lib/theme-utils';

// تهيئة السمة (الوضع الداكن/الفاتح) بناءً على تفضيلات المستخدم
initializeTheme();

// Register Arabic language for date-fns
import { ar } from 'date-fns/locale';
import { registerLocale, setDefaultLocale } from "react-datepicker";
registerLocale('ar', ar);
setDefaultLocale('ar');

createRoot(document.getElementById("root")!).render(
  <App />
);
