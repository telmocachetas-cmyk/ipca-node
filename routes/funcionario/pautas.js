const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isFuncionario } = require('../../middleware/auth');
const router = express.Router();

// Listar pautas
router.get('/funcionario/pautas', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const { uc, epoca, ano_letivo } = req.query;
        
        let filter = {};
        if (uc) filter.uc_id = new ObjectId(uc);
        if (epoca) filter.epoca = epoca;
        if (ano_letivo) filter.ano_letivo = ano_letivo;
        
        const pautas = await db.collection('pautas')
            .find(filter)
            .sort({ data_criacao: -1 })
            .toArray();
        
        for (let pauta of pautas) {
            const uc = await db.collection('disciplinas').findOne({ _id: pauta.uc_id });
            pauta.uc_nome = uc ? uc.nome : 'Desconhecido';
            
            const notas = await db.collection('notas').find({ pauta_id: pauta._id }).toArray();
            pauta.total_alunos = notas.length;
            pauta.notas_lancadas = notas.filter(n => n.nota !== null && n.nota !== undefined).length;
            pauta.aprovados = notas.filter(n => n.aprovado === true).length;
        }
        
        const ucs = await db.collection('disciplinas').find({}).sort({ nome: 1 }).toArray();
        
        const total_pautas = pautas.length;
        const ucsComPauta = new Set(pautas.map(p => p.uc_id.toString())).size;
        
        const todasNotas = await db.collection('notas').find({}).toArray();
        const total_notas = todasNotas.filter(n => n.nota !== null).length;
        const media_notas = total_notas > 0 ? (todasNotas.reduce((sum, n) => sum + (n.nota || 0), 0) / total_notas).toFixed(1) : 0;
        
        res.send(generatePautasHTML(pautas, ucs, { total_pautas, ucsComPauta, total_notas, media_notas }, req.query, req.session.login));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar pautas');
    }
});

// Criar pauta - GET
router.get('/funcionario/criar-pauta', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const ucs = await db.collection('disciplinas').find({}).sort({ nome: 1 }).toArray();
        
        const total_ucs = ucs.length;
        const total_pautas = await db.collection('pautas').countDocuments();
        
        const ucsComMaisPautas = await db.collection('pautas').aggregate([
            { $group: { _id: "$uc_id", total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 5 }
        ]).toArray();
        
        for (let item of ucsComMaisPautas) {
            const uc = await db.collection('disciplinas').findOne({ _id: item._id });
            item.uc_nome = uc ? uc.nome : 'Desconhecido';
        }
        
        res.send(generateCriarPautaHTML(ucs, total_ucs, total_pautas, ucsComMaisPautas, req.session.login));
        
    } catch (error) {
        res.status(500).send('Erro ao carregar página');
    }
});

// Criar pauta - POST
router.post('/funcionario/criar-pauta', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const { uc_id, ano_letivo, epoca } = req.body;
        
        const existing = await db.collection('pautas').findOne({
            uc_id: new ObjectId(uc_id),
            ano_letivo,
            epoca
        });
        
        if (existing) {
            return res.send(`<script>alert('Já existe uma pauta para esta UC/época!'); window.location.href='/funcionario/criar-pauta';</script>`);
        }
        
        const uc = await db.collection('disciplinas').findOne({ _id: new ObjectId(uc_id) });
        
        const result = await db.collection('pautas').insertOne({
            uc_id: new ObjectId(uc_id),
            uc_nome: uc.nome,
            ano_letivo,
            epoca,
            data_criacao: new Date(),
            funcionario_id: req.session.user_id,
            funcionario_login: req.session.login
        });
        
        const pauta_id = result.insertedId;
        
        const alunosElegiveis = await db.collection('pedidos_matricula').aggregate([
            { $match: { estado: 'aprovado' } },
            { $lookup: { from: 'cursos', localField: 'curso_id', foreignField: '_id', as: 'curso' } },
            { $unwind: '$curso' },
            { $match: { 'curso.disciplinas.disciplina_id': new ObjectId(uc_id) } }
        ]).toArray();
        
        for (let aluno of alunosElegiveis) {
            await db.collection('notas').insertOne({
                pauta_id,
                aluno_id: aluno.aluno_id,
                aluno_login: aluno.aluno_login,
                nota: null,
                aprovado: false,
                data_registo: null,
                funcionario_id: null,
                funcionario_login: null
            });
        }
        
        const total_alunos = alunosElegiveis.length;
        res.send(`<script>alert('Pauta criada com sucesso! ${total_alunos} alunos elegíveis inscritos.'); window.location.href='/funcionario/lancar-notas?pauta_id=${pauta_id}';</script>`);
        
    } catch (error) {
        console.error(error);
        res.send(`<script>alert('Erro ao criar pauta: ${error.message}'); window.location.href='/funcionario/criar-pauta';</script>`);
    }
});

