import { useTheme, THEMES } from '../../contexts/ThemeContext';

const LOGO_V = '20260503';

export default function Logo({ size = 'md', collapsed = false, variant = 'auto' }) {
  const { currentId } = useTheme();

  // sm=sidebar expanded, lg=login card
  const widths = { sm: 120, md: 130, lg: 160, xl: 180 };
  const w = collapsed ? 48 : widths[size] ?? 120;

  // darkSidebar=true → dark bg → light logo (logo-claro)
  // darkSidebar=false → light bg → dark logo (logo-oscuro)
  let darkSidebar;
  if (variant === 'light-bg' || variant === 'dark') {
    darkSidebar = false;
  } else if (variant === 'dark-bg') {
    darkSidebar = true;
  } else {
    darkSidebar = THEMES[currentId]?.darkSidebar ?? true;
  }

  const file = darkSidebar ? 'logo-claro.png' : 'logo-oscuro.png';
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
