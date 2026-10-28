
const formulario = document.getElementById('formulario-editar-perfil');
const campoFoto = document.getElementById('foto');
const imagemFoto = document.getElementById('foto-editar');

const fotoPadrao = 'imagens/perfil.png';
let fotoTemporaria = null;

async function carregarDadosPerfil() {
    try {
        const resposta = await fetch('http://127.0.0.1:3000/meu-perfil', {
            credentials: 'include'
        });

        if (resposta.status === 401) {
            window.location.href = 'Login.html';
            return;
        }

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar o perfil.');
        }

        const usuario = await resposta.json();

        document.getElementById('nome').value = usuario.nome || '';
        document.getElementById('usuario').value = usuario.nome_usuario || '';
        document.getElementById('bio').value = usuario.biografia || '';

        // Carrega a foto já salva no perfil
        if (usuario.foto) {
            imagemFoto.src = `http://127.0.0.1:3000/${usuario.foto_perfil}`;
        } else {
            imagemFoto.src = fotoPadrao;
        }

        const nivel = usuario.nivel_atividade || 'iniciante';

        const radioNivel = document.querySelector(
            `input[name="nivel"][value="${nivel}"]`
        );

        if (radioNivel) {
            radioNivel.checked = true;
        }

        const privacidade = Number(usuario.perfil_privado) === 1
            ? 'privado'
            : 'publico';

        const radioPrivacidade = document.querySelector(
            `input[name="privacidade"][value="${privacidade}"]`
        );

        if (radioPrivacidade) {
            radioPrivacidade.checked = true;
        }

        const atividades = usuario.atividades || [];

        document.querySelectorAll('input[name="atividades"]').forEach(campo => {
            campo.checked = atividades.includes(campo.value);
        });

        const atividadesConhecidas = [
            'corrida',
            'caminhada',
            'ciclismo',
            'academia',
            'outros'
        ];

        const atividadePersonalizada = atividades.find(
            atividade => !atividadesConhecidas.includes(atividade)
        );

        document.getElementById('outra-atividade').value =
            atividadePersonalizada || '';

    } catch (erro) {
        console.error('Erro ao carregar perfil:', erro);
        alert('Não foi possível carregar os dados do perfil.');
    }
}

// Mostra uma prévia da foto selecionada
campoFoto.addEventListener('change', function () {
    const arquivo = campoFoto.files[0];

    if (!arquivo) {
        return;
    }

    const tiposPermitidos = ['image/jpeg', 'image/png'];

    if (!tiposPermitidos.includes(arquivo.type)) {
        alert('Selecione uma imagem JPG ou PNG.');
        campoFoto.value = '';
        return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5 MB.');
        campoFoto.value = '';
        return;
    }

    if (fotoTemporaria) {
        URL.revokeObjectURL(fotoTemporaria);
    }

    fotoTemporaria = URL.createObjectURL(arquivo);
    imagemFoto.src = fotoTemporaria;
});

formulario.addEventListener('submit', async function (evento) {
    evento.preventDefault();

    const nome = document.getElementById('nome').value;
    const nome_usuario = document.getElementById('usuario').value;
    const biografia = document.getElementById('bio').value;

    const nivelSelecionado = document.querySelector(
        'input[name="nivel"]:checked'
    );

    const privacidadeSelecionada = document.querySelector(
        'input[name="privacidade"]:checked'
    );

    if (!nivelSelecionado || !privacidadeSelecionada) {
        alert('Selecione seu nível de atividade e a privacidade do perfil.');
        return;
    }

    const atividades = Array.from(
        document.querySelectorAll('input[name="atividades"]:checked')
    ).map(campo => campo.value);

    const outra_atividade = document
        .getElementById('outra-atividade')
        .value
        .trim();

    const perfil_privado =
        privacidadeSelecionada.value === 'privado' ? 1 : 0;

    try {
        // Salva primeiro os dados textuais do perfil
        const resposta = await fetch('http://127.0.0.1:3000/meu-perfil', {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome,
                nome_usuario,
                biografia,
                nivel_atividade: nivelSelecionado.value,
                perfil_privado,
                atividades,
                outra_atividade
            })
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            alert(resultado.mensagem || 'Não foi possível salvar o perfil.');
            return;
        }

        // Se uma foto foi selecionada, envia separadamente
        if (campoFoto.files.length > 0) {
            const arquivo = campoFoto.files[0];

            const tiposPermitidos = ['image/jpeg', 'image/png'];

            if (!tiposPermitidos.includes(arquivo.type)) {
                alert('Selecione uma imagem JPG ou PNG.');
                return;
            }

            if (arquivo.size > 5 * 1024 * 1024) {
                alert('A imagem deve ter no máximo 5 MB.');
                return;
            }

            const dadosFoto = new FormData();
            dadosFoto.append('foto', arquivo);

            const respostaFoto = await fetch(
                'http://127.0.0.1:3000/meu-perfil/foto',
                {
                    method: 'POST',
                    credentials: 'include',
                    body: dadosFoto
                }
            );

            const resultadoFoto = await respostaFoto.json();

            if (!respostaFoto.ok) {
                alert(
                    resultadoFoto.mensagem ||
                    'Os dados foram salvos, mas não foi possível salvar a foto.'
                );
                return;
            }
        }

        alert('Perfil atualizado com sucesso!');
        window.location.href = 'Perfil.html';

    } catch (erro) {
        console.error('Erro ao salvar perfil:', erro);
        alert('Não foi possível conectar ao servidor.');
    }
});

carregarDadosPerfil();
