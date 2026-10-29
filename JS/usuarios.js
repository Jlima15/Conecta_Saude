
const formularioUsuarios = document.getElementById('form-buscar-usuarios');
const campoPesquisaUsuarios = document.getElementById('pesquisa-usuarios');
const listaUsuarios = document.getElementById('lista-usuarios');

formularioUsuarios.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const pesquisa = campoPesquisaUsuarios.value.trim();

    if (pesquisa.length < 2) {
        listaUsuarios.textContent =
            'Digite pelo menos dois caracteres.';
        return;
    }

    listaUsuarios.textContent = 'Buscando pessoas...';

    try {
        const resposta = await fetch(
            `/buscar-usuarios?pesquisa=${encodeURIComponent(pesquisa)}`,
            { credentials: 'include' }
        );

        if (resposta.status === 401) {
            window.location.href = 'Login.html';
            return;
        }

        const usuarios = await resposta.json();

        if (!resposta.ok) {
            throw new Error(usuarios.mensagem || 'Erro na busca.');
        }

        listaUsuarios.replaceChildren();

        if (usuarios.length === 0) {
            listaUsuarios.textContent = 'Nenhuma pessoa encontrada.';
            return;
        }

        usuarios.forEach(usuario => {
            const cartao = document.createElement('article');
            cartao.className = 'cartao-evento';

            const imagem = document.createElement('img');
            imagem.src = usuario.foto
                ? `/${usuario.foto}`
                : 'imagens/Perfil.png';
            imagem.alt = 'Foto de perfil';
            imagem.className = 'foto-perfil';

            const nome = document.createElement('h3');
            nome.textContent = usuario.nome;

            const nomeUsuario = document.createElement('p');
            nomeUsuario.textContent = '@' + usuario.nome_usuario;

            const privacidade = document.createElement('p');
            privacidade.textContent =
                Number(usuario.perfil_privado) === 1
                    ? 'Perfil privado'
                    : 'Perfil público';

            const link = document.createElement('a');
            link.href = `Perfil.html?id=${usuario.id_usuario}`;
            link.className = 'botao';
            link.textContent = 'Ver perfil';

            // Botão visual de bloquear
            const botaoBloquear = document.createElement('button');
            botaoBloquear.type = 'button';
            botaoBloquear.className = 'botao-acao botao-bloquear';
            botaoBloquear.textContent = 'Bloquear';

            // Botão visual de desbloquear
            const botaoDesbloquear = document.createElement('button');
            botaoDesbloquear.type = 'button';
            botaoDesbloquear.className = 'botao-acao botao-desbloquear';
            botaoDesbloquear.textContent = 'Desbloquear';

            // Adiciona os elementos ao cartão do usuário
            cartao.append(
                imagem,
                nome,
                nomeUsuario,
                privacidade,
                link,
                botaoBloquear,
                botaoDesbloquear
            );

            listaUsuarios.appendChild(cartao);
        });

    } catch (erro) {
        console.error('Erro ao buscar pessoas:', erro);
        listaUsuarios.textContent = 'Não foi possível buscar pessoas.';
    }
});
