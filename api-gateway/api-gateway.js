const httpProxy = require('express-http-proxy');
const express = require('express');
const app = express();
var logger = require('morgan');

app.use(logger('dev'));

function selectProxyHost(req) {
    if (req.path.startsWith('/usuarios')) {
        return 'http://localhost:8080/';
    } else if (req.path.startsWith('/ingressos')) {
        return 'http://localhost:8081/';
    } else if (req.path.startsWith('/atracoes')) {
        return 'http://localhost:8082/';
    } else if (req.path.startsWith('/filas')) {
        return 'http://localhost:8083/';
    } else if (req.path.startsWith('/estimativa')) {
        return 'http://localhost:8084/';
    } else {
        return null;
    }
}

app.use((req, res, next) => {
    const proxyHost = selectProxyHost(req);
    
    if (proxyHost == null) {
        res.status(404).send('Recurso não encontrado.');
    } else {
        httpProxy(proxyHost)(req, res, next);
    }
});

const PORT = 8000;
app.listen(PORT, () => {
    console.log(`API Gateway em execução na porta: ${PORT}`);
});