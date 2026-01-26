/**
 * UI Strings Manifest for Hyperscape Client
 *
 * All user-facing strings are centralized here for:
 * - Consistency across the application
 * - Future i18n/localization support
 * - Easy maintenance and updates
 *
 * @packageDocumentation
 */

/**
 * Core application strings
 */
export const UI_STRINGS = {
  core: {
    loading: "Loading world...",
    entering: "Entering world...",
    connectionLost: "Connection Lost",
    reconnecting: "Reconnecting in {countdown}s...",
    reconnectNow: "Reconnect Now",
    cancel: "Cancel",
    autoReconnectCancelled: "Auto-reconnect cancelled",
    reconnect: "Reconnect",
  },

  death: {
    title: "Oh dear, you are dead!",
    killedBy: "Killed by: {killer}",
    respawn: "Click here to respawn",
    respawning: "Respawning...",
    respawnTimeout: "Respawn request timed out. Please try again.",
    itemsDropped: "Your items have been dropped at your death location.",
    timeRemaining: "Time remaining: {time}",
    itemsDespawned: "Your items have despawned!",
  },

  kicked: {
    duplicateUser: "Player already active on another device or window.",
    playerLimit: "Player limit reached.",
    unknown: "You were kicked.",
  },

  auth: {
    login: "Log In",
    logout: "Log Out",
    signOut: "Sign Out",
    connecting: "Connecting...",
    authenticating: "Authenticating...",
    loginFailed: "Login failed. Please try again.",
    sessionExpired: "Session expired. Please log in again.",
  },

  username: {
    placeholder: "Enter username",
    tooShort: "Username too short",
    tooLong: "Username too long",
    invalidCharacters: "Invalid characters in username",
    taken: "Username already taken",
    submit: "Continue",
    title: "Choose Your Name",
  },

  character: {
    select: "Select Character",
    create: "Create Character",
    delete: "Delete Character",
    confirmDelete: "Are you sure you want to delete this character?",
    noCharacters: "No characters found",
    play: "Play",
  },

  settings: {
    title: "Settings",
    tabs: {
      account: "Account",
      visuals: "Visual",
      interface: "UI",
      audio: "Audio",
      system: "System",
    },
    complexity: {
      title: "Interface Complexity",
      simple: "Simple",
      standard: "Standard",
      advanced: "Advanced",
    },
    graphics: {
      title: "Graphics Quality",
      shadows: "Shadows",
      colorGrading: "Color Grading",
      antialiasing: "Anti-aliasing",
      postProcessing: "Post-processing",
    },
    audio: {
      master: "Master Volume",
      music: "Music",
      effects: "Sound Effects",
      ambient: "Ambient",
      mute: "Mute All",
    },
    display: {
      fullscreen: "Fullscreen",
      fps: "Show FPS",
      ping: "Show Ping",
    },
  },

  panels: {
    inventory: "Inventory",
    equipment: "Equipment",
    skills: "Skills",
    quests: "Quests",
    map: "Map",
    chat: "Chat",
    bank: "Bank",
    settings: "Settings",
    combat: "Combat",
    prayer: "Prayer",
    magic: "Magic",
  },

  inventory: {
    empty: "Your inventory is empty",
    full: "Inventory is full",
    use: "Use",
    drop: "Drop",
    examine: "Examine",
    equip: "Equip",
    unequip: "Unequip",
    bank: "Bank",
    coins: "{amount} coins",
  },

  combat: {
    attack: "Attack",
    flee: "Flee",
    health: "Health",
    target: "Target",
    level: "Level {level}",
    victory: "Victory!",
    defeat: "Defeated",
  },

  skills: {
    total: "Total",
    level: "Level",
    experience: "Experience",
    nextLevel: "Next Level",
    progress: "{current}/{max}",
  },

  toast: {
    itemReceived: "Received {item}",
    itemDropped: "Dropped {item}",
    itemEquipped: "Equipped {item}",
    itemUnequipped: "Unequipped {item}",
    levelUp: "Level up! {skill} is now level {level}",
    questComplete: "Quest complete: {quest}",
    coinsReceived: "Received {amount} coins",
    coinsSpent: "Spent {amount} coins",
    notEnoughCoins: "Not enough coins",
    inventoryFull: "Inventory is full",
    cannotEquip: "Cannot equip this item",
  },

  errors: {
    generic: "An error occurred",
    network: "Network error",
    timeout: "Request timed out",
    unauthorized: "Unauthorized",
    notFound: "Not found",
    serverError: "Server error",
    offline: "You are offline",
  },

  actions: {
    confirm: "Confirm",
    cancel: "Cancel",
    save: "Save",
    close: "Close",
    back: "Back",
    next: "Next",
    done: "Done",
    retry: "Retry",
    yes: "Yes",
    no: "No",
  },

  time: {
    now: "Just now",
    secondsAgo: "{seconds}s ago",
    minutesAgo: "{minutes}m ago",
    hoursAgo: "{hours}h ago",
    daysAgo: "{days}d ago",
  },
} as const;

/**
 * Type for nested string path access
 */
type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends string
          ? K
          : `${K}.${NestedKeyOf<T[K]>}`
        : never;
    }[keyof T]
  : never;

/**
 * Type for UI string keys
 */
export type StringKey = NestedKeyOf<typeof UI_STRINGS>;

/**
 * Gets a nested value from the strings object
 */
function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split(".");
  let current = obj as Record<string, unknown>;

  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key] as Record<string, unknown>;
  }

  return typeof current === "string" ? current : undefined;
}

/**
 * Interpolates parameters into a string
 *
 * @param str - String with {param} placeholders
 * @param params - Object with parameter values
 * @returns Interpolated string
 */
function interpolate(
  str: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return str;

  return Object.entries(params).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    str,
  );
}

/**
 * Gets a translated string by key path
 *
 * @param key - Dot-notation path to string (e.g., "core.loading")
 * @param params - Optional interpolation parameters
 * @returns The translated string or the key if not found
 *
 * @example
 * ```typescript
 * t("core.loading") // "Loading world..."
 * t("death.killedBy", { killer: "Goblin" }) // "Killed by: Goblin"
 * t("toast.levelUp", { skill: "Attack", level: 10 }) // "Level up! Attack is now level 10"
 * ```
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  const str = getNestedValue(UI_STRINGS, key);
  if (!str) return key;
  return interpolate(str, params);
}

/**
 * Formats a time duration for display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats a relative time (time ago)
 */
export function formatRelativeTime(timestamp: Date | number): string {
  const now = Date.now();
  const time = typeof timestamp === "number" ? timestamp : timestamp.getTime();
  const diff = Math.floor((now - time) / 1000);

  if (diff < 5) return t("time.now");
  if (diff < 60) return t("time.secondsAgo", { seconds: diff });
  if (diff < 3600)
    return t("time.minutesAgo", { minutes: Math.floor(diff / 60) });
  if (diff < 86400)
    return t("time.hoursAgo", { hours: Math.floor(diff / 3600) });
  return t("time.daysAgo", { days: Math.floor(diff / 86400) });
}

/**
 * Formats a coin amount with proper formatting
 */
export function formatCoins(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toLocaleString();
}
