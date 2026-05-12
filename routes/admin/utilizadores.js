const express = require('express');
const bcrypt = require('bcrypt');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router = express.Router();

// Listar utilizadores
router.get('/admin/utilizadores', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const utilizadores = await db.collection('users')
            .find({})
            .sort({ login: 1 })
            .toArray();
        
        res.send(generateUtilizadoresHTML(utilizadores, req.session.login));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar utilizadores');
    }
});

// Criar utilizador
router.post('/admin/utilizadores/criar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { login, pwd, grupo } = req.body;
        
        const existing = await db.collection('users').findOne({ login });
        if (existing) {
            return sendAlert(res, 'Este login já existe!', '/admin/utilizadores');
        }
        
        const hashedPassword = await bcrypt.hash(pwd, 10);
        
        await db.collection('users').insertOne({
            login,
            pwd: hashedPassword,
            grupo,
            data_registo: new Date()
        });
        
        sendAlert(res, 'Utilizador criado com sucesso!', '/admin/utilizadores');
        
    } catch (error) {
        sendAlert(res, 'Erro ao criar utilizador', '/admin/utilizadores');
    }
});

// Editar utilizador
router.post('/admin/utilizadores/editar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { login_original, login, pwd, grupo } = req.body;
        
        const updateData = { login, grupo };
        
        if (pwd && pwd.trim() !== '') {
            updateData.pwd = await bcrypt.hash(pwd, 10);
        }
        
        await db.collection('users').updateOne(
            { login: login_original },
            { $set: updateData }
        );
        
        sendAlert(res, 'Utilizador atualizado com sucesso!', '/admin/utilizadores');
        
    } catch (error) {
        sendAlert(res, 'Erro ao atualizar utilizador', '/admin/utilizadores');
    }
});

// Eliminar utilizador
router.get('/admin/utilizadores/eliminar/:login', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { login } = req.params;
        
        if (login === req.session.login) {
            return sendAlert(res, 'Não pode eliminar o seu próprio utilizador!', '/admin/utilizadores');
        }
        
        await db.collection('users').deleteOne({ login });
        sendAlert(res, 'Utilizador eliminado com sucesso!', '/admin/utilizadores');
        
    } catch (error) {
        sendAlert(res, 'Erro ao eliminar utilizador', '/admin/utilizadores');
    }
});

function generateUtilizadoresHTML(utilizadores, currentLogin) {
    const rows = utilizadores.map(user => `
        <tr>
            <td><strong>${escapeHtml(user.login)}</strong></td>
            <td>
                <span class="badge ${user.grupo === 'ADMIN' ? 'badge-admin' : (user.grupo === 'FUNCIONARIO' ? 'badge' : 'badge-aluno')}" 
                      style="${user.grupo === 'FUNCIONARIO' ? 'background:#17a2b8' : ''}">
                    ${user.grupo}
                </span>
            </td>
            <td><code style="font-size:0.8em">${user.pwd.substring(0, 20)}...</code></td>
            <td>
                <button onclick="editarUtilizador('${user.login}', '${user.grupo}')" 
                        class="btn" style="background:#28a745;padding:5px 10px;">✏️ Editar</button>
                ${user.login !== currentLogin ? 
                    `<a href="/admin/utilizadores/eliminar/${user.login}" 
                       class="btn" style="background:#dc3545;padding:5px 10px;"
                       onclick="return confirm('Tem a certeza?')">🗑️ Eliminar</a>` : ''}
            </td>
        </tr>
    `).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Gerir Utilizadores - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; flex-wrap:wrap; gap:5px; background:#f8f9fa; padding:15px 30px; border-bottom:1px solid #dee2e6; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; transition:all 0.3s; font-weight:500; }
            .nav a:hover { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; transform:translateY(-2px); }
            .form-row { display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:10px; align-items:end; }
            @media (max-width:768px) { .form-row { grid-template-columns:1fr; } }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">
                    <div><h1>👥 Gestão de Utilizadores</h1><p><strong>Bem-vindo, ${currentLogin}</strong></p></div>
                    <div class="menu-perfil">
                        <span class="profile-badge profile-admin">ADMIN</span>
                        <div class="menu-perfil-content">
                            <a href="/">🏠 Site Principal</a>
                            <a href="/admin/perfil">👤 Meu Perfil</a>
                            <a href="/logout">🚪 Logout</a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="nav">
                <a href="/admin/dashboard">📊 Dashboard</a>
                <a href="/admin/cursos">📚 Cursos</a>
                <a href="/admin/disciplinas">📖 Unidades Curriculares</a>
                <a href="/admin/planos">📋 Planos de Estudos</a>
                <a href="/admin/validar-fichas">📝 Fichas</a>
            </div>
            <div class="content">
                <div class="card">
                    <h2>➕ Adicionar Novo Utilizador</h2>
                    <form method="POST" action="/admin/utilizadores/criar" class="form-row">
                        <input type="text" name="login" placeholder="Login" required style="padding:10px">
                        <input type="password" name="pwd" placeholder="Password" required style="padding:10px">
                        <select name="grupo" required style="padding:10px">
                            <option value="ADMIN">ADMIN</option>
                            <option value="ALUNO">ALUNO</option>
                            <option value="FUNCIONARIO">FUNCIONARIO</option>
                        </select>
                        <button type="submit" class="btn">Criar</button>
                    </form>
                </div>
                <div class="card">
                    <h2>📋 Lista de Utilizadores</h2>
                    ${utilizadores.length ? `
                        <table class="table">
                            <thead><tr><th>Login</th><th>Tipo</th><th>Password (hash)</th><th>Ações</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    ` : '<p style="text-align:center;color:#666;padding:40px">Nenhum utilizador encontrado.</p>'}
                </div>
            </div>
        </div>
        <div id="modalEditar" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000">
            <div style="background:white;max-width:500px;margin:100px auto;padding:30px;border-radius:15px">
                <h3>✏️ Editar Utilizador</h3>
                <form method="POST" action="/admin/utilizadores/editar">
                    <input type="hidden" name="login_original" id="edit_login_original">
                    <div class="form-group"><label>Login:</label><input type="text" name="login" id="edit_login" required style="width:100%;padding:10px"></div>
                    <div class="form-group"><label>Nova Password (deixar vazio para manter):</label><input type="password" name="pwd" id="edit_pwd" style="width:100%;padding:10px"></div>
                    <div class="form-group"><label>Tipo:</label><select name="grupo" id="edit_grupo" required style="width:100%;padding:10px">
                        <option value="ADMIN">ADMIN</option>
                        <option value="ALUNO">ALUNO</option>
                        <option value="FUNCIONARIO">FUNCIONARIO</option>
                    </select></div>
                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" onclick="fecharModal()" class="btn" style="background:#6c757d">Cancelar</button>
                        <button type="submit" class="btn">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
        <script>
            function editarUtilizador(login, grupo) {
                document.getElementById('edit_login_original').value = login;
                document.getElementById('edit_login').value = login;
                document.getElementById('edit_grupo').value = grupo;
                document.getElementById('edit_pwd').value = '';
                document.getElementById('modalEditar').style.display = 'block';
            }
            function fecharModal() { document.getElementById('modalEditar').style.display = 'none'; }
            window.onclick = function(event) { var modal = document.getElementById('modalEditar'); if (event.target == modal) modal.style.display = 'none'; }
        </script>
    </body>
    </html>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function sendAlert(res, message, redirectUrl) {
    res.send(`<script>alert('${message}'); window.location.href='${redirectUrl}';</script>`);
}

module.exports = router;