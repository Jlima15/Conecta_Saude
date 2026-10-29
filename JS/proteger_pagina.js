
async function verificarSessao() {
    try {
        const resposta = await fetch('http:/sessao', {
            credentials: 'include',
            cache: 'no-store'
        });

        if (resposta.status === 401) {
            window.location.href = 'Login.html';
            return;
        }

        if (!resposta.ok) {
            console.error('Erro ao verificar sessão:', resposta.status);
            alert('Não foi possível verificar seu login. Tente novamente.');
            return;
        }

        const resultado = await resposta.json();

        if (!resultado.autenticado) {
            window.location.href = 'Login.html';
        }

    } catch (erro) {
        console.error('Erro ao verificar a sessão:', erro);
        alert('Não foi possível verificar seu login. Confira se o servidor está iniciado.');
    }
}

verificarSessao();
