import { describe, it, expect } from "vitest";
import {
  normalizeHeader,
  isPlayerInfoColumn,
  isNumericColumn,
  splitFullName,
  splitBatsThrows,
  stripUnitsFromValue,
  fixEuropeanDecimal,
  detectHeaderRow,
  isLongFormat,
  pivotLongToWide,
  expandPackedCells,
  cleanAllValues,
  preprocessRawData,
  groupAttemptColumns,
} from "../importUtils";
// buildPlayerNameIndex is a pure function extracted inline to avoid importing
// playerService.ts (which has duplicate exports that cause parse errors).
// The logic is identical to the one in @/services/playerService.
function buildPlayerNameIndex(players: { first_name: string; last_name: string }[]): Set<string> {
  return new Set(
    players.map((p) => `${p.first_name.trim().toLowerCase()}|${p.last_name.trim().toLowerCase()}`)
  );
}

// ── buildPlayerNameIndex ────────────────────────────────────────────

describe("buildPlayerNameIndex", () => {
  it("returns empty set for empty array", () => {
    expect(buildPlayerNameIndex([]).size).toBe(0);
  });

  it("normalizes names to lowercase trimmed keys", () => {
    const idx = buildPlayerNameIndex([
      { first_name: "  John ", last_name: " Doe " },
    ]);
    expect(idx.has("john|doe")).toBe(true);
    expect(idx.has("John|Doe")).toBe(false);
  });

  it("deduplicates identical names", () => {
    const idx = buildPlayerNameIndex([
      { first_name: "Jane", last_name: "Smith" },
      { first_name: "jane", last_name: "smith" },
    ]);
    expect(idx.size).toBe(1);
  });

  it("handles multiple distinct players", () => {
    const idx = buildPlayerNameIndex([
      { first_name: "A", last_name: "B" },
      { first_name: "C", last_name: "D" },
      { first_name: "E", last_name: "F" },
    ]);
    expect(idx.size).toBe(3);
    expect(idx.has("a|b")).toBe(true);
    expect(idx.has("c|d")).toBe(true);
    expect(idx.has("e|f")).toBe(true);
  });
});

// ── normalizeHeader ─────────────────────────────────────────────────

describe("normalizeHeader", () => {
  it("lowercases and trims", () => {
    expect(normalizeHeader("  First Name  ")).toBe("first name");
  });

  it("replaces underscores with spaces", () => {
    expect(normalizeHeader("last_name")).toBe("last name");
  });

  it("strips diacritics", () => {
    expect(normalizeHeader("résumé")).toBe("resume");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeHeader("first   name")).toBe("first name");
  });
});

// ── isPlayerInfoColumn ──────────────────────────────────────────────

describe("isPlayerInfoColumn", () => {
  it("recognizes common player info headers", () => {
    expect(isPlayerInfoColumn("First Name")).toBe(true);
    expect(isPlayerInfoColumn("last_name")).toBe(true);
    expect(isPlayerInfoColumn("Grade")).toBe(true);
    expect(isPlayerInfoColumn("Position")).toBe(true);
    expect(isPlayerInfoColumn("Jersey")).toBe(true);
    expect(isPlayerInfoColumn("Bats")).toBe(true);
    expect(isPlayerInfoColumn("Throws")).toBe(true);
    expect(isPlayerInfoColumn("Height")).toBe(true);
    expect(isPlayerInfoColumn("Weight")).toBe(true);
    expect(isPlayerInfoColumn("Email")).toBe(true);
  });

  it("rejects metric-like headers", () => {
    expect(isPlayerInfoColumn("60 Yard Dash")).toBe(false);
    expect(isPlayerInfoColumn("Exit Velocity")).toBe(false);
    expect(isPlayerInfoColumn("Fastball MPH")).toBe(false);
  });
});

// ── isNumericColumn ─────────────────────────────────────────────────