// Lançar notas - GET
router.get('/funcionario/lancar-notas', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const { pauta_id } = req.query;
        
        if (!pauta_id) {
            return res.redirect('/funcionario/pautas');
        }
        
        const pauta = await db.collection('pautas').findOne({ _id: new ObjectId(pauta_id) });
        if (!pauta) {
            return res.redirect('/funcionario/pautas');
        }
        
        const uc = await db.collection('disciplinas').findOne({ _id: pauta.uc_id });
        pauta.uc_nome = uc ? uc.nome : 'Desconhecido';
        
        const notas = await db.collection('notas')
            .find({ pauta_id: new ObjectId(pauta_id) })
            .sort({ aluno_login: 1 })
            .toArray();
        
        for (let nota of notas) {
            const user = await db.collection('users').findOne({ login: nota.aluno_login });
            nota.nome_completo = user?.nome_completo || nota.aluno_login;
        }
        
        res.send(generateLancarNotasHTML(pauta, notas, req.session.login));
        
    } catch (error) {
        res.status(500).send('Erro ao carregar página de notas');
    }
});

// Lançar notas - POST
router.post('/funcionario/lancar-notas', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const { pauta_id, notas } = req.body;
        
        for (const [nota_id, valor_nota] of Object.entries(notas)) {
            if (valor_nota !== '' && valor_nota !== null) {
                const nota_num = parseFloat(valor_nota);
                const aprovado = nota_num >= 9.5;
                
                await db.collection('notas').updateOne(
                    { _id: new ObjectId(nota_id) },
                    { 
                        $set: { 
                            nota: nota_num,
                            aprovado,
                            data_registo: new Date(),
                            funcionario_id: req.session.user_id,
                            funcionario_login: req.session.login
                        }
                    }
                );
            }
        }
        
        res.send(`<script>alert('Notas guardadas com sucesso!'); window.location.href='/funcionario/lancar-notas?pauta_id=${pauta_id}';</script>`);
        
    } catch (error) {
        res.send(`<script>alert('Erro ao guardar notas'); window.location.href='/funcionario/pautas';</script>`);
    }
});

// Ver detalhes da pauta
router.get('/funcionario/pauta/:id', isAuthenticated, isFuncionario, async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        
        const pauta = await db.collection('pautas').findOne({ _id: new ObjectId(id) });
        if (!pauta) {
            return res.redirect('/funcionario/pautas');
        }
        
        const uc = await db.collection('disciplinas').findOne({ _id: pauta.uc_id });
        pauta.uc_nome = uc ? uc.nome : 'Desconhecido';
        
        const notas = await db.collection('notas')
            .find({ pauta_id: new ObjectId(id) })
            .sort({ aluno_login: 1 })
            .toArray();
        
        for (let nota of notas) {
            const user = await db.collection('users').findOne({ login: nota.aluno_login });
            nota.nome_completo = user?.nome_completo || nota.aluno_login;
        }
        
        const total_alunos = notas.length;
        const notas_lancadas = notas.filter(n => n.nota !== null).length;
        const aprovados = notas.filter(n => n.aprovado === true).length;
        const reprovados = notas.filter(n => n.nota !== null && !n.aprovado).length;
        const media = notas_lancadas > 0 ? (notas.reduce((sum, n) => sum + (n.nota || 0), 0) / notas_lancadas).toFixed(1) : 0;
        
        res.send(generateDetalhesPautaHTML(pauta, notas, { total_alunos, notas_lancadas, aprovados, reprovados, media }, req.session.login));
        
    } catch (error) {
        res.status(500).send('Erro ao carregar detalhes da pauta');
    }
});

// ============ FUNÇÕES DE GERAÇÃO DE HTML ============

