const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isFuncionario } = require('../../middleware/auth');
const router = express.Router();

router.get('/funcionario/dashboard', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        
        // Estatísticas
        const [total_pendentes, total_pautas, total_alunos] = await Promise.all([
            db.collection('pedidos_matricula').countDocuments({ estado: 'pendente' }),
            db.collection('pautas').countDocuments(),
            db.collection('users').countDocuments({ grupo: 'ALUNO' })
        ]);
        
        // Últimos pedidos pendentes
        const ultimos_pedidos = await db.collection('pedidos_matricula')
            .find({ estado: 'pendente' })
            .sort({ data_pedido: -1 })
            .limit(5)
            .toArray();
        
        // Adicionar nome do curso a cada pedido
        for (let pedido of ultimos_pedidos) {
            const curso = await db.collection('cursos').findOne({ _id: pedido.curso_id });
            pedido.curso_nome = curso ? curso.nome : 'Desconhecido';
        }
        
        // Últimas pautas criadas
        const ultimas_pautas = await db.collection('pautas')
            .find({})
            .sort({ data_criacao: -1 })
            .limit(5)
            .toArray();
        
        // Adicionar nome da UC a cada pauta
        for (let pauta of ultimas_pautas) {
            const uc = await db.collection('disciplinas').findOne({ _id: pauta.uc_id });
            pauta.uc_nome = uc ? uc.nome : 'Desconhecido';
        }
        
        res.send(generateFuncionarioDashboardHTML({
            total_pendentes,
            total_pautas,
            total_alunos,
            ultimos_pedidos,
            ultimas_pautas,
            login: req.session.login
        }));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar dashboard');
    }
});

function generateFuncionarioDashboardHTML(data) {
    const pedidosList = data.ultimos_pedidos.map(p => `
        <tr><td style="padding:8px 0">${p.aluno_login}</td>
        <td style="padding:8px 0;text-align:right"><span class="badge badge-admin">Pendente</span></td></tr>
    `).join('');
    
    const pautasList = data.ultimas_pautas.map(p => `
        <tr>
            <td>${new Date(p.data_criacao).toLocaleDateString('pt-PT')}</td>
            <td>${p.uc_nome}</td>
            <td>${p.epoca}</td>
            <td>${p.ano_letivo}</td>
        </tr>
    `).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Dashboard - Funcionário</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; flex-wrap:wrap; gap:5px; background:#f8f9fa; padding:15px 30px; border-bottom:1px solid #dee2e6; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; transition:all 0.3s; font-weight:500; }
            .nav a:hover { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; transform:translateY(-2px); }
            .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:20px; margin-bottom:30px; }
            .info-card { background:white; border-radius:15px; padding:25px; box-shadow:0 5px 15px rgba(0,0,0,0.1); text-align:center; transition:transform 0.3s; }
            .info-card:hover { transform:translateY(-5px); }
            .info-card-value { font-size:2em; font-weight:bold; color:#667eea; }
            .btn-small { display:inline-block; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; text-decoration:none; padding:5px 15px; border-radius:20px; margin-top:10px; font-size:0.9em; }
            .quick-actions { display:grid; grid-template-columns:repeat(2,1fr); gap:15px; margin-top:20px; }
            .action-btn { display:block; padding:20px; background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; text-decoration:none; border-radius:10px; text-align:center; font-size:1.1em; transition:transform 0.3s; }
            .action-btn:hover { transform:translateY(-3px); box-shadow:0 5px 15px rgba(102,126,234,0.4); }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">
                    <div><h1>👔 Painel do Funcionário</h1><p><strong>Bem-vindo, ${data.login}</strong></p></div>
                    <div class="menu-perfil">
                        <span class="profile-badge" style="background:#17a2b8">FUNCIONÁRIO</span>
                        <div class="menu-perfil-content">
                            <a href="/">🏠 Site Principal</a>
                            <a href="/funcionario/perfil">👤 Meu Perfil</a>
                            <a href="/logout">🚪 Logout</a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="nav">
                <a href="/funcionario/criar-pauta">📝 Criar Pauta</a>
                <a href="/funcionario/pautas">📊 Ver Pautas</a>
                <a href="/funcionario/pedidos">📋 Pedidos</a>
                <a href="/funcionario/alunos">👥 Alunos</a>
            </div>
            <div class="content">
                <div class="stats-grid">
                    <div class="info-card"><div class="info-card-value">${data.total_pendentes}</div><div>Pedidos Pendentes</div><a href="/funcionario/pedidos" class="btn-small">Ver pedidos</a></div>
                    <div class="info-card"><div class="info-card-value">${data.total_pautas}</div><div>Pautas Criadas</div><a href="/funcionario/pautas" class="btn-small">Ver pautas</a></div>
                    <div class="info-card"><div class="info-card-value">${data.total_alunos}</div><div>Alunos Registados</div><a href="/funcionario/alunos" class="btn-small">Ver alunos</a></div>
                </div>
                <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
                    <div class="card"><h2>⚡ Ações Rápidas</h2>
                        <div class="quick-actions">
                            <a href="/funcionario/pedidos" class="action-btn">📋 Gerir Pedidos Pendentes</a>
                            <a href="/funcionario/criar-pauta" class="action-btn">📝 Criar Nova Pauta</a>
                            <a href="/funcionario/pautas" class="action-btn">📊 Ver Pautas Existentes</a>
                        </div>
                    </div>
                    <div class="card"><h2>⏳ Últimos Pedidos</h2>
                        ${data.ultimos_pedidos.length ? `<table style="width:100%">${pedidosList}</table><div style="text-align:center;margin-top:15px"><a href="/funcionario/pedidos" class="btn-small">Ver todos</a></div>` : '<p style="text-align:center;color:#666;padding:20px">Nenhum pedido pendente.</p>'}
                    </div>
                </div>
                ${data.ultimas_pautas.length ? `<div class="card" style="margin-top:20px"><h2>📊 Últimas Pautas Criadas</h2>
                    <table class="table"><thead><tr><th>Data</th><th>UC</th><th>Época</th><th>Ano Letivo</th></tr></thead><tbody>${pautasList}</tbody></table></div>` : ''}
            </div>
            <div class="footer"><p>&copy; 2026 IPCA - Área do Funcionário</p></div>
        </div>
    </body>
    </html>`;
}

module.exports = router;