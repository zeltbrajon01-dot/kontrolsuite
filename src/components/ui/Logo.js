import { useTheme, THEMES } from '../../contexts/ThemeContext';

export default function Logo({ size = 'md', collapsed = false, variant = 'auto' }) {
  const { currentId } = useTheme();

  // Width-based sizing: sm=sidebar, lg=login card
  const widths = { sm: 80, md: 100, lg: 120, xl: 150 };
  const w = collapsed ? 44 : widths[size] ?? 80;

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

  const src = darkSidebar ? '/logo-claro.png' : '/logo-oscuro.png';

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
