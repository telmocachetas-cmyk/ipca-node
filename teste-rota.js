const express = require('express');
const app = express();

app.get('/teste', (req, res) => {
    res.send('Rota de teste funciona!');
});

app.listen(3002, () => console.log('Teste em http://localhost:3002/teste'));