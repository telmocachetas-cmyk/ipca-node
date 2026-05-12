const express = require('express');
const { getDB } = require('../../db');
const { isAuthenticated, isAluno } = require('../../middleware/auth');
const router = express.Router();

router.get('/aluno/pedidos', isAuthenticated, isAluno, async (req, res) => {
    try {
        const db = getDB();
        const login = req.session.login;
        
        const pedidos = await db.collection('pedidos_matricula')
            .find({ aluno_login: login })
            .sort({ data_pedido: -1 })
            .toArray();
        
        for (let p of pedidos) {
            const curso = await db.collection('cursos').findOne({ _id: p.curso_id });
            p.curso_nome = curso ? curso.nome : 'Desconhecido';
        }
        
        const fichas = await db.collection('fichas_aluno')
            .find({ aluno_login: login })
            .sort({ data_submissao: -1 })
            .toArray();
        
        res.send(generatePedidosHTML(pedidos, fichas, login));
        
    } catch (error) {
        res.status(500).send('Erro ao carregar pedidos');
    }
});

function generatePedidosHTML(pedidos, fichas, login) {
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Meus Pedidos</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
            .timeline { position:relative; padding-left:30px; }
            .timeline-item { position:relative; padding-bottom:30px; }
            .timeline-item:before { content:''; position:absolute; left:-20px; top:5px; width:12px; height:12px; border-radius:50%; background:#667eea; }
            .timeline-item:after { content:''; position:absolute; left:-15px; top:20px; width:2px; height:calc(100% - 15px); background:#e0e0e0; }
            .timeline-item:last-child:after { display:none; }
            .estado-concluido:before { background:#28a745; }
            .estado-pendente:before { background:#ffc107; }
            .estado-rejeitado:before { background:#dc3545; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div><h1>📋 Meus Pedidos</h1><p><strong>${login}</strong></p></div>
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
                <a href="/aluno/dashboard">📊 Dashboard</a>
                <a href="/aluno/matricula">🎓 Matrícula</a>
                <a href="/aluno/plano-estudos">📚 Plano de Estudos</a>
                <a href="/aluno/ficha">📝 Ficha Pessoal</a>
            </div>
            <div class="content">
                <div class="card">
                    <h2>📋 Estado da Ficha de Aluno</h2>
                    ${fichas.length > 0 ? fichas.map(f => `
                        <div style="background:#f8f9fa;padding:20px;border-radius:10px;margin-bottom:20px">
                            <div style="display:flex;justify-content:space-between;align-items:center">
                                <div><p><strong>Data submissão:</strong> ${f.data_submissao ? new Date(f.data_submissao).toLocaleString('pt-PT') : 'Não submetida'}</p>
                                <p><strong>Observações:</strong> ${f.observacoes || '-'}</p></div>
                                <div>${f.estado === 'rascunho' ? '<span class="badge badge-admin">Rascunho</span>' : 
                                    (f.estado === 'submetida' ? '<span class="badge" style="background:#17a2b8">Submetida</span>' :
                                    (f.estado === 'aprovada' ? '<span class="badge badge-aluno">Aprovada</span>' :
                                    '<span class="badge" style="background:#dc3545">Rejeitada</span>'))}</div>
                            </div>
                            ${f.data_decisao ? `<p style="margin-top:10px;color:#666"><small>Decisão em: ${new Date(f.data_decisao).toLocaleString('pt-PT')}</small></p>` : ''}
                        </div>
                    `).join('') : '<p style="text-align:center;padding:30px">Ainda não preencheu a ficha de aluno. <a href="/aluno/ficha">Preencher agora</a></p>'}
                </div>
                
                <div class="card">
                    <h2>📋 Pedidos de Matrícula</h2>
                    ${pedidos.length > 0 ? `
                        <div class="timeline">
                            ${pedidos.map(p => {
                                const estadoClass = p.estado === 'aprovado' ? 'estado-concluido' : (p.estado === 'pendente' ? 'estado-pendente' : 'estado-rejeitado');
                                return `<div class="timeline-item ${estadoClass}">
                                    <div style="display:flex;justify-content:space-between;align-items:center">
                                        <div><h3>${p.curso_nome}</h3>
                                        <p><strong>Data pedido:</strong> ${new Date(p.data_pedido).toLocaleString('pt-PT')}</p>
                                        ${p.observacoes ? `<p><strong>Observações:</strong> ${p.observacoes}</p>` : ''}</div>
                                        <div>${p.estado === 'pendente' ? '<span class="badge badge-admin">Pendente</span>' : 
                                            (p.estado === 'aprovado' ? '<span class="badge badge-aluno">Aprovado</span>' :
                                            '<span class="badge" style="background:#dc3545">Rejeitado</span>')}</div>
                                    </div>
                                    ${p.data_decisao ? `<p style="margin-top:10px;color:#666"><small>Decisão em: ${new Date(p.data_decisao).toLocaleString('pt-PT')}</small></p>` : ''}
                                </div>`;
                            }).join('')}
                        </div>
                    ` : '<p style="text-align:center;padding:30px">Nenhum pedido de matrícula encontrado. <a href="/aluno/pedir-matricula">Pedir matrícula</a></p>'}
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

module.exports = router;