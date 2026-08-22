import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPersonName } from "./classify";
import { parseReconciliationWorkbook } from "./workbook";
import {
  buildSyntheticXlsx,
  emptyWorkbookSheets,
  PEOPLE_HEADERS,
  personCells,
  projectCells,
} from "./synthetic-xlsx";
import { parseXlsxWorkbook, sheetByName } from "./xlsx";

describe("Client Memory workbook parser", () => {
  it("reads used-range headers and ignores stale PeopleTable metadata", () => {
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [
          personCells({
            name: "Ada Lovelace",
            email: "ada@example.com",
            phone: "3055550100",
          }),
          personCells({
            name: "Alan Turing",
            email: "alan@example.com",
          }),
        ],
      }),
    );
    const tables = parseXlsxWorkbook(xlsx);
    const people = sheetByName(tables, "People");
    assert.ok(people);
    assert.equal(people.headers.length, PEOPLE_HEADERS.length);
    assert.deepEqual(people.headers, PEOPLE_HEADERS);
    assert.equal(people.rows.length, 2);
    assert.equal(people.headers.includes("Reconciliation Status"), true);
  });

  it("uses formula cached values", () => {
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [
          personCells({
            name: "Ada Lovelace",
            email: "ada@example.com",
            linkedProjects: 3,
          }),
        ],
      }),
    );
    const people = sheetByName(parseXlsxWorkbook(xlsx), "People");
    assert.equal(people?.rows[0]?.values["Linked Project Rows"], 3);
  });

  it("does not treat Company Name == Name as an organization", () => {
    assert.equal(
      classifyPersonName("Ada Lovelace", { companyName: "Ada Lovelace" }),
      "person-candidate",
    );
    assert.equal(classifyPersonName("Madonna"), "needs-review");
    assert.equal(classifyPersonName("Acme Jewelers"), "needs-review");
    assert.equal(classifyPersonName("Acme LLC"), "organization-candidate");
    assert.equal(classifyPersonName(""), "invalid");
  });

  it("preserves malformed Review Flag prose and Match Confidence YES", () => {
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [
          personCells({ name: "Ada Lovelace", email: "ada@example.com" }),
        ],
        projects: [
          projectCells({
            canonicalClient: "Ada Lovelace",
            match: "Likely",
            title: "Oval ring",
            cad: "CAD-1",
            confidence: "YES",
            reviewFlag: "Need to confirm metal with client later this week",
            notes: "Follow up",
          }),
        ],
      }),
    );
    const parsed = parseReconciliationWorkbook(xlsx);
    assert.equal(parsed.projects[0]?.matchConfidenceMalformed, true);
    assert.equal(parsed.projects[0]?.reviewFlagMalformed, true);
    assert.match(parsed.projects[0]?.reviewFlagProse ?? "", /Need to confirm/);
    assert.equal(parsed.projects[0]?.matchJudgment, "likely");
  });

  it("joins Exact projects by unique local People.Name only", () => {
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [
          personCells({ name: "Ada Lovelace", email: "ada@example.com" }),
        ],
        projects: [
          projectCells({
            canonicalClient: "Ada Lovelace",
            match: "Exact",
            title: "Ada ring",
            cad: "CAD-1",
          }),
          projectCells({
            canonicalClient: "Someone Else",
            match: "Likely",
            title: "Likely ring",
            cad: "CAD-2",
          }),
          projectCells({
            canonicalClient: "Ghost Client",
            match: "No exact client DB match",
            title: "Unresolved",
            cad: "CAD-3",
          }),
        ],
      }),
    );
    const parsed = parseReconciliationWorkbook(xlsx);
    assert.equal(parsed.projects[0]?.matchJudgment, "exact");
    assert.equal(parsed.peopleNameCounts.get("Ada Lovelace"), 1);
    assert.equal(parsed.peopleNameCounts.get("Ghost Client"), undefined);
  });

  it("parses Rules & Summary without treating it as an authoritative count", () => {
    const xlsx = buildSyntheticXlsx(
      emptyWorkbookSheets({
        people: [personCells({ name: "Ada Lovelace", email: "ada@example.com" })],
        rules: [
          ["Projects", 18],
          ["People", 10],
        ],
      }),
    );
    const parsed = parseReconciliationWorkbook(xlsx);
    assert.equal(parsed.people.length, 1);
    assert.equal(parsed.rulesSummaryRows, 2);
    assert.notEqual(parsed.people.length, 10);
  });
});
