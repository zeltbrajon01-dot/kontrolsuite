const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000; // 15 minutes
const PREFIX       = 'hy_rl_';

function storageKey(email) {
  return PREFIX + email.toLowerCase().trim();
}

export { MAX_ATTEMPTS as MAX_LOGIN_ATTEMPTS };

export function checkRateLimit(email) {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return { blocked: false, attempts: 0 };

    const data = JSON.parse(raw);

    if (data.lockedUntil) {
      if (Date.now() < data.lockedUntil) {
        return {
          blocked: true,
          remaining: Math.ceil((data.lockedUntil - Date.now()) / 60000),
        };
      }
      // Lock expired — clear it
      localStorage.removeItem(storageKey(email));
      return { blocked: false, attempts: 0 };
    }

    return { blocked: false, attempts: data.attempts || 0 };
  } catch {
    return { blocked: false, attempts: 0 };
  }
}

export function recordFailedAttempt(email) {
  try {
    const { attempts } = checkRateLimit(email);
    const next = attempts + 1;
    const entry = next >= MAX_ATTEMPTS
      ? { attempts: next, lockedUntil: Date.now() + LOCKOUT_MS }
      : { attempts: next };
    localStorage.setItem(storageKey(email), JSON.stringify(entry));
    return next;
  } catch {
    return 0;
  }
}

export function clearAttempts(email) {
  try { localStorage.removeItem(storageKey(email)); } catch (_) {}
}
