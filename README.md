# 🧩 Sistema de Propostas – ACIU  
Aplicação completa para gestão de empresas, propostas, pendências, comissões e geração de PDFs oficiais da ACIU.  
Inclui **frontend estático**, **backend Node/Express**, **MySQL**, **PDF Generator**, **assinatura digital**, **dashboard**, **controle de permissões** e **auditoria**.

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/MySQL-8%2B-4479A1?style=for-the-badge&logo=mysql&logoColor=white"/>
  <img src="https://img.shields.io/badge/Express.js-Backend-black?style=for-the-badge&logo=express&logoColor=white"/>
  <img src="https://img.shields.io/badge/HTML-CSS-JS-ff9800?style=for-the-badge&logo=html5&logoColor=white"/>
  <img src="https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens"/>
  <img src="https://img.shields.io/badge/jsPDF-PDF_Generator-1976d2?style=for-the-badge"/>
</p>

---

## 📌 Visão Geral

Este sistema foi desenvolvido para auxiliar o processo de **associação comercial**, centralizando:

- Cadastro completo de empresas;
- Registro de sócios/diretores;
- Assinatura digital desenhada via canvas;
- Geração automática de PDFs no modelo da ACIU;
- Controle de pendências, aprovações e recusas;
- Dashboard administrativo com comissões e indicadores;
- Usuários com permissões (Admin, Editor, Viewer).

O objetivo é fornecer uma ferramenta moderna, rápida e confiável para uso diário no setor comercial.

---

## 🗂 Estrutura do Projeto

/public
css/, js/, *.html
/server
app.js, routes.js, controllers/, db/, middleware/, utils/
.env.example

yaml
Copiar código

---

## ⚙️ Pré-requisitos

- Node.js **18+**
- MySQL **8+** (ou compatível)

---

## 🧱 Configuração do Banco de Dados

1. Crie um banco de dados vazio:

   ```sql
   CREATE DATABASE sistema_propostas;
Execute as migrations dentro da pasta server:

bash
Copiar código
npm run migrate
Isso irá:

Criar todas as tabelas necessárias;

Criar/atualizar automaticamente o usuário admin:

makefile
Copiar código
E-mail: admin@empresa.com
Senha: admin123
Inserir configurações iniciais e dados de exemplo (seed), caso o banco esteja vazio.

Para sobrescrever a senha padrão:

env
Copiar código
ADMIN_DEFAULT_PASSWORD=minhasenha
🖥️ Backend
bash
Copiar código
cd server
cp ../.env.example .env
# edite o arquivo .env com:
# DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, ADMIN_DEFAULT_PASSWORD, etc.

npm install        # instala dependências
npm run migrate    # cria/atualiza tabelas
npm start          # inicia o servidor
Servidor disponível em:

arduino
Copiar código
http://localhost:3001
Endpoints REST ficam expostos em:

bash
Copiar código
/api/*
💻 Frontend
Após iniciar o backend (npm start), acesse:

http://localhost:3001/ → redireciona para login.html

http://localhost:3001/dashboard.html

http://localhost:3001/empresas.html

http://localhost:3001/pendencias.html

Se quiser hospedar o frontend separadamente:

publique a pasta public

configure o proxy/CORS apontando para http://localhost:3001

🔑 Login Inicial (Seed)
makefile
Copiar código
E-mail: admin@empresa.com
Senha: admin123
🔌 Endpoints Principais
🔐 Autenticação
POST /api/login

GET /api/profile

📊 Dashboard
GET /api/dashboard/summary

GET /api/dashboard/commissions?month=YYYY-MM

🏢 Empresas
GET /api/empresas/list

GET /api/empresas/search

GET /api/empresas/:id

POST /api/empresas

PUT /api/empresas/:id

📌 Pendências
GET /api/empresas/pending

POST /api/empresas/pending/approve

POST /api/empresas/pending/reject

⚙️ Configurações
GET /api/settings

PUT /api/settings

👤 Usuários (Apenas Admin)
GET /api/users

POST /api/users

PUT /api/users/:id

DELETE /api/users/:id

📝 Notas Técnicas
Autenticação JWT com expiração de 8h

RBAC (viewer/editor/admin)

Upload de assinaturas em PNG (server/uploads)

Geração de PDF com jsPDF (layout oficial ACIU)

Layout mobile-first

Tema claro/escuro e seletor de cor primária

Seletores (select/option) com contraste ideal para ambos temas

🧪 Testes Manuais Recomendados
Login → dashboard com token válido

Dashboard → KPIs + comissões por mês

Empresas → pesquisa/lista + formulário + assinatura desenhada

PDF → geração completa e campos alinhados

Pendências → edição inline + aprovação/reprovação

Configurações → tema/cor + CRUD de usuários (admin)

