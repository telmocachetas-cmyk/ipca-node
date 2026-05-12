const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAdmin } = require('../../middleware/auth');
const router = express.Router();

// Listar planos
router.get('/admin/planos', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        
        // Buscar todos os cursos
        const cursos = await db.collection('cursos').find({}).sort({ nome: 1 }).toArray();
        
        // Buscar todas as disciplinas
        const disciplinas = await db.collection('disciplinas').find({}).sort({ nome: 1 }).toArray();
        
        // Para cada curso, organizar disciplinas por ano/semestre
        const cursosComPlanos = [];
        
        for (let curso of cursos) {
            const disciplinasPorAnoSemestre = {};
            
            if (curso.disciplinas && curso.disciplinas.length) {
                for (let item of curso.disciplinas) {
                    const disc = await db.collection('disciplinas').findOne({ _id: item.disciplina_id });
                    if (disc) {
                        const key = `${item.ano}_${item.semestre}`;
                        if (!disciplinasPorAnoSemestre[key]) {
                            disciplinasPorAnoSemestre[key] = { ano: item.ano, semestre: item.semestre, disciplinas: [] };
                        }
                        disciplinasPorAnoSemestre[key].disciplinas.push({
                            id: disc._id,
                            nome: disc.nome,
                            codigo: disc.codigo,
                            creditos: disc.creditos,
                            plano_id: item.plano_id || item._id
                        });
                    }
                }
            }
            
            cursosComPlanos.push({
                ...curso,
                planos: Object.values(disciplinasPorAnoSemestre)
            });
        }
        
        res.send(generatePlanosHTML(cursos, disciplinas, cursosComPlanos, req.session.login));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar planos');
    }
});

// Adicionar disciplina ao plano
router.post('/admin/planos/adicionar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { curso_id, disciplina_id, ano, semestre } = req.body;
        
        const curso = await db.collection('cursos').findOne({ _id: new ObjectId(curso_id) });
        
        // Verificar se já existe
        const exists = curso.disciplinas?.some(d => 
            d.disciplina_id.toString() === disciplina_id && 
            d.ano === parseInt(ano) && 
            d.semestre === parseInt(semestre)
        );
        
        if (exists) {
            return sendAlert(res, 'Esta disciplina já está no plano para este ano/semestre!', '/admin/planos');
        }
        
        const novoPlano = {
            disciplina_id: new ObjectId(disciplina_id),
            ano: parseInt(ano),
            semestre: parseInt(semestre),
            plano_id: new ObjectId(),
            data_adicao: new Date()
        };
        
        await db.collection('cursos').updateOne(
            { _id: new ObjectId(curso_id) },
            { $push: { disciplinas: novoPlano } }
        );
        
        sendAlert(res, 'Disciplina adicionada ao plano com sucesso!', '/admin/planos');
        
    } catch (error) {
        sendAlert(res, 'Erro ao adicionar disciplina', '/admin/planos');
    }
});

// Remover disciplina do plano
router.get('/admin/planos/remover/:curso_id/:plano_id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { curso_id, plano_id } = req.params;
        
        await db.collection('cursos').updateOne(
            { _id: new ObjectId(curso_id) },
            { $pull: { disciplinas: { plano_id: new ObjectId(plano_id) } } }
        );
        
        sendAlert(res, 'Disciplina removida do plano!', '/admin/planos');
        
    } catch (error) {
        sendAlert(res, 'Erro ao remover disciplina', '/admin/planos');
    }
});

function generatePlanosHTML(cursos, disciplinas, cursosComPlanos, login) {
    const cursosOptions = cursos.map(c => `<option value="${c._id}">${escapeHtml(c.nome)}</option>`).join('');
    const disciplinasOptions = disciplinas.map(d => `<option value="${d._id}">${escapeHtml(d.nome)}</option>`).join('');
    
    const planosHTML = cursosComPlanos.map(curso => {
        let planosContent = '';
        
        if (curso.planos.length === 0) {
            planosContent = '<p style="color:#666;text-align:center;padding:20px">Nenhuma unidade curricular atribuída a este curso.</p>';
        } else {
            for (let plano of curso.planos) {
                planosContent += `
                    <div class="semestre-titulo" style="background:#f8f9fa;padding:10px;margin:15px 0 10px 0;border-radius:5px;font-weight:bold;color:#667eea">
                        ${plano.ano}º Ano - ${plano.semestre}º Semestre
                    </div>
                    <table class="table">
                        <thead><tr><th>Código</th><th>Unidade Curricular</th><th>ECTS</th><th>Ação</th></tr></thead>
                        <tbody>
                            ${plano.disciplinas.map(disc => `
                                <tr>
                                    <td>${disc.codigo || '---'}</td>
                                    <td>${escapeHtml(disc.nome)}</td>
                                    <td>${disc.creditos || 6}</td>
                                    <td><a href="/admin/planos/remover/${curso._id}/${disc.plano_id}" class="btn" style="background:#dc3545;padding:5px 10px;" onclick="return confirm('Remover esta UC do plano?')">Remover</a></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        }
        
        return `
            <div class="curso-plano" style="margin-bottom:30px;border:1px solid #e0e0e0;border-radius:10px;padding:20px">
                <h3 style="color:#667eea;margin-bottom:15px">${escapeHtml(curso.nome)}</h3>
                ${planosContent}
            </div>
        `;
    }).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Gerir Planos de Estudo - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; flex-wrap:wrap; gap:5px; background:#f8f9fa; padding:15px 30px; border-bottom:1px solid #dee2e6; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; transition:all 0.3s; font-weight:500; }
            .nav a:hover { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; transform:translateY(-2px); }
            .form-plano { display:grid; grid-template-columns:2fr 2fr 1fr 1fr auto; gap:10px; align-items:end; }
            @media (max-width:768px) { .form-plano { grid-template-columns:1fr; } }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">
                    <div><h1>📋 Gestão de Planos de Estudo</h1><p><strong>Bem-vindo, ${login}</strong></p></div>
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
                <a href="/admin/disciplinas">📖 Unidades Curriculares</a>
                <a href="/admin/utilizadores">👥 Utilizadores</a>
                <a href="/admin/validar-fichas">📝 Fichas</a>
            </div>
            <div class="content">
                <div class="card">
                    <h2>➕ Adicionar UC ao Plano</h2>
                    <form method="POST" action="/admin/planos/adicionar" class="form-plano">
                        <div class="form-group"><label>Curso:</label><select name="curso_id" required>${cursosOptions}</select></div>
                        <div class="form-group"><label>Unidade Curricular:</label><select name="disciplina_id" required>${disciplinasOptions}</select></div>
                        <div class="form-group"><label>Ano:</label><select name="ano" required><option value="1">1º Ano</option><option value="2">2º Ano</option><option value="3">3º Ano</option></select></div>
                        <div class="form-group"><label>Semestre:</label><select name="semestre" required><option value="1">1º Semestre</option><option value="2">2º Semestre</option></select></div>
                        <button type="submit" class="btn">Adicionar</button>
                    </form>
                </div>
                <div class="card">
                    <h2>📋 Planos de Estudo Atuais</h2>
                    ${planosHTML || '<p style="text-align:center;color:#666;padding:40px">Nenhum plano encontrado.</p>'}
                </div>
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

function sendAlert(res, message, redirectUrl) {
    res.send(`<script>alert('${message}'); window.location.href='${redirectUrl}';</script>`);
}

module.exports = router;