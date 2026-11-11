export type DatabaseColumn = {
  table: string;
  name: string;
  type: string;
  notNull: boolean;
};

export function findColumnDrift(
  expected: DatabaseColumn[],
  actual: DatabaseColumn[],
) {
  const columns = new Map(
    actual.map((column) => [`${column.table}.${column.name}`, column]),
  );

  return expected.flatMap((column) => {
    const key = `${column.table}.${column.name}`;
    const found = columns.get(key);

    if (!found) return [`Missing column ${key}.`];
    const problems: string[] = [];
    if (found.type !== column.type) {
      problems.push(`${key} has type ${found.type}; expected ${column.type}.`);
    }
    if (found.notNull !== column.notNull) {
      problems.push(`${key} has different nullability from the app schema.`);
    }
    return problems;
  });
}

export function neonEndpoint(hostname: string) {
  if (!hostname.endsWith(".neon.tech")) return null;
  return hostname.split(".")[0].replace(/-pooler$/, "");
}
