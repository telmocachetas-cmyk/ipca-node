const express = require('express');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAluno } = require('../../middleware/auth');
const router = express.Router();

router.get('/aluno/matricula', isAuthenticated, isAluno, async (req, res) => {
    try {
        const db = getDB();
        const login = req.session.login;
        
        const ficha = await db.collection('fichas_aluno').findOne({ aluno_login: login });
        const ficha_aprovada = ficha && ficha.estado === 'aprovada';
        
        // Verificar estado da matrícula
        const pedido = await db.collection('pedidos_matricula').findOne(
            { aluno_login: login },
            { sort: { data_pedido: -1 } }
        );
        
        let estado_matricula = 'sem_matricula';
        let numero_matricula = '---';
        let data_matricula = '--/--/----';
        let curso = null;
        
        if (pedido) {
            if (pedido.estado === 'aprovado') {
                estado_matricula = 'aprovada';
                data_matricula = pedido.data_decisao ? new Date(pedido.data_decisao).toLocaleDateString('pt-PT') : '--/--/----';
                numero_matricula = `IPCA${new Date(pedido.data_pedido).getFullYear()}${pedido._id.toString().slice(-4)}`;
                curso = await db.collection('cursos').findOne({ _id: pedido.curso_id });
            } else if (pedido.estado === 'pendente') {
                estado_matricula = 'pendente';
                curso = await db.collection('cursos').findOne({ _id: pedido.curso_id });
            }
        }
        
        const pedidos = await db.collection('pedidos_matricula')
            .find({ aluno_login: login })
            .sort({ data_pedido: -1 })
            .limit(3)
            .toArray();
        
        // Adicionar nome do curso a cada pedido
        for (let p of pedidos) {
            const c = await db.collection('cursos').findOne({ _id: p.curso_id });
            p.curso_nome = c ? c.nome : 'Desconhecido';
        }
        
        res.send(generateMatriculaHTML({
            login: req.session.login,
            ficha_aprovada,
            estado_matricula,
            numero_matricula,
            data_matricula,
            curso,
            pedidos,
            ficha
        }));
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar página de matrícula');
    }
});

router.get('/aluno/pedir-matricula', isAuthenticated, isAluno, async (req, res) => {
    try {
        const db = getDB();
        const login = req.session.login;
        
        const ficha = await db.collection('fichas_aluno').findOne({ aluno_login: login });
        
        if (!ficha || ficha.estado !== 'aprovada') {
            return res.send(`<script>alert('Precisa de ter uma ficha aprovada para pedir matrícula.'); window.location.href='/aluno/ficha';</script>`);
        }
        
        // Buscar cursos disponíveis (excluindo os com pedido pendente)
        const pedidoPendente = await db.collection('pedidos_matricula').findOne({
            aluno_login: login,
            estado: 'pendente'
        });
        
        let cursosQuery = {};
        if (pedidoPendente) {
            cursosQuery = { _id: { $ne: pedidoPendente.curso_id } };
        }
        
        const cursos = await db.collection('cursos').find(cursosQuery).toArray();
        const pedidos = await db.collection('pedidos_matricula')
            .find({ aluno_login: login })
            .sort({ data_pedido: -1 })
            .toArray();
        
        for (let p of pedidos) {
            const c = await db.collection('cursos').findOne({ _id: p.curso_id });
            p.curso_nome = c ? c.nome : 'Desconhecido';
        }
        
        res.send(generatePedirMatriculaHTML({ login: req.session.login, cursos, pedidos }));
        
    } catch (error) {
        res.status(500).send('Erro ao carregar página');
    }
});

