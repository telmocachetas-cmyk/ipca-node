const express = require('express');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Redirecionar para o perfil correto baseado no grupo do utilizador
router.get('/perfil', isAuthenticated, (req, res) => {
    const grupo = req.session.grupo;
    
    if (grupo === 'ADMIN') {
        return res.redirect('/admin/perfil');
    } else if (grupo === 'FUNCIONARIO') {
        return res.redirect('/funcionario/perfil');
    } else if (grupo === 'ALUNO') {
        return res.redirect('/aluno/perfil');
    }
    
    // Fallback
    res.redirect('/');
});

module.exports = router;