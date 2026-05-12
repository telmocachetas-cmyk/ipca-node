const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router = express.Router();

// Listar cursos
router.get('/admin/cursos', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const cursos = await db.collection('cursos').find({}).sort({ nome: 1 }).toArray();
        
        // Contar disciplinas por curso
        for (let curso of cursos) {
            curso.total_disciplinas = curso.disciplinas ? curso.disciplinas.length : 0;
        }
        
        let cursosHTML = '';
        for (let curso of cursos) {
            cursosHTML += `
                <tr>
                    <td>#${curso._id.toString().slice(-6)}</td>
                    <td><strong>${escapeHtml(curso.nome)}</strong></td>
                    <td><span class="badge">${curso.total_disciplinas} disciplinas</span></td>
                    <td>
                        <button onclick="editarCurso('${curso._id}', '${escapeHtml(curso.nome)}')" class="btn" style="background:#28a745;padding:5px 10px;">✏️ Editar</button>
                        <a href="/admin/cursos/eliminar/${curso._id}" class="btn" style="background:#dc3545;padding:5px 10px;" onclick="return confirm('Tem certeza?')">🗑️ Eliminar</a>
                    </td>
                </tr>
            `;
        }
        
        res.send(generateCursosHTML(cursosHTML));
    } catch (error) {
        res.status(500).send('Erro ao listar cursos');
    }
});

// Criar curso
router.post('/admin/cursos/criar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { nome } = req.body;
        
        const existing = await db.collection('cursos').findOne({ nome });
        if (existing) {
            return sendAlert(res, 'Já existe um curso com este nome!', '/admin/cursos');
        }
        
        await db.collection('cursos').insertOne({
            nome,
            disciplinas: [],
            data_criacao: new Date()
        });
        
        res.redirect('/admin/cursos');
    } catch (error) {
        sendAlert(res, 'Erro ao criar curso', '/admin/cursos');
    }
});

// Editar curso
router.post('/admin/cursos/editar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { id, nome } = req.body;
        
        const existing = await db.collection('cursos').findOne({ nome, _id: { $ne: new ObjectId(id) } });
        if (existing) {
            return sendAlert(res, 'Já existe outro curso com este nome!', '/admin/cursos');
        }
        
        await db.collection('cursos').updateOne(
            { _id: new ObjectId(id) },
            { $set: { nome } }
        );
        
        res.redirect('/admin/cursos');
    } catch (error) {
        sendAlert(res, 'Erro ao atualizar curso', '/admin/cursos');
    }
});

// Eliminar curso
router.get('/admin/cursos/eliminar/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        
        const curso = await db.collection('cursos').findOne({ _id: new ObjectId(id) });
        if (curso.disciplinas && curso.disciplinas.length > 0) {
            return sendAlert(res, 'Não é possível eliminar: curso tem disciplinas associadas!', '/admin/cursos');
        }
        
        await db.collection('cursos').deleteOne({ _id: new ObjectId(id) });
        res.redirect('/admin/cursos');
    } catch (error) {
        sendAlert(res, 'Erro ao eliminar curso', '/admin/cursos');
    }
});

function generateCursosHTML(cursosRows) {
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Gerir Cursos - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display: flex; flex-wrap: wrap; gap: 5px; background: #f8f9fa; padding: 15px 30px; border-bottom: 1px solid #dee2e6; }
            .nav a { color: #667eea; text-decoration: none; padding: 8px 15px; border-radius: 25px; }
            .nav a:hover { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div><h1>📚 Gestão de Cursos</h1></div>
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
                <a href="/admin/disciplinas">📖 Unidades Curriculares</a>
                <a href="/admin/planos">📋 Planos de Estudos</a>
                <a href="/admin/utilizadores">👥 Utilizadores</a>
                <a href="/admin/validar-fichas">📝 Fichas</a>
            </div>
            <div class="content">
                <div class="card">
                    <h2>➕ Adicionar Novo Curso</h2>
                    <form method="POST" action="/admin/cursos/criar" style="display:flex;gap:10px">
                        <input type="text" name="nome" placeholder="Nome do curso" required style="flex:1;padding:10px">
                        <button type="submit" class="btn">Criar Curso</button>
                    </form>
                </div>
                <div class="card">
                    <h2>📋 Lista de Cursos</h2>
                    <table class="table"><thead><tr><th>ID</th><th>Nome</th><th>Disciplinas</th><th>Ações</th></tr></thead><tbody>${cursosRows}</tbody></table>
                </div>
            </div>
        </div>
        <div id="modalEditar" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1000">
            <div style="background:white;max-width:500px;margin:100px auto;padding:30px;border-radius:15px">
                <h3>✏️ Editar Curso</h3>
                <form method="POST" action="/admin/cursos/editar">
                    <input type="hidden" name="id" id="edit_id">
                    <div class="form-group"><label>Nome do Curso:</label><input type="text" name="nome" id="edit_nome" required style="width:100%;padding:10px"></div>
                    <div style="display:flex;gap:10px;justify-content:flex-end">
                        <button type="button" onclick="fecharModal()" class="btn" style="background:#6c757d">Cancelar</button>
                        <button type="submit" class="btn">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
        <script>
            function editarCurso(id, nome) { document.getElementById('edit_id').value = id; document.getElementById('edit_nome').value = nome; document.getElementById('modalEditar').style.display = 'block'; }
            function fecharModal() { document.getElementById('modalEditar').style.display = 'none'; }
            window.onclick = function(event) { var modal = document.getElementById('modalEditar'); if (event.target == modal) modal.style.display = 'none'; }
        </script>
    </body>
    </html>`;
}

function escapeHtml(str) {
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