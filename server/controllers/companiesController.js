import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import pool from '../db/pool.js';
import { digitsOnly, nullIfEmpty } from '../utils/normalizers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

export const listRecent = async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT id, fantasy_name, cnpj, city, state, sector, status, updated_at
     FROM companies
     ORDER BY updated_at DESC
     LIMIT 50`
  );
  res.json({ items: rows });
};

export const searchCompanies = async (req, res) => {
  const { q = '', status } = req.query;
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
  const [rows] = await pool.query(
    `SELECT id, fantasy_name, cnpj, city, state, sector, status, updated_at FROM companies ${where} ORDER BY updated_at DESC LIMIT 100`,
    params
  );
  res.json({ items: rows });
};

function storeSignature(dataUrl) {
  if (!dataUrl) return null;
  const matches = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/);
  if (!matches) return null;
  ensureUploadsDir();
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `signature-${uuid()}.${ext}`;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, buffer);
  return `/uploads/${filename}`;
}

export const createCompany = async (req, res) => {
  const {
    fantasy_name,
    corporate_name,
    cnpj,
    ie,
    address,
    zip,
    city,
    state,
    phone,
    cel,
    whatsapp,
    email,
    instagram,
    business_activity,
    foundation_date,
    employees_qty,
    sector,
    accounting_office,
    referred_by,
    note,
    plan_type,
    value,
    commission_rate,
    commission_exempt,
    due_date,
    signature_data_url,
  } = req.body;

  if (!fantasy_name) {
    return res.status(400).json({ message: 'Nome fantasia é obrigatório.' });
  }

  const sanitizedCnpj = digitsOnly(cnpj);
  const sanitizedZip = digitsOnly(zip);
  const sanitizedPhone = digitsOnly(phone);
  const sanitizedCel = digitsOnly(cel);
  const sanitizedWhatsapp = digitsOnly(whatsapp);

  const signature_url = storeSignature(signature_data_url);

  const [result] = await pool.query(
    `INSERT INTO companies (
      fantasy_name, corporate_name, cnpj, ie, address, zip, city, state, phone, cel, whatsapp, email, instagram,
      business_activity, foundation_date, employees_qty, sector, accounting_office, referred_by, note,
      plan_type, value, commission_rate, commission_exempt, due_date, signature_url, status, updated_by
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'pendente', ?)
    `,
    [
      nullIfEmpty(fantasy_name),
      nullIfEmpty(corporate_name),
      nullIfEmpty(sanitizedCnpj),
      nullIfEmpty(ie),
      nullIfEmpty(address),
      nullIfEmpty(sanitizedZip),
      nullIfEmpty(city),
      nullIfEmpty(state),
      nullIfEmpty(sanitizedPhone),
      nullIfEmpty(sanitizedCel),
      nullIfEmpty(sanitizedWhatsapp),
      nullIfEmpty(email),
      nullIfEmpty(instagram),
      nullIfEmpty(business_activity),
      nullIfEmpty(foundation_date),
      employees_qty ? Number(employees_qty) : null,
      nullIfEmpty(sector),
      nullIfEmpty(accounting_office),
      nullIfEmpty(referred_by),
      nullIfEmpty(note),
      nullIfEmpty(plan_type),
      value ? Number(value) : null,
      commission_rate ? Number(commission_rate) : null,
      commission_exempt ? 1 : 0,
      nullIfEmpty(due_date),
      signature_url,
      req.user?.id || null,
    ]
  );

  res.status(201).json({ id: result.insertId, message: 'Empresa criada com sucesso.' });
};
