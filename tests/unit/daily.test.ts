import { describe, expect, it } from "vitest";
import { COLLECTION_EPOCH, dailyDate, dayIndex, localDateKey, shareString, shiftDateKey } from "@/lib/kit/daily";

/** The formula all three games used before the kit, copied here as the reference. */
const oldDay = (date: Date) => Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 0, 1)) / 86_400_000);

describe("daily numbering", () => {
  it("numbers the epoch #1", () => {
    expect(dailyDate(new Date(2026, 0, 1, 9))).toEqual({ key: "2026-01-01", day: 0, number: 1 });
  });

  it("shows #280 on 2026-10-07, as all three games already did", () => {
    expect(dailyDate(new Date(2026, 9, 7, 23, 59)).number).toBe(280);
    expect(dailyDate(new Date(2026, 9, 7, 0, 0)).number).toBe(280);
  });

  it("matches the games' old formula on every day of two years, at any hour", () => {
    for (let d = 0; d < 730; d++) {
      for (const hour of [0, 3, 12, 23]) {
        const date = new Date(2026, 0, 1 + d, hour, 30);
        expect(dayIndex(date, COLLECTION_EPOCH)).toBe(oldDay(date));
      }
    }
  });

  it("uses the local calendar date for the key", () => {
    expect(localDateKey(new Date(2026, 2, 9, 1))).toBe("2026-03-09");
  });

  it("supports a game's own epoch", () => {
    expect(dailyDate(new Date(2026, 11, 25), "2026-12-01").number).toBe(25);
  });

  it("steps date keys across months and years", () => {
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("shareString", () => {
  it("puts the title, number, score, grid and URL on their own lines", () => {
    expect(shareString({ title: "Outta Here", number: 280, score: "12.3 s · 1 hit", grid: "■■□", url: "https://example.org/outta-here" })).toBe(
      "Outta Here · Daily #280\n12.3 s · 1 hit\n■■□\nhttps://example.org/outta-here",
    );
  });

  it("names the challenge and skips missing lines", () => {
    expect(shareString({ title: "Don't Crater", label: "Daily Drop", number: 3 })).toBe("Don't Crater · Daily Drop #3");
  });
});
