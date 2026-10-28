
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
            fs.unlink(req.file.path, () => {});

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


app.listen(PORTA, () => {
    console.log(`Servidor iniciado em http://localhost:${PORTA}`);
});
