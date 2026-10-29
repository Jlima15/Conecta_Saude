
require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const conexao = require('./database');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();

const PORTA = 3000;

const pastaFotos = path.join(__dirname, 'uploads', 'perfis');

fs.mkdirSync(pastaFotos, { recursive: true });

app.use('/uploads', express.static(
    path.join(__dirname, 'uploads')
));

const armazenamentoFotos = multer.diskStorage({
    destination: (req, arquivo, callback) => {
        callback(null, pastaFotos);
    },

    filename: (req, arquivo, callback) => {
        const extensao = arquivo.mimetype === 'image/png'
            ? '.png'
            : '.jpg';

        const nomeArquivo =
            `perfil_${req.session.usuario.id}_${Date.now()}${extensao}`;

        callback(null, nomeArquivo);
    }
});

const uploadFoto = multer({
    storage: armazenamentoFotos,

    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    },

    fileFilter: (req, arquivo, callback) => {
        const extensao = path.extname(arquivo.originalname).toLowerCase();

        const extensoesPermitidas = ['.jpg', '.jpeg', '.png'];
        const tiposPermitidos = ['image/jpeg', 'image/png'];

        if (
            extensoesPermitidas.includes(extensao) &&
            tiposPermitidos.includes(arquivo.mimetype)
        ) {
            return callback(null, true);
        }

        callback(new Error('Envie uma imagem JPG ou PNG válida.'));
    }
});


app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000 * 60 * 60
    }
}));

app.use(cors({
    origin: 'http://127.0.0.1:5500',
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));
app.use(express.urlencoded({ extended: true }));

app.get('/teste-banco', async (req, res) => {
    try {
        const [resultado] = await conexao.query(
            'SELECT DATABASE() AS banco'
        );

        res.json({
            mensagem: 'Conexão com o banco funcionando!',
            banco: resultado[0].banco
        });
    } catch (erro) {
        console.error('Erro ao consultar o banco:', erro.message);

        res.status(500).json({
            mensagem: 'Não foi possível consultar o banco de dados.'
        });
    }
});

app.post('/cadastro', async (req, res) => {
    try {
        const { nome, idade, email, senha } = req.body;

        if (!nome || !idade || !email || !senha) {
            return res.status(400).json({
                mensagem: 'Preencha todos os campos.'
            });
        }

        const idadeNumero = Number(idade);

        if (!Number.isInteger(idadeNumero) || idadeNumero < 1 || idadeNumero > 120) {
            return res.status(400).json({
                mensagem: 'Informe uma idade válida.'
            });
        }

        if (senha.length < 8) {
            return res.status(400).json({
                mensagem: 'A senha deve ter pelo menos 8 caracteres.'
            });
        }

        const nomeUsuario = nome
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '')
            .slice(0, 50);

        if (!nomeUsuario) {
            return res.status(400).json({
                mensagem: 'Não foi possível gerar seu nome de usuário.'
            });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        await conexao.execute(
            `INSERT INTO usuarios
            (nome, idade, nome_usuario, email, senha_hash)
            VALUES (?, ?, ?, ?, ?)`,
            [nome.trim(), idadeNumero, nomeUsuario, email.trim().toLowerCase(), senhaHash]
        );

        return res.status(201).json({
            mensagem: 'Cadastro realizado com sucesso!'
        });

    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                mensagem: 'Este e-mail ou nome de usuário já está cadastrado.'
            });
        }

        console.error('Erro no cadastro:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao realizar o cadastro.'
        });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                mensagem: 'Informe o e-mail e a senha.'
            });
        }

        const [usuarios] = await conexao.execute(
            'SELECT id_usuario, nome, nome_usuario, email, senha_hash FROM usuarios WHERE email = ?',
            [email.trim().toLowerCase()]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensagem: 'E-mail ou senha incorretos.'
            });
        }

        const usuario = usuarios[0];
        const senhaCorreta = await bcrypt.compare(
            senha,
            usuario.senha_hash
        );

        if (!senhaCorreta) {
            return res.status(401).json({
                mensagem: 'E-mail ou senha incorretos.'
            });
        }

        req.session.usuario = {
            id: usuario.id_usuario,
            nome: usuario.nome,
            nomeUsuario: usuario.nome_usuario,
            email: usuario.email
        };

        return res.json({
            mensagem: 'Login realizado com sucesso!'
        });

    } catch (erro) {
        console.error('Erro no login:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao realizar o login.'
        });
    }
});

app.get('/sessao', (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({
            autenticado: false
        });
    }

    return res.json({
        autenticado: true,
        usuario: req.session.usuario
    });
});


