export async function up(connection) {
  await connection.query(`
    ALTER TABLE companies
      ADD COLUMN partners TEXT NULL AFTER note
  `);
}
