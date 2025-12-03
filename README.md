# 🧩 Sistema de Propostas 
Aplicação completa para gestão de empresas, propostas, pendências, comissões e geração de PDFs.  
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

1. Crie um banco de dados vazio (ex.: `sistema_propostas`).
2. Dentro da pasta `server`, rode as migrations:

   ```bash
   npm run migrate
   ```

   - O comando cria todas as tabelas necessárias.
   - Um usuário admin é criado/atualizado automaticamente (`admin@empresa.com`). A senha padrão é `admin123`, mas pode ser sobrescrita definindo a variável `ADMIN_DEFAULT_PASSWORD` no `.env` antes de rodar a migration.
   - Configurações iniciais e dados de exemplo para empresas são inseridos caso o banco esteja vazio.

## Backend

```bash
cd server
cp .env.example .env
# edite credenciais do banco, JWT_SECRET etc.
# (Opcional) defina ADMIN_DEFAULT_PASSWORD antes de rodar migrations

# instalar dependências
npm install

# criar/atualizar estrutura do banco
npm run migrate

# iniciar o servidor
npm start
```

O servidor sobe em `http://localhost:3001` por padrão e expõe os endpoints REST em `/api/*`.

PDF → geração completa e campos alinhados

Pendências → edição inline + aprovação/reprovação

Configurações → tema/cor + CRUD de usuários (admin)

## Endpoints principais

- `POST /api/login` / `GET /api/profile`
- Dashboard: `GET /api/dashboard/summary`, `GET /api/dashboard/commissions?month=YYYY-MM`
- Empresas: `GET /api/empresas/list`, `GET /api/empresas/search`, `POST /api/empresas`
- Pendências: `GET /api/empresas/pending`, `POST /api/empresas/pending/approve`, `POST /api/empresas/pending/reject`
- Configurações: `GET/PUT /api/settings`
- Usuários (admin): `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`, `DELETE /api/users/:id`

## Notas

- JWT com expiração de 8h e RBAC (viewer/editor/admin)
- Upload de assinaturas em PNG (pasta `server/uploads`)
- Layout mobile-first com tema claro/escuro e seletor de cor primária
- Seletores (select/option) com contraste adequado para ambos os temas

## Testes manuais sugeridos

- Login → redireciona para dashboard com token válido
- Dashboard → KPIs, últimas edições e card de comissões por mês (com taxa padrão ou manual)
- Empresas → pesquisa/lista, alternância lista/formulário e envio com assinatura desenhada
- Pendências → edição inline de valor/taxa, aprovação/reprovação removendo linhas
- Configurações → ajuste de tema/cor + CRUD de usuários (apenas admin)


