const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAluno } = require('../../middleware/auth');
const router = express.Router();

router.get('/aluno/dashboard', isAuthenticated, isAluno, async (req, res) => {
    try {
        const db = getDB();
        const login = req.session.login;
        
        // Buscar informações do aluno e ficha
        const aluno = await db.collection('users').findOne({ login });
        const ficha = await db.collection('fichas_aluno').findOne({ aluno_login: login });
        
        // Buscar matrícula aprovada
        let curso = null;
        let total_disciplinas = 0;
        let disciplinas = [];
        
        const matricula = await db.collection('pedidos_matricula').findOne({
            aluno_login: login,
            estado: 'aprovado'
        });
        
        if (matricula) {
            curso = await db.collection('cursos').findOne({ _id: matricula.curso_id });
            
            if (curso && curso.disciplinas) {
                // Buscar detalhes das disciplinas
                const disciplinasIds = curso.disciplinas.map(d => d.disciplina_id);
                disciplinas = await db.collection('disciplinas').find({
                    _id: { $in: disciplinasIds }
                }).toArray();
                
                // Adicionar semestre de cada disciplina
                for (let disc of disciplinas) {
                    const planoItem = curso.disciplinas.find(d => 
                        d.disciplina_id.toString() === disc._id.toString()
                    );
                    disc.semestre = planoItem ? planoItem.semestre : 1;
                }
                
                total_disciplinas = disciplinas.length;
            }
        }
        
        // Verificar estado da matrícula
        const pedidoPendente = await db.collection('pedidos_matricula').findOne({
            aluno_login: login,
            estado: 'pendente'
        });
        
        const matricula_aprovada = !!matricula;
        const pedido_pendente = !!pedidoPendente;
        const estado_matricula = matricula_aprovada ? 'aprovada' : (pedido_pendente ? 'pendente' : 'sem_matricula');
        
        // Separar disciplinas por semestre
        const disciplinasSemestre1 = disciplinas.filter(d => d.semestre === 1);
        const disciplinasSemestre2 = disciplinas.filter(d => d.semestre === 2);
        
        res.send(generateAlunoDashboardHTML({
            login: req.session.login,
            curso: curso,
            total_disciplinas,
            disciplinasSemestre1,
            disciplinasSemestre2,
            estado_matricula,
            matricula_aprovada,
            pedido_pendente,
            ficha
        }));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar dashboard');
    }
});

