const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router = express.Router();

// Listar disciplinas
router.get('/admin/disciplinas', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const disciplinas = await db.collection('disciplinas').find({}).sort({ nome: 1 }).toArray();
        
        // Contar cursos que usam cada disciplina
        for (let disc of disciplinas) {
            const cursos = await db.collection('cursos')
                .find({ 'disciplinas.disciplina_id': disc._id })
                .toArray();
            disc.total_cursos = cursos.length;
        }
        
        let mensagem = req.query.msg ? decodeURIComponent(req.query.msg) : '';
        let tipoMsg = req.query.tipo || '';
        
        res.send(generateDisciplinasHTML(disciplinas, req.session.login, mensagem, tipoMsg));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar disciplinas');
    }
});

// Criar disciplina
router.post('/admin/disciplinas/criar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { nome } = req.body;
        
        // Verificar se já existe
        const existing = await db.collection('disciplinas').findOne({ nome });
        if (existing) {
            return res.redirect('/admin/disciplinas?msg=' + encodeURIComponent('Já existe uma Unidade Curricular com este nome!') + '&tipo=error');
        }
        
        await db.collection('disciplinas').insertOne({
            nome,
            data_criacao: new Date()
        });
        
        res.redirect('/admin/disciplinas?msg=' + encodeURIComponent('UC criada com sucesso!') + '&tipo=success');
        
    } catch (error) {
        res.redirect('/admin/disciplinas?msg=' + encodeURIComponent('Erro ao criar UC') + '&tipo=error');
    }
});

// Editar disciplina
router.post('/admin/disciplinas/editar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { id, nome } = req.body;
        
        // Verificar se já existe outra com o mesmo nome
        const existing = await db.collection('disciplinas').findOne({ 
            nome, 
            _id: { $ne: new ObjectId(id) } 
        });
        
        if (existing) {
            return res.redirect('/admin/disciplinas?msg=' + encodeURIComponent('Já existe outra Unidade Curricular com este nome!') + '&tipo=error');
        }
        
        await db.collection('disciplinas').updateOne(
            { _id: new ObjectId(id) },
            { $set: { nome } }
        );
        
        res.redirect('/admin/disciplinas?msg=' + encodeURIComponent('UC atualizada com sucesso!') + '&tipo=success');
        
    } catch (error) {
        res.redirect('/admin/disciplinas?msg=' + encodeURIComponent('Erro ao atualizar UC') + '&tipo=error');
    }
});

// Eliminar disciplina
router.get('/admin/disciplinas/eliminar/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        
        // Verificar se disciplina está em uso
        const cursoComDisciplina = await db.collection('cursos').findOne({
            'disciplinas.disciplina_id': new ObjectId(id)
        });
        
        if (cursoComDisciplina) {
            return res.redirect('/admin/disciplinas?msg=' + encodeURIComponent('Não é possível eliminar: UC está em uso num plano de estudos!') + '&tipo=error');
        }
        
        await db.collection('disciplinas').deleteOne({ _id: new ObjectId(id) });
        res.redirect('/admin/disciplinas?msg=' + encodeURIComponent('UC eliminada com sucesso!') + '&tipo=success');
        
    } catch (error) {
        res.redirect('/admin/disciplinas?msg=' + encodeURIComponent('Erro ao eliminar UC') + '&tipo=error');
    }
});

function generateDisciplinasHTML(disciplinas, login, mensagem, tipoMsg) {
    const alertHTML = mensagem ? `
        <div class="alert alert-${tipoMsg === 'success' ? 'success' : 'error'}">
            ${mensagem}
        </div>
    ` : '';
    
    const rows = disciplinas.map(disc => `
        <tr>
            <td>#${disc._id.toString().slice(-6)}</td>
            <td><strong>${escapeHtml(disc.nome)}</strong></td>
            <td><span class="badge badge-admin">${disc.total_cursos} cursos</span></td>
            <td>
                <button onclick="editarDisciplina('${disc._id}', '${escapeHtml(disc.nome)}')" 
                        class="btn" style="background: #28a745; padding: 5px 10px;">
                    ✏️ Editar
                </button>
                <a href="/admin/disciplinas/eliminar/${disc._id}" 
                   class="btn" style="background: #dc3545; padding: 5px 10px;"
                   onclick="return confirm('Tem a certeza que deseja eliminar esta UC?')">
                    🗑️ Eliminar
                </a>
            </td>
        </tr>
    `).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gerir Unidades Curriculares - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                background: #f8f9fa;
                padding: 15px 30px;
                border-bottom: 1px solid #dee2e6;
            }
            
            .nav a {
                color: #667eea;
                text-decoration: none;
                padding: 8px 15px;
                margin: 0 2px;
                border-radius: 25px;
                transition: all 0.3s;
                font-weight: 500;
                white-space: nowrap;
                font-size: 0.95em;
            }
            
            .nav a:hover {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                transform: translateY(-2px);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                    <div>
                        <h1>📖 Gestão de Unidades Curriculares</h1>
                        <p style="margin-left: 20px;"><strong>Bem-vindo, ${escapeHtml(login)}</strong></p>
                    </div>
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
                <a href="/admin/planos">📋 Planos de Estudo</a>
                <a href="/admin/utilizadores">👥 Utilizadores</a>
                <a href="/admin/validar-fichas">📝 Fichas</a>
            </div>
            
            <div class="content">
                ${alertHTML}
                
                <div class="card">
                    <h2>➕ Adicionar Nova Unidade Curricular</h2>
                    <form method="POST" action="/admin/disciplinas/criar" style="display: flex; gap: 10px;">
                        <div style="flex: 1;">
                            <input type="text" name="nome" class="form-group" placeholder="Nome da Unidade Curricular" required style="width: 100%; padding: 10px;">
                        </div>
                        <button type="submit" class="btn">Criar Unidade Curricular</button>
                    </form>
                </div>
                
                <div class="card">
                    <h2>📋 Lista de Unidades Curriculares</h2>
                    
                    ${disciplinas.length > 0 ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nome da Unidade Curricular</th>
                                    <th>Cursos que a usam</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    ` : `
                        <p style="text-align: center; color: #666; padding: 40px;">
                            Nenhuma Unidade Curricular encontrada. Crie a primeira UC!
                        </p>
                    `}
                </div>
            </div>
        </div>
        
        <!-- Modal de Edição -->
        <div id="modalEditar" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
            <div style="background: white; max-width: 500px; margin: 100px auto; padding: 30px; border-radius: 15px;">
                <h3 style="margin-bottom: 20px;">✏️ Editar Unidade Curricular</h3>
                <form method="POST" action="/admin/disciplinas/editar" id="formEditar">
                    <input type="hidden" name="id" id="edit_id">
                    <div class="form-group">
                        <label>Nome da Unidade Curricular:</label>
                        <input type="text" name="nome" id="edit_nome" required style="width: 100%; padding: 10px;">
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" onclick="fecharModal()" class="btn" style="background: #6c757d;">Cancelar</button>
                        <button type="submit" class="btn">Guardar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; 2026 IPCA - Gestão de Unidades Curriculares</p>
        </div>
        
        <script>
            function editarDisciplina(id, nome) {
                document.getElementById('edit_id').value = id;
                document.getElementById('edit_nome').value = nome;
                document.getElementById('modalEditar').style.display = 'block';
            }
            
            function fecharModal() {
                document.getElementById('modalEditar').style.display = 'none';
            }
            
            window.onclick = function(event) {
                var modal = document.getElementById('modalEditar');
                if (event.target == modal) {
                    modal.style.display = 'none';
                }
            }
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

module.exports = router;