import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { nullIfEmpty } from '../utils/normalizers.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const listUsers = async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, theme_preference, created_at, updated_at FROM users ORDER BY created_at DESC'
  );
  res.json({ items: rows });
};

export const createUser = async (req, res) => {
  const { name, email, password, role = 'viewer', theme_preference = 'system' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'E-mail inválido.' });
  }

  const password_hash = await bcrypt.hash(password, 10);

  try {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, theme_preference) VALUES (?, ?, ?, ?, ?)',
      [name, email, password_hash, role, theme_preference]
    );
    res.status(201).json({ id: result.insertId, message: 'Usuário criado com sucesso.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'E-mail já cadastrado.' });
    }
    throw error;
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, theme_preference } = req.body;

  if (email && !emailRegex.test(email)) {
    return res.status(400).json({ message: 'E-mail inválido.' });
  }

  const fields = [];
  const values = [];

  if (name !== undefined) {
    fields.push('name = ?');
    values.push(nullIfEmpty(name));
  }
  if (email !== undefined) {
    fields.push('email = ?');
    values.push(nullIfEmpty(email));
  }
  if (role !== undefined) {
    fields.push('role = ?');
    values.push(role);
  }
  if (theme_preference !== undefined) {
    fields.push('theme_preference = ?');
    values.push(theme_preference);
  }

  if (!fields.length) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
  }

  values.push(id);

  try {
    const [result] = await pool.query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    res.json({ message: 'Usuário atualizado com sucesso.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'E-mail já cadastrado.' });
    }
    throw error;
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }
  res.json({ message: 'Usuário removido com sucesso.' });
};