function generateAlunoDashboardHTML(data) {
    const disciplinasGrid = (disciplinas) => {
        if (!disciplinas.length) return '<p style="text-align:center;color:#666;padding:40px">Nenhuma disciplina encontrada</p>';
        
        return `<div class="disciplinas-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px;margin-top:20px">
            ${disciplinas.map(disc => `
                <div class="disciplina-card" style="background:white;border-radius:10px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.1);border-left:4px solid #667eea">
                    <h4 style="margin:0 0 10px 0">${disc.nome}</h4>
                    <p style="margin:5px 0;color:#666"><strong>Código:</strong> DISC${disc._id.toString().slice(-3)}</p>
                    <p style="margin:5px 0;color:#666"><strong>Estado:</strong> 
                        <span class="estado-disciplina estado-em-curso" style="display:inline-block;padding:4px 12px;border-radius:20px;background:#28a745;color:white">Em curso</span>
                    </p>
                    <div style="margin-top:15px"><span style="background:#e9ecef;padding:5px 10px;border-radius:15px;font-size:0.8em">48h</span></div>
                </div>
            `).join('')}
        </div>`;
    };
    
    const getEstadoFichaBadge = () => {
        if (!data.ficha) return '<span class="badge" style="background:#6c757d">Não preenchida</span>';
        const estados = {
            'rascunho': '<span class="badge badge-admin">Rascunho</span>',
            'submetida': '<span class="badge" style="background:#17a2b8">Submetida</span>',
            'aprovada': '<span class="badge badge-aluno">Aprovada</span>',
            'rejeitada': '<span class="badge" style="background:#dc3545">Rejeitada</span>'
        };
        return estados[data.ficha.estado] || '<span class="badge">Desconhecido</span>';
    };
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Painel do Aluno - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; flex-wrap:wrap; gap:5px; background:#f8f9fa; padding:15px 30px; border-bottom:1px solid #dee2e6; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; transition:all 0.3s; font-weight:500; }
            .nav a:hover { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; transform:translateY(-2px); }
            .info-card { background:white; border-radius:15px; padding:25px; box-shadow:0 5px 15px rgba(0,0,0,0.1); text-align:center; transition:transform 0.3s; }
            .info-card:hover { transform:translateY(-5px); }
            .info-card-value { font-size:2em; font-weight:bold; color:#667eea; }
            .status-matricula { display:inline-block; padding:8px 20px; border-radius:25px; font-weight:600; }
            .status-ativa { background:#28a745; color:white; }
            .status-pendente { background:#ffc107; color:#333; }
            .status-sem-matricula { background:#6c757d; color:white; }
            .cards-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-top:20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div><h1>🎓 Área do Aluno</h1><p>Bem-vindo, <strong>${data.login}</strong></p></div>
                    <div class="menu-perfil">
                        <span class="profile-badge profile-aluno">ALUNO</span>
                        <div class="menu-perfil-content">
                            <a href="/">🏠 Site Principal</a>
                            <a href="/aluno/perfil">👤 Meu Perfil</a>
                            <a href="/logout">🚪 Logout</a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="nav">
                <a href="/aluno/matricula">🎓 Matrícula</a>
                <a href="/aluno/plano-estudos">📚 Plano de Estudos</a>
                <a href="/aluno/ficha">📝 Ficha Pessoal</a>
                <a href="/aluno/pedidos">📋 Pedidos</a>
            </div>
            <div class="content">
                <div class="cards-grid">
                    <div class="info-card"><div class="info-card-value">${data.curso ? data.curso.nome : 'Não atribuído'}</div><div>Curso</div>
                        <div style="margin-top:15px"><span class="status-matricula ${data.estado_matricula === 'aprovada' ? 'status-ativa' : (data.estado_matricula === 'pendente' ? 'status-pendente' : 'status-sem-matricula')}">
                            ${data.estado_matricula === 'aprovada' ? '✓ Matrícula Ativa' : (data.estado_matricula === 'pendente' ? '⏳ Pedido Pendente' : '⚠️ Sem Matrícula')}
                        </span></div>
                    </div>
                    <div class="info-card"><div class="info-card-value">${data.total_disciplinas}</div><div>Disciplinas Inscritas</div>
                        <div style="margin-top:15px"><a href="/aluno/plano-estudos" style="color:#667eea">Ver todas →</a></div>
                    </div>
                    <div class="info-card"><div class="info-card-value">2025/2026</div><div>Ano Letivo</div>
                        <div style="margin-top:15px"><span>1º Semestre</span></div>
                    </div>
                </div>
                
                <div class="card">
                    <h2>📝 Estado da Ficha de Aluno</h2>
                    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
                        ${data.ficha ? `
                            <div style="display:flex;align-items:center;gap:15px">
                                ${data.ficha.foto_path ? `<img src="/${data.ficha.foto_path}" style="width:80px;height:100px;border-radius:10px;object-fit:cover;border:2px solid #667eea">` : 
                                    `<div style="width:80px;height:100px;background:#f0f0f0;border-radius:10px;display:flex;align-items:center;justify-content:center;border:2px dashed #667eea"><span style="color:#999">Sem foto</span></div>`}
                                <div><p><strong>Estado:</strong> ${getEstadoFichaBadge()}</p>
                                ${data.ficha.observacoes ? `<p><strong>Observações:</strong> ${data.ficha.observacoes}</p>` : ''}</div>
                            </div>
                        ` : `<p style="color:#666">Ainda não preencheu a ficha de aluno. <a href="/aluno/ficha">Preencher agora</a></p>`}
                    </div>
                </div>
                
                <div class="card">
                    <h2>📖 Minhas Disciplinas</h2>
                    ${data.curso && data.total_disciplinas > 0 ? disciplinasGrid(data.disciplinasSemestre1) : 
                        `<p style="text-align:center;color:#666;padding:40px">Nenhuma disciplina encontrada para o seu curso.</p>`}
                </div>
                
                <div class="card">
                    <h2>⚡ Ações Rápidas</h2>
                    <div style="display:flex;gap:15px;flex-wrap:wrap">
                        ${(!data.ficha || data.ficha.estado === 'rascunho' || data.ficha.estado === 'rejeitada') ? 
                            `<a href="/aluno/ficha" class="btn">📝 Preencher Ficha</a>` : ''}
                        ${(data.ficha && data.ficha.estado === 'aprovada' && data.estado_matricula !== 'aprovada' && data.estado_matricula !== 'pendente') ? 
                            `<a href="/aluno/pedir-matricula" class="btn" style="background:#28a745">🎓 Pedir Matrícula</a>` : ''}
                        ${data.estado_matricula === 'pendente' ? 
                            `<a href="/aluno/pedidos" class="btn">📋 Ver Pedidos</a>` : ''}
                        ${data.matricula_aprovada ? 
                            `<a href="/aluno/plano-estudos" class="btn">📚 Aceder às Disciplinas</a>` : 
                            `<a href="/aluno/plano-estudos" class="btn">📚 Ver Plano de Estudos</a>`}
                    </div>
                </div>
            </div>
            <div class="footer"><p>&copy; 2026 IPCA - Área do Aluno</p></div>
        </div>
    </body>
    </html>`;
}

module.exports = router;