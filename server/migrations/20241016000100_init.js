import bcrypt from 'bcryptjs';

const ADMIN_NAME = 'Administrador';
const ADMIN_EMAIL = 'admin@empresa.com';
const ADMIN_DEFAULT_PASSWORD =
  process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const BASE_TABLE_OPTIONS =
  'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

const toDate = (date) => date.toISOString().slice(0, 10);
const toDateTime = (date) =>
  date.toISOString().slice(0, 19).replace('T', ' ');

export async function up(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('viewer','editor','admin') NOT NULL DEFAULT 'viewer',
      theme_preference ENUM('system','light','dark') DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ${BASE_TABLE_OPTIONS};
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(64) PRIMARY KEY,
      \`value\` TEXT
    ) ${BASE_TABLE_OPTIONS};
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fantasy_name VARCHAR(160),
      corporate_name VARCHAR(160),
      cnpj VARCHAR(18) UNIQUE,
      ie VARCHAR(40),
      address VARCHAR(160),
      zip VARCHAR(12),
      city VARCHAR(100),
      state VARCHAR(2),
      phone VARCHAR(40),
      cel VARCHAR(40),
      whatsapp VARCHAR(40),
      email VARCHAR(160),
      instagram VARCHAR(160),
      business_activity VARCHAR(160),
      foundation_date DATE,
      employees_qty INT,
      sector VARCHAR(100),
      accounting_office VARCHAR(160),
      referred_by VARCHAR(120),
      note VARCHAR(255),
      plan_type ENUM('mensal','trimestral','semestral','anual') NULL,
      value DECIMAL(10,2) NULL,
      commission_rate DECIMAL(6,4) NULL,
      commission_exempt TINYINT(1) DEFAULT 0,
      due_date DATE NULL,
      signature_url VARCHAR(320) NULL,
      status ENUM('pendente','ativo','reprovado') DEFAULT 'pendente',
      approved_at DATETIME NULL,
      updated_by INT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_companies_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ${BASE_TABLE_OPTIONS};
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS pending_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      action ENUM('approved','rejected') NOT NULL,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_pending_logs_company FOREIGN KEY (company_id)
        REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ${BASE_TABLE_OPTIONS};
  `);

  const passwordHash = await bcrypt.hash(
    ADMIN_DEFAULT_PASSWORD,
    BCRYPT_ROUNDS
  );

  await connection.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'admin')
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        password_hash = VALUES(password_hash),
        role = VALUES(role)
    `,
    [ADMIN_NAME, ADMIN_EMAIL, passwordHash]
  );

  const [[admin]] = await connection.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [ADMIN_EMAIL]
  );
  const adminId = admin?.id || null;

  await connection.query(`
    INSERT INTO settings(\`key\`, \`value\`) VALUES
      ('theme_preference','system'),
      ('primary','#4f86ff'),
      ('default_commission_rate','0.10')
    ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`);
  `);

  const [[{ company_count: companyCount }]] = await connection.query(
    'SELECT COUNT(*) AS company_count FROM companies'
  );

  if (companyCount === 0 && adminId) {
    const now = new Date();
    const firstDayOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );
    const tenthDay = new Date(firstDayOfMonth);
    tenthDay.setUTCDate(tenthDay.getUTCDate() + 10);

    const approvedAt = toDateTime(now);
    const firstDay = toDate(firstDayOfMonth);
    const tenthDayDate = toDate(tenthDay);

    const sampleCompanies = [
      {
        fantasy_name: 'Casa Solar',
        corporate_name: 'Casa Solar LTDA',
        cnpj: '11222333000181',
        city: 'São Paulo',
        state: 'SP',
        sector: 'Energia',
        status: 'ativo',
        value: 2990.0,
        commission_rate: 0.12,
        due_date: firstDay,
        plan_type: 'mensal',
        approved_at: approvedAt,
      },
      {
        fantasy_name: 'TechMax',
        corporate_name: 'TechMax Serviços Digitais',
        cnpj: '44333555000109',
        city: 'Campinas',
        state: 'SP',
        sector: 'Tecnologia',
        status: 'ativo',
        value: 1890.5,
        commission_rate: 0.08,
        due_date: tenthDayDate,
        plan_type: 'mensal',
        approved_at: approvedAt,
      },
      {
        fantasy_name: 'Flor & Arte',
        corporate_name: 'Flor & Arte Comércio de Flores',
        cnpj: '99888777000122',
        city: 'Sorocaba',
        state: 'SP',
        sector: 'Varejo',
        status: 'pendente',
      },
      {
        fantasy_name: 'BarraFit',
        corporate_name: 'BarraFit Academia',
        cnpj: '55444666000155',
        city: 'Barueri',
        state: 'SP',
        sector: 'Academia',
        status: 'pendente',
      },
      {
        fantasy_name: 'Doces Maria',
        corporate_name: 'Doces Maria Confeitaria',
        cnpj: '22114433000166',
        city: 'Osasco',
        state: 'SP',
        sector: 'Alimentos',
        status: 'pendente',
      },
    ];

    for (const company of sampleCompanies) {
      await connection.query(
        `
          INSERT INTO companies (
            fantasy_name,
            corporate_name,
            cnpj,
            city,
            state,
            sector,
            status,
            value,
            commission_rate,
            due_date,
            plan_type,
            approved_at,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            fantasy_name = VALUES(fantasy_name),
            corporate_name = VALUES(corporate_name),
            city = VALUES(city),
            state = VALUES(state),
            sector = VALUES(sector),
            status = VALUES(status),
            value = VALUES(value),
            commission_rate = VALUES(commission_rate),
            due_date = VALUES(due_date),
            plan_type = VALUES(plan_type),
            approved_at = VALUES(approved_at),
            updated_by = VALUES(updated_by)
        `,
        [
          company.fantasy_name,
          company.corporate_name,
          company.cnpj,
          company.city || null,
          company.state || null,
          company.sector || null,
          company.status,
          company.value ?? null,
          company.commission_rate ?? null,
          company.due_date || null,
          company.plan_type || null,
          company.approved_at || null,
          adminId,
        ]
      );
    }
  }
}
