
const formulario = document.getElementById('formulario-login');


formulario.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    console.log('CLIQUEI EM ENTRAR');
    console.log('Formulário enviado!');

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    try {
        const resposta = await fetch('http://127.0.0.1:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                email: email,
                senha: senha
            })
        });
        

        const resultado = await resposta.json();

        if (!resposta.ok) {
            alert(resultado.mensagem);
            return;
        }

        window.location.href = 'Perfil.html';

    } catch (erro) {
        alert('Não foi possível conectar ao servidor.');
        console.error('Erro ao fazer login:', erro);
    }
});
