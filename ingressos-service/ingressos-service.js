const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = 8081;
const USUARIOS_SERVICE_URL = 'http://localhost:8080/usuarios';

const getISODateNow = () => new Date().toISOString();

const getISODateFuture = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
};

const getISODateEndOfDay = () => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
}

var db = new sqlite3.Database('./dados.db', (err) => {
    if (err) {
        console.log('ERRO: não foi possível conectar ao SQLite.');
        throw err;
    }
    console.log('Conectado ao SQLite (Ingressos)!');
});

db.run(`CREATE TABLE IF NOT EXISTS ingressos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email_usuario TEXT NOT NULL,
            tipo TEXT NOT NULL,
            data_criacao TEXT NOT NULL,
            data_validade TEXT,
            acessos_restantes INTEGER
        )`,
    [], (err) => {
        if (err) {
            console.log('ERRO: não foi possível criar tabela ingressos.');
            throw err;
        }
    });

app.post('/ingressos', async (req, res, next) => {
    const { email_usuario, tipo } = req.body;

    if (!email_usuario || !tipo) {
        return res.status(400).send('Email e Tipo são obrigatórios.');
    }

    try {
        await axios.get(`${USUARIOS_SERVICE_URL}/${email_usuario}`);
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.status(404).send('Usuário não encontrado no cadastro.');
        }
        return res.status(500).send('Erro ao verificar usuário: ' + error.message);
    }

    const agora = new Date();
    db.all(`SELECT * FROM ingressos WHERE email_usuario = ?`, [email_usuario], (err, ingressos) => {
        if (err) {
            return res.status(500).send('Erro ao verificar ingressos existentes.');
        }

        const ingressoAtivo = ingressos.find(ing => {
            if (ing.tipo === 'PREDETERMINADO') {
                return ing.acessos_restantes > 0;
            }
            if (ing.tipo === 'DIARIO' || ing.tipo === 'ANUAL') {
                return new Date(ing.data_validade) >= agora;
            }
            return false;
        });

        if (ingressoAtivo) {
            return res.status(409).send(`Usuário já possui um ingresso ativo (ID: ${ingressoAtivo.id}, Tipo: ${ingressoAtivo.tipo}).`);
        }

        const data_criacao = getISODateNow();
        let data_validade = null;
        let acessos_restantes = null;

        if (tipo === 'DIARIO') {
            data_validade = getISODateEndOfDay();
        } else if (tipo === 'ANUAL') {
            data_validade = getISODateFuture(365);
        } else if (tipo === 'PREDETERMINADO') {
            acessos_restantes = parseInt(req.body.acessos, 10);
            if (!acessos_restantes || acessos_restantes <= 0) {
                return res.status(400).send('Número de acessos é obrigatório para o tipo PREDETERMINADO.');
            }
        } else {
            return res.status(400).send('Tipo de ingresso inválido (DIARIO, ANUAL, PREDETERMINADO).');
        }

        const query = `INSERT INTO ingressos (email_usuario, tipo, data_criacao, data_validade, acessos_restantes)
                       VALUES (?, ?, ?, ?, ?)`;
        const params = [email_usuario, tipo, data_criacao, data_validade, acessos_restantes];

        db.run(query, params, function (err) {
            if (err) {
                res.status(500).send('Erro ao comprar ingresso.');
            } else {
                res.status(201).json({ message: 'Ingresso comprado com sucesso!', id: this.lastID });
            }
        });
    });
});

app.get('/ingressos/usuario/:email', (req, res, next) => {
    db.all(`SELECT * FROM ingressos WHERE email_usuario = ?`, [req.params.email], (err, result) => {
        if (err) {
            res.status(500).send('Erro ao obter dados.');
        } else {
            res.status(200).json(result);
        }
    });
});

app.post('/ingressos/usar', (req, res, next) => {
    const { email_usuario } = req.body;

    if (!email_usuario) {
        return res.status(400).send('Email do usuário é obrigatório.');
    }

    db.all(`SELECT * FROM ingressos WHERE email_usuario = ?`, [email_usuario], (err, ingressos) => {
        if (err) {
            return res.status(500).send('Erro ao verificar ingressos.');
        }
        if (!ingressos || ingressos.length === 0) {
            return res.status(404).send('Nenhum ingresso encontrado para este usuário.');
        }

        const agora = new Date();

        const ativo_predeterminado = ingressos.find(ing =>
            ing.tipo === 'PREDETERMINADO' && ing.acessos_restantes > 0
        );
        const ativo_diario = ingressos.find(ing =>
            ing.tipo === 'DIARIO' && new Date(ing.data_validade) >= agora
        );
        const ativo_anual = ingressos.find(ing =>
            ing.tipo === 'ANUAL' && new Date(ing.data_validade) >= agora
        );

        const ingresso_a_usar = ativo_predeterminado || ativo_diario || ativo_anual;

        if (!ingresso_a_usar) {
            return res.status(403).send('Acesso negado. Nenhum ingresso ativo encontrado.');
        }

        if (ingresso_a_usar.tipo === 'PREDETERMINADO') {
            const novosAcessos = ingresso_a_usar.acessos_restantes - 1;
            db.run(`UPDATE ingressos SET acessos_restantes = ? WHERE id = ?`, [novosAcessos, ingresso_a_usar.id], (updateErr) => {
                if (updateErr) {
                    return res.status(500).send('Erro ao atualizar ingresso.');
                }
                res.status(200).send(`Acesso permitido (PREDETERMINADO). Restam: ${novosAcessos} acessos.`);
            });
        } else {
            res.status(200).send(`Acesso permitido (${ingresso_a_usar.tipo}). Valido até: ${ingresso_a_usar.data_validade}`);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Serviço de ingressos em execução na porta: ${PORT}`);
});