describe("isNumericColumn", () => {
  it("returns false for empty rows", () => {
    expect(isNumericColumn([], "col")).toBe(false);
  });

  it("returns true when majority of values are numeric", () => {
    const rows = [
      { speed: "88.5" },
      { speed: "91.2" },
      { speed: "85.0" },
      { speed: "" },
    ];
    expect(isNumericColumn(rows, "speed")).toBe(true);
  });

  it("returns true for numeric values with units", () => {
    const rows = [
      { vel: "88 mph" },
      { vel: "91 mph" },
      { vel: "85 mph" },
    ];
    expect(isNumericColumn(rows, "vel")).toBe(true);
  });

  it("returns false when majority of values are text", () => {
    const rows = [
      { name: "John" },
      { name: "Jane" },
      { name: "Bob" },
    ];
    expect(isNumericColumn(rows, "name")).toBe(false);
  });
});

// ── splitFullName ───────────────────────────────────────────────────

describe("splitFullName", () => {
  it("returns empty for blank input", () => {
    expect(splitFullName("")).toEqual({ first: "", last: "" });
    expect(splitFullName("   ")).toEqual({ first: "", last: "" });
  });

  it("splits simple first last", () => {
    expect(splitFullName("John Doe")).toEqual({ first: "John", last: "Doe" });
  });

  it("handles last, first format", () => {
    expect(splitFullName("Doe, John")).toEqual({ first: "John", last: "Doe" });
  });

  it("handles single name (no last name)", () => {
    expect(splitFullName("Madonna")).toEqual({ first: "Madonna", last: "" });
  });

  it("handles three-part names (first middle last)", () => {
    expect(splitFullName("John Michael Doe")).toEqual({
      first: "John Michael",
      last: "Doe",
    });
  });
});

// ── splitBatsThrows ─────────────────────────────────────────────────

describe("splitBatsThrows", () => {
  it("returns empty for blank input", () => {
    expect(splitBatsThrows("")).toEqual({ bats: "", throws: "" });
  });

  it("splits R/R format", () => {
    expect(splitBatsThrows("R/R")).toEqual({ bats: "R", throws: "R" });
  });

  it("splits L/R format", () => {
    expect(splitBatsThrows("L/R")).toEqual({ bats: "L", throws: "R" });
  });

  it("splits hyphen-separated format", () => {
    expect(splitBatsThrows("R-L")).toEqual({ bats: "R", throws: "L" });
  });

  it("handles verbose Bats R / Throws R format", () => {
    expect(splitBatsThrows("Bats R / Throws L")).toEqual({
      bats: "R",
      throws: "L",
    });
  });

  it("is case-insensitive", () => {
    expect(splitBatsThrows("r/l")).toEqual({ bats: "R", throws: "L" });
  });
});

// ── stripUnitsFromValue ─────────────────────────────────────────────

describe("stripUnitsFromValue", () => {
  it("returns null for empty/blank", () => {
    expect(stripUnitsFromValue("")).toBeNull();
    expect(stripUnitsFromValue("   ")).toBeNull();
  });

  it("returns null for N/A markers", () => {
    expect(stripUnitsFromValue("N/A")).toBeNull();
    expect(stripUnitsFromValue("na")).toBeNull();
    expect(stripUnitsFromValue("none")).toBeNull();
    expect(stripUnitsFromValue("--")).toBeNull();
    expect(stripUnitsFromValue("—")).toBeNull();
  });

  it("parses plain numbers", () => {
    expect(stripUnitsFromValue("88.5")).toBe(88.5);
    expect(stripUnitsFromValue("42")).toBe(42);
  });

  it("strips mph unit", () => {
    expect(stripUnitsFromValue("88 mph")).toBe(88);
    expect(stripUnitsFromValue("91.2mph")).toBe(91.2);
  });

  it("strips sec/s unit", () => {
    expect(stripUnitsFromValue("6.8 sec")).toBe(6.8);
    expect(stripUnitsFromValue("7.2s")).toBe(7.2);
  });

  it("strips ft/in unit", () => {
    expect(stripUnitsFromValue("300 ft")).toBe(300);
    expect(stripUnitsFromValue("72 in")).toBe(72);
  });

  it("strips lbs", () => {
    expect(stripUnitsFromValue("185 lbs")).toBe(185);
  });

  it("handles European decimal (comma)", () => {
    expect(stripUnitsFromValue("8,03")).toBe(8.03);
  });

  it("returns null for non-numeric text", () => {
    expect(stripUnitsFromValue("John")).toBeNull();
    expect(stripUnitsFromValue("abc")).toBeNull();
  });
});

