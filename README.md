# Sistema de Propostas

Aplicação completa (frontend estático + backend Node/Express + MySQL) para gestão de empresas, propostas e aprovações.

## Estrutura

```
/public
  css/, js/, *.html
/server
  app.js, routes.js, controllers/, db/, middleware/, utils/
.env.example
```

## Pré-requisitos

- Node.js 18+
- MySQL 8 (ou compatível)

## Configuração do banco

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
cp ../.env.example .env
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

## Frontend

A API já expõe os arquivos estáticos contidos em `public`. Após iniciar o servidor (`npm start`), acesse:

- `http://localhost:3001/` → redireciona para `login.html`
- `http://localhost:3001/dashboard.html`
- `http://localhost:3001/pendencias.html`

Caso deseje servir o frontend separadamente (por exemplo, em outro domínio), basta disponibilizar o conteúdo da pasta `public` e
configurar o proxy/CORS apontando para o backend em `http://localhost:3001`.

### Login seed

```
E-mail: admin@empresa.com
Senha: admin123
```

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
