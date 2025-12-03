export async function up(connection) {
  await connection.query(`
    ALTER TABLE companies
      ADD COLUMN financial_responsible VARCHAR(160) NULL AFTER accounting_office
  `);
}
