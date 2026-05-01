import { useTheme, THEMES } from '../../contexts/ThemeContext';

/**
 * variant:
 *   'auto'      — reads darkSidebar from current theme (use in sidebar)
 *   'light-bg'  — always logo-oscuro.png (logo on white/light card)
 *   'dark-bg'   — always logo-claro.png  (logo on dark background)
 *   'dark'      — legacy alias for 'light-bg'
 */
export default function Logo({ size = 'md', collapsed = false, variant = 'auto' }) {
  const { currentId } = useTheme();

  const heights    = { sm: 30, md: 36, lg: 44, xl: 56 };
  const collHeights = { sm: 26, md: 30, lg: 36, xl: 44 };
  const h = collapsed ? collHeights[size] : heights[size];

  let darkSidebar;
  if (variant === 'light-bg' || variant === 'dark') {
    darkSidebar = false; // light background → dark logo
  } else if (variant === 'dark-bg') {
    darkSidebar = true;  // dark background → light logo
  } else {
    // 'auto' — read from theme definition
    darkSidebar = THEMES[currentId]?.darkSidebar ?? true;
  }

  const src = darkSidebar ? '/logo-claro.png' : '/logo-oscuro.png';

  return (
    <img
      src={src}
      alt="KontrolSuite"
      style={{
        height: h,
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        display: 'block',
        userSelect: 'none',
      }}
    />
  );
}
