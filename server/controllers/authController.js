import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { createToken } from '../utils/token.js';

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];

  if (!user) {
    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    return res.status(401).json({ message: 'Credenciais inválidas.' });
  }

  const token = createToken(user);
  const { password_hash, ...userData } = user;
  return res.json({ token, user: userData });
};

export const profile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Não autenticado.' });
  }

  const [rows] = await pool.query(
    'SELECT id, name, email, role, theme_preference, created_at, updated_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!rows.length) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }
  return res.json(rows[0]);
};
