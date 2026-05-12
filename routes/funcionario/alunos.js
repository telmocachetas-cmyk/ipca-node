const express = require('express');
const { getDB } = require('../../db');
const { isAuthenticated, isFuncionario } = require('../../middleware/auth');
const router = express.Router();

router.get('/funcionario/alunos', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        
        const alunos = await db.collection('users')
            .find({ grupo: 'ALUNO' })
            .sort({ login: 1 })
            .toArray();
        
        for (let aluno of alunos) {
            const ficha = await db.collection('fichas_aluno').findOne({ aluno_login: aluno.login });
            aluno.estado_ficha = ficha ? ficha.estado : 'sem_ficha';
            aluno.foto_path = ficha?.foto_path;
            aluno.nome_completo = ficha?.nome_completo || aluno.login;
        }
        
        const total_alunos = alunos.length;
        const com_ficha = alunos.filter(a => a.estado_ficha !== 'sem_ficha').length;
        const matriculados = await db.collection('pedidos_matricula').countDocuments({ estado: 'aprovado' });
        
        res.send(generateAlunosHTML(alunos, total_alunos, com_ficha, matriculados, req.session.login));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar alunos');
    }
});

function generateAlunosHTML(alunos, total, comFicha, matriculados, login) {
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Alunos - Funcionário</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
            .stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-bottom:30px; }
            .stat-card { background:white; border-radius:15px; padding:20px; text-align:center; box-shadow:0 2px 10px rgba(0,0,0,0.1); }
            .stat-number { font-size:2em; font-weight:bold; color:#667eea; }
            .aluno-avatar { width:40px; height:40px; border-radius:50%; object-fit:cover; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div><h1>👥 Alunos Registados</h1><p>Bem-vindo, ${login}</p></div>
                <div class="menu-perfil"><span class="profile-badge" style="background:#17a2b8">FUNCIONÁRIO</span></div>
            </div>
            <div class="nav">
                <a href="/funcionario/dashboard">📊 Dashboard</a>
                <a href="/funcionario/criar-pauta">📝 Criar Pauta</a>
                <a href="/funcionario/pautas">📊 Ver Pautas</a>
                <a href="/funcionario/pedidos">📋 Pedidos</a>
            </div>
            <div class="content">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-number">${total}</div><div>Total Alunos</div></div>
                    <div class="stat-card"><div class="stat-number">${comFicha}</div><div>Com Ficha</div></div>
                    <div class="stat-card"><div class="stat-number">${matriculados}</div><div>Matriculados</div></div>
                </div>
                <div class="card">
                    <h2>Lista de Alunos</h2>
                    <table class="table">
                        <thead><tr><th>Aluno</th><th>Nome</th><th>Ficha</th><th>Foto</th></tr></thead>
                        <tbody>
                            ${alunos.map(a => `
                                <tr>
                                    <td><strong>${a.login}</strong></td>
                                    <td>${a.nome_completo}</td>
                                    <td><span class="badge ${a.estado_ficha === 'aprovada' ? 'badge-aluno' : 'badge-admin'}">${a.estado_ficha}</span></td>
                                    <td>${a.foto_path ? `<img src="/${a.foto_path}" class="aluno-avatar">` : '📷'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

module.exports = router;