const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router = express.Router();

// Listar fichas pendentes
router.get('/admin/validar-fichas', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        
        // Estatísticas
        const [pendentes, aprovadas, rejeitadas] = await Promise.all([
            db.collection('fichas_aluno').countDocuments({ estado: 'submetida' }),
            db.collection('fichas_aluno').countDocuments({ estado: 'aprovada' }),
            db.collection('fichas_aluno').countDocuments({ estado: 'rejeitada' })
        ]);
        
        // Fichas pendentes
        const fichasPendentes = await db.collection('fichas_aluno')
            .find({ estado: 'submetida' })
            .sort({ data_submissao: 1 })
            .toArray();
        
        for (let ficha of fichasPendentes) {
            const curso = await db.collection('cursos').findOne({ _id: ficha.curso_id });
            ficha.curso_nome = curso ? curso.nome : 'Desconhecido';
        }
        
        // Histórico
        const historico = await db.collection('fichas_aluno')
            .find({ estado: { $in: ['aprovada', 'rejeitada'] } })
            .sort({ data_decisao: -1 })
            .limit(20)
            .toArray();
        
        for (let ficha of historico) {
            const curso = await db.collection('cursos').findOne({ _id: ficha.curso_id });
            ficha.curso_nome = curso ? curso.nome : 'Desconhecido';
        }
        
        res.send(generateFichasHTML(fichasPendentes, historico, { pendentes, aprovadas, rejeitadas }, req.session.login));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar fichas');
    }
});

// Aprovar ficha
router.post('/admin/fichas/aprovar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { ficha_id, observacoes } = req.body;
        
        await db.collection('fichas_aluno').updateOne(
            { _id: new ObjectId(ficha_id) },
            { 
                $set: { 
                    estado: 'aprovada',
                    observacoes: observacoes || '',
                    data_decisao: new Date(),
                    gestor_id: req.session.user_id,
                    gestor_login: req.session.login
                }
            }
        );
        
        sendAlert(res, 'Ficha aprovada com sucesso!', '/admin/validar-fichas');
        
    } catch (error) {
        sendAlert(res, 'Erro ao aprovar ficha', '/admin/validar-fichas');
    }
});

// Rejeitar ficha
router.post('/admin/fichas/rejeitar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { ficha_id, observacoes } = req.body;
        
        await db.collection('fichas_aluno').updateOne(
            { _id: new ObjectId(ficha_id) },
            { 
                $set: { 
                    estado: 'rejeitada',
                    observacoes: observacoes || 'Ficha rejeitada',
                    data_decisao: new Date(),
                    gestor_id: req.session.user_id,
                    gestor_login: req.session.login
                }
            }
        );
        
        sendAlert(res, 'Ficha rejeitada!', '/admin/validar-fichas');
        
    } catch (error) {
        sendAlert(res, 'Erro ao rejeitar ficha', '/admin/validar-fichas');
    }
});

