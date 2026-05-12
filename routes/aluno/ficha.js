const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAluno } = require('../../middleware/auth');
const router = express.Router();

// Configurar upload de ficheiros
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './public/uploads';
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `aluno_${req.session.login}_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png/;
        const extname = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowed.test(file.mimetype);
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Apenas imagens JPG/PNG são permitidas'));
    }
});

router.get('/aluno/ficha', isAuthenticated, isAluno, async (req, res) => {
    try {
        const db = getDB();
        const login = req.session.login;
        
        const ficha = await db.collection('fichas_aluno').findOne({ aluno_login: login });
        const cursos = await db.collection('cursos').find({}).toArray();
        
        res.send(generateFichaHTML(ficha, cursos, login, null));
    } catch (error) {
        res.status(500).send('Erro ao carregar ficha');
    }
});

router.post('/aluno/ficha', isAuthenticated, isAluno, upload.single('foto'), async (req, res) => {
    try {
        const db = getDB();
        const login = req.session.login;
        const { curso_id, nome_completo, data_nascimento, nif, morada, telefone, email, acao } = req.body;
        
        const fichaData = {
            curso_id: new ObjectId(curso_id),
            nome_completo,
            data_nascimento: new Date(data_nascimento),
            nif,
            morada,
            telefone,
            email,
            estado: acao === 'submeter' ? 'submetida' : 'rascunho'
        };
        
        if (req.file) {
            fichaData.foto_path = `uploads/${req.file.filename}`;
        }
        
        if (acao === 'submeter') {
            fichaData.data_submissao = new Date();
        }
        
        const existing = await db.collection('fichas_aluno').findOne({ aluno_login: login });
        
        if (existing) {
            await db.collection('fichas_aluno').updateOne(
                { aluno_login: login },
                { $set: fichaData }
            );
        } else {
            fichaData.aluno_id = req.session.user_id;
            fichaData.aluno_login = login;
            await db.collection('fichas_aluno').insertOne(fichaData);
        }
        
        const mensagem = `Ficha ${acao === 'submeter' ? 'submetida' : 'guardada'} com sucesso!`;
        res.send(`<script>alert('${mensagem}'); window.location.href='/aluno/ficha';</script>`);
        
    } catch (error) {
        console.error(error);
        res.send(`<script>alert('Erro: ${error.message}'); window.location.href='/aluno/ficha';</script>`);
    }
});

function generateFichaHTML(ficha, cursos, login, errorMsg) {
    const estadoBadge = () => {
        if (!ficha) return '';
        const estados = {
            'rascunho': '<span class="estado-badge estado-rascunho">RASCUNHO</span>',
            'submetida': '<span class="estado-badge estado-submetida">SUBMETIDA</span>',
            'aprovada': '<span class="estado-badge estado-aprovada">APROVADA</span>',
            'rejeitada': '<span class="estado-badge estado-rejeitada">REJEITADA</span>'
        };
        return estados[ficha.estado] || '';
    };
    
    const isReadOnly = ficha && (ficha.estado === 'submetida' || ficha.estado === 'aprovada');
    const showUpload = !ficha || (!ficha.foto_path && ficha.estado !== 'submetida');
    
    return `<!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Minha Ficha - Aluno</title>
        <link rel="stylesheet" href="/css/estilo.css">
        <style>
            .nav { display:flex; gap:10px; background:#f8f9fa; padding:15px 30px; }
            .nav a { color:#667eea; text-decoration:none; padding:8px 15px; border-radius:25px; }
            .nav a:hover { background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); color:white; }
            .grid-ficha { display:grid; grid-template-columns:280px 1fr; gap:40px; align-items:start; }
            
            /* ESTILOS DA COLUNA DA FOTO - CENTRALIZADOS */
            .foto-coluna {
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
            }
            
            .foto-titulo {
                font-weight: bold;
                display: block;
                margin-bottom: 15px;
                text-align: center;
                font-size: 1.1em;
            }
            
            .foto-preview { 
                width: 200px; 
                height: 250px; 
                border-radius: 10px; 
                object-fit: cover; 
                border: 3px solid #667eea; 
                background: #f0f0f0;
                display: block;
                margin: 0 auto;
            }
            
            .foto-placeholder { 
                width: 200px; 
                height: 250px; 
                border-radius: 10px; 
                background: linear-gradient(135deg, #e0e0e0, #f0f0f0); 
                border: 3px dashed #667eea; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: center;
                margin: 0 auto;
            }
            
            .btn-foto { 
                display: inline-block; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 8px 20px; 
                border-radius: 25px; 
                cursor: pointer; 
                font-size: 0.85em; 
                transition: all 0.3s; 
                border: none;
                margin-top: 15px;
            }
            
            .btn-foto:hover { 
                transform: translateY(-2px); 
                box-shadow: 0 5px 15px rgba(102,126,234,0.4); 
            }
            
            .foto-info {
                font-size: 0.7em;
                color: #999;
                margin-top: 8px;
                text-align: center;
            }
            
            .estado-badge { display:inline-block; padding:8px 15px; border-radius:20px; font-weight:bold; }
            .estado-rascunho { background:#ffc107; color:#000; }
            .estado-submetida { background:#17a2b8; color:#fff; }
            .estado-aprovada { background:#28a745; color:#fff; }
            .estado-rejeitada { background:#dc3545; color:#fff; }
            
            @media (max-width:768px) { .grid-ficha { grid-template-columns:1fr; } }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div><h1>📝 Ficha de Aluno</h1><p><strong>Bem-vindo, ${login}</strong></p></div>
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
                <a href="/aluno/pedidos">📋 Pedidos</a>
            </div>
            <div class="content">
                ${ficha && ficha.estado === 'aprovada' ? '<div class="alert alert-success">✅ A sua ficha foi APROVADA! Já pode pedir matrícula.</div>' : ''}
                ${ficha && ficha.estado === 'rejeitada' ? `<div class="alert alert-error">❌ Ficha rejeitada. Motivo: ${ficha.observacoes || 'Sem justificação'}</div>` : ''}
                
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
                        <h2>Dados Pessoais</h2>
                        ${estadoBadge()}
                    </div>
                    <form method="POST" enctype="multipart/form-data">
                        <div class="grid-ficha">
                            <!-- COLUNA DA FOTO - CORRIGIDA E CENTRALIZADA -->
                            <div class="foto-coluna">
                                <span class="foto-titulo">Fotografia</span>
                                
                                ${ficha && ficha.foto_path ? 
                                    `<img src="/${ficha.foto_path}" class="foto-preview" id="fotoPreview">` :
                                    `<div class="foto-placeholder" id="fotoPlaceholder">
                                        <span style="font-size:3em">📷</span>
                                        <span>Sem foto</span>
                                     </div>
                                     <img src="" class="foto-preview" id="fotoPreview" style="display:none">`}
                                
                                ${showUpload && (!ficha || ficha.estado !== 'submetida') ? `
                                    <label for="foto" class="btn-foto">
                                        📷 Escolher foto
                                    </label>
                                    <input type="file" id="foto" name="foto" accept=".jpg,.jpeg,.png" style="display:none" onchange="previewFoto(this)">
                                    <div class="foto-info">JPG/PNG • Máx 2MB</div>
                                ` : ''}
                            </div>
                            <!-- FIM DA COLUNA DA FOTO -->
                            
                            <div>
                                <div class="form-group"><label>Nome Completo:</label><input type="text" name="nome_completo" required value="${ficha ? (ficha.nome_completo || '') : ''}" ${isReadOnly ? 'readonly' : ''}></div>
                                <div class="form-group"><label>Data Nascimento:</label><input type="date" name="data_nascimento" required value="${ficha ? (ficha.data_nascimento ? new Date(ficha.data_nascimento).toISOString().split('T')[0] : '') : ''}" ${isReadOnly ? 'readonly' : ''}></div>
                                <div class="form-group"><label>NIF:</label><input type="text" name="nif" value="${ficha ? (ficha.nif || '') : ''}" ${isReadOnly ? 'readonly' : ''}></div>
                                <div class="form-group"><label>Morada:</label><textarea name="morada" ${isReadOnly ? 'readonly' : ''}>${ficha ? (ficha.morada || '') : ''}</textarea></div>
                                <div class="form-group"><label>Telefone:</label><input type="text" name="telefone" value="${ficha ? (ficha.telefone || '') : ''}" ${isReadOnly ? 'readonly' : ''}></div>
                                <div class="form-group"><label>Email:</label><input type="email" name="email" value="${ficha ? (ficha.email || '') : ''}" ${isReadOnly ? 'readonly' : ''}></div>
                                <div class="form-group">
                                    <label>Curso Pretendido:</label>
                                    <select name="curso_id" ${isReadOnly ? 'disabled' : ''}>
                                        <option value="">Selecione...</option>
                                        ${cursos.map(c => `<option value="${c._id}" ${ficha && ficha.curso_id && ficha.curso_id.toString() === c._id.toString() ? 'selected' : ''}>${c.nome}</option>`).join('')}
                                    </select>
                                    ${isReadOnly && ficha && ficha.curso_id ? `<input type="hidden" name="curso_id" value="${ficha.curso_id}">` : ''}
                                </div>
                                ${(!ficha || ficha.estado === 'rascunho' || ficha.estado === 'rejeitada') ? `
                                    <div style="display:flex;gap:10px;margin-top:20px">
                                        <button type="submit" name="acao" value="rascunho" class="btn" style="flex:1">💾 Guardar Rascunho</button>
                                        <button type="submit" name="acao" value="submeter" class="btn" style="flex:1;background:#28a745">📤 Submeter para Validação</button>
                                    </div>
                                ` : ficha && ficha.estado === 'submetida' ? 
                                    `<p style="text-align:center;padding:20px;background:#e3f2fd;border-radius:10px">⏳ Ficha submetida. Aguarde validação do gestor.</p>` :
                                ficha && ficha.estado === 'aprovada' ?
                                    `<p style="text-align:center;padding:20px;background:#d4edda;border-radius:10px">✅ Ficha aprovada! Pode pedir matrícula.</p>` : ''}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        <script>
            function previewFoto(input) {
                if (input.files && input.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const preview = document.getElementById('fotoPreview');
                        const placeholder = document.getElementById('fotoPlaceholder');
                        if (placeholder) placeholder.style.display = 'none';
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    }
                    reader.readAsDataURL(input.files[0]);
                }
            }
        </script>
    </body>
    </html>`;
}

module.exports = router;