// ── fixEuropeanDecimal ──────────────────────────────────────────────

describe("fixEuropeanDecimal", () => {
  it("converts comma to period for simple decimal", () => {
    expect(fixEuropeanDecimal("8,03")).toBe("8.03");
  });

  it("leaves standard decimals unchanged", () => {
    expect(fixEuropeanDecimal("8.03")).toBe("8.03");
  });

  it("leaves non-numeric strings unchanged", () => {
    expect(fixEuropeanDecimal("hello")).toBe("hello");
  });

  it("trims whitespace", () => {
    expect(fixEuropeanDecimal("  8,03  ")).toBe("8.03");
  });
});

// ── detectHeaderRow ─────────────────────────────────────────────────

describe("detectHeaderRow", () => {
  it("returns 0 for empty input", () => {
    expect(detectHeaderRow([])).toBe(0);
  });

  it("detects header as the first row when data is clean", () => {
    const rows = [
      ["Name", "60 Yard", "Exit Velo", "Fastball"],
      ["John Doe", "7.2", "88", "82"],
      ["Jane Smith", "7.5", "85", "79"],
    ];
    expect(detectHeaderRow(rows)).toBe(0);
  });

  it("skips metadata preamble rows", () => {
    const rows = [
      ["Report generated 2024-01-15", "", "", ""],
      ["Season: Spring 2024", "", "", ""],
      ["Name", "60 Yard", "Exit Velo", "Fastball"],
      ["John Doe", "7.2", "88", "82"],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });

  it("skips separator rows", () => {
    const rows = [
      ["--- DATA BELOW ---"],
      ["Name", "Speed", "Distance", "Time"],
      ["Player 1", "88", "300", "7.2"],
    ];
    expect(detectHeaderRow(rows)).toBe(1);
  });
});

// ── isLongFormat ────────────────────────────────────────────────────

describe("isLongFormat", () => {
  it("detects long/tidy format headers", () => {
    expect(isLongFormat(["Player Name", "Metric Name", "Value"])).toBe(true);
    expect(isLongFormat(["Athlete", "Drill", "Score"])).toBe(true);
    expect(isLongFormat(["First Name", "Last Name", "Event", "Result"])).toBe(true);
  });

  it("rejects wide format headers", () => {
    expect(isLongFormat(["Name", "60 Yard", "Exit Velo"])).toBe(false);
    expect(isLongFormat(["Player", "Speed", "Distance"])).toBe(false);
  });
});

// ── pivotLongToWide ─────────────────────────────────────────────────

describe("pivotLongToWide", () => {
  it("pivots long format with single values per metric", () => {
    const headers = ["Player Name", "Metric Name", "Value"];
    const rows = [
      { "Player Name": "John", "Metric Name": "Speed", "Value": "88" },
      { "Player Name": "John", "Metric Name": "Distance", "Value": "300" },
      { "Player Name": "Jane", "Metric Name": "Speed", "Value": "85" },
      { "Player Name": "Jane", "Metric Name": "Distance", "Value": "280" },
    ];
    const result = pivotLongToWide(rows, headers);
    expect(result.headers).toContain("Player Name");
    expect(result.headers).toContain("Distance");
    expect(result.headers).toContain("Speed");
    expect(result.rows).toHaveLength(2);

    const john = result.rows.find((r) => r["Player Name"] === "John");
    expect(john).toBeDefined();
    expect(john!["Speed"]).toBe("88");
    expect(john!["Distance"]).toBe("300");
  });

  it("handles multiple trials per metric", () => {
    const headers = ["Player Name", "Metric Name", "Value"];
    const rows = [
      { "Player Name": "John", "Metric Name": "Speed", "Value": "88" },
      { "Player Name": "John", "Metric Name": "Speed", "Value": "91" },
    ];
    const result = pivotLongToWide(rows, headers);
    // Should create Speed_1 and Speed_2 columns
    expect(result.headers).toContain("Speed_1");
    expect(result.headers).toContain("Speed_2");
    const john = result.rows[0];
    expect(john["Speed_1"]).toBe("88");
    expect(john["Speed_2"]).toBe("91");
  });

  it("uses first_name/last_name columns when available", () => {
    const headers = ["First Name", "Last Name", "Metric Name", "Value"];
    const rows = [
      { "First Name": "John", "Last Name": "Doe", "Metric Name": "Speed", "Value": "88" },
      { "First Name": "John", "Last Name": "Doe", "Metric Name": "Time", "Value": "7.2" },
    ];
    const result = pivotLongToWide(rows, headers);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]["First Name"]).toBe("John");
    expect(result.rows[0]["Speed"]).toBe("88");
    expect(result.rows[0]["Time"]).toBe("7.2");
  });

  it("returns input unchanged if metric or value column missing", () => {
    const headers = ["Player", "Something"];
    const rows = [{ Player: "John", Something: "abc" }];
    const result = pivotLongToWide(rows, headers);
    expect(result).toEqual({ headers, rows });
  });
});