app.get('/atividades', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idUsuario = req.session.usuario.id;

        const [atividades] = await conexao.execute(
            `SELECT
                a.id_atividade,
                a.id_usuario,
                a.titulo,
                a.descricao,
                a.tipo,
                a.local,
                a.data,
                a.horario,
                a.nivel,
                a.vagas,
                u.nome,
                u.nome_usuario,
                (a.id_usuario = ?) AS usuario_proprietario,

                (SELECT COUNT(*)
                 FROM Curtida c
                 WHERE c.id_atividade = a.id_atividade
                ) AS total_curtidas,

                (SELECT COUNT(*)
                 FROM Comentario co
                 WHERE co.id_atividade = a.id_atividade
                ) AS total_comentarios,

                (SELECT COUNT(*)
                 FROM Inscricao i
                 WHERE i.id_atividade = a.id_atividade
                   AND TRIM(i.status_inscricao) = 'ATIVA'
                ) AS total_inscritos,

                EXISTS (
                    SELECT 1
                    FROM Curtida c
                    WHERE c.id_atividade = a.id_atividade
                      AND c.id_usuario = ?
                ) AS usuario_curtiu,

                EXISTS (
                    SELECT 1
                    FROM Inscricao i
                    WHERE i.id_atividade = a.id_atividade
                      AND i.id_usuario = ?
                      AND TRIM(i.status_inscricao) = 'ATIVA'
                ) AS usuario_inscrito

             FROM Atividade a
             INNER JOIN Usuarios u
                ON u.id_usuario = a.id_usuario

             ORDER BY a.data ASC, a.horario ASC`,
            [idUsuario, idUsuario, idUsuario]
        );

        return res.json(atividades);

    } catch (erro) {
        console.error('Erro ao listar atividades:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao carregar as atividades.'
        });
    }
});


app.get('/meu-perfil', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idUsuario = req.session.usuario.id;

        const [usuarios] = await conexao.execute(
            `SELECT nome, nome_usuario, biografia, nivel_atividade,
            perfil_privado, foto
            FROM usuarios
            WHERE id_usuario = ?`,
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensagem: 'Usuário não encontrado.'
            });
        }

        const [atividades] = await conexao.execute(
            `SELECT atividade
             FROM usuario_atividades
             WHERE id_usuario = ?`,
            [idUsuario]
        );

        return res.json({
            ...usuarios[0],
            atividades: atividades.map(item => item.atividade)
        });

    } catch (erro) {
        console.error('Erro ao buscar perfil:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao carregar o perfil.'
        });
    }
});



app.post('/logout', (req, res) => {
    req.session.destroy((erro) => {
        if (erro) {
            console.error('Erro ao encerrar sessão:', erro.message);

            return res.status(500).json({
                mensagem: 'Não foi possível sair da conta.'
            });
        }

        res.clearCookie('connect.sid');

        return res.json({
            mensagem: 'Você saiu da sua conta.'
        });
    });
});



app.put('/meu-perfil', async (req, res) => {
    let conexaoAtual;

    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const {
            nome,
            nome_usuario,
            biografia,
            atividades,
            outra_atividade,
            nivel_atividade,
            perfil_privado
        } = req.body;

        // Verifica nome e nome de usuário
        if (
            typeof nome !== 'string' ||
            !nome.trim() ||
            typeof nome_usuario !== 'string' ||
            !nome_usuario.trim()
        ) {
            return res.status(400).json({
                mensagem: 'Nome e nome de usuário são obrigatórios.'
            });
        }

        const nomeFinal = nome.trim();
        const usuarioFinal = nome_usuario.trim().replace(/^@/, '');
        const bioFinal = typeof biografia === 'string'
            ? biografia.trim()
            : '';

        if (nomeFinal.length > 100 || usuarioFinal.length > 50) {
            return res.status(400).json({
                mensagem: 'O nome ou nome de usuário é muito longo.'
            });
        }

        if (bioFinal.length > 500) {
            return res.status(400).json({
                mensagem: 'A biografia deve ter no máximo 500 caracteres.'
            });
        }

        if (!/^[a-zA-Z0-9_.]+$/.test(usuarioFinal)) {
            return res.status(400).json({
                mensagem: 'O nome de usuário só pode conter letras, números, ponto e underline.'
            });
        }

        // Lista dos níveis permitidos
        const niveisValidos = [
            'iniciante',
            'intermediario',
            'avancado'
        ];

        if (!niveisValidos.includes(nivel_atividade)) {
            return res.status(400).json({
                mensagem: 'Selecione um nível de atividade válido.'
            });
        }

        // Verifica a privacidade
        if (![0, 1, false, true].includes(perfil_privado)) {
            return res.status(400).json({
                mensagem: 'Selecione uma opção de privacidade válida.'
            });
        }

        // Lista das atividades fixas permitidas
        const atividadesValidas = [
            'corrida',
            'caminhada',
            'ciclismo',
            'academia',
            'outros'
        ];

        if (
            !Array.isArray(atividades) ||
            !atividades.every(
                atividade => atividadesValidas.includes(atividade)
            )
        ) {
            return res.status(400).json({
                mensagem: 'Confira as atividades selecionadas.'
            });
        }

        // Verifica a atividade personalizada
        const outraAtividade = typeof outra_atividade === 'string'
            ? outra_atividade.trim()
            : '';

        if (outraAtividade.length > 50) {
            return res.status(400).json({
                mensagem: 'A atividade personalizada deve ter no máximo 50 caracteres.'
            });
        }

        if (outraAtividade && !atividades.includes('outros')) {
            return res.status(400).json({
                mensagem: 'Marque "Outros" para informar outra atividade.'
            });
        }

        // Obtém uma conexão e inicia a transação
        conexaoAtual = await conexao.getConnection();
        await conexaoAtual.beginTransaction();

        // Atualiza os dados do usuário
        await conexaoAtual.execute(
            `UPDATE usuarios
             SET nome = ?, nome_usuario = ?, biografia = ?,
                 nivel_atividade = ?, perfil_privado = ?
             WHERE id_usuario = ?`,
            [
                nomeFinal,
                usuarioFinal,
                bioFinal || null,
                nivel_atividade,
                Number(perfil_privado),
                req.session.usuario.id
            ]
        );

        // Remove as atividades antigas para salvar as atuais
        await conexaoAtual.execute(
            `DELETE FROM usuario_atividades
             WHERE id_usuario = ?`,
            [req.session.usuario.id]
        );

        const atividadesParaSalvar = [...new Set(atividades)];

        // Adiciona o texto personalizado, se foi preenchido
        if (atividadesParaSalvar.includes('outros') && outraAtividade) {
            atividadesParaSalvar.push(outraAtividade);
        }

        // Salva as atividades selecionadas
        for (const atividade of atividadesParaSalvar) {
            await conexaoAtual.execute(
                `INSERT INTO usuario_atividades
                 (id_usuario, atividade)
                 VALUES (?, ?)`,
                [req.session.usuario.id, atividade]
            );
        }

        await conexaoAtual.commit();

        // Atualiza os dados da sessão
        req.session.usuario.nome = nomeFinal;
        req.session.usuario.nomeUsuario = usuarioFinal;

        return res.json({
            mensagem: 'Perfil atualizado com sucesso!'
        });

    } catch (erro) {
        if (conexaoAtual) {
            await conexaoAtual.rollback();
        }

        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                mensagem: 'Esse nome de usuário já está em uso.'
            });
        }

        console.error('Erro ao atualizar perfil:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao atualizar o perfil.'
        });

    } finally {
        if (conexaoAtual) {
            conexaoAtual.release();
        }
    }
});


