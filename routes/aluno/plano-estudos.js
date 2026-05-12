const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAluno } = require('../../middleware/auth');
const router = express.Router();

router.get('/aluno/plano-estudos', isAuthenticated, isAluno, async (req, res) => {
    try {
        const db = getDB();
        const login = req.session.login;
        
        const ficha = await db.collection('fichas_aluno').findOne({ aluno_login: login });
        
        // Buscar matrícula aprovada
        const matricula = await db.collection('pedidos_matricula').findOne({
            aluno_login: login,
            estado: 'aprovado'
        });
        
        let curso = null;
        let disciplinasSemestre1 = [];
        let disciplinasSemestre2 = [];
        let total_disciplinas = 0;
        
        if (matricula) {
            curso = await db.collection('cursos').findOne({ _id: matricula.curso_id });
            
            if (curso && curso.disciplinas) {
                const disciplinasIds = curso.disciplinas.map(d => d.disciplina_id);
                const disciplinas = await db.collection('disciplinas').find({
                    _id: { $in: disciplinasIds }
                }).toArray();
                
                // Adicionar semestre
                for (let disc of disciplinas) {
                    const planoItem = curso.disciplinas.find(d => 
                        d.disciplina_id.toString() === disc._id.toString()
                    );
                    disc.semestre = planoItem ? planoItem.semestre : 1;
                    if (disc.semestre === 1) disciplinasSemestre1.push(disc);
                    else disciplinasSemestre2.push(disc);
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
        
        res.send(generatePlanoEstudosHTML({
            login,
            curso,
            total_disciplinas,
            disciplinasSemestre1,
            disciplinasSemestre2,
            matricula_aprovada,
            pedido_pendente,
            ficha
        }));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar plano de estudos');
    }
});

function generatePlanoEstudosHTML(data) {
    const generateDisciplinasTable = (disciplinas, semestreNum) => {
        if (!disciplinas.length) return '<tr><td colspan="5" style="text-align:center;color:#666">Nenhuma disciplina neste semestre</td></tr>';
        
        return disciplinas.map(disc => `
            <tr>
                <td>DISC${disc._id.toString().slice(-3)}</td>
                <td>${disc.nome}</td>
                <td>48h</td>
                <td>6</td>
                <td><span class="estado-disciplina estado-em-curso">${data.matricula_aprovada ? (semestreNum === 1 ? 'Em curso' : 'Por iniciar') : (data.pedido_pendente ? 'A aguardar' : 'Bloqueado')}</span></td>
            </tr>
        `).join('');
    };
    
    const showNoCourse = !data.curso;
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Plano de Estudos - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
            .estado-disciplina { display:inline-block; padding:4px 12px; border-radius:20px; font-size:0.85em; font-weight:600; }
            .estado-em-curso { background:#28a745; color:white; }
            .estado-aguarda { background:#ffc107; color:#333; }
            .estado-bloqueado { background:#6c757d; color:white; }
            .aviso-matricula { background:#fff3cd; border:1px solid #ffeeba; color:#856404; padding:15px; border-radius:10px; margin-bottom:20px; text-align:center; }
            .sem-curso { text-align:center; padding:60px; color:#666; background:#f8f9fa; border-radius:15px; margin:20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div><h1>📚 Plano de Estudos</h1>
                    <p><strong>${data.login}</strong> ${data.curso ? `- ${data.curso.nome}` : ''}</p></div>
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
                <a href="/aluno/ficha">📝 Ficha Pessoal</a>
                <a href="/aluno/pedidos">📋 Pedidos</a>
            </div>
            <div class="content">
                ${showNoCourse ? `
                    <div class="sem-curso">
                        <h3>🎓 Sem curso atribuído</h3>
                        <p>Para ver o plano de estudos, precisa primeiro:</p>
                        <ol style="text-align:left;max-width:400px;margin:20px auto">
                            <li>📝 Preencher a <a href="/aluno/ficha">ficha de aluno</a></li>
                            <li>✅ Aguardar aprovação da ficha</li>
                            <li>🎓 <a href="/aluno/pedir-matricula">Pedir matrícula</a> num curso</li>
                            <li>📋 Aguardar aprovação da matrícula</li>
                        </ol>
                        <div style="margin-top:30px">
                            <a href="/aluno/ficha" class="btn">📝 Preencher Ficha</a>
                            <a href="/aluno/pedir-matricula" class="btn" style="background:#28a745">🎓 Pedir Matrícula</a>
                        </div>
                    </div>
                ` : `
                    ${!data.matricula_aprovada ? `
                        <div class="aviso-matricula">
                            ${data.pedido_pendente ? 
                                '⏳ O seu pedido de matrícula está pendente de aprovação.' :
                                (data.ficha && data.ficha.estado === 'aprovada' ?
                                    '⚠️ Para frequentar as disciplinas, precisa ter uma matrícula ativa. <a href="/aluno/pedir-matricula">Pedir matrícula agora</a>.' :
                                    '⚠️ Precisa primeiro <a href="/aluno/ficha">preencher a ficha de aluno</a>.')}
                        </div>
                    ` : ''}
                    
                    <div class="card">
                        <h2>📊 Resumo do Ano Letivo 2025/2026</h2>
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:center">
                            <div><div style="font-size:2.5em;color:#667eea">${data.total_disciplinas}</div><div>Disciplinas</div></div>
                            <div><div style="font-size:2.5em;color:#667eea">${data.total_disciplinas * 48}h</div><div>Carga Horária</div></div>
                            <div><div style="font-size:2.5em;color:#667eea">${data.total_disciplinas * 6}</div><div>Créditos ECTS</div></div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h2>📚 1º Semestre</h2>
                        <table class="table">
                            <thead><tr><th>Código</th><th>Disciplina</th><th>Horas</th><th>ECTS</th><th>Estado</th></tr></thead>
                            <tbody>${generateDisciplinasTable(data.disciplinasSemestre1, 1)}</tbody>
                        </table>
                    </div>
                    
                    <div class="card">
                        <h2>📚 2º Semestre</h2>
                        <table class="table">
                            <thead><tr><th>Código</th><th>Disciplina</th><th>Horas</th><th>ECTS</th><th>Estado</th></tr></thead>
                            <tbody>${generateDisciplinasTable(data.disciplinasSemestre2, 2)}</tbody>
                        </table>
                    </div>
                    
                    <div class="card">
                        <h2>⏰ Horário Semanal</h2>
                        <p style="text-align:center;color:#666;padding:30px">⏳ Indisponível</p>
                    </div>
                `}
            </div>
            <div class="footer"><p>&copy; 2026 IPCA - Plano de Estudos</p></div>
        </div>
    </body>
    </html>`;
}

module.exports = router;