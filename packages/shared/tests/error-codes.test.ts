import { expect, it } from "vitest";
import { normalizeErrorCode } from "../src/error-codes";

it.each([
  ["E10", "E10"],
  ["e 10", "E10"],
  ["Err10", "E10"],
  ["hata 10", "E10"],
  ["10", "E10"],
  ["E014", "E14"],
  ["E0", "E0"],
  ["yok", null],
])("normalizeErrorCode(%s)", (i, o) => {
  expect(normalizeErrorCode(i)).toBe(o);
});
