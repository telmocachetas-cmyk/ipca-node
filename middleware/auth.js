function isAuthenticated(req, res, next) {
    if (req.session.login) {
        next();
    } else {
        res.redirect('/login');
    }
}

function isAdmin(req, res, next) {
    if (req.session.grupo === 'ADMIN') {
        next();
    } else {
        res.status(403).send('Acesso negado. Apenas administradores.');
    }
}

function isFuncionario(req, res, next) {
    if (req.session.grupo === 'FUNCIONARIO' || req.session.grupo === 'ADMIN') {
        next();
    } else {
        res.status(403).send('Acesso negado. Apenas funcionários.');
    }
}

function isAluno(req, res, next) {
    // Alunos têm acesso limitado
    if (req.session.grupo === 'ALUNO' || req.session.grupo === 'ADMIN' || req.session.grupo === 'FUNCIONARIO') {
        next();
    } else {
        res.status(403).send('Acesso negado.');
    }
}

module.exports = { isAuthenticated, isAdmin, isFuncionario, isAluno };