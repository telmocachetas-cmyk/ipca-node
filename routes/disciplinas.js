const express = require('express');
const { getDB } = require('../db');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Listar disciplinas (página pública para todos os utilizadores autenticados)
router.get('/disciplinas', isAuthenticated, async (req, res) => {
    try {
        const db = getDB();
        
        // Buscar todas as disciplinas
        const disciplinas = await db.collection('disciplinas')
            .find({})
            .sort({ nome: 1 })
            .toArray();
        
        // Para cada disciplina, contar em quantos cursos é usada
        for (let disc of disciplinas) {
            const cursos = await db.collection('cursos')
                .find({ 'disciplinas.disciplina_id': disc._id })
                .toArray();
            disc.total_cursos = cursos.length;
        }
        
        // Total de cursos válidos
        const total_cursos = await db.collection('cursos').countDocuments();
        
        res.send(generateListarDisciplinasHTML(disciplinas, total_cursos, req.session));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar disciplinas');
    }
});

function generateListarDisciplinasHTML(disciplinas, totalCursos, session) {
    const isAdmin = session.grupo === 'ADMIN';
    
    const rows = disciplinas.map(disc => `
        <tr>
            <td>#${disc._id.toString().slice(-6)}</td>
            <td><strong>${escapeHtml(disc.nome)}</strong></td>
            <td><span class="badge ${isAdmin ? 'badge-admin' : 'badge'}">${disc.total_cursos} cursos</span></td>
            ${isAdmin ? `
            <td>
                <a href="/admin/disciplinas/editar/${disc._id}" 
                   class="btn" style="background: #28a745; padding: 5px 10px;">✏️ Editar</a>
                <a href="/admin/disciplinas/eliminar/${disc._id}" 
                   class="btn" style="background: #dc3545; padding: 5px 10px;"
                   onclick="return confirm('Tem a certeza?')">🗑️ Eliminar</a>
            </td>
            ` : ''}
        </tr>
    `).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Unidades Curriculares - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display: flex; gap: 15px; background: #f8f9fa; padding: 15px 30px; border-bottom: 1px solid #dee2e6; }
            .nav a { color: #667eea; text-decoration: none; padding: 8px 15px; border-radius: 25px; transition: all 0.3s; }
            .nav a:hover { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; transform: translateY(-2px); }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1>📖 Unidades Curriculares</h1>
                        <p>${escapeHtml(session.login)} (${session.grupo})</p>
                    </div>
                    <div class="menu-perfil">
                        <span class="profile-badge profile-${session.grupo === 'ADMIN' ? 'admin' : (session.grupo === 'ALUNO' ? 'aluno' : '')}">
                            ${session.grupo}
                        </span>
                        <div class="menu-perfil-content">
                            <a href="/">🏠 Início</a>
                            <a href="/perfil">👤 Meu Perfil</a>
                            <a href="/logout">🚪 Logout</a>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="nav">
                <a href="/">🏠 Início</a>
                <a href="/cursos">📚 Cursos</a>
            </div>
            
            <div class="content">
                <div class="card">
                    <h2>Lista de Unidades Curriculares</h2>
                    
                    ${isAdmin ? `
                    <div style="margin-bottom: 20px;">
                        <a href="/admin/disciplinas" class="btn">➕ Nova Unidade Curricular</a>
                    </div>
                    ` : ''}
                    
                    ${disciplinas.length > 0 ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nome da Unidade Curricular</th>
                                    <th>Cursos que a usam</th>
                                    ${isAdmin ? '<th>Ações</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                    ` : `
                        <p style="text-align: center; color: #666; padding: 40px;">
                            Nenhuma unidade curricular encontrada.
                            ${isAdmin ? '<br><br><a href="/admin/disciplinas" class="btn">Criar primeira unidade curricular</a>' : ''}
                        </p>
                    `}
                </div>
                
                <!-- Estatísticas rápidas -->
                <div class="card">
                    <h2>📊 Estatísticas</h2>
                    <div style="display: flex; gap: 20px; justify-content: space-around;">
                        <div style="text-align: center;">
                            <div style="font-size: 2em; color: #667eea;">${disciplinas.length}</div>
                            <div>Total de Unidades Curriculares</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 2em; color: #667eea;">${totalCursos}</div>
                            <div>Total de Cursos</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="footer">
                <p>&copy; 2026 IPCA - Lista de Unidades Curriculares</p>
            </div>
        </div>
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