function generatePautasHTML(pautas, ucs, stats, filters, login) {
    const pautasRows = pautas.map(pauta => {
        const progresso = pauta.total_alunos > 0 ? Math.round((pauta.notas_lancadas / pauta.total_alunos) * 100) : 0;
        return `
            <tr>
                <td><strong>${pauta.uc_nome}</strong></td>
                <td>${pauta.ano_letivo}</td>
                <td><span class="badge" style="background:#17a2b8">${pauta.epoca}</span></td>
                <td>${new Date(pauta.data_criacao).toLocaleDateString('pt-PT')}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:10px">
                        <div style="flex:1;background:#e0e0e0;border-radius:10px;height:10px">
                            <div style="width:${progresso}%;background:#28a745;height:10px;border-radius:10px"></div>
                        </div>
                        <span>${pauta.notas_lancadas}/${pauta.total_alunos}</span>
                    </div>
                </td>
                <td>
                    <a href="/funcionario/lancar-notas?pauta_id=${pauta._id}" class="btn" style="background:#28a745;padding:5px 10px">✏️ Lançar</a>
                    <a href="/funcionario/pauta/${pauta._id}" class="btn" style="background:#17a2b8;padding:5px 10px">👁️ Ver</a>
                 </td>
             </tr>
        `;
    }).join('');
    
    const ucsOptions = ucs.map(uc => `<option value="${uc._id}">${uc.nome}</option>`).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Ver Pautas - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
            .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:15px; margin-bottom:25px; }
            .stat-card { background:white; border-radius:10px; padding:15px; text-align:center; box-shadow:0 2px 10px rgba(0,0,0,0.1); }
            .stat-value { font-size:1.8em; font-weight:bold; color:#667eea; }
            .filtros { background:#f8f9fa; padding:20px; border-radius:10px; margin-bottom:20px; display:grid; grid-template-columns:repeat(4,1fr); gap:15px; align-items:end; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>📊 Pautas de Avaliação</h1><p>Bem-vindo, ${login}</p></div>
            <div class="nav">
                <a href="/funcionario/dashboard">📊 Dashboard</a>
                <a href="/funcionario/criar-pauta">📝 Criar Pauta</a>
                <a href="/funcionario/pedidos">📋 Pedidos</a>
                <a href="/funcionario/alunos">👥 Alunos</a>
            </div>
            <div class="content">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${stats.total_pautas}</div><div>Total Pautas</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.ucsComPauta}</div><div>UCs com Pauta</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.total_notas}</div><div>Notas Lançadas</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.media_notas}</div><div>Média Geral</div></div>
                </div>
                
                <div class="card">
                    <h2>Lista de Pautas</h2>
                    ${pautas.length ? `<table class="table"><thead><tr><th>UC</th><th>Ano</th><th>Época</th><th>Data</th><th>Progresso</th><th>Ações</th></tr></thead><tbody>${pautasRows}</tbody></table>` : '<p>Nenhuma pauta encontrada.</p>'}
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

