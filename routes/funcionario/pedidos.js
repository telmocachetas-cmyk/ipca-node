const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isFuncionario } = require('../../middleware/auth');
const router = express.Router();

// Listar pedidos pendentes
router.get('/funcionario/pedidos', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        
        const pedidos = await db.collection('pedidos_matricula')
            .find({ estado: 'pendente' })
            .sort({ data_pedido: 1 })
            .toArray();
        
        for (let pedido of pedidos) {
            const curso = await db.collection('cursos').findOne({ _id: pedido.curso_id });
            pedido.curso_nome = curso ? curso.nome : 'Desconhecido';
            
            const aluno = await db.collection('users').findOne({ login: pedido.aluno_login });
            pedido.nome_completo = aluno?.nome_completo || pedido.aluno_login;
            
            const ficha = await db.collection('fichas_aluno').findOne({ 
                aluno_login: pedido.aluno_login,
                estado: 'aprovada'
            });
            pedido.tem_ficha_aprovada = !!ficha;
        }
        
        res.send(generatePedidosHTML(pedidos, req.session.login));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar pedidos');
    }
});

// Aprovar pedido
router.post('/funcionario/pedidos/aprovar', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const { pedido_id } = req.body;
        
        await db.collection('pedidos_matricula').updateOne(
            { _id: new ObjectId(pedido_id) },
            { 
                $set: { 
                    estado: 'aprovado',
                    data_decisao: new Date(),
                    funcionario_id: req.session.user_id,
                    funcionario_login: req.session.login
                }
            }
        );
        
        res.redirect('/funcionario/pedidos?msg=' + encodeURIComponent('Pedido aprovado!'));
        
    } catch (error) {
        res.redirect('/funcionario/pedidos?msg=' + encodeURIComponent('Erro ao aprovar'));
    }
});

// Rejeitar pedido
router.post('/funcionario/pedidos/rejeitar', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const { pedido_id, observacoes } = req.body;
        
        await db.collection('pedidos_matricula').updateOne(
            { _id: new ObjectId(pedido_id) },
            { 
                $set: { 
                    estado: 'rejeitado',
                    data_decisao: new Date(),
                    funcionario_id: req.session.user_id,
                    funcionario_login: req.session.login,
                    observacoes: observacoes || 'Pedido rejeitado'
                }
            }
        );
        
        res.redirect('/funcionario/pedidos?msg=' + encodeURIComponent('Pedido rejeitado!'));
        
    } catch (error) {
        res.redirect('/funcionario/pedidos?msg=' + encodeURIComponent('Erro ao rejeitar'));
    }
});

function generatePedidosHTML(pedidos, login) {
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Pedidos de Matrícula - Funcionário</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
            .pedido-card { border:1px solid #e0e0e0; border-radius:10px; padding:20px; margin-bottom:20px; }
            .btn-aprovar { background:#28a745; color:white; border:none; padding:8px 20px; border-radius:5px; cursor:pointer; }
            .btn-rejeitar { background:#dc3545; color:white; border:none; padding:8px 20px; border-radius:5px; cursor:pointer; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between">
                    <div><h1>📋 Pedidos de Matrícula</h1><p>Bem-vindo, ${login}</p></div>
                    <div class="menu-perfil"><span class="profile-badge" style="background:#17a2b8">FUNCIONÁRIO</span></div>
                </div>
            </div>
            <div class="nav">
                <a href="/funcionario/dashboard">📊 Dashboard</a>
                <a href="/funcionario/criar-pauta">📝 Criar Pauta</a>
                <a href="/funcionario/pautas">📊 Ver Pautas</a>
                <a href="/funcionario/alunos">👥 Alunos</a>
            </div>
            <div class="content">
                <h2>Pedidos Pendentes (${pedidos.length})</h2>
                ${pedidos.length === 0 ? '<p>Nenhum pedido pendente.</p>' : pedidos.map(p => `
                    <div class="pedido-card">
                        <h3>${p.aluno_login} - ${p.nome_completo}</h3>
                        <p><strong>Curso:</strong> ${p.curso_nome}</p>
                        <p><strong>Data pedido:</strong> ${new Date(p.data_pedido).toLocaleString('pt-PT')}</p>
                        <form method="POST" action="/funcionario/pedidos/aprovar" style="display:inline">
                            <input type="hidden" name="pedido_id" value="${p._id}">
                            <button type="submit" class="btn-aprovar">✅ Aprovar</button>
                        </form>
                        <form method="POST" action="/funcionario/pedidos/rejeitar" style="display:inline" onsubmit="return confirm('Tem certeza?')">
                            <input type="hidden" name="pedido_id" value="${p._id}">
                            <input type="text" name="observacoes" placeholder="Motivo da rejeição" required>
                            <button type="submit" class="btn-rejeitar">❌ Rejeitar</button>
                        </form>
                    </div>
                `).join('')}
            </div>
        </div>
    </body>
    </html>`;
}

module.exports = router;