function generateFichasHTML(pendentes, historico, stats, login) {
    const pendentesHTML = pendentes.map(ficha => `
        <div class="ficha-pendente" style="border-left:4px solid #ffc107;margin-bottom:20px;padding:20px;background:#fff;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1)">
            <div style="display:flex;gap:20px;flex-wrap:wrap">
                <div>
                    ${ficha.foto_path ? 
                        `<img src="/${ficha.foto_path}" style="width:80px;height:100px;border-radius:10px;object-fit:cover;border:2px solid #667eea">` :
                        `<div style="width:80px;height:100px;background:#f0f0f0;border-radius:10px;display:flex;align-items:center;justify-content:center;border:2px dashed #667eea"><span>📷</span></div>`}
                </div>
                <div style="flex:1">
                    <h3>${escapeHtml(ficha.nome_completo)} (${ficha.aluno_login})</h3>
                    <p><strong>Curso pretendido:</strong> ${ficha.curso_nome}</p>
                    <p><strong>Data submissão:</strong> ${new Date(ficha.data_submissao).toLocaleString('pt-PT')}</p>
                    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px">
                        <p><strong>NIF:</strong> ${ficha.nif || '-'}</p>
                        <p><strong>Telefone:</strong> ${ficha.telefone || '-'}</p>
                        <p><strong>Email:</strong> ${ficha.email || '-'}</p>
                        <p><strong>Data nasc.:</strong> ${ficha.data_nascimento ? new Date(ficha.data_nascimento).toLocaleDateString('pt-PT') : '-'}</p>
                    </div>
                    <p><strong>Morada:</strong> ${ficha.morada || '-'}</p>
                </div>
                <div style="width:300px">
                    <form method="POST" action="/admin/fichas/aprovar" onsubmit="return confirm('Aprovar esta ficha?')">
                        <input type="hidden" name="ficha_id" value="${ficha._id}">
                        <div class="form-group"><label>Observações:</label><textarea name="observacoes" rows="2" placeholder="Motivo da aprovação/rejeição..." style="width:100%"></textarea></div>
                        <div style="display:flex;gap:10px">
                            <button type="submit" class="btn" style="background:#28a745;flex:1">✅ Aprovar</button>
                            <button type="button" onclick="rejeitarFicha('${ficha._id}')" class="btn" style="background:#dc3545;flex:1">❌ Rejeitar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `).join('');
    
    const historicoHTML = historico.map(ficha => `
        <tr>
            <td>${new Date(ficha.data_submissao).toLocaleDateString('pt-PT')}</td>
            <td>${escapeHtml(ficha.nome_completo)}</td>
            <td>${ficha.curso_nome}</td>
            <td>${ficha.estado === 'aprovada' ? '<span class="badge badge-aluno">Aprovada</span>' : '<span class="badge" style="background:#dc3545">Rejeitada</span>'}</td>
            <td>${ficha.gestor_login || '-'}</td>
            <td>${ficha.observacoes || '-'}</td>
        </tr>
    `).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Validar Fichas - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; flex-wrap:wrap; gap:5px; background:#f8f9fa; padding:15px 30px; border-bottom:1px solid #dee2e6; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; transition:all 0.3s; font-weight:500; }
            .nav a:hover { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; transform:translateY(-2px); }
            .stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-bottom:30px; }
            .stat-card { background:white; border-radius:15px; padding:20px; box-shadow:0 5px 15px rgba(0,0,0,0.1); text-align:center; }
            .stat-number { font-size:2.5em; font-weight:bold; color:#667eea; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">
                    <div><h1>✅ Validação de Fichas de Aluno</h1><p><strong>Bem-vindo, ${login}</strong></p></div>
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
                <a href="/admin/disciplinas">📖 UCs</a>
                <a href="/admin/planos">📋 Planos</a>
                <a href="/admin/utilizadores">👥 Utilizadores</a>
            </div>
            <div class="content">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-number">${stats.pendentes}</div><p>Pendentes</p></div>
                    <div class="stat-card"><div class="stat-number">${stats.aprovadas}</div><p>Aprovadas</p></div>
                    <div class="stat-card"><div class="stat-number">${stats.rejeitadas}</div><p>Rejeitadas</p></div>
                </div>
                
                <div class="card">
                    <h2>⏳ Fichas Pendentes (${stats.pendentes})</h2>
                    ${pendentesHTML || '<p style="text-align:center;padding:40px;color:#666">Nenhuma ficha pendente no momento.</p>'}
                </div>
                
                <div class="card">
                    <h2>📜 Histórico de Validações</h2>
                    ${historico.length ? `
                        <table class="table">
                            <thead><tr><th>Data</th><th>Aluno</th><th>Curso</th><th>Estado</th><th>Validado por</th><th>Observações</th></tr></thead>
                            <tbody>${historicoHTML}</tbody>
                        </table>
                    ` : '<p>Nenhuma ficha processada ainda.</p>'}
                </div>
            </div>
        </div>
        <form id="rejeitarForm" method="POST" action="/admin/fichas/rejeitar">
            <input type="hidden" name="ficha_id" id="rejeitar_ficha_id">
            <input type="hidden" name="observacoes" id="rejeitar_observacoes">
        </form>
        <script>
            function rejeitarFicha(fichaId) {
                var motivo = prompt('Motivo da rejeição:');
                if (motivo !== null) {
                    document.getElementById('rejeitar_ficha_id').value = fichaId;
                    document.getElementById('rejeitar_observacoes').value = motivo;
                    document.getElementById('rejeitarForm').submit();
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

function sendAlert(res, message, redirectUrl) {
    res.send(`<script>alert('${message}'); window.location.href='${redirectUrl}';</script>`);
}

module.exports = router;