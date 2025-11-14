export async function up(connection) {
  await connection.query(`
    ALTER TABLE companies
      ADD COLUMN services_contracted TEXT NULL AFTER note,
      ADD COLUMN marketing_authorizations TEXT NULL AFTER services_contracted,
      ADD COLUMN rejection_reason TEXT NULL AFTER marketing_authorizations
  `);
}
