import { describe, expect, it } from "vitest";
import { buildWriteParams } from "../src/utils";

// Guards the write-path sysparm mapping. ServiceNow accepts these on
// POST/PATCH/PUT; before this the client dropped them entirely, so choice and
// reference fields could only ever be written as stored values.
describe("buildWriteParams", () => {
  it("returns an empty object when nothing is requested", () => {
    expect(buildWriteParams({})).toEqual({});
  });

  it("maps each option to its sysparm_ name", () => {
    expect(
      buildWriteParams({
        inputDisplayValue: true,
        displayValue: "all",
        fields: "sys_id,number,priority",
        excludeReferenceLink: true,
      })
    ).toEqual({
      sysparm_input_display_value: "true",
      sysparm_display_value: "all",
      sysparm_fields: "sys_id,number,priority",
      sysparm_exclude_reference_link: "true",
    });
  });

  it("omits boolean flags when false rather than sending 'false'", () => {
    // ServiceNow treats presence as intent for these; sending "false" is noise.
    expect(
      buildWriteParams({ inputDisplayValue: false, excludeReferenceLink: false })
    ).toEqual({});
  });

  it("supports display_value=false explicitly (stored values in response)", () => {
    expect(buildWriteParams({ displayValue: "false" })).toEqual({
      sysparm_display_value: "false",
    });
  });
});
