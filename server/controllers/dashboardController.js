import pool from '../db/pool.js';

export const getSummary = async (_req, res) => {
  const [[usersCount]] = await pool.query('SELECT COUNT(*) AS total FROM users');
  const [[companyStats]] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      SUM(status = 'ativo') AS active,
      SUM(status = 'pendente') AS pending,
      SUM(status = 'reprovado') AS rejected,
      IFNULL(SUM(CASE WHEN status = 'ativo' THEN value ELSE 0 END), 0) AS activeValue
    FROM companies`
  );

  const totalCompanies = Number(companyStats?.total || 0);
  const activeCompanies = Number(companyStats?.active || 0);
  const pendingCompanies = Number(companyStats?.pending || 0);
  const rejectedCompanies = Number(companyStats?.rejected || 0);
  const activeValue = Number(companyStats?.activeValue || 0);
  const averageTicket = activeCompanies > 0 ? Number((activeValue / activeCompanies).toFixed(2)) : 0;

  const [recent] = await pool.query(
    `SELECT c.id, c.fantasy_name, u.name AS updated_by_name, c.updated_at
     FROM companies c
     LEFT JOIN users u ON u.id = c.updated_by
     ORDER BY c.updated_at DESC
     LIMIT 6`
  );

  return res.json({
    totalUsers: Number(usersCount.total || 0),
    totalCompanies,
    activeCompanies,
    pendingCompanies,
    rejectedCompanies,
    activeValue,
    averageTicket,
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

  const [commissionStatsRows] = await pool.query(
    `SELECT
        IFNULL(SUM(value),0) AS totalValue,
        IFNULL(SUM(CASE WHEN commission_rate IS NOT NULL THEN value * commission_rate ELSE 0 END),0) AS totalCommission,
        AVG(commission_rate) AS avgRate,
        COUNT(*) AS totalApproved
      FROM companies
      WHERE status = 'ativo'
        AND approved_at IS NOT NULL
        AND commission_exempt = 0
        AND YEAR(approved_at) = ?
        AND MONTH(approved_at) = ?`,
    [year, monthIndex]
  );

  const [[settingsRow]] = await pool.query(
    "SELECT CAST(value AS DECIMAL(6,4)) AS defaultRate FROM settings WHERE `key` = 'default_commission_rate'"
  );

  const stats = commissionStatsRows[0] || {};
  const totalValue = Number(stats.totalValue || 0);
  const approvedCommission = Number(stats.totalCommission || 0);
  const approvedCompanies = Number(stats.totalApproved || 0);
  const defaultRate = settingsRow ? settingsRow.defaultRate : null;
  const fallbackRate = defaultRate ?? Number(stats.avgRate || 0);
  const approvedRate = totalValue > 0 && approvedCommission > 0
    ? Number((approvedCommission / totalValue).toFixed(4))
    : null;
  const estimatedCommission = fallbackRate
    ? Number((totalValue * fallbackRate).toFixed(2))
    : 0;

  return res.json({
    totalValue,
    defaultRate: defaultRate !== null ? Number(defaultRate) : undefined,
    commission: estimatedCommission,
    approvedCommission,
    approvedCompanies,
    approvedRate,
  });
};
