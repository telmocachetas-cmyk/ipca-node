require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { connectDB } = require('./db');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Sessões
app.use(session({
    secret: process.env.SESSION_SECRET || 'mysecret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

// ============ ROTAS PÚBLICAS ============
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/index'));
app.use('/', require('./routes/cursos'));
app.use('/', require('./routes/disciplinas'));
app.use('/', require('./routes/perfil'));

// ============ ROTAS ADMIN ============
app.use('/', require('./routes/admin/dashboard'));
app.use('/', require('./routes/admin/cursos'));
app.use('/', require('./routes/admin/disciplinas'));
app.use('/', require('./routes/admin/planos'));
app.use('/', require('./routes/admin/utilizadores'));
app.use('/', require('./routes/admin/fichas'));
app.use('/', require('./routes/admin/perfil'));

// ============ ROTAS ALUNO ============
app.use('/', require('./routes/aluno/dashboard'));
app.use('/', require('./routes/aluno/ficha'));
app.use('/', require('./routes/aluno/matricula'));
app.use('/', require('./routes/aluno/perfil'));
app.use('/', require('./routes/aluno/pedidos'));
app.use('/', require('./routes/aluno/plano-estudos'));

// ============ ROTAS FUNCIONARIO ============
app.use('/', require('./routes/funcionario/dashboard'));
app.use('/', require('./routes/funcionario/pautas'));
app.use('/', require('./routes/funcionario/perfil'));
app.use('/', require('./routes/funcionario/pedidos'));
app.use('/', require('./routes/funcionario/alunos'));

// Iniciar servidor
async function start() {
    await connectDB();
    app.listen(process.env.PORT || 3002, () => {
        console.log(`🚀 Servidor em http://localhost:${process.env.PORT || 3002}`);
    });
}

start();