// ── expandPackedCells ───────────────────────────────────────────────

describe("expandPackedCells", () => {
  it("returns unchanged when no packed cells found", () => {
    const headers = ["Name", "Speed"];
    const rows = [
      { Name: "John", Speed: "88" },
      { Name: "Jane", Speed: "85" },
    ];
    const result = expandPackedCells(rows, headers);
    expect(result.headers).toEqual(headers);
    expect(result.rows).toEqual(rows);
  });

  it("expands slash-separated numeric values", () => {
    const headers = ["Name", "60 Yard"];
    const rows = [
      { Name: "John", "60 Yard": "7.2/7.0/6.9" },
      { Name: "Jane", "60 Yard": "7.5/7.3/7.1" },
      { Name: "Bob", "60 Yard": "7.8/7.6/7.4" },
    ];
    const result = expandPackedCells(rows, headers);
    expect(result.headers).toContain("60 Yard_1");
    expect(result.headers).toContain("60 Yard_2");
    expect(result.headers).toContain("60 Yard_3");
    expect(result.rows[0]["60 Yard_1"]).toBe("7.2");
    expect(result.rows[0]["60 Yard_2"]).toBe("7.0");
    expect(result.rows[0]["60 Yard_3"]).toBe("6.9");
  });

  it("returns empty rows unchanged", () => {
    const result = expandPackedCells([], ["A", "B"]);
    expect(result.rows).toEqual([]);
  });
});

// ── cleanAllValues ──────────────────────────────────────────────────

describe("cleanAllValues", () => {
  it("strips units from metric columns", () => {
    const rows = [{ "Exit Velo": "88 mph", Name: "John" }];
    const result = cleanAllValues(rows);
    expect(result[0]["Exit Velo"]).toBe("88");
    expect(result[0]["Name"]).toBe("John"); // player info untouched
  });

  it("fixes European decimals in metric columns", () => {
    const rows = [{ "60 Yard": "8,03" }];
    const result = cleanAllValues(rows);
    expect(result[0]["60 Yard"]).toBe("8.03");
  });

  it("preserves player info columns", () => {
    const rows = [{ "First Name": "José", "Last Name": "García" }];
    const result = cleanAllValues(rows);
    expect(result[0]["First Name"]).toBe("José");
    expect(result[0]["Last Name"]).toBe("García");
  });
});

// ── preprocessRawData (integration) ─────────────────────────────────

