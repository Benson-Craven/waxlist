import { expect, test } from "vitest";
import { findColumnDrift, neonEndpoint } from "@/lib/db/diagnostics";

test("detects an incomplete schema even when migration bookkeeping is current", () => {
  const expected = [
    { table: "users", name: "auth_user_id", type: "text", notNull: false },
    { table: "smart_wants", name: "id", type: "uuid", notNull: true },
  ];
  expect(findColumnDrift(expected, [expected[0]])).toEqual([
    "Missing column smart_wants.id.",
  ]);
});

test("detects type and nullability drift without rejecting extra provider columns", () => {
  const column = {
    table: "users", name: "auth_user_id", type: "text", notNull: false,
  };
  expect(
    findColumnDrift([column], [{ ...column, type: "uuid", notNull: true }]),
  ).toHaveLength(2);
  expect(
    findColumnDrift([column], [column, { ...column, name: "extra" }]),
  ).toEqual([]);
});

test("compares pooled database and direct auth endpoint names", () => {
  expect(neonEndpoint("ep-test-pooler.eu-west-2.aws.neon.tech")).toBe(
    neonEndpoint("ep-test.eu-west-2.aws.neon.tech"),
  );
  expect(neonEndpoint("ep-other.eu-west-2.aws.neon.tech")).not.toBe(
    neonEndpoint("ep-test.eu-west-2.aws.neon.tech"),
  );
  expect(neonEndpoint("localhost")).toBeNull();
});
