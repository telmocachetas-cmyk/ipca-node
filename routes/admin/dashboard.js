const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router = express.Router();

router.get('/admin/dashboard', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        
        // Estatísticas para admin
        const total_cursos = await db.collection('cursos').countDocuments();
        const total_disciplinas = await db.collection('disciplinas').countDocuments();
        const total_utilizadores = await db.collection('users').countDocuments();
        const total_alunos = await db.collection('users').countDocuments({ grupo: 'ALUNO' });
        const total_planos = await db.collection('cursos').aggregate([
            { $project: { total_disciplinas: { $size: { $ifNull: ["$disciplinas", []] } } } },
            { $group: { _id: null, total: { $sum: "$total_disciplinas" } } }
        ]).toArray();
        const total_planos_count = total_planos[0]?.total || 0;
        
        // Fichas pendentes
        const fichas_pendentes = await db.collection('fichas_aluno').countDocuments({ estado: 'submetida' });
        
        // Últimos utilizadores registados
        const ultimos_users = await db.collection('users')
            .find({})
            .sort({ data_registo: -1 })
            .limit(5)
            .toArray();
        
        // Últimas fichas submetidas
        const ultimas_fichas = await db.collection('fichas_aluno')
            .find({ estado: 'submetida' })
            .sort({ data_submissao: -1 })
            .limit(5)
            .toArray();
        
        // Buscar nomes dos cursos para as fichas
        for (let ficha of ultimas_fichas) {
            const curso = await db.collection('cursos').findOne({ _id: ficha.curso_id });
            ficha.curso_nome = curso ? curso.nome : '-';
        }
        
        res.send(generateDashboardHTML({
            req,
            total_cursos,
            total_disciplinas,
            total_utilizadores,
            total_alunos,
            total_planos: total_planos_count,
            fichas_pendentes,
            ultimos_users,
            ultimas_fichas
        }));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar dashboard');
    }
});

