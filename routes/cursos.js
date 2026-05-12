const express = require('express');
const { getDB } = require('../db');
const { ObjectId } = require('mongodb');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const router = express.Router();

// Listar cursos
router.get('/cursos', isAuthenticated, async (req, res) => {
    try {
        const db = getDB();
        const cursos = await db.collection('cursos')
            .find({})
            .sort({ nome: 1 })
            .toArray();
        
        // Para cada curso, contar disciplinas
        for (let curso of cursos) {
            curso.total_disciplinas = curso.disciplinas ? curso.disciplinas.length : 0;
        }
        
        let tableRows = '';
        for (let curso of cursos) {
            tableRows += `
                <tr>
                    <td>#${curso._id.toString().slice(-6)}</td>
                    <td><strong>${curso.nome}</strong></td>
                    <td><span class="badge">${curso.total_disciplinas} unidades</span></td>
                    ${req.session.grupo === 'ADMIN' ? `
                    <td>
                        <a href="/cursos/editar/${curso._id}" class="btn" style="background: #28a745; padding: 5px 10px;">✏️ Editar</a>
                        <a href="/cursos/eliminar/${curso._id}" class="btn" style="background: #dc3545; padding: 5px 10px;" onclick="return confirm('Tem a certeza?')">🗑️ Eliminar</a>
                    </td>
                    ` : ''}
                </tr>
            `;
        }
        
        res.send(generateHTML(tableRows, req.session.grupo === 'ADMIN'));
    } catch (error) {
        res.status(500).send('Erro ao listar cursos');
    }
});

// Criar curso (POST)
router.post('/cursos/criar', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { nome } = req.body;
        
        await db.collection('cursos').insertOne({
            nome,
            disciplinas: [],
            data_criacao: new Date()
        });
        
        res.redirect('/cursos');
    } catch (error) {
        res.status(500).send('Erro ao criar curso');
    }
});

// Eliminar curso
router.get('/cursos/eliminar/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const db = getDB();
        const { id } = req.params;
        
        await db.collection('cursos').deleteOne({ _id: new ObjectId(id) });
        res.redirect('/cursos');
    } catch (error) {
        res.status(500).send('Erro ao eliminar curso');
    }
});

function generateHTML(rows, isAdmin) {
    return `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <title>Cursos - IPCA</title>
        <link rel="stylesheet" href="/css/estilo.css">
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📚 Cursos</h1>
            </div>
            <div class="content">
                <div class="card">
                    <h2>Lista de Cursos</h2>
                    ${isAdmin ? `
                    <form method="POST" action="/cursos/criar" style="margin-bottom: 20px;">
                        <input type="text" name="nome" placeholder="Nome do novo curso" required>
                        <button type="submit" class="btn">➕ Adicionar Curso</button>
                    </form>
                    ` : ''}
                    <table class="table">
                        <thead>
                            <tr><th>ID</th><th>Nome</th><th>Disciplinas</th>${isAdmin ? '<th>Ações</th>' : ''}</tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>
    </body>
    </html>`;
}

module.exports = router;