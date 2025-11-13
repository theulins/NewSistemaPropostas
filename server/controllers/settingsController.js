import pool from '../db/pool.js';

const allowedKeys = new Set(['theme_preference', 'primary', 'default_commission_rate']);

export const getSettings = async (_req, res) => {
  const [rows] = await pool.query('SELECT `key`, `value` FROM settings WHERE `key` IN (?,?,?)', [
    'theme_preference',
    'primary',
    'default_commission_rate',
  ]);

  const result = {
    theme_preference: 'system',
    primary: '#4f86ff',
  };

  rows.forEach((row) => {
    result[row.key] = row.value;
  });

  return res.json({
    theme_preference: result.theme_preference,
    primary: result.primary,
    default_commission_rate: result.default_commission_rate ? Number(result.default_commission_rate) : null,
  });
};

export const updateSettings = async (req, res) => {
  const entries = Object.entries(req.body || {}).filter(([key]) => allowedKeys.has(key));
  if (!entries.length) {
    return res.status(400).json({ message: 'Nenhum valor válido informado.' });
  }

  await pool.query('START TRANSACTION');
  try {
    for (const [key, value] of entries) {
      await pool.query(
        'REPLACE INTO settings (`key`, `value`) VALUES (?, ?)',
        [key, value]
      );
    }
    await pool.query('COMMIT');
    res.json({ message: 'Configurações atualizadas.' });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
};
