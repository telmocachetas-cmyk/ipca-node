const express = require('express');
const bcrypt = require('bcrypt');
const { getDB } = require('../../db');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router = express.Router();

router.get('/admin/perfil', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const user = await db.collection('users').findOne({ login: req.session.login });
        
        res.send(generatePerfilHTML(user, req.session.login, ''));
    } catch (error) {
        res.status(500).send('Erro ao carregar perfil');
    }
});

router.post('/admin/perfil/alterar-password', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { pwd_atual, pwd_nova, pwd_confirmar } = req.body;
        
        const user = await db.collection('users').findOne({ login: req.session.login });
        
        if (!await bcrypt.compare(pwd_atual, user.pwd)) {
            return sendAlert(res, 'Password atual incorreta!', '/admin/perfil');
        }
        if (pwd_nova !== pwd_confirmar) {
            return sendAlert(res, 'As passwords não coincidem!', '/admin/perfil');
        }
        if (pwd_nova.length < 4) {
            return sendAlert(res, 'A password deve ter pelo menos 4 caracteres!', '/admin/perfil');
        }
        
        const hashedPassword = await bcrypt.hash(pwd_nova, 10);
        await db.collection('users').updateOne(
            { login: req.session.login },
            { $set: { pwd: hashedPassword } }
        );
        
        sendAlert(res, 'Password alterada com sucesso!', '/admin/perfil');
    } catch (error) {
        sendAlert(res, 'Erro ao alterar password', '/admin/perfil');
    }
});

function generatePerfilHTML(user, login, errorMsg) {
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Meu Perfil - Admin - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .profile-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 15px; margin-bottom: 30px; }
            .profile-avatar { width: 100px; height: 100px; background: white; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 3em; color: #667eea; }
            .profile-info { display: grid; grid-template-columns: repeat(2,1fr); gap: 20px; margin-bottom: 30px; }
            .info-item { background: #f8f9fa; padding: 20px; border-radius: 10px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>👤 Meu Perfil (Administrador)</h1><p>${login}</p></div>
            <div class="nav">
                <a href="/admin/dashboard">📊 Dashboard</a>
                <a href="/admin/cursos">📚 Cursos</a>
                <a href="/admin/disciplinas">📖 Unidades Curriculares</a>
                <a href="/admin/planos">📋 Planos de Estudos</a>
                <a href="/admin/utilizadores">👥 Utilizadores</a>
                <a href="/logout" style="float:right">🚪 Logout</a>
            </div>
            <div class="content">
                <div class="profile-header"><div class="profile-avatar">${login.charAt(0).toUpperCase()}</div><h2>${login}</h2><p><span class="badge badge-admin">ADMIN</span></p></div>
                <div class="profile-info">
                    <div class="info-item"><div class="info-label">Login</div><div class="info-value">${login}</div></div>
                    <div class="info-item"><div class="info-label">Tipo</div><div class="info-value"><span class="badge badge-admin">ADMIN</span></div></div>
                </div>
                <div class="card"><h2>🔒 Alterar Password</h2>
                    <form method="POST" action="/admin/perfil/alterar-password" style="max-width:500px;margin:0 auto">
                        <div class="form-group"><label>Password Atual</label><input type="password" name="pwd_atual" required></div>
                        <div class="form-group"><label>Nova Password</label><input type="password" name="pwd_nova" required minlength="4"></div>
                        <div class="form-group"><label>Confirmar Nova Password</label><input type="password" name="pwd_confirmar" required></div>
                        <button type="submit" class="btn btn-block">Alterar Password</button>
                    </form>
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

function sendAlert(res, message, redirectUrl) {
    res.send(`<script>alert('${message}'); window.location.href='${redirectUrl}';</script>`);
}

module.exports = router;