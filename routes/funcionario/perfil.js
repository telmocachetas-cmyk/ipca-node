const express = require('express');
const bcrypt = require('bcrypt');
const { getDB } = require('../../db');
const { isAuthenticated, isFuncionario } = require('../../middleware/auth');
const router = express.Router();

router.get('/funcionario/perfil', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const user = await db.collection('users').findOne({ login: req.session.login });
        res.send(generatePerfilHTML(user, req.session.login));
    } catch (error) {
        res.status(500).send('Erro ao carregar perfil');
    }
});

router.post('/funcionario/perfil/alterar-password', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const { pwd_atual, pwd_nova, pwd_confirmar } = req.body;
        
        const user = await db.collection('users').findOne({ login: req.session.login });
        
        if (!await bcrypt.compare(pwd_atual, user.pwd)) {
            return res.send(`<script>alert('Password atual incorreta!'); window.location.href='/funcionario/perfil';</script>`);
        }
        if (pwd_nova !== pwd_confirmar) {
            return res.send(`<script>alert('As passwords não coincidem!'); window.location.href='/funcionario/perfil';</script>`);
        }
        if (pwd_nova.length < 4) {
            return res.send(`<script>alert('A password deve ter pelo menos 4 caracteres!'); window.location.href='/funcionario/perfil';</script>`);
        }
        
        const hashedPassword = await bcrypt.hash(pwd_nova, 10);
        await db.collection('users').updateOne(
            { login: req.session.login },
            { $set: { pwd: hashedPassword } }
        );
        
        res.send(`<script>alert('Password alterada com sucesso!'); window.location.href='/funcionario/perfil';</script>`);
    } catch (error) {
        res.send(`<script>alert('Erro ao alterar password'); window.location.href='/funcionario/perfil';</script>`);
    }
});

function generatePerfilHTML(user, login) {
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Meu Perfil - Funcionário</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .profile-header { background:linear-gradient(135deg,#17a2b8 0%,#138496 100%); color:white; padding:40px; text-align:center; border-radius:15px; margin-bottom:30px; }
            .profile-avatar { width:100px; height:100px; background:white; border-radius:50%; margin:0 auto 20px; display:flex; align-items:center; justify-content:center; font-size:3em; color:#17a2b8; }
            .profile-info { display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin-bottom:30px; }
            .info-item { background:#f8f9fa; padding:20px; border-radius:10px; }
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>👤 Meu Perfil</h1><p><strong>${login}</strong> (Funcionário)</p></div>
            <div class="nav">
                <a href="/funcionario/dashboard">📊 Dashboard</a>
                <a href="/funcionario/criar-pauta">📝 Criar Pauta</a>
                <a href="/funcionario/pautas">📊 Ver Pautas</a>
                <a href="/funcionario/pedidos">📋 Pedidos</a>
                <a href="/funcionario/alunos">👥 Alunos</a>
                <a href="/logout" style="float:right">🚪 Logout</a>
            </div>
            <div class="content">
                <div class="profile-header">
                    <div class="profile-avatar">${login.charAt(0).toUpperCase()}</div>
                    <h2>${login}</h2>
                    <p><span class="badge" style="background:#17a2b8">FUNCIONÁRIO</span></p>
                </div>
                <div class="profile-info">
                    <div class="info-item"><div class="info-label">Login</div><div class="info-value">${login}</div></div>
                    <div class="info-item"><div class="info-label">Tipo</div><div class="info-value"><span class="badge" style="background:#17a2b8">FUNCIONÁRIO</span></div></div>
                </div>
                <div class="card"><h2>🔒 Alterar Password</h2>
                    <form method="POST" action="/funcionario/perfil/alterar-password" style="max-width:500px;margin:0 auto">
                        <div class="form-group"><label>Password Atual</label><input type="password" name="pwd_atual" required></div>
                        <div class="form-group"><label>Nova Password</label><input type="password" name="pwd_nova" required minlength="4"></div>
                        <div class="form-group"><label>Confirmar Password</label><input type="password" name="pwd_confirmar" required></div>
                        <button type="submit" class="btn btn-block">Alterar Password</button>
                    </form>
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

module.exports = router;