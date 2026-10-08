/*
 * Sharing a result. On a phone or tablet the system share sheet is the
 * natural place; on a desktop it gets in the way, so a desktop copies to the
 * clipboard and the button says "Copied".
 */

export type ShareOutcome = "shared" | "copied" | "dismissed" | "failed";

const hasTouchFirst = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export async function shareText(text: string, options: { title?: string } = {}): Promise<ShareOutcome> {
  if (typeof navigator === "undefined") return "failed";
  if (hasTouchFirst() && typeof navigator.share === "function") {
    try {
      await navigator.share({ text, title: options.title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "dismissed";
      // The sheet refused (no permission, unsupported text): fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