app.post('/meu-perfil/foto', (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({
            mensagem: 'Você precisa fazer login.'
        });
    }

    uploadFoto.single('foto')(req, res, async (erroUpload) => {
        if (erroUpload) {
            if (erroUpload instanceof multer.MulterError) {
                const mensagem = erroUpload.code === 'LIMIT_FILE_SIZE'
                    ? 'A foto deve ter no máximo 5 MB.'
                    : 'Não foi possível enviar a foto.';

                return res.status(400).json({ mensagem });
            }

            return res.status(400).json({
                mensagem: erroUpload.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                mensagem: 'Selecione uma foto para enviar.'
            });
        }

        try {
            const caminhoFoto = `uploads/perfis/${req.file.filename}`;

            await conexao.execute(
                'UPDATE usuarios SET foto = ? WHERE id_usuario = ?',
                [caminhoFoto, req.session.usuario.id]
            );

            return res.json({
                mensagem: 'Foto de perfil atualizada com sucesso!',
                foto: caminhoFoto
            });
        } catch (erro) {
            fs.unlink(req.file.path, () => { });

            console.error('Erro ao salvar foto de perfil:', erro.message);

            return res.status(500).json({
                mensagem: 'Erro ao salvar a foto de perfil.'
            });
        }
    });
});


app.post('/atividades', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const {
            titulo,
            descricao,
            tipo,
            local,
            data,
            horario,
            nivel,
            vagas,
            idade_minima,
            idade_maxima
        } = req.body;

        if (
            !titulo?.trim() ||
            !descricao?.trim() ||
            !tipo?.trim() ||
            !local?.trim() ||
            !data ||
            !horario ||
            !nivel ||
            !Number.isInteger(vagas) ||
            vagas < 1
        ) {
            return res.status(400).json({
                mensagem: 'Preencha todos os campos corretamente.'
            });
        }

        // Validação da faixa etária
        if (
            !Number.isInteger(idade_minima) ||
            !Number.isInteger(idade_maxima) ||
            idade_minima < 0 ||
            idade_maxima > 120 ||
            idade_minima > idade_maxima
        ) {
            return res.status(400).json({
                mensagem: 'Informe uma faixa etária válida.'
            });
        }

        const niveisValidos = [
            'Iniciante',
            'Intermediário',
            'Avançado'
        ];

        if (!niveisValidos.includes(nivel)) {
            return res.status(400).json({
                mensagem: 'Selecione um nível de atividade válido.'
            });
        }

        const tiposValidos = [
            'corrida',
            'caminhada',
            'ciclismo',
            'academia',
            'futebol',
            'outro'
        ];

        if (!tiposValidos.includes(tipo)) {
            return res.status(400).json({
                mensagem: 'Selecione um tipo de atividade válido.'
            });
        }

        const [resultado] = await conexao.execute(
            `INSERT INTO Atividade
                (id_usuario, titulo, descricao, tipo, local,
                 data, horario, nivel, vagas,
                 idade_minima, idade_maxima)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.usuario.id,
                titulo.trim(),
                descricao.trim(),
                tipo,
                local.trim(),
                data,
                horario,
                nivel,
                vagas,
                idade_minima,
                idade_maxima
            ]
        );

        return res.status(201).json({
            mensagem: 'Atividade publicada com sucesso!',
            id_atividade: resultado.insertId
        });

    } catch (erro) {
        console.error('Erro ao publicar atividade:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao salvar a atividade no banco de dados.'
        });
    }
});



app.post('/atividades/:id/curtir', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idAtividade = Number(req.params.id);
        const idUsuario = req.session.usuario.id;

        if (!Number.isInteger(idAtividade) || idAtividade < 1) {
            return res.status(400).json({
                mensagem: 'Atividade inválida.'
            });
        }

        // Verifica se a atividade existe.
        const [atividades] = await conexao.execute(
            'SELECT id_atividade FROM Atividade WHERE id_atividade = ?',
            [idAtividade]
        );

        if (atividades.length === 0) {
            return res.status(404).json({
                mensagem: 'Atividade não encontrada.'
            });
        }

        // Verifica se o usuário já curtiu.
        const [curtidas] = await conexao.execute(
            `SELECT id_curtida
             FROM Curtida
             WHERE id_usuario = ? AND id_atividade = ?`,
            [idUsuario, idAtividade]
        );

        let curtiu;

        if (curtidas.length > 0) {
            // Já curtiu: remove a curtida.
            await conexao.execute(
                `DELETE FROM Curtida
                 WHERE id_usuario = ? AND id_atividade = ?`,
                [idUsuario, idAtividade]
            );

            curtiu = false;
        } else {
            // Ainda não curtiu: registra a curtida.
            await conexao.execute(
                `INSERT INTO Curtida (id_usuario, id_atividade)
                 VALUES (?, ?)`,
                [idUsuario, idAtividade]
            );

            curtiu = true;
        }

        // Busca a contagem atualizada.
        const [resultado] = await conexao.execute(
            `SELECT COUNT(*) AS total_curtidas
             FROM Curtida
             WHERE id_atividade = ?`,
            [idAtividade]
        );

        return res.json({
            mensagem: curtiu
                ? 'Curtida registrada!'
                : 'Curtida removida!',
            curtiu,
            total_curtidas: resultado[0].total_curtidas
        });

    } catch (erro) {
        console.error('Erro ao curtir atividade:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao processar a curtida.'
        });
    }
});


app.get('/atividades/:id/comentarios', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idAtividade = Number(req.params.id);

        if (!Number.isInteger(idAtividade) || idAtividade < 1) {
            return res.status(400).json({
                mensagem: 'Atividade inválida.'
            });
        }

        const [comentarios] = await conexao.execute(
            `SELECT
                c.id_comentario,
                c.texto,
                c.data_comentario,
                u.nome,
                u.nome_usuario
             FROM Comentario c
             INNER JOIN Usuarios u
                ON u.id_usuario = c.id_usuario
             WHERE c.id_atividade = ?
             ORDER BY c.data_comentario ASC`,
            [idAtividade]
        );

        return res.json(comentarios);

    } catch (erro) {
        console.error('Erro ao buscar comentários:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao carregar os comentários.'
        });
    }
});


app.post('/atividades/:id/comentarios', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idAtividade = Number(req.params.id);
        const idUsuario = req.session.usuario.id;
        const texto = req.body.texto?.trim();

        if (!Number.isInteger(idAtividade) || idAtividade < 1) {
            return res.status(400).json({
                mensagem: 'Atividade inválida.'
            });
        }

        if (!texto || texto.length > 1000) {
            return res.status(400).json({
                mensagem: 'O comentário deve ter entre 1 e 1000 caracteres.'
            });
        }

        const [atividades] = await conexao.execute(
            'SELECT id_atividade FROM Atividade WHERE id_atividade = ?',
            [idAtividade]
        );

        if (atividades.length === 0) {
            return res.status(404).json({
                mensagem: 'Atividade não encontrada.'
            });
        }

        const [resultado] = await conexao.execute(
            `INSERT INTO Comentario (id_usuario, id_atividade, texto)
             VALUES (?, ?, ?)`,
            [idUsuario, idAtividade, texto]
        );

        const [comentarios] = await conexao.execute(
            `SELECT
                c.id_comentario,
                c.texto,
                c.data_comentario,
                u.nome,
                u.nome_usuario
             FROM Comentario c
             INNER JOIN Usuarios u
                ON u.id_usuario = c.id_usuario
             WHERE c.id_comentario = ?`,
            [resultado.insertId]
        );

        return res.status(201).json(comentarios[0]);

    } catch (erro) {
        console.error('Erro ao publicar comentário:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao publicar o comentário.'
        });
    }
});


app.post('/atividades/:id/participar', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idAtividade = Number(req.params.id);
        const idUsuario = req.session.usuario.id;

        if (!Number.isInteger(idAtividade) || idAtividade < 1) {
            return res.status(400).json({
                mensagem: 'Atividade inválida.'
            });
        }

        // Busca a atividade e seu limite de vagas.
        const [atividades] = await conexao.execute(
            `SELECT id_atividade, vagas
             FROM Atividade
             WHERE id_atividade = ?`,
            [idAtividade]
        );

        if (atividades.length === 0) {
            return res.status(404).json({
                mensagem: 'Atividade não encontrada.'
            });
        }

        const [inscricoes] = await conexao.execute(
            `SELECT id_inscricao, status_inscricao
             FROM Inscricao
             WHERE id_usuario = ? AND id_atividade = ?`,
            [idUsuario, idAtividade]
        );

        const inscricao = inscricoes[0];

        // Se já está inscrito, cancela a inscrição.
        if (inscricao && inscricao.status_inscricao.trim() === 'ATIVA') {
            await conexao.execute(
                `UPDATE Inscricao
                 SET status_inscricao = 'CANCELADA'
                 WHERE id_inscricao = ?`,
                [inscricao.id_inscricao]
            );

            const [contagem] = await conexao.execute(
                `SELECT COUNT(*) AS total
                 FROM Inscricao
                 WHERE id_atividade = ?
                   AND TRIM(status_inscricao) = 'ATIVA'`,
                [idAtividade]
            );

            return res.json({
                mensagem: 'Inscrição cancelada.',
                inscrito: false,
                total_inscritos: contagem[0].total
            });
        }

        // Confere quantas pessoas estão inscritas atualmente.
        const [contagem] = await conexao.execute(
            `SELECT COUNT(*) AS total
             FROM Inscricao
             WHERE id_atividade = ?
               AND TRIM(status_inscricao) = 'ATIVA'`,
            [idAtividade]
        );

        if (Number(contagem[0].total) >= Number(atividades[0].vagas)) {
            return res.status(409).json({
                mensagem: 'Não há vagas disponíveis nesta atividade.'
            });
        }

        // Reativa uma inscrição cancelada ou cria uma nova.
        if (inscricao) {
            await conexao.execute(
                `UPDATE Inscricao
                 SET status_inscricao = 'ATIVA',
                     data_inscricao = CURRENT_TIMESTAMP
                 WHERE id_inscricao = ?`,
                [inscricao.id_inscricao]
            );
        } else {
            await conexao.execute(
                `INSERT INTO Inscricao
                    (id_usuario, id_atividade, status_inscricao)
                 VALUES (?, ?, 'ATIVA')`,
                [idUsuario, idAtividade]
            );
        }

        const [contagemAtualizada] = await conexao.execute(
            `SELECT COUNT(*) AS total
             FROM Inscricao
             WHERE id_atividade = ?
               AND TRIM(status_inscricao) = 'ATIVA'`,
            [idAtividade]
        );

        return res.json({
            mensagem: 'Inscrição realizada com sucesso!',
            inscrito: true,
            total_inscritos: contagemAtualizada[0].total
        });

    } catch (erro) {
        console.error('Erro ao processar inscrição:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao processar a inscrição.'
        });
    }
});


app.get('/meus-eventos', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idUsuario = req.session.usuario.id;

        const [eventos] = await conexao.execute(
            `SELECT
                a.id_atividade,
                a.titulo,
                a.descricao,
                a.tipo,
                a.local,
                a.data,
                a.horario,
                a.nivel,
                a.vagas,
                u.nome AS nome_organizador,
                (
                    SELECT COUNT(*)
                    FROM Inscricao i2
                    WHERE i2.id_atividade = a.id_atividade
                      AND TRIM(i2.status_inscricao) = 'ATIVA'
                ) AS total_inscritos
             FROM Inscricao i
             INNER JOIN Atividade a
                ON a.id_atividade = i.id_atividade
             INNER JOIN Usuarios u
                ON u.id_usuario = a.id_usuario
             WHERE i.id_usuario = ?
               AND TRIM(i.status_inscricao) = 'ATIVA'
             ORDER BY a.data ASC, a.horario ASC`,
            [idUsuario]
        );

        return res.json(eventos);

    } catch (erro) {
        console.error('Erro ao carregar meus eventos:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao carregar seus eventos.'
        });
    }
});


app.get('/buscar-atividades', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const pesquisa = (req.query.pesquisa || '').trim();
        const local = (req.query.local || '').trim();
        const data = (req.query.data || '').trim();
        const nivel = (req.query.nivel || '').trim();
        const idadeTexto = (req.query.idade || '').trim();

        let idade = null;

        if (idadeTexto !== '') {
            idade = Number(idadeTexto);

            if (
                !Number.isInteger(idade) ||
                idade < 0 ||
                idade > 120
            ) {
                return res.status(400).json({
                    mensagem: 'Informe uma idade entre 0 e 120 anos.'
                });
            }
        }

        const tiposValidos = [
            'corrida',
            'caminhada',
            'ciclismo',
            'academia',
            'futebol',
            'outro'
        ];

        const tipoInformado = (req.query.tipo || '').toLowerCase();

        const tipo = tiposValidos.includes(tipoInformado)
            ? tipoInformado
            : '';

        const nivelFormatado = {
            iniciante: 'Iniciante',
            intermediario: 'Intermediário',
            avancado: 'Avançado'
        }[nivel.toLowerCase()] || '';

        if (nivel && !nivelFormatado) {
            return res.status(400).json({
                mensagem: 'Nível inválido.'
            });
        }

        const filtros = [];
        const parametros = [];

        if (pesquisa) {
            filtros.push(
                '(a.titulo LIKE ? OR a.descricao LIKE ? OR a.tipo LIKE ?)'
            );

            const termo = `%${pesquisa}%`;
            parametros.push(termo, termo, termo);
        }

        if (tipo) {
            filtros.push('LOWER(a.tipo) = ?');
            parametros.push(tipo);
        }

        if (local) {
            filtros.push('a.local LIKE ?');
            parametros.push(`%${local}%`);
        }

        if (data) {
            filtros.push('a.data = ?');
            parametros.push(data);
        }

        if (nivelFormatado) {
            filtros.push('a.nivel = ?');
            parametros.push(nivelFormatado);
        }

        if (idade !== null) {
            filtros.push(
                'a.idade_minima <= ? AND a.idade_maxima >= ?'
            );

            parametros.push(idade, idade);
        }

        const where = filtros.length
            ? `WHERE ${filtros.join(' AND ')}`
            : '';

        const [atividades] = await conexao.execute(
            `SELECT
                a.id_atividade,
                a.titulo,
                a.descricao,
                a.tipo,
                a.local,
                a.data,
                a.horario,
                a.nivel,
                a.vagas,
                a.idade_minima,
                a.idade_maxima,
                u.nome AS nome_organizador,
                (
                    SELECT COUNT(*)
                    FROM Inscricao i
                    WHERE i.id_atividade = a.id_atividade
                      AND TRIM(i.status_inscricao) = 'ATIVA'
                ) AS total_inscritos
             FROM Atividade a
             INNER JOIN Usuarios u
                ON u.id_usuario = a.id_usuario
             ${where}
             ORDER BY a.data ASC, a.horario ASC`,
            parametros
        );

        return res.json(atividades);

    } catch (erro) {
        console.error('Erro ao buscar atividades:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao buscar atividades.'
        });
    }
});



app.delete('/atividades/:id', async (req, res) => {
    let conexaoAtual;

    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idAtividade = Number(req.params.id);
        const idUsuario = req.session.usuario.id;

        if (!Number.isInteger(idAtividade) || idAtividade < 1) {
            return res.status(400).json({
                mensagem: 'Atividade inválida.'
            });
        }

        conexaoAtual = await conexao.getConnection();
        await conexaoAtual.beginTransaction();

        // Confere se a atividade existe e quem é o autor.
        const [atividades] = await conexaoAtual.execute(
            `SELECT id_atividade, id_usuario
             FROM Atividade
             WHERE id_atividade = ?
             FOR UPDATE`,
            [idAtividade]
        );

        if (atividades.length === 0) {
            await conexaoAtual.rollback();

            return res.status(404).json({
                mensagem: 'Atividade não encontrada.'
            });
        }

        // Somente o autor pode excluir a própria publicação.
        if (Number(atividades[0].id_usuario) !== Number(idUsuario)) {
            await conexaoAtual.rollback();

            return res.status(403).json({
                mensagem: 'Você só pode excluir atividades que publicou.'
            });
        }

        // Remove os registros associados à atividade.
        await conexaoAtual.execute(
            'DELETE FROM Curtida WHERE id_atividade = ?',
            [idAtividade]
        );

        await conexaoAtual.execute(
            'DELETE FROM Comentario WHERE id_atividade = ?',
            [idAtividade]
        );

        await conexaoAtual.execute(
            'DELETE FROM Inscricao WHERE id_atividade = ?',
            [idAtividade]
        );

        // Remove a publicação.
        await conexaoAtual.execute(
            'DELETE FROM Atividade WHERE id_atividade = ?',
            [idAtividade]
        );

        await conexaoAtual.commit();

        return res.json({
            mensagem: 'Atividade excluída com sucesso!'
        });

    } catch (erro) {
        if (conexaoAtual) {
            await conexaoAtual.rollback();
        }

        console.error('Erro ao excluir atividade:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao excluir a atividade.'
        });

    } finally {
        if (conexaoAtual) {
            conexaoAtual.release();
        }
    }
});


app.post('/usuarios/:id/seguir', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idSeguidor = Number(req.session.usuario.id);
        const idSeguido = Number(req.params.id);

        if (!Number.isInteger(idSeguido) || idSeguido < 1) {
            return res.status(400).json({
                mensagem: 'Usuário inválido.'
            });
        }

        if (idSeguidor === idSeguido) {
            return res.status(400).json({
                mensagem: 'Você não pode seguir a si mesmo.'
            });
        }

        // Busca o usuário e verifica a privacidade do perfil.
        const [usuarios] = await conexao.execute(
            `SELECT id_usuario, perfil_privado
             FROM Usuarios
             WHERE id_usuario = ?`,
            [idSeguido]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensagem: 'Usuário não encontrado.'
            });
        }

        // Impede interações entre contas com bloqueio.
        const [bloqueios] = await conexao.execute(
            `SELECT id_bloqueio
             FROM Bloqueio
             WHERE (id_bloqueador = ? AND id_bloqueado = ?)
                OR (id_bloqueador = ? AND id_bloqueado = ?)
             LIMIT 1`,
            [idSeguidor, idSeguido, idSeguido, idSeguidor]
        );

        if (bloqueios.length > 0) {
            return res.status(403).json({
                mensagem: 'Não é possível seguir este usuário.'
            });
        }

        // Verifica se já existe uma relação.
        const [relacoes] = await conexao.execute(
            `SELECT status
             FROM Seguir
             WHERE id_seguidor = ? AND id_seguido = ?`,
            [idSeguidor, idSeguido]
        );

        if (relacoes.length > 0) {
            const status = relacoes[0].status;

            return res.status(409).json({
                mensagem: status === 'PENDENTE'
                    ? 'Sua solicitação já está pendente.'
                    : 'Você já segue este usuário.',
                status
            });
        }

        // Perfil público aceita automaticamente.
        // Perfil privado exige aprovação.
        const status = Number(usuarios[0].perfil_privado) === 1
            ? 'PENDENTE'
            : 'ACEITO';

        await conexao.execute(
            `INSERT INTO Seguir
                (id_seguidor, id_seguido, status)
             VALUES (?, ?, ?)`,
            [idSeguidor, idSeguido, status]
        );

        return res.status(201).json({
            mensagem: status === 'PENDENTE'
                ? 'Solicitação de seguimento enviada!'
                : 'Agora você segue este usuário.',
            status
        });

    } catch (erro) {
        console.error('Erro ao seguir usuário:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao processar o seguimento.'
        });
    }
});


app.get('/solicitacoes-seguir', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idUsuario = req.session.usuario.id;

        const [solicitacoes] = await conexao.execute(
            `SELECT
                s.id_seguir,
                s.id_seguidor,
                s.status,
                u.nome,
                u.nome_usuario,
                u.foto
             FROM Seguir s
             INNER JOIN Usuarios u
                ON u.id_usuario = s.id_seguidor
             WHERE s.id_seguido = ?
               AND s.status = 'PENDENTE'
             ORDER BY s.id_seguir DESC`,
            [idUsuario]
        );

        return res.json(solicitacoes);

    } catch (erro) {
        console.error('Erro ao listar solicitações:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao carregar solicitações.'
        });
    }
});



app.put('/solicitacoes-seguir/:id/aceitar', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idDono = Number(req.session.usuario.id);
        const idSolicitacao = Number(req.params.id);

        if (!Number.isInteger(idSolicitacao) || idSolicitacao < 1) {
            return res.status(400).json({
                mensagem: 'Solicitação inválida.'
            });
        }

        const [resultado] = await conexao.execute(
            `UPDATE Seguir
             SET status = 'ACEITO'
             WHERE id_seguir = ?
               AND id_seguido = ?
               AND status = 'PENDENTE'
               AND NOT EXISTS (
                   SELECT 1
                   FROM Bloqueio b
                   WHERE
                       (b.id_bloqueador = Seguir.id_seguidor
                        AND b.id_bloqueado = Seguir.id_seguido)
                       OR
                       (b.id_bloqueador = Seguir.id_seguido
                        AND b.id_bloqueado = Seguir.id_seguidor)
               )`,
            [idSolicitacao, idDono]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: 'Solicitação não encontrada ou relação bloqueada.'
            });
        }

        return res.json({
            mensagem: 'Solicitação aceita!'
        });

    } catch (erro) {
        console.error('Erro ao aceitar solicitação:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao aceitar solicitação.'
        });
    }
});




app.delete('/solicitacoes-seguir/:id/recusar', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idDono = Number(req.session.usuario.id);
        const idSolicitacao = Number(req.params.id);

        if (!Number.isInteger(idSolicitacao) || idSolicitacao < 1) {
            return res.status(400).json({
                mensagem: 'Solicitação inválida.'
            });
        }

        const [resultado] = await conexao.execute(
            `DELETE FROM Seguir
             WHERE id_seguir = ?
               AND id_seguido = ?
               AND status = 'PENDENTE'`,
            [idSolicitacao, idDono]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: 'Solicitação pendente não encontrada.'
            });
        }

        return res.json({
            mensagem: 'Solicitação recusada.'
        });

    } catch (erro) {
        console.error('Erro ao recusar solicitação:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao recusar solicitação.'
        });
    }
});



app.get('/usuarios/:id/relacionamento', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idUsuario = Number(req.session.usuario.id);
        const idOutro = Number(req.params.id);

        if (!Number.isInteger(idOutro) || idOutro < 1) {
            return res.status(400).json({
                mensagem: 'Usuário inválido.'
            });
        }

        const [usuarios] = await conexao.execute(
            `SELECT id_usuario, perfil_privado
             FROM Usuarios
             WHERE id_usuario = ?`,
            [idOutro]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensagem: 'Usuário não encontrado.'
            });
        }

        const [bloqueios] = await conexao.execute(
            `SELECT id_bloqueio
             FROM Bloqueio
             WHERE (id_bloqueador = ? AND id_bloqueado = ?)
                OR (id_bloqueador = ? AND id_bloqueado = ?)
             LIMIT 1`,
            [idUsuario, idOutro, idOutro, idUsuario]
        );

        if (bloqueios.length > 0) {
            return res.json({
                bloqueado: true,
                segue: false,
                segue_voce: false,
                solicitacao_pendente: false,
                total_seguidores: 0,
                total_seguindo: 0
            });
        }

        const [relacoes] = await conexao.execute(
            `SELECT
                EXISTS (
                    SELECT 1
                    FROM Seguir
                    WHERE id_seguidor = ?
                      AND id_seguido = ?
                      AND status = 'ACEITO'
                ) AS segue,

                EXISTS (
                    SELECT 1
                    FROM Seguir
                    WHERE id_seguidor = ?
                      AND id_seguido = ?
                      AND status = 'ACEITO'
                ) AS segue_voce,

                EXISTS (
                    SELECT 1
                    FROM Seguir
                    WHERE id_seguidor = ?
                      AND id_seguido = ?
                      AND status = 'PENDENTE'
                ) AS solicitacao_pendente`,
            [
                idUsuario, idOutro,
                idOutro, idUsuario,
                idUsuario, idOutro
            ]
        );

        const [contagens] = await conexao.execute(
            `SELECT
                (
                    SELECT COUNT(*)
                    FROM Seguir
                    WHERE id_seguido = ?
                      AND status = 'ACEITO'
                ) AS total_seguidores,

                (
                    SELECT COUNT(*)
                    FROM Seguir
                    WHERE id_seguidor = ?
                      AND status = 'ACEITO'
                ) AS total_seguindo`,
            [idOutro, idOutro]
        );

        return res.json({
            bloqueado: false,
            perfil_privado: Boolean(usuarios[0].perfil_privado),
            ...relacoes[0],
            ...contagens[0]
        });

    } catch (erro) {
        console.error('Erro ao consultar relacionamento:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao consultar o relacionamento.'
        });
    }
});


app.get('/buscar-usuarios', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const pesquisa = (req.query.pesquisa || '').trim();

        if (pesquisa.length < 2) {
            return res.json([]);
        }

        const termo = `%${pesquisa}%`;

        const [usuarios] = await conexao.execute(
            `SELECT
                u.id_usuario,
                u.nome,
                u.nome_usuario,
                u.foto,
                u.perfil_privado
             FROM Usuarios u
             WHERE (u.nome LIKE ? OR u.nome_usuario LIKE ?)
               AND u.id_usuario <> ?
               AND NOT EXISTS (
                   SELECT 1
                   FROM Bloqueio b
                   WHERE
                       (b.id_bloqueador = ? AND b.id_bloqueado = u.id_usuario)
                       OR
                       (b.id_bloqueador = u.id_usuario AND b.id_bloqueado = ?)
               )
             ORDER BY u.nome
             LIMIT 30`,
            [
                termo,
                termo,
                req.session.usuario.id,
                req.session.usuario.id,
                req.session.usuario.id
            ]
        );

        return res.json(usuarios);

    } catch (erro) {
        console.error('Erro ao buscar usuários:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao buscar usuários.'
        });
    }
});


app.get('/usuarios/:id/perfil', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idVisitante = Number(req.session.usuario.id);
        const idPerfil = Number(req.params.id);

        if (!Number.isInteger(idPerfil) || idPerfil < 1) {
            return res.status(400).json({
                mensagem: 'Usuário inválido.'
            });
        }

        const [usuarios] = await conexao.execute(
            `SELECT
                id_usuario,
                nome,
                nome_usuario,
                biografia,
                nivel_atividade,
                perfil_privado,
                foto
             FROM Usuarios
             WHERE id_usuario = ?`,
            [idPerfil]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensagem: 'Usuário não encontrado.'
            });
        }

        const [bloqueios] = await conexao.execute(
            `SELECT id_bloqueio
             FROM Bloqueio
             WHERE (id_bloqueador = ? AND id_bloqueado = ?)
                OR (id_bloqueador = ? AND id_bloqueado = ?)
             LIMIT 1`,
            [idVisitante, idPerfil, idPerfil, idVisitante]
        );

        if (bloqueios.length > 0) {
            return res.status(403).json({
                mensagem: 'Não é possível visualizar este perfil.'
            });
        }

        const [relacoes] = await conexao.execute(
            `SELECT status
             FROM Seguir
             WHERE id_seguidor = ?
               AND id_seguido = ?
             LIMIT 1`,
            [idVisitante, idPerfil]
        );

        const segue = relacoes.some(
            relacao => relacao.status === 'ACEITO'
        );

        const perfilPrivado =
            Number(usuarios[0].perfil_privado) === 1;

        const podeVerDetalhes =
            idVisitante === idPerfil ||
            !perfilPrivado ||
            segue;

        const [contagens] = await conexao.execute(
            `SELECT
                (SELECT COUNT(*)
                 FROM Seguir
                 WHERE id_seguido = ?
                   AND status = 'ACEITO') AS total_seguidores,

                (SELECT COUNT(*)
                 FROM Seguir
                 WHERE id_seguidor = ?
                   AND status = 'ACEITO') AS total_seguindo`,
            [idPerfil, idPerfil]
        );

        let atividades = [];

        if (podeVerDetalhes) {
            const [resultadoAtividades] = await conexao.execute(
                `SELECT atividade
                 FROM usuario_atividades
                 WHERE id_usuario = ?`,
                [idPerfil]
            );

            atividades = resultadoAtividades.map(
                item => item.atividade
            );
        }

        return res.json({
            ...usuarios[0],
            pode_ver_detalhes: podeVerDetalhes,
            atividades,
            ...contagens[0]
        });

    } catch (erro) {
        console.error('Erro ao carregar perfil de usuário:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao carregar o perfil.'
        });
    }
});



app.delete('/usuarios/:id/deixar-de-seguir', async (req, res) => {
    

    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa estar conectado.'
            });
        }

        const idSeguidor = Number(req.session.usuario.id);
        const idSeguido = Number(req.params.id);

        if (
            !Number.isInteger(idSeguido) ||
            idSeguido <= 0 ||
            !Number.isInteger(idSeguidor) ||
            idSeguidor <= 0
        ) {
            return res.status(400).json({
                mensagem: 'Usuário inválido.'
            });
        }

        if (idSeguidor === idSeguido) {
            return res.status(400).json({
                mensagem: 'Você não pode deixar de seguir a si mesmo.'
            });
        }

        const sql = `
            DELETE FROM Seguir
            WHERE id_seguidor = ?
              AND id_seguido = ?
              AND status = 'ACEITO'
        `;

        

        const [resultado] = await conexao.execute(sql, [
            idSeguidor,
            idSeguido
        ]);

        

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensagem: 'Você não segue este usuário.'
            });
        }

        return res.json({
            mensagem: 'Você deixou de seguir este usuário.'
        });

    } catch (erro) {
        console.error('Erro ao deixar de seguir:', erro);

        return res.status(500).json({
            mensagem: 'Erro ao deixar de seguir este usuário.'
        });
    }
});



if (require.main === module) {
    app.listen(PORTA, () => {
        console.log(`Servidor iniciado em http://localhost:${PORTA}`);
    });
}

module.exports = app;