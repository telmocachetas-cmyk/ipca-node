---

## 🚀 Como executar o projeto

### Pré-requisitos

- Node.js instalado (versão 18 ou superior)
- Conta no MongoDB Atlas (gratuita)
- Git (para clonar o repositório)

### Passo 1: Clonar o repositório

```bash
git clone https://github.com/SEU_USUARIO/ipca-node.git
cd ipca-node

### Passo 2: Instalar dependências

npm install

### Passo 3: Configurar variáveis de ambiente

Criar ficheiro .env na raiz do projeto:
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://SEU_USUARIO:SUA_PASSWORD@cluster.mongodb.net/

# Nome da base de dados
DB_NAME=ipca

# Chave secreta para as sessões
SESSION_SECRET=um_segredo_muito_seguro_123456

# Porta do servidor
PORT=3002

### Passo 4: Iniciar o servidor

node app.js

O servidor estará disponível em: http://localhost:3002