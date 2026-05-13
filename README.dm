# IPCA - Sistema de Gestão Académica

## Como executar:

1. Instalar Node.js
2. `npm install`
3. Criar conta no MongoDB Atlas
4. Criar ficheiro `.env`:

MONGODB_URI=mongodb+srv://SEU_USUARIO:SUA_PASSWORD@cluster.mongodb.net/
DB_NAME=ipca
SESSION_SECRET=qualquer_coisa
PORT=3002

5. `node app.js`
6. Aceder a `http://localhost:3002`

## Credenciais:
- ADMIN: admin / 1234
- FUNCIONARIO: func1 / 1234
- ALUNO: criar via registo