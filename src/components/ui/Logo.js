export default function Logo({ size = 'md', collapsed = false, variant = 'light' }) {
  const sizes = {
    sm: { icon: 22, fontSize: '15px' },
    md: { icon: 28, fontSize: '18px' },
    lg: { icon: 36, fontSize: '24px' },
    xl: { icon: 48, fontSize: '32px' },
  };
  const { icon, fontSize } = sizes[size];
  const nameColor = variant === 'dark' ? '#0f172a' : '#ffffff';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
      <svg width={icon} height={icon} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="#2563EB" />
        <path d="M18.5 4L9 17.5H16L13.5 28L23 14.5H16L18.5 4Z" fill="white" />
      </svg>
      {!collapsed && (
        <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize, letterSpacing: '-0.5px', color: nameColor }}>
          Hell<span style={{ color: '#2563EB' }}>Yeah</span>
        </span>
      )}
    </div>
  );
}
