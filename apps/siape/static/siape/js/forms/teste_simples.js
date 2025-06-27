console.log('TESTE: Arquivo JavaScript carregado com sucesso!');

$(document).ready(function() {
    console.log('TESTE: Document ready funcionando!');
    
    // Teste simples de função
    window.testeModal = function() {
        alert('Função de teste funcionando!');
    };
    
    console.log('TESTE: Função window.testeModal criada');
}); 