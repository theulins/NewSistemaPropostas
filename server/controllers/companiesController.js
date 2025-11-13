import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import pool from '../db/pool.js';
import { digitsOnly, nullIfEmpty } from '../utils/normalizers.js';

const RECEITA_TIMEOUT_MS = Number(process.env.RECEITA_TIMEOUT_MS) || 15000;
const RECEITA_BASE_URL = process.env.RECEITA_BASE_URL || 'https://receitaws.com.br/v1/cnpj';

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

function parseReceitaDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return null;
}

function formatZip(value) {
  const digits = digitsOnly(value);
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

function normalizeReceitaResponse(data, fallbackCnpj) {
  const primaryActivity = Array.isArray(data.atividade_principal) && data.atividade_principal.length
    ? data.atividade_principal[0]
    : null;
  const addressParts = [data.logradouro, data.numero, data.complemento].filter(Boolean);
  const cleanPhone = data.telefone ? data.telefone.replace(/\s+/g, ' ').trim() : '';
  return {
    fantasy_name: data.fantasia || data.nome || '',
    corporate_name: data.nome || '',
    cnpj: digitsOnly(data.cnpj) || fallbackCnpj,
    ie: data.ie || data.inscricao_estadual || '',
    address: addressParts.join(', '),
    zip: formatZip(data.cep),
    city: data.municipio || '',
    state: data.uf || '',
    email: data.email || '',
    phone: cleanPhone,
    business_activity: primaryActivity?.text || '',
    sector: primaryActivity?.text || '',
    foundation_date: parseReceitaDate(data.abertura),
  };
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

export const lookupCompanyByCnpj = async (req, res) => {
  const rawCnpj = req.params.cnpj || '';
  const sanitized = digitsOnly(rawCnpj);
  if (!sanitized || sanitized.length !== 14) {
    return res.status(400).json({ message: 'Informe um CNPJ válido com 14 dígitos.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECEITA_TIMEOUT_MS);
  try {
    const response = await fetch(`${RECEITA_BASE_URL}/${sanitized}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SistemaPropostas/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || 'Não foi possível consultar o CNPJ informado.');
    }

    const payload = await response.json();
    if (payload.status !== 'OK') {
      throw new Error(payload.message || 'Consulta não retornou resultados.');
    }

    const normalized = normalizeReceitaResponse(payload, sanitized);
    return res.json({ data: normalized });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ message: 'Tempo esgotado ao consultar a Receita Federal. Tente novamente.' });
    }
    console.error('Erro ao consultar ReceitaWS:', error);
    return res.status(502).json({ message: error.message || 'Não foi possível consultar o CNPJ.' });
  } finally {
    clearTimeout(timeout);
  }
};
