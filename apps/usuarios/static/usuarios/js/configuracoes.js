// Configurações do Usuário - JavaScript

$(document).ready(function() {
    const modoEscuroCheckbox = $('#modo-escuro');
    const manterMenuAbertoCheckbox = $('#manter-menu-aberto');
    const salvarBtn = $('#salvar-configuracoes');
    const messageEl = $('#message');

    // Função para mostrar mensagens
    function mostrarMensagem(texto, tipo) {
        messageEl.removeClass('success error').addClass(tipo).text(texto).show();
        setTimeout(() => {
            messageEl.hide();
        }, 5000);
    }

    // Carregar configurações atuais
    function carregarConfiguracoes() {
        $.get(urlGetConfiguracoes)
            .done(function(data) {
                modoEscuroCheckbox.prop('checked', data.modo_escuro);
                manterMenuAbertoCheckbox.prop('checked', data.manter_menu_aberto);
            })
            .fail(function() {
                mostrarMensagem('Erro ao carregar configurações', 'error');
            });
    }

    // Salvar configurações
    function salvarConfiguracoes() {
        const dados = {
            modo_escuro: modoEscuroCheckbox.is(':checked'),
            manter_menu_aberto: manterMenuAbertoCheckbox.is(':checked')
        };

        salvarBtn.prop('disabled', true).addClass('loading');

        $.post(urlPostConfiguracoes, dados)
            .done(function(data) {
                mostrarMensagem(data.message, 'success');
                
                // Aplicar modo escuro imediatamente se alterado
                if (dados.modo_escuro) {
                    localStorage.setItem('theme', 'dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                    document.body.classList.add('dark-mode');
                } else {
                    localStorage.setItem('theme', 'light');
                    document.documentElement.setAttribute('data-theme', 'light');
                    document.body.classList.remove('dark-mode');
                }

                // Salvar preferência do menu no localStorage
                localStorage.setItem('manter_menu_aberto', dados.manter_menu_aberto);
            })
            .fail(function() {
                mostrarMensagem('Erro ao salvar configurações', 'error');
            })
            .always(function() {
                salvarBtn.prop('disabled', false).removeClass('loading');
            });
    }

    // Event listeners
    salvarBtn.on('click', salvarConfiguracoes);

    // Permitir salvar com Enter
    $(document).on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            salvarConfiguracoes();
        }
    });

    // Carregar configurações ao inicializar
    carregarConfiguracoes();
}); 