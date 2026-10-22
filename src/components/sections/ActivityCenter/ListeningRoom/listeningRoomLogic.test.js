import { describe, it, expect } from "vitest";
import { formatTime, formatMonth, listMonths, tracksForMonth } from "./listeningRoomLogic";

const t = (month, position, extra = {}) => ({ id: `${month}-${position}`, month, position, title: "x", artist: "y", ...extra });

describe("listeningRoomLogic", () => {
  it("formats time", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(7.9)).toBe("0:07");
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(-3)).toBe("0:00");
  });
  it("formats months", () => {
    expect(formatMonth("2026-10")).toBe("October 2026");
    expect(formatMonth("2026-01")).toBe("January 2026");
    expect(formatMonth("nope")).toBe("nope");
  });
  it("lists months newest first and ignores unpublished-only months", () => {
    const tracks = [t("2026-08", 1), t("2026-10", 1), t("2026-09", 1, { published: false })];
    expect(listMonths(tracks)).toEqual(["2026-10", "2026-08"]);
  });
  it("orders a month by position and hides unpublished tracks", () => {
    const tracks = [t("2026-10", 3), t("2026-10", 1), t("2026-10", 2, { published: false }), t("2026-09", 1)];
    expect(tracksForMonth(tracks, "2026-10").map((x) => x.position)).toEqual([1, 3]);
  });
  it("never returns more than five", () => {
    const tracks = [1, 2, 3, 4, 5, 6].map((p) => t("2026-10", p));
    expect(tracksForMonth(tracks, "2026-10")).toHaveLength(5);
  });
  it("handles empty data", () => {
    expect(listMonths([])).toEqual([]);
    expect(tracksForMonth(undefined, "2026-10")).toEqual([]);
  });
});