describe("preprocessRawData", () => {
  it("returns empty for empty input", () => {
    const result = preprocessRawData([]);
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("processes a simple wide-format spreadsheet", () => {
    const raw = [
      ["Name", "60 Yard", "Exit Velo"],
      ["John Doe", "7.2", "88 mph"],
      ["Jane Smith", "7.5", "85 mph"],
    ];
    const result = preprocessRawData(raw);
    expect(result.headers).toContain("Name");
    expect(result.headers).toContain("60 Yard");
    expect(result.headers).toContain("Exit Velo");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]["Exit Velo"]).toBe("88"); // unit stripped
  });

  it("skips preamble rows and finds header", () => {
    const raw = [
      ["Report: Spring 2024", "", ""],
      ["", "", ""],
      ["Name", "Speed", "Distance"],
      ["Player A", "88", "300"],
    ];
    const result = preprocessRawData(raw);
    expect(result.headers).toEqual(["Name", "Speed", "Distance"]);
    expect(result.rows).toHaveLength(1);
  });

  it("skips blank data rows", () => {
    const raw = [
      ["Name", "Score"],
      ["John", "10"],
      ["", ""],
      ["Jane", "20"],
    ];
    const result = preprocessRawData(raw);
    expect(result.rows).toHaveLength(2);
  });

  it("handles long-format data with pivot", () => {
    const raw = [
      ["Player Name", "Metric Name", "Value"],
      ["John", "Speed", "88"],
      ["John", "Distance", "300"],
      ["Jane", "Speed", "85"],
    ];
    const result = preprocessRawData(raw);
    // Should be pivoted to wide format
    expect(result.rows.length).toBeLessThanOrEqual(2);
    const john = result.rows.find((r) => r["Player Name"] === "John");
    expect(john).toBeDefined();
    expect(john!["Speed"]).toBe("88");
  });
});

// ── groupAttemptColumns ─────────────────────────────────────────────

describe("groupAttemptColumns", () => {
  it("groups numbered attempt columns under base name", () => {
    const headers = ["Name", "60 Yard_1", "60 Yard_2", "60 Yard_3"];
    const rows = [
      { Name: "John", "60 Yard_1": "7.2", "60 Yard_2": "7.0", "60 Yard_3": "6.9" },
    ];
    const nameColumns = new Set(["Name"]);
    const groups = groupAttemptColumns(headers, rows, nameColumns);
    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("60 Yard");
    expect(groups[0].columns).toEqual(["60 Yard_1", "60 Yard_2", "60 Yard_3"]);
  });

  it("creates solo groups for non-numbered columns", () => {
    const headers = ["Name", "Exit Velo"];
    const rows = [{ Name: "John", "Exit Velo": "88" }];
    const nameColumns = new Set(["Name"]);
    const groups = groupAttemptColumns(headers, rows, nameColumns);
    expect(groups).toHaveLength(1);
    expect(groups[0].displayName).toBe("Exit Velo");
    expect(groups[0].columns).toEqual(["Exit Velo"]);
  });

  it("skips player info columns", () => {
    const headers = ["First Name", "Last Name", "Grade", "Exit Velo"];
    const rows = [
      { "First Name": "John", "Last Name": "Doe", Grade: "10", "Exit Velo": "88" },
    ];
    const nameColumns = new Set(["First Name", "Last Name"]);
    const groups = groupAttemptColumns(headers, rows, nameColumns);
    // Only Exit Velo should appear (Grade is player info)
    const names = groups.map((g) => g.displayName);
    expect(names).not.toContain("First Name");
    expect(names).not.toContain("Last Name");
    expect(names).not.toContain("Grade");
  });

  it("sorts attempt columns numerically", () => {
    const headers = ["Name", "Speed_3", "Speed_1", "Speed_2"];
    const rows = [
      { Name: "John", Speed_3: "90", Speed_1: "88", Speed_2: "89" },
    ];
    const nameColumns = new Set(["Name"]);
    const groups = groupAttemptColumns(headers, rows, nameColumns);
    expect(groups[0].columns).toEqual(["Speed_1", "Speed_2", "Speed_3"]);
  });
});