router.post('/aluno/pedir-matricula', isAuthenticated, isAluno, async (req, res) => {
    try {
        const db = getDB();
        const login = req.session.login;
        const { curso_id } = req.body;
        
        const existing = await db.collection('pedidos_matricula').findOne({
            aluno_login: login,
            curso_id: new ObjectId(curso_id),
            estado: 'pendente'
        });
        
        if (existing) {
            return res.send(`<script>alert('Já existe um pedido pendente para este curso!'); window.location.href='/aluno/pedir-matricula';</script>`);
        }
        
        const curso = await db.collection('cursos').findOne({ _id: new ObjectId(curso_id) });
        const ano_letivo = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
        
        await db.collection('pedidos_matricula').insertOne({
            aluno_id: req.session.user_id,
            aluno_login: login,
            curso_id: new ObjectId(curso_id),
            curso_nome: curso.nome,
            ano_letivo,
            estado: 'pendente',
            data_pedido: new Date()
        });
        
        res.send(`<script>alert('Pedido de matrícula submetido com sucesso!'); window.location.href='/aluno/matricula';</script>`);
        
    } catch (error) {
        res.send(`<script>alert('Erro ao submeter pedido: ${error.message}'); window.location.href='/aluno/pedir-matricula';</script>`);
    }
});

