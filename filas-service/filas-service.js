const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = 8083;
const ATRACOES_SERVICE_URL = 'http://localhost:8082/atracoes';

var db = new sqlite3.Database('./dados.db', (err) => {
    if (err) {
        console.log('ERRO: não foi possível conectar ao SQLite.');
        throw err;
    }
    console.log('Conectado ao SQLite (Filas)!');
});

db.run(`CREATE TABLE IF NOT EXISTS filas (
            atracao_id INTEGER PRIMARY KEY NOT NULL,
            quantidade INTEGER NOT NULL DEFAULT 0
        )`,
    [], (err) => {
        if (err) {
            console.log('ERRO: não foi possível criar tabela filas.');
            throw err;
        }
    });

const checkAttraction = async (id) => {
    try {
        const response = await axios.get(`${ATRACOES_SERVICE_URL}/${id}`);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        throw error;
    }
};

app.post('/filas/entrar', async (req, res, next) => {
    const { atracao_id } = req.body;
    if (!atracao_id) {
        return res.status(400).send('atracao_id é obrigatório.');
    }

    try {
        const atracao = await checkAttraction(atracao_id);
        if (!atracao) {
            return res.status(404).send('Atração não encontrada.');
        }
        if (atracao.status !== 'OPERANDO') {
            return res.status(403).send('Atração não está operando no momento.');
        }

        db.run(`INSERT INTO filas (atracao_id, quantidade) VALUES (?, 1)
                ON CONFLICT(atracao_id) DO UPDATE SET quantidade = quantidade + 1`,
            [atracao_id], function (err) {
                if (err) {
                    return res.status(500).send('Erro ao atualizar fila.');
                }
                db.get(`SELECT quantidade FROM filas WHERE atracao_id = ?`, [atracao_id], (err, row) => {
                    if (err) {
                         return res.status(500).send('Erro ao ler fila após entrada.');
                    }
                    res.status(200).json({ message: 'Entrada registrada.', nova_quantidade: row.quantidade });
                });
            });
    } catch (error) {
        res.status(500).send('Erro ao comunicar com serviço de atrações: ' + error.message);
    }
});

app.post('/filas/sair', (req, res, next) => {
    const { atracao_id } = req.body;
    if (!atracao_id) {
        return res.status(400).send('atracao_id é obrigatório.');
    }

    db.run(`UPDATE filas SET quantidade = MAX(0, quantidade - 1) WHERE atracao_id = ?`,
        [atracao_id], function (err) {
            if (err) {
                return res.status(500).send('Erro ao atualizar fila.');
            }
            
            db.get(`SELECT quantidade FROM filas WHERE atracao_id = ?`, [atracao_id], (err, row) => {
                 if (err) {
                     return res.status(500).send('Erro ao ler fila após saída.');
                 }
                 res.status(200).json({ message: 'Saída registrada.', nova_quantidade: row ? row.quantidade : 0 });
            });
        });
});

app.get('/filas', (req, res, next) => {
    db.all(`SELECT * FROM filas`, [], (err, result) => {
        if (err) {
            res.status(500).send('Erro ao obter dados.');
        } else {
            res.status(200).json(result);
        }
    });
});

app.get('/filas/:atracao_id', async (req, res, next) => {
    const atracao_id = req.params.atracao_id;
    try {
        const atracao = await checkAttraction(atracao_id);
        if (!atracao) {
            return res.status(404).send('Atração não encontrada.');
        }
        
        db.get(`SELECT quantidade FROM filas WHERE atracao_id = ?`, [atracao_id], (err, row) => {
            if (err) {
                return res.status(500).send('Erro ao obter dados da fila.');
            }
            
            const quantidade = (row) ? row.quantidade : 0;
            res.status(200).json({ atracao_id: parseInt(atracao_id, 10), quantidade: quantidade });
        });
        
    } catch (error) {
        res.status(500).send('Erro ao comunicar com serviço de atrações: ' + error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Serviço de filas em execução na porta: ${PORT}`);
});