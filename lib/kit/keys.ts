/*
 * Keyboard conventions shared by the shell and the games.
 *
 * The shell's own keys (Esc, R and H on results, K for the Keyring, ? for the
 * shortcuts sheet) never fire while the player is typing, and never fire for
 * a key a game has already used: a game that handles a key calls
 * `event.preventDefault()`, and the shell leaves that key alone. The shell
 * decides only after every listener has seen the key (`whenUnclaimed`), so it
 * doesn't matter in which order the listeners were added.
 */

export const SHELL_KEYS = {
  pause: "Escape",
  playAgain: "r",
  hall: "h",
  keyring: "k",
  shortcuts: "?",
} as const;

/** True when keys should go to a text field, not to the game. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export const hasModifier = (event: KeyboardEvent) => event.ctrlKey || event.metaKey || event.altKey;

/**
 * A plain press of `key` (letters compared without case) that nothing else
 * has claimed: no modifier, not typing, not already handled by a game.
 */
export function isFreeKey(event: KeyboardEvent, key: string): boolean {
  if (event.defaultPrevented || hasModifier(event) || isTypingTarget(event.target)) return false;
  return key.length === 1 ? event.key.toLowerCase() === key.toLowerCase() : event.key === key;
}

/** Runs `action` once every other listener has seen `event`, unless one of them claimed it. */
export function whenUnclaimed(event: KeyboardEvent, action: () => void) {
  window.setTimeout(() => {
    if (!event.defaultPrevented) action();
  }, 0);
}
