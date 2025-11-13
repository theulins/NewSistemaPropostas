import pool from '../db/pool.js';

export const getSummary = async (_req, res) => {
  const [[usersCount]] = await pool.query('SELECT COUNT(*) AS total FROM users');
  const [[companiesCount]] = await pool.query("SELECT COUNT(*) AS total FROM companies WHERE status != 'reprovado'");

  const [recent] = await pool.query(
    `SELECT c.id, c.fantasy_name, u.name AS updated_by_name, c.updated_at
     FROM companies c
     LEFT JOIN users u ON u.id = c.updated_by
     ORDER BY c.updated_at DESC
     LIMIT 6`
  );

  return res.json({
    totalUsers: usersCount.total,
    totalCompanies: companiesCount.total,
    recent: recent.map((item) => ({
      id: item.id,
      fantasy_name: item.fantasy_name,
      updated_by_name: item.updated_by_name,
      updated_at: item.updated_at,
    })),
  });
};

export const getCommissions = async (req, res) => {
  const { month } = req.query;
  const monthDate = month ? new Date(`${month}-01T00:00:00`) : new Date();
  if (Number.isNaN(monthDate.getTime())) {
    return res.status(400).json({ message: 'Parâmetro month inválido.' });
  }

  const year = monthDate.getUTCFullYear();
  const monthIndex = monthDate.getUTCMonth() + 1;

  const [commissionRows] = await pool.query(
    `SELECT IFNULL(SUM(value),0) AS totalValue, AVG(commission_rate) AS avgRate
     FROM companies
     WHERE status = 'ativo'
       AND approved_at IS NOT NULL
       AND YEAR(approved_at) = ?
       AND MONTH(approved_at) = ?`,
    [year, monthIndex]
  );

  const [[settingsRow]] = await pool.query(
    "SELECT CAST(value AS DECIMAL(6,4)) AS defaultRate FROM settings WHERE `key` = 'default_commission_rate'"
  );

  const totalValue = Number(commissionRows.totalValue || 0);
  const defaultRate = settingsRow ? settingsRow.defaultRate : null;
  const rateToUse = defaultRate ?? Number(commissionRows.avgRate || 0);

  return res.json({
    totalValue,
    defaultRate: defaultRate !== null ? Number(defaultRate) : undefined,
    commission: rateToUse ? Number((totalValue * rateToUse).toFixed(2)) : 0,
  });
};
