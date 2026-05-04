import { useTheme, THEMES } from '../../contexts/ThemeContext';

const LOGO_V = '20260503';

export default function Logo({ size = 'md', collapsed = false, variant = 'auto' }) {
  const { currentId } = useTheme();

  // sm=sidebar expanded, lg=login card
  const widths = { sm: 160, md: 180, lg: 220, xl: 260 };
  const w = collapsed ? 48 : widths[size] ?? 120;

  // darkSidebar=true → dark bg → light logo (logo-blanco)
  // darkSidebar=false → light bg → dark logo (logo-negro)
  let darkSidebar;
  if (variant === 'light-bg' || variant === 'dark') {
    darkSidebar = false;
  } else if (variant === 'dark-bg') {
    darkSidebar = true;
  } else {
    darkSidebar = THEMES[currentId]?.darkSidebar ?? true;
  }

  const file = darkSidebar ? 'logo-blanco.png' : 'logo-negro.png';
  const src = `/${file}?v=${LOGO_V}`;

  return (
    <img
      src={src}
      alt="KontrolSuite"
      style={{
        width: w,
        height: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        display: 'block',
        userSelect: 'none',
      }}
    />
  );
}