function generateMatriculaHTML(data) {
    const getStatusClass = () => {
        if (data.estado_matricula === 'aprovada') return 'status-ativa';
        if (data.estado_matricula === 'pendente') return 'status-pendente';
        return 'status-sem-matricula';
    };
    
    const getStatusText = () => {
        if (data.estado_matricula === 'aprovada') return '✓ MATRÍCULA ATIVA';
        if (data.estado_matricula === 'pendente') return '⏳ AGUARDANDO APROVAÇÃO';
        return '⚠️ SEM MATRÍCULA';
    };
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Minha Matrícula - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
            .nav a:hover { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; }
            .status-matricula { display:inline-block; padding:10px 30px; border-radius:30px; font-weight:bold; font-size:1.2em; }
            .status-ativa { background:#28a745; color:white; }
            .status-pendente { background:#ffc107; color:#333; }
            .status-sem-matricula { background:#6c757d; color:white; }
            .card-destaque { background:linear-gradient(135deg,#28a745 0%,#20c997 100%); color:white; border-radius:20px; padding:40px; margin:30px 0; text-align:center; }
            .btn-destaque { display:inline-block; background:white; color:#28a745; text-decoration:none; padding:18px 45px; border-radius:50px; font-weight:bold; font-size:1.4em; }
            .foto-aluno { width:180px; height:180px; border-radius:50%; object-fit:cover; border:4px solid white; }
            .cards-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:20px; margin-top:20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div><h1>🎓 Minha Matrícula</h1><p>Bem-vindo, <strong>${data.login}</strong></p></div>
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
                <a href="/aluno/plano-estudos">📚 Plano de Estudos</a>
                <a href="/aluno/ficha">📝 Ficha Pessoal</a>
                <a href="/aluno/pedidos">📋 Pedidos</a>
            </div>
            <div class="content">
                ${data.estado_matricula !== 'aprovada' ? `
                <div class="card-destaque">
                    <h2>🎓 Pedido de Matrícula ${new Date().getFullYear()}/${new Date().getFullYear()+1}</h2>
                    ${data.ficha_aprovada ? 
                        (data.estado_matricula === 'pendente' ? 
                            `<p>⏳ Já submeteu um pedido de matrícula. Aguarde a aprovação.</p>` :
                            `<p>✅ A sua ficha está aprovada! Pode solicitar a matrícula.</p>
                             <a href="/aluno/pedir-matricula" class="btn-destaque">🚀 PEDIR MATRÍCULA AGORA</a>`) :
                        `<p>⚠️ Para pedir matrícula, precisa primeiro ter a ficha de aluno aprovada.</p>
                         <a href="/aluno/ficha" class="btn-destaque" style="background:#ffc107;color:#333">📝 PREENCHER FICHA</a>`}
                </div>` : ''}
                
                <div class="card" style="border:2px solid #667eea">
                    <div style="text-align:center;margin-bottom:30px">
                        <span class="status-matricula ${getStatusClass()}">${getStatusText()}</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 2fr;gap:30px">
                        <div style="text-align:center">
                            ${data.ficha && data.ficha.foto_path ? 
                                `<img src="/${data.ficha.foto_path}" class="foto-aluno">` :
                                `<div class="foto-aluno" style="background:linear-gradient(135deg,#667eea, #764ba2);display:flex;align-items:center;justify-content:center"><span style="font-size:4em;color:white">👤</span></div>`}
                            <p style="margin-top:15px"><strong>${data.login}</strong></p>
                        </div>
                        <div>
                            <table style="width:100%">
                                <tr><td style="padding:12px;font-weight:bold">Nº Matrícula:</td><td>${data.numero_matricula}</td></tr>
                                <tr style="background:#f8f9fa"><td style="padding:12px;font-weight:bold">Nome:</td><td>${data.login}</td></tr>
                                <tr><td style="padding:12px;font-weight:bold">Curso:</td><td>${data.curso ? data.curso.nome : '<span style="color:#999">Não definido</span>'}</td></tr>
                                <tr style="background:#f8f9fa"><td style="padding:12px;font-weight:bold">Data Matrícula:</td><td>${data.data_matricula}</td></tr>
                                <tr><td style="padding:12px;font-weight:bold">Ano Letivo:</td><td>${new Date().getFullYear()}/${new Date().getFullYear()+1}</td></tr>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div class="cards-grid">
                    <div class="card"><h2>📄 Documentos</h2>
                        <table class="table"><tr><td>📋 Comprovativo de Matrícula</td><td><span class="btn" style="background:#ccc;cursor:not-allowed">Indisponível</span></td></tr>
                        <tr><td>📊 Horário</td><td><span class="btn" style="background:#ccc;cursor:not-allowed">Indisponível</span></td></tr>
                        <tr><td>📚 Plano de Estudos</td><td><a href="/aluno/plano-estudos" class="btn">Ver</a></td></tr></table>
                    </div>
                    <div class="card"><h2>ℹ️ Informações</h2>
                        <ul style="list-style:none;padding:0"><li style="padding:10px;border-bottom:1px solid #eee"><strong>📅 Início das aulas:</strong> 15/09/2025</li>
                        <li style="padding:10px;border-bottom:1px solid #eee"><strong>📝 Época de exames:</strong> 10/01/2026 a 30/01/2026</li>
                        <li style="padding:10px"><strong>💰 Propina:</strong> 697€ (Paga a 10/09/2025)</li></ul>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

function generatePedirMatriculaHTML(data) {
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Pedir Matrícula</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>🎓 Pedido de Matrícula</h1><p>${data.login}</p></div>
            <div class="nav">
                <a href="/aluno/dashboard">📊 Dashboard</a>
                <a href="/aluno/matricula">🎓 Matrícula</a>
                <a href="/aluno/plano-estudos">📚 Plano de Estudos</a>
                <a href="/aluno/ficha">📝 Ficha Pessoal</a>
                <a href="/aluno/pedidos">📋 Pedidos</a>
            </div>
            <div class="content">
                <div class="card">
                    <h2>Novo Pedido de Matrícula</h2>
                    ${data.cursos.length > 0 ? `
                        <form method="POST">
                            <div class="form-group"><label>Curso:</label><select name="curso_id" required>
                                <option value="">Selecione um curso</option>
                                ${data.cursos.map(c => `<option value="${c._id}">${c.nome}</option>`).join('')}
                            </select></div>
                            <button type="submit" class="btn">Submeter Pedido</button>
                        </form>
                    ` : '<p style="text-align:center;padding:30px">Já submeteu pedidos para todos os cursos disponíveis.</p>'}
                </div>
                <div class="card">
                    <h2>Meus Pedidos</h2>
                    ${data.pedidos.length > 0 ? `
                        <table class="table">
                            <thead><tr><th>Data</th><th>Curso</th><th>Estado</th><th>Observações</th></tr></thead>
                            <tbody>${data.pedidos.map(p => `
                                <tr><td>${new Date(p.data_pedido).toLocaleDateString('pt-PT')}</td>
                                <td>${p.curso_nome}</td>
                                <td>${p.estado === 'pendente' ? '<span class="badge badge-admin">Pendente</span>' : (p.estado === 'aprovado' ? '<span class="badge badge-aluno">Aprovado</span>' : '<span class="badge" style="background:#dc3545">Rejeitado</span>')}</td>
                                <td>${p.observacoes || '-'}</td></tr>
                            `).join('')}</tbody>
                        </table>
                    ` : '<p style="text-align:center;padding:30px">Nenhum pedido encontrado.</p>'}
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

module.exports = router;