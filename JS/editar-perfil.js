
const formulario = document.getElementById('formulario-editar-perfil');

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

        // Carrega o nível de atividade
        const nivel = usuario.nivel_atividade || 'iniciante';

        const radioNivel = document.querySelector(
            `input[name="nivel"][value="${nivel}"]`
        );

        if (radioNivel) {
            radioNivel.checked = true;
        }

        // Carrega a privacidade
        const privacidade = Number(usuario.perfil_privado) === 1
            ? 'privado'
            : 'publico';

        const radioPrivacidade = document.querySelector(
            `input[name="privacidade"][value="${privacidade}"]`
        );

        if (radioPrivacidade) {
            radioPrivacidade.checked = true;
        }

        // Marca as atividades salvas
        const atividades = usuario.atividades || [];

        document.querySelectorAll('input[name="atividades"]').forEach(campo => {
            campo.checked = atividades.includes(campo.value);
        });

        // Recupera a atividade personalizada
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
            alert(resultado.mensagem);
            return;
        }

        alert(resultado.mensagem);
        window.location.href = 'Perfil.html';

    } catch (erro) {
        console.error('Erro ao salvar perfil:', erro);
        alert('Não foi possível conectar ao servidor.');
    }
});

carregarDadosPerfil();
