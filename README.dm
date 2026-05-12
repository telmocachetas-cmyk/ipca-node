# IPCA - Sistema de Gestão Académica

## Como executar

1. `npm install`
2. Criar `.env` com `MONGODB_URI=...`
3. `node init-db.js`
4. `node app.js`

## Credenciais
- Admin: admin/admin123
- Funcionário: func1/func123
- Aluno: aluno1/aluno123

## Rotas principais
- `/admin/dashboard`
- `/aluno/dashboard`
- `/funcionario/dashboard`

## Como desligar

npx kill-port 3002
node app.js

OU

Ctrl + C
node app.js