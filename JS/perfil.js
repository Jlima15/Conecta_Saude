
async function carregarPerfil() {
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

        // Nome, nome de usuário e biografia
        document.getElementById('nome-perfil').textContent =
            usuario.nome || 'Usuário';

        document.getElementById('nome-usuario-perfil').textContent =
            '@' + (usuario.nome_usuario || 'usuario');

        document.getElementById('descricao-perfil').textContent =
            usuario.biografia || 'Nenhuma biografia cadastrada.';

        // Atividades
        const atividades = usuario.atividades || [];

        const nomesAtividades = {
            corrida: 'Corrida',
            caminhada: 'Caminhada',
            ciclismo: 'Ciclismo',
            academia: 'Academia',
            outros: 'Outros'
        };

        const atividadesExibidas = atividades.map(atividade => {
            return nomesAtividades[atividade] || atividade;
        });

        document.getElementById('atividades-perfil').textContent =
            atividadesExibidas.length > 0
                ? atividadesExibidas.join(', ')
                : 'Nenhuma atividade cadastrada.';

        // Nível de atividade
        const niveis = {
            iniciante: 'Iniciante',
            intermediario: 'Intermediário',
            avancado: 'Avançado'
        };

        document.getElementById('nivel-perfil').textContent =
            niveis[usuario.nivel_atividade] || 'Não informado';

        // Privacidade
        document.getElementById('privacidade-perfil').textContent =
            Number(usuario.perfil_privado) === 1
                ? 'Privado'
                : 'Público';

    } catch (erro) {
        console.error('Erro ao carregar perfil:', erro);
        alert('Não foi possível carregar os dados do perfil.');
    }
}

carregarPerfil();