function generateCriarPautaHTML(ucs, total_ucs, total_pautas, topUcs, login) {
    const ucsOptions = ucs.map(uc => `<option value="${uc._id}">${uc.nome}</option>`).join('');
    const topUcsList = topUcs.map(uc => `<tr><td>${uc.uc_nome}</td><td><span class="badge badge-admin">${uc.total}</span></td></tr>`).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Criar Pauta - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
            .nav a:hover { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; }
            
            .stats-mini {
                display: flex;
                justify-content: center;
                gap: 30px;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
            }
            
            .stat-mini-card {
                background: #f8f9fa;
                border-radius: 15px;
                padding: 20px 40px;
                text-align: center;
                min-width: 180px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            }
            
            .stat-mini-number {
                font-size: 2em;
                font-weight: bold;
                color: #667eea;
            }
            
            .stat-mini-label {
                font-size: 0.9em;
                color: #666;
                margin-top: 5px;
            }
            
            .form-container {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                align-items: end;
            }
            
            @media (max-width: 768px) {
                .form-container { grid-template-columns: 1fr; }
                .stats-mini { flex-direction: column; align-items: center; gap: 15px; }
                .stat-mini-card { min-width: auto; width: 100%; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div><h1>📝 Criar Pauta de Avaliação</h1><p>Bem-vindo, ${login}</p></div>
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
                <a href="/funcionario/dashboard">📊 Dashboard</a>
                <a href="/funcionario/pautas">📊 Ver Pautas</a>
                <a href="/funcionario/pedidos">📋 Pedidos</a>
                <a href="/funcionario/alunos">👥 Alunos</a>
            </div>
            
            <div class="content">
                <div class="card">
                    <h2>➕ Criar Nova Pauta</h2>
                    <form method="POST">
                        <div class="form-container">
                            <div class="form-group">
                                <label>Unidade Curricular:</label>
                                <select name="uc_id" required style="width:100%; padding:10px;">${ucsOptions}</select>
                            </div>
                            
                            <div class="form-group">
                                <label>Ano Letivo:</label>
                                <select name="ano_letivo" required style="width:100%; padding:10px;">
                                    <option value="${new Date().getFullYear()}/${new Date().getFullYear()+1}">${new Date().getFullYear()}/${new Date().getFullYear()+1}</option>
                                    <option value="${new Date().getFullYear()-1}/${new Date().getFullYear()}">${new Date().getFullYear()-1}/${new Date().getFullYear()}</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Época:</label>
                                <select name="epoca" required style="width:100%; padding:10px;">
                                    <option value="Normal">Normal</option>
                                    <option value="Recurso">Recurso</option>
                                    <option value="Especial">Especial</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <button type="submit" class="btn" style="padding: 12px 40px;">Criar Pauta</button>
                        </div>
                    </form>
                    
                    <!-- Cards lado a lado -->
                    <div class="stats-mini">
                        <div class="stat-mini-card">
                            <div class="stat-mini-number">${total_ucs}</div>
                            <div class="stat-mini-label">UCs Disponíveis</div>
                        </div>
                        <div class="stat-mini-card">
                            <div class="stat-mini-number">${total_pautas}</div>
                            <div class="stat-mini-label">Pautas Criadas</div>
                        </div>
                    </div>
                </div>
                
                ${topUcs.length ? `
                <div class="card">
                    <h2>📊 UCs com Mais Pautas</h2>
                    <table class="table">
                        <thead><tr><th>Unidade Curricular</th><th>Total de Pautas</th></tr></thead>
                        <tbody>${topUcsList}</tbody>
                    </table>
                </div>` : ''}
            </div>
            
            <div class="footer">
                <p>&copy; 2026 IPCA - Área do Funcionário</p>
            </div>
        </div>
    </body>
    </html>`;
}

function generateLancarNotasHTML(pauta, notas, login) {
    const notasRows = notas.map(nota => {
        const isAprovado = nota.nota && nota.nota >= 9.5;
        return `
            <tr>
                <td>${nota.aluno_login}</td>
                <td>${nota.nome_completo}</td>
                <td><input type="number" name="notas[${nota._id}]" value="${nota.nota || ''}" step="0.1" min="0" max="20" class="nota-input" style="width:80px;padding:8px;border-radius:5px;text-align:center"></td>
                <td>${nota.nota ? (isAprovado ? '<span class="badge badge-aluno">Aprovado</span>' : '<span class="badge" style="background:#dc3545">Reprovado</span>') : '<span class="badge badge-admin">Pendente</span>'}</td>
            </tr>
        `;
    }).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Lançar Notas - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>✏️ Lançar Notas</h1><p>${pauta.uc_nome} - ${pauta.epoca} ${pauta.ano_letivo}</p></div>
            <div class="nav">
                <a href="/funcionario/dashboard">📊 Dashboard</a>
                <a href="/funcionario/pautas">📊 Ver Pautas</a>
                <a href="/funcionario/pedidos">📋 Pedidos</a>
                <a href="/funcionario/alunos">👥 Alunos</a>
            </div>
            <div class="content">
                <div class="card">
                    <form method="POST">
                        <table class="table">
                            <thead><tr><th>Aluno</th><th>Nome</th><th>Nota</th><th>Estado</th></tr></thead>
                            <tbody>${notasRows}</tbody>
                        </table>
                        <div style="text-align:center;margin-top:20px">
                            <button type="submit" name="guardar_notas" class="btn">Guardar Notas</button>
                            <a href="/funcionario/pautas" class="btn" style="background:#6c757d">Voltar</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

function generateDetalhesPautaHTML(pauta, notas, stats, login) {
    const notasRows = notas.map(nota => {
        const isAprovado = nota.nota && nota.nota >= 9.5;
        return `
            <tr>
                <td>${nota.aluno_login}</td>
                <td>${nota.nome_completo}</td>
                <td>${nota.nota ? nota.nota.toFixed(1) : '-'}</td>
                <td>${nota.nota ? (isAprovado ? '<span class="badge badge-aluno">Aprovado</span>' : '<span class="badge" style="background:#dc3545">Reprovado</span>') : '<span class="badge badge-admin">Pendente</span>'}</td>
                <td>${nota.data_registo ? new Date(nota.data_registo).toLocaleDateString('pt-PT') : '-'}</td>
            </tr>
        `;
    }).join('');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Detalhes da Pauta - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
            .stats-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:15px; margin:20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>📊 Detalhes da Pauta</h1><p>${pauta.uc_nome} - ${pauta.epoca} ${pauta.ano_letivo}</p></div>
            <div class="nav">
                <a href="/funcionario/dashboard">📊 Dashboard</a>
                <a href="/funcionario/criar-pauta">📝 Criar Pauta</a>
                <a href="/funcionario/pedidos">📋 Pedidos</a>
                <a href="/funcionario/alunos">👥 Alunos</a>
            </div>
            <div class="content">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${stats.total_alunos}</div><div>Total Alunos</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.notas_lancadas}</div><div>Notas Lançadas</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.aprovados}</div><div>Aprovados</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.reprovados}</div><div>Reprovados</div></div>
                    <div class="stat-card"><div class="stat-value">${stats.media}</div><div>Média</div></div>
                </div>
                <div class="card">
                    <h3>Notas dos Alunos</h3>
                    <table class="table"><thead><tr><th>Aluno</th><th>Nome</th><th>Nota</th><th>Estado</th><th>Data Registo</th></tr></thead><tbody>${notasRows}</tbody></table>
                    <div style="text-align:center;margin-top:20px"><a href="/funcionario/lancar-notas?pauta_id=${pauta._id}" class="btn" style="background:#28a745">✏️ Lançar/Editar Notas</a></div>
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

module.exports = router;