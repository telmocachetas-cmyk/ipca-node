const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const { getDB } = require('../db');
const router = express.Router();

const publicPath = path.join(__dirname, '..', 'public');

// GET - mostrar página de login
router.get('/login', (req, res) => {
    if (req.session.login) {
        return res.redirect('/');
    }
    res.sendFile(path.join(publicPath, 'html', 'login.html'));
});

// POST - processar login
router.post('/login', async (req, res) => {
    console.log('Tentativa de login:', req.body); // LOG PARA DEBUG
    
    try {
        const { login, pwd } = req.body;
        
        if (!login || !pwd) {
            return res.redirect('/login?erro=' + encodeURIComponent('Preencha todos os campos'));
        }
        
        const db = getDB();
        const user = await db.collection('users').findOne({ login });
        
        console.log('Utilizador encontrado:', user ? user.login : 'não encontrado'); // LOG
        
        if (user) {
            const passwordMatch = await bcrypt.compare(pwd, user.pwd);
            console.log('Password match:', passwordMatch); // LOG
            
            if (passwordMatch) {
                req.session.login = user.login;
                req.session.grupo = user.grupo;
                req.session.user_id = user._id;
                console.log('Login bem sucedido! Redirecionando...');
                return res.redirect('/');
            }
        }
        
        res.redirect('/login?erro=' + encodeURIComponent('Login ou password incorretos!'));
        
    } catch (error) {
        console.error('Erro no login:', error);
        res.redirect('/login?erro=' + encodeURIComponent('Erro no servidor'));
    }
});

router.get('/registo', (req, res) => {
    if (req.session.login) {
        return res.redirect('/');
    }
    res.sendFile(path.join(publicPath, 'html', 'registo.html'));
});

router.post('/registo', async (req, res) => {
    try {
        const { login, pwd, confirm_pwd } = req.body;
        const db = getDB();
        
        if (!login || !pwd) return res.redirect('/registo?erro=' + encodeURIComponent('Todos os campos são obrigatórios'));
        if (pwd !== confirm_pwd) return res.redirect('/registo?erro=' + encodeURIComponent('As passwords não coincidem'));
        if (pwd.length < 4) return res.redirect('/registo?erro=' + encodeURIComponent('A password deve ter pelo menos 4 caracteres'));
        
        const existingUser = await db.collection('users').findOne({ login });
        if (existingUser) return res.redirect('/registo?erro=' + encodeURIComponent('Este login já está em uso'));
        
        const hashedPassword = await bcrypt.hash(pwd, 10);
        await db.collection('users').insertOne({
            login,
            pwd: hashedPassword,
            grupo: 'ALUNO',
            data_registo: new Date()
        });
        
        res.redirect('/registo?sucesso=' + encodeURIComponent('Conta criada com sucesso! Faça login.'));
        
    } catch (error) {
        res.redirect('/registo?erro=' + encodeURIComponent('Erro ao criar conta'));
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.sendFile(path.join(publicPath, 'html', 'logout.html'));
});

module.exports = router;