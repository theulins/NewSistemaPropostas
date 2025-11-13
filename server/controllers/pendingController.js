import pool from '../db/pool.js';
import { nullIfEmpty } from '../utils/normalizers.js';

export const listPending = async (req, res) => {
  const { q = '', status = 'pendente' } = req.query;
  const likeTerm = `%${q}%`;
  const params = [];
  let where = 'WHERE 1=1';
  if (q) {
    where += ' AND (fantasy_name LIKE ? OR corporate_name LIKE ? OR cnpj LIKE ? OR city LIKE ?)';
    params.push(likeTerm, likeTerm, likeTerm, likeTerm);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  const sql = `SELECT id, fantasy_name, corporate_name, cnpj, city, state, plan_type, value, commission_rate, due_date, status
    FROM companies ${where} ORDER BY updated_at DESC`;

  const [rows] = await pool.query(sql, params);

  res.json({ items: rows });
};

export const approvePending = async (req, res) => {
  const { company_id, plan_type, value, commission_rate, due_date } = req.body;

  if (!company_id) {
    return res.status(400).json({ message: 'company_id é obrigatório.' });
  }

  const numericValue = Number(value);
  const numericRate = commission_rate !== undefined ? Number(commission_rate) : null;

  if (Number.isNaN(numericValue) || numericValue < 0) {
    return res.status(400).json({ message: 'Valor inválido.' });
  }

  if (numericRate !== null && (Number.isNaN(numericRate) || numericRate < 0)) {
    return res.status(400).json({ message: 'Taxa inválida.' });
  }

  await pool.query('START TRANSACTION');
  try {
    const [rows] = await pool.query('SELECT id FROM companies WHERE id = ? FOR UPDATE', [company_id]);
    if (!rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Empresa não encontrada.' });
    }

    await pool.query(
      `UPDATE companies SET
        status = 'ativo',
        plan_type = ?,
        value = ?,
        commission_rate = ?,
        due_date = ?,
        approved_at = NOW(),
        updated_by = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        nullIfEmpty(plan_type),
        numericValue,
        numericRate,
        nullIfEmpty(due_date),
        req.user?.id || null,
        company_id,
      ]
    );

    await pool.query(
      'INSERT INTO pending_logs (company_id, action, message) VALUES (?,?,?)',
      [company_id, 'approved', `Valor: ${numericValue}; Taxa: ${numericRate}`]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Empresa aprovada com sucesso.' });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
};

export const rejectPending = async (req, res) => {
  const { company_id, reason } = req.body;
  if (!company_id) {
    return res.status(400).json({ message: 'company_id é obrigatório.' });
  }

  await pool.query('START TRANSACTION');
  try {
    const [rows] = await pool.query('SELECT id FROM companies WHERE id = ? FOR UPDATE', [company_id]);
    if (!rows.length) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'Empresa não encontrada.' });
    }

    await pool.query(
      `UPDATE companies SET status = 'reprovado', updated_at = NOW(), updated_by = ? WHERE id = ?`,
      [req.user?.id || null, company_id]
    );

    await pool.query(
      'INSERT INTO pending_logs (company_id, action, message) VALUES (?,?,?)',
      [company_id, 'rejected', nullIfEmpty(reason)]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Empresa reprovada.' });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
};
