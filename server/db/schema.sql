CREATE TABLE IF NOT EXISTS users(
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('viewer','editor','admin') NOT NULL DEFAULT 'viewer',
  theme_preference ENUM('system','light','dark') DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings(
  `key` VARCHAR(64) PRIMARY KEY,
  `value` TEXT
);

CREATE TABLE IF NOT EXISTS companies(
  id INT AUTO_INCREMENT PRIMARY KEY,
  fantasy_name VARCHAR(160),
  corporate_name VARCHAR(160),
  cnpj VARCHAR(18),
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pending_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  action ENUM('approved','rejected') NOT NULL,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

INSERT INTO users (name, email, password_hash, role)
VALUES ('Administrador', 'admin@empresa.com', '$2y$12$7ppBayeirE54tjw4a1FEAuKYbImr58.Hapv32D..TCmfVtADFmpJK', 'admin')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO settings(`key`, `value`) VALUES
  ('theme_preference','system'),
  ('primary','#4f86ff'),
  ('default_commission_rate','0.10')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

INSERT INTO companies (
  fantasy_name, corporate_name, cnpj, city, state, sector, status, value, commission_rate, due_date, plan_type, approved_at, updated_by
) VALUES
  ('Casa Solar', 'Casa Solar LTDA', '11222333000181', 'São Paulo', 'SP', 'Energia', 'ativo', 2990.00, 0.12, DATE_FORMAT(CURDATE(), '%Y-%m-01'), 'mensal', NOW(), 1),
  ('TechMax', 'TechMax Serviços Digitais', '44333555000109', 'Campinas', 'SP', 'Tecnologia', 'ativo', 1890.50, 0.08, DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 10 DAY), 'mensal', NOW(), 1),
  ('Flor & Arte', 'Flor & Arte Comércio de Flores', '99888777000122', 'Sorocaba', 'SP', 'Varejo', 'pendente', NULL, NULL, NULL, NULL, NULL, NULL),
  ('BarraFit', 'BarraFit Academia', '55444666000155', 'Barueri', 'SP', 'Academia', 'pendente', NULL, NULL, NULL, NULL, NULL, NULL),
  ('Doces Maria', 'Doces Maria Confeitaria', '22114433000166', 'Osasco', 'SP', 'Alimentos', 'pendente', NULL, NULL, NULL, NULL, NULL, NULL);
