import { fmtRate, calcAdb, aggregateSubAreas } from "@/lib/metrics";

// fmtRate 

describe("fmtRate", () => {
  it("returns '0' when total is 0 (no division-by-zero)", () => {
    expect(fmtRate(0, 0)).toBe("0");
    expect(fmtRate(5, 0)).toBe("0");
  });

  it("calculates incidents per 1,000 vehicles correctly", () => {
    expect(fmtRate(5, 1000)).toBe("5.0");
    expect(fmtRate(1, 200)).toBe("5.0");
  });

  it("rounds to one decimal place", () => {
    expect(fmtRate(1, 3)).toBe("333.3");
  });

  it("returns '0.0' for zero incidents with non-zero total", () => {
    expect(fmtRate(0, 500)).toBe("0.0");
  });

  it("handles fractional results accurately", () => {
    expect(fmtRate(10, 400)).toBe("25.0");
  });
});

// calcAdb 

describe("calcAdb", () => {
  it("sums the three constituent behaviour counts", () => {
    expect(calcAdb(5, 3, 2)).toBe(10);
  });

  it("returns 0 when all components are 0", () => {
    expect(calcAdb(0, 0, 0)).toBe(0);
  });

  it("works when some components are 0", () => {
    expect(calcAdb(7, 0, 0)).toBe(7);
    expect(calcAdb(0, 4, 0)).toBe(4);
  });
});

// aggregateSubAreas 

describe("aggregateSubAreas", () => {
  const areas = [
    { vehicles: 100, speeding: 10, swerving: 5, abrupt_stopping: 3, adb: 18 },
    { vehicles: 200, speeding: 20, swerving: 8, abrupt_stopping: 4, adb: 32 },
    { vehicles: 50,  speeding: 2,  swerving: 1, abrupt_stopping: 0, adb: 3  },
  ];

  it("sums vehicles across all sub-areas", () => {
    expect(aggregateSubAreas(areas).vehicles).toBe(350);
  });

  it("sums all ADB components correctly", () => {
    const result = aggregateSubAreas(areas);
    expect(result.speeding).toBe(32);
    expect(result.swerving).toBe(14);
    expect(result.abrupt_stopping).toBe(7);
    expect(result.adb).toBe(53);
  });

  it("returns all-zero totals for an empty array", () => {
    const result = aggregateSubAreas([]);
    expect(result).toEqual({ vehicles: 0, speeding: 0, swerving: 0, abrupt_stopping: 0, adb: 0 });
  });

  it("handles a single sub-area correctly", () => {
    const result = aggregateSubAreas([areas[0]]);
    expect(result.vehicles).toBe(100);
    expect(result.adb).toBe(18);
  });
});
