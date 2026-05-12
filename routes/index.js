const express = require('express');
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');
const router = express.Router();

// Página principal
router.get('/', async (req, res) => {
    if (!req.session.login) {
        return res.redirect('/login');
    }
    
    try {
        const db = getDB();
        
        // Estatísticas
        const total_cursos = await db.collection('cursos').countDocuments();
        const total_disciplinas = await db.collection('disciplinas').countDocuments();
        const total_utilizadores = await db.collection('users').countDocuments();
        
        // Determinar dashboard link
        let dashboard_link = '#';
        if (req.session.grupo === 'ADMIN') {
            dashboard_link = '/admin/dashboard';
        } else if (req.session.grupo === 'FUNCIONARIO') {
            dashboard_link = '/funcionario/dashboard';
        } else {
            dashboard_link = '/aluno/dashboard';
        }
        
        // Buscar cursos para mostrar (últimos 3)
        const cursos = await db.collection('cursos')
            .find({})
            .limit(3)
            .toArray();
        
        res.send(`
            <!DOCTYPE html>
            <html lang="pt">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Bem-vindo - IPCA</title>
                <link rel="stylesheet" href="/css/estilo.css">
                <style>
                    .dashboard-cards {
                        display: flex !important;
                        flex-direction: row !important;
                        gap: 20px !important;
                        margin-bottom: 30px !important;
                        flex-wrap: wrap !important;
                    }
                    .dashboard-card {
                        flex: 1 !important;
                        min-width: 250px !important;
                        background: white !important;
                        border-radius: 15px !important;
                        padding: 25px !important;
                        box-shadow: 0 5px 15px rgba(0,0,0,0.1) !important;
                        text-align: center !important;
                    }
                    .card-number {
                        font-size: 3.5em !important;
                        font-weight: bold !important;
                        color: #667eea !important;
                    }
                    .card-button {
                        display: inline-block !important;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                        color: white !important;
                        text-decoration: none !important;
                        padding: 10px 25px !important;
                        border-radius: 25px !important;
                        margin-top: 10px !important;
                    }
                    .welcome-banner {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 30px;
                        border-radius: 15px;
                        margin-bottom: 30px;
                        text-align: center;
                    }
                    .btn-dashboard {
                        display: inline-block;
                        background: white;
                        color: #667eea;
                        text-decoration: none;
                        padding: 12px 30px;
                        border-radius: 50px;
                        font-weight: bold;
                    }
                    .indisponivel {
                        background: #6c757d !important;
                        cursor: not-allowed;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h1>🎓 IPCA - Sistema de Gestão Académica</h1>
                                <p>Bem-vindo, <strong>${req.session.login}</strong>! (${req.session.grupo})</p>
                            </div>
                            <div class="menu-perfil">
                                <span class="profile-badge">${req.session.grupo}</span>
                                <div class="menu-perfil-content">
                                    <a href="/">🏠 Página Inicial</a>
                                    <a href="/perfil">👤 Meu Perfil</a>
                                    <a href="/logout">🚪 Logout</a>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="content">
                        <div class="welcome-banner">
                            <h2>👋 Olá, ${req.session.login}!</h2>
                            <p>Bem-vindo ao Sistema de Gestão Académica do IPCA.</p>
                            <a href="${dashboard_link}" class="btn-dashboard">Aceder ao Dashboard →</a>
                        </div>
                        
                        <h2 style="margin-bottom: 20px;">📊 Estatísticas Gerais</h2>
                        <div class="dashboard-cards">
                            <div class="dashboard-card">
                                <div class="card-number">${total_cursos}</div>
                                <div class="card-label">Cursos</div>
                                <a href="/cursos" class="card-button">Ver Cursos</a>
                            </div>
                            <div class="dashboard-card">
                                <div class="card-number">${total_disciplinas}</div>
                                <div class="card-label">Unidades Curriculares</div>
                                <a href="/disciplinas" class="card-button">Ver Unidades Curriculares</a>
                            </div>
                            <div class="dashboard-card">
                                <div class="card-number">⏰</div>
                                <div class="card-label">Horários</div>
                                <span class="card-button indisponivel">Indisponível</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>&copy; 2026 IPCA - Sistema de Gestão Académica</p>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao carregar página');
    }
});

module.exports = router;