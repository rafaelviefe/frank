const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = 8084;
const ATRACOES_SERVICE_URL = 'http://localhost:8082/atracoes';
const FILAS_SERVICE_URL = 'http://localhost:8083/filas';

app.get('/estimativa/:atracao_id', async (req, res, next) => {
    const { atracao_id } = req.params;

    try {
        const atracaoPromise = axios.get(`${ATRACOES_SERVICE_URL}/${atracao_id}`);
        const filaPromise = axios.get(`${FILAS_SERVICE_URL}/${atracao_id}`);

        const [atracaoResponse, filaResponse] = await Promise.all([atracaoPromise, filaPromise]);

        const atracao = atracaoResponse.data;
        const fila = filaResponse.data;

        if (atracao.status !== 'OPERANDO') {
            return res.status(200).json({
                atracao_id: atracao.id,
                nome: atracao.nome,
                status: atracao.status,
                tempo_estimado_minutos: null,
                mensagem: "Atração não está em operação."
            });
        }

        const { quantidade } = fila;
        const { capacidade_minuto } = atracao;

        let tempo_estimado = 0;
        if (quantidade > 0 && capacidade_minuto > 0) {
            tempo_estimado = Math.ceil(quantidade / capacidade_minuto);
        }

        res.status(200).json({
            atracao_id: atracao.id,
            nome: atracao.nome,
            status: atracao.status,
            quantidade_fila: quantidade,
            tempo_estimado_minutos: tempo_estimado
        });

    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.status(404).send('Atração ou fila não encontrada.');
        }
        console.log(error.message);
        return res.status(500).send('Erro ao comunicar com outros serviços.');
    }
});

app.listen(PORT, () => {
    console.log(`Serviço de estimativa em execução na porta: ${PORT}`);
});