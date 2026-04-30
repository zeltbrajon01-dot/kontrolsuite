import { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = {
  default: {
    id: 'default',
    name: 'Predeterminado',
    desc: 'Oscuro azul marino',
    preview: { sidebar: '#0a1121', main: '#0d1829', accent: '#2563EB', card: '#111e31' },
    vars: {
      '--hy-bg-main':            '#0d1829',
      '--hy-bg-sidebar':         '#0a1121',
      '--hy-bg-header':          '#0b1424',
      '--hy-bg-card':            '#111e31',
      '--hy-bg-card2':           '#0f1929',
      '--hy-bg-input':           '#0d1829',
      '--hy-border':             '#1a2840',
      '--hy-border2':            '#1e2f47',
      '--hy-text1':              '#e2e8f0',
      '--hy-text2':              '#94a3b8',
      '--hy-text3':              '#4e6685',
      '--hy-text4':              '#2d4461',
      '--hy-brand':              '#2563EB',
      '--hy-brand-hover':        '#1d4ed8',
      '--hy-nav-text':           '#4e6685',
      '--hy-nav-text-hover':     '#94a3b8',
      '--hy-nav-text-active':    '#e2e8f0',
      '--hy-nav-active-bg':      'rgba(37,99,235,0.13)',
      '--hy-nav-active-shadow':  'inset 3px 0 0 #2563EB',
      '--hy-nav-hover-bg':       '#162236',
      '--hy-nav-section':        '#2d4461',
      '--hy-nav-icon-active':    '#2563EB',
      '--hy-th-bg':              '#0d1829',
      '--hy-sidebar-border':     '1px solid #1a2840',
      '--hy-header-border':      '1px solid #1a2840',
    },
  },

  blue: {
    id: 'blue',
    name: 'Azul Corporativo',
    desc: 'Blanco con sidebar azul marino',
    preview: { sidebar: '#1e3a5f', main: '#f1f5f9', accent: '#2563EB', card: '#ffffff' },
    vars: {
      '--hy-bg-main':            '#f1f5f9',
      '--hy-bg-sidebar':         '#1e3a5f',
      '--hy-bg-header':          '#ffffff',
      '--hy-bg-card':            '#ffffff',
      '--hy-bg-card2':           '#f8fafc',
      '--hy-bg-input':           '#f1f5f9',
      '--hy-border':             '#e2e8f0',
      '--hy-border2':            '#cbd5e1',
      '--hy-text1':              '#0f172a',
      '--hy-text2':              '#334155',
      '--hy-text3':              '#64748b',
      '--hy-text4':              '#94a3b8',
      '--hy-brand':              '#2563EB',
      '--hy-brand-hover':        '#1d4ed8',
      '--hy-nav-text':           'rgba(255,255,255,0.5)',
      '--hy-nav-text-hover':     'rgba(255,255,255,0.9)',
      '--hy-nav-text-active':    '#ffffff',
      '--hy-nav-active-bg':      'rgba(255,255,255,0.15)',
      '--hy-nav-active-shadow':  'inset 3px 0 0 #60a5fa',
      '--hy-nav-hover-bg':       'rgba(255,255,255,0.08)',
      '--hy-nav-section':        'rgba(255,255,255,0.3)',
      '--hy-nav-icon-active':    '#60a5fa',
      '--hy-th-bg':              '#f8fafc',
      '--hy-sidebar-border':     '1px solid rgba(255,255,255,0.1)',
      '--hy-header-border':      '1px solid #e2e8f0',
    },
  },

  green: {
    id: 'green',
    name: 'Verde Esmeralda',
    desc: 'Blanco con sidebar verde oscuro',
    preview: { sidebar: '#064E3B', main: '#f0fdf4', accent: '#059669', card: '#ffffff' },
    vars: {
      '--hy-bg-main':            '#f0fdf4',
      '--hy-bg-sidebar':         '#064E3B',
      '--hy-bg-header':          '#ffffff',
      '--hy-bg-card':            '#ffffff',
      '--hy-bg-card2':           '#f0fdf4',
      '--hy-bg-input':           '#f0fdf4',
      '--hy-border':             '#d1fae5',
      '--hy-border2':            '#a7f3d0',
      '--hy-text1':              '#065f46',
      '--hy-text2':              '#374151',
      '--hy-text3':              '#6b7280',
      '--hy-text4':              '#9ca3af',
      '--hy-brand':              '#059669',
      '--hy-brand-hover':        '#047857',
      '--hy-nav-text':           'rgba(255,255,255,0.5)',
      '--hy-nav-text-hover':     'rgba(255,255,255,0.9)',
      '--hy-nav-text-active':    '#ffffff',
      '--hy-nav-active-bg':      'rgba(255,255,255,0.12)',
      '--hy-nav-active-shadow':  'inset 3px 0 0 #6ee7b7',
      '--hy-nav-hover-bg':       'rgba(255,255,255,0.07)',
      '--hy-nav-section':        'rgba(255,255,255,0.3)',
      '--hy-nav-icon-active':    '#6ee7b7',
      '--hy-th-bg':              '#f9fafb',
      '--hy-sidebar-border':     '1px solid rgba(255,255,255,0.08)',
      '--hy-header-border':      '1px solid #d1fae5',
    },
  },

  purple: {
    id: 'purple',
    name: 'Midnight Purple',
    desc: 'Gris oscuro con sidebar morado',
    preview: { sidebar: '#4C1D95', main: '#1E1E2E', accent: '#cba6f7', card: '#24243e' },
    vars: {
      '--hy-bg-main':            '#1E1E2E',
      '--hy-bg-sidebar':         '#4C1D95',
      '--hy-bg-header':          '#181825',
      '--hy-bg-card':            '#24243e',
      '--hy-bg-card2':           '#1a1a2e',
      '--hy-bg-input':           '#181825',
      '--hy-border':             '#383854',
      '--hy-border2':            '#45455f',
      '--hy-text1':              '#cdd6f4',
      '--hy-text2':              '#bac2de',
      '--hy-text3':              '#6c7086',
      '--hy-text4':              '#585b70',
      '--hy-brand':              '#cba6f7',
      '--hy-brand-hover':        '#b98ef3',
      '--hy-nav-text':           'rgba(255,255,255,0.5)',
      '--hy-nav-text-hover':     'rgba(255,255,255,0.9)',
      '--hy-nav-text-active':    '#ffffff',
      '--hy-nav-active-bg':      'rgba(255,255,255,0.12)',
      '--hy-nav-active-shadow':  'inset 3px 0 0 #cba6f7',
      '--hy-nav-hover-bg':       'rgba(255,255,255,0.07)',
      '--hy-nav-section':        'rgba(255,255,255,0.3)',
      '--hy-nav-icon-active':    '#cba6f7',
      '--hy-th-bg':              '#181825',
      '--hy-sidebar-border':     '1px solid rgba(255,255,255,0.1)',
      '--hy-header-border':      '1px solid #383854',
    },
  },

  noir: {
    id: 'noir',
    name: 'Noir Profesional',
    desc: 'Sidebar negro, contenido blanco',
    preview: { sidebar: '#0a0a0a', main: '#f9fafb', accent: '#4F46E5', card: '#ffffff' },
    vars: {
      '--hy-bg-main':            '#f9fafb',
      '--hy-bg-sidebar':         '#0a0a0a',
      '--hy-bg-header':          '#ffffff',
      '--hy-bg-card':            '#ffffff',
      '--hy-bg-card2':           '#f3f4f6',
      '--hy-bg-input':           '#f9fafb',
      '--hy-border':             '#e5e7eb',
      '--hy-border2':            '#d1d5db',
      '--hy-text1':              '#0f172a',
      '--hy-text2':              '#334155',
      '--hy-text3':              '#64748b',
      '--hy-text4':              '#94a3b8',
      '--hy-brand':              '#4F46E5',
      '--hy-brand-hover':        '#4338CA',
      '--hy-nav-text':           'rgba(255,255,255,0.4)',
      '--hy-nav-text-hover':     'rgba(255,255,255,0.9)',
      '--hy-nav-text-active':    '#ffffff',
      '--hy-nav-active-bg':      'rgba(255,255,255,0.1)',
      '--hy-nav-active-shadow':  'inset 3px 0 0 #818cf8',
      '--hy-nav-hover-bg':       'rgba(255,255,255,0.06)',
      '--hy-nav-section':        'rgba(255,255,255,0.22)',
      '--hy-nav-icon-active':    '#818cf8',
      '--hy-th-bg':              '#f9fafb',
      '--hy-sidebar-border':     '1px solid #1c1c1c',
      '--hy-header-border':      '1px solid #e5e7eb',
    },
  },

  white: {
    id: 'white',
    name: 'Blanco Profesional',
    desc: 'Todo blanco, estilo Monday / Bitrix24',
    preview: { sidebar: '#ffffff', main: '#f4f6f8', accent: '#2563EB', card: '#ffffff' },
    vars: {
      '--hy-bg-main':            '#f4f6f8',
      '--hy-bg-sidebar':         '#ffffff',
      '--hy-bg-header':          '#ffffff',
      '--hy-bg-card':            '#ffffff',
      '--hy-bg-card2':           '#f4f6f8',
      '--hy-bg-input':           '#f4f6f8',
      '--hy-border':             '#e5e7eb',
      '--hy-border2':            '#d1d5db',
      '--hy-text1':              '#111827',
      '--hy-text2':              '#374151',
      '--hy-text3':              '#6b7280',
      '--hy-text4':              '#9ca3af',
      '--hy-brand':              '#2563EB',
      '--hy-brand-hover':        '#1d4ed8',
      '--hy-nav-text':           '#6b7280',
      '--hy-nav-text-hover':     '#111827',
      '--hy-nav-text-active':    '#1d4ed8',
      '--hy-nav-active-bg':      '#eff6ff',
      '--hy-nav-active-shadow':  'inset 3px 0 0 #2563EB',
      '--hy-nav-hover-bg':       '#f3f4f6',
      '--hy-nav-section':        '#9ca3af',
      '--hy-nav-icon-active':    '#2563EB',
      '--hy-th-bg':              '#f9fafb',
      '--hy-sidebar-border':     '1px solid #e5e7eb',
      '--hy-header-border':      '1px solid #e5e7eb',
    },
  },
};

function applyTheme(theme) {
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [currentId, setCurrentId] = useState(() => {
    const id = localStorage.getItem('hy-theme') || 'default';
    applyTheme(THEMES[id] || THEMES.default); // sync before first paint — no flash
    return id;
  });

  useEffect(() => {
    applyTheme(THEMES[currentId] || THEMES.default);
  }, [currentId]);

  function setThemeById(id) {
    if (!THEMES[id]) return;
    localStorage.setItem('hy-theme', id);
    setCurrentId(id);
  }

  return (
    <ThemeContext.Provider value={{ currentId, setThemeById, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