function generateDashboardHTML(data) {
    const { req, total_cursos, total_disciplinas, total_utilizadores, total_planos, fichas_pendentes, ultimos_users, ultimas_fichas } = data;
    
    // Gerar tabela de últimos utilizadores
    const ultimosUsersHTML = ultimos_users.map(user => {
        const grupoClass = user.grupo === 'ADMIN' ? 'badge-admin' : (user.grupo === 'FUNCIONARIO' ? 'badge' : 'badge-aluno');
        const grupoStyle = user.grupo === 'FUNCIONARIO' ? 'background:#17a2b8' : '';
        return `
            <tr>
                <td style="padding: 8px 0;">${escapeHtml(user.login)}</td>
                <td style="padding: 8px 0; text-align: right;">
                    <span class="badge ${grupoClass}" style="${grupoStyle}">${user.grupo}</span>
                </td>
            </tr>
        `;
    }).join('');
    
    // Gerar tabela de últimas fichas
    const ultimasFichasHTML = ultimas_fichas.map(ficha => {
        const dataSubmissao = ficha.data_submissao ? new Date(ficha.data_submissao).toLocaleString('pt-PT') : '-';
        return `
            <tr>
                <td>${dataSubmissao}</td>
                <td>${escapeHtml(ficha.aluno_login) || '-'}</td>
                <td>${escapeHtml(ficha.curso_nome) || '-'}</td>
                <td><a href="/admin/validar-fichas" class="btn" style="padding: 5px 10px;">Validar</a></td>
            </tr>
        `;
    }).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard - IPCA</title>
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
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .info-card {
                background: white;
                border-radius: 15px;
                padding: 25px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                text-align: center;
                transition: transform 0.3s;
                border: 1px solid #f0f0f0;
            }
            
            .info-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
            }
            
            .info-card-icon {
                font-size: 2.5em;
                margin-bottom: 15px;
                color: #667eea;
            }
            
            .info-card-title {
                font-size: 1.1em;
                color: #666;
                margin-bottom: 10px;
            }
            
            .info-card-value {
                font-size: 2em;
                font-weight: bold;
                color: #333;
            }
            
            .btn-small {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                padding: 5px 15px;
                border-radius: 20px;
                margin-top: 10px;
                font-size: 0.9em;
                transition: all 0.3s;
            }
            
            .btn-small:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                    <div>
                        <h1>⚙️ Painel de Administração</h1>
                        <p>Bem-vindo, <strong>${escapeHtml(req.session.login)}</strong></p>
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
                <a href="/admin/cursos">📚 Cursos</a>
                <a href="/admin/disciplinas">📖 Unidades Curriculares</a>
                <a href="/admin/planos">📋 Planos de Estudo</a>
                <a href="/admin/utilizadores">👥 Utilizadores</a>
                <a href="/admin/validar-fichas">📝 Fichas</a>
            </div>
            
            <div class="content">
                <div class="stats-grid">
                    <div class="info-card">
                        <div class="info-card-icon">📚</div>
                        <div class="info-card-title">Cursos</div>
                        <div class="info-card-value">${total_cursos}</div>
                        <a href="/admin/cursos" class="btn-small">Gerir</a>
                    </div>
                    
                    <div class="info-card">
                        <div class="info-card-icon">📖</div>
                        <div class="info-card-title">UCs</div>
                        <div class="info-card-value">${total_disciplinas}</div>
                        <a href="/admin/disciplinas" class="btn-small">Gerir</a>
                    </div>
                    
                    <div class="info-card">
                        <div class="info-card-icon">👥</div>
                        <div class="info-card-title">Utilizadores</div>
                        <div class="info-card-value">${total_utilizadores}</div>
                        <a href="/admin/utilizadores" class="btn-small">Gerir</a>
                    </div>
                    
                    <div class="info-card">
                        <div class="info-card-icon">📋</div>
                        <div class="info-card-title">Planos Ativos</div>
                        <div class="info-card-value">${total_planos}</div>
                        <a href="/admin/planos" class="btn-small">Gerir</a>
                    </div>

                    <div class="info-card">
                        <div class="info-card-icon">📝</div>
                        <div class="info-card-title">Fichas Pendentes</div>
                        <div class="info-card-value">${fichas_pendentes}</div>
                        <a href="/admin/validar-fichas" class="btn-small">Gerir</a>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                    <div class="card">
                        <h2>⚡ Ações Rápidas</h2>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                            <a href="/admin/cursos?acao=criar" style="text-decoration: none;">
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; transition: all 0.3s;">
                                    <div style="font-size: 2em; margin-bottom: 10px;">➕</div>
                                    <div style="color: #333;">Novo Curso</div>
                                </div>
                            </a>
                            
                            <a href="/admin/disciplinas?acao=criar" style="text-decoration: none;">
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; transition: all 0.3s;">
                                    <div style="font-size: 2em; margin-bottom: 10px;">📖</div>
                                    <div style="color: #333;">Nova UC</div>
                                </div>
                            </a>
                            
                            <a href="/admin/planos" style="text-decoration: none;">
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; transition: all 0.3s;">
                                    <div style="font-size: 2em; margin-bottom: 10px;">📋</div>
                                    <div style="color: #333;">Criar Plano</div>
                                </div>
                            </a>

                            <a href="/admin/validar-fichas" style="text-decoration: none;">
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; transition: all 0.3s;">
                                    <div style="font-size: 2em; margin-bottom: 10px;">✅</div>
                                    <div style="color: #333;">Validar Fichas</div>
                                    ${fichas_pendentes > 0 ? `<span style="background: #ffc107; color: #000; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; margin-left: 5px;">${fichas_pendentes}</span>` : ''}
                                </div>
                            </a>
                            
                            <a href="/admin/utilizadores" style="text-decoration: none;">
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; transition: all 0.3s;">
                                    <div style="font-size: 2em; margin-bottom: 10px;">👥</div>
                                    <div style="color: #333;">Novo Utilizador</div>
                                </div>
                            </a>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h2>👥 Últimos Utilizadores</h2>
                        <table style="width: 100%;">
                            ${ultimosUsersHTML || '<tr><td colspan="2" style="text-align: center; padding: 20px; color: #666;">Nenhum utilizador encontrado.</td></tr>'}
                        </table>
                    </div>
                </div>

                ${ultimas_fichas.length > 0 ? `
                <div class="card" style="margin-top: 20px;">
                    <h2>📝 Últimas Fichas Submetidas</h2>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Aluno</th>
                                <th>Curso</th>
                                <th>Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ultimasFichasHTML}
                        </tbody>
                    </table>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; 2026 IPCA - Área Administrativa</p>
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