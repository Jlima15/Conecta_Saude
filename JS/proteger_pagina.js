
async function verificarSessao() {
    try {
        const resposta = await fetch('http://127.0.0.1:3000/sessao', {
            credentials: 'include'
        });

        if (!resposta.ok) {
            window.location.href = 'Login.html';
            return;
        }

    } catch (erro) {
        console.error('Erro ao verificar a sessão:', erro);
        alert('Não foi possível verificar seu login. Confira se o servidor está iniciado.');
    }
}

verificarSessao();
