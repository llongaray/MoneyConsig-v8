$(document).ready(function() {
    // Função para alternar entre os modais
    function alternarModal(targetId) {
        // Esconde todos os modais
        $('.modal-comunicados').hide();
        
        // Mostra o modal alvo
        $(`#${targetId}`).show();
        
        // Atualiza os botões
        $('.btn-label').removeClass('active');
        $(`.btn-label[data-target="${targetId}"]`).addClass('active');
    }

    // Função para abrir um comunicado específico
    function abrirComunicadoEspecifico(comunicadoId) {
        // Verifica se o comunicado está na lista de não lidos
        const comunicadoNaoLido = $(`#lista-nao-lidos .comunicado-item[data-id="${comunicadoId}"]`);
        if (comunicadoNaoLido.length > 0) {
            alternarModal('modal-nao-lidos');
            comunicadoNaoLido[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Se não estiver em não lidos, verifica em lidos
        const comunicadoLido = $(`#lista-lidos .comunicado-item[data-id="${comunicadoId}"]`);
        if (comunicadoLido.length > 0) {
            alternarModal('modal-lidos');
            comunicadoLido[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Verifica se há um hash na URL ao carregar a página
    if (window.location.hash) {
        const comunicadoId = window.location.hash.replace('#comunicado-', '');
        // Aguarda o carregamento dos comunicados antes de tentar abrir
        setTimeout(() => abrirComunicadoEspecifico(comunicadoId), 500);
    }

    // Evento de clique nos botões de navegação
    $('.btn-label').on('click', function() {
        const targetId = $(this).data('target');
        alternarModal(targetId);
    });

    // Carrega os comunicados
    function carregarComunicados() {
        $.ajax({
            url: '/rh/api/comunicados/list/',
            method: 'GET',
            success: function(response) {
                const naoLidos = response.filter(c => !c.lido);
                const lidos = response.filter(c => c.lido);
                
                // Atualiza os contadores
                $('#valor-contador-nao-lidos').text(naoLidos.length);
                $('#valor-contador-lidos').text(lidos.length);
                
                // Atualiza as listas
                atualizarListaComunicados('lista-nao-lidos', naoLidos);
                atualizarListaComunicados('lista-lidos', lidos);
            },
            error: function(error) {
                console.error('Erro ao carregar comunicados:', error);
            }
        });
    }

    // Função para atualizar a lista de comunicados
    function atualizarListaComunicados(listaId, comunicados) {
        const $lista = $(`#${listaId}`);
        $lista.empty();

        if (comunicados.length === 0) {
            $lista.html('<p class="text-center">Nenhum comunicado encontrado</p>');
            return;
        }

        comunicados.forEach(comunicado => {
            const data = formatarDataBR(comunicado.data_criacao);
            const arquivos = comunicado.arquivos ? comunicado.arquivos.map(arquivo => `
                <div class="arquivo">
                    <i class="bx bx-paperclip"></i>
                    <a href="/rh/api/comunicados/download/${arquivo.id}/" download>
                        ${arquivo.nome}
                    </a>
                </div>
            `).join('') : '';

            const html = `
                <div class="comunicado-item ${!comunicado.lido ? 'nao-lido' : ''}" data-id="${comunicado.id}">
                    <div class="comunicado-header">
                        <h3>${comunicado.assunto}</h3>
                        <span class="data">${data}</span>
                    </div>
                    ${comunicado.banner ? `
                        <div class="comunicado-banner">
                            <img src="${comunicado.banner}" alt="Banner do comunicado" class="img-fluid">
                        </div>
                    ` : ''}
                    ${comunicado.texto ? `
                        <div class="comunicado-texto">${comunicado.texto}</div>
                    ` : ''}
                    ${arquivos ? `
                        <div class="comunicado-arquivos">
                            <h4><i class="bx bx-paperclip me-2"></i>Anexos</h4>
                            ${arquivos}
                        </div>
                    ` : ''}
                    ${!comunicado.lido ? `
                        <button class="btn-marcar-lido" onclick="marcarComoLido(${comunicado.id})">
                            <i class="bx bx-envelope-open"></i>
                            Marcar como lido
                        </button>
                    ` : ''}
                </div>
            `;
            $lista.append(html);
        });
    }

    // Função para obter o token CSRF
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Função para marcar comunicado como lido
    window.marcarComoLido = function(comunicadoId) {
        $.ajax({
            url: `/rh/api/comunicados/${comunicadoId}/marcar-lido/`,
            method: 'POST',
            data: JSON.stringify({
                comunicado_id: comunicadoId
            }),
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': getCookie('csrftoken'),
                'X-Requested-With': 'XMLHttpRequest'
            },
            success: function(response) {
                if (response.status === 'success') {
                    carregarComunicados();
                } else {
                    console.error('Erro ao marcar como lido:', response.message);
                    alert('Erro ao marcar comunicado como lido. Por favor, tente novamente.');
                }
            },
            error: function(error) {
                console.error('Erro ao marcar comunicado como lido:', error);
                alert('Erro ao marcar comunicado como lido. Por favor, tente novamente.');
            }
        });
    };

    // Carrega os comunicados inicialmente
    carregarComunicados();

    // Atualiza os comunicados a cada 30 segundos
    setInterval(carregarComunicados, 30000);
});

function formatarDataBR(dataString) {
    if (!dataString) return 'Data não disponível';
    
    // Se já estiver no formato DD/MM/YYYY, retorna como está
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dataString)) {
        return dataString;
    }
    
    try {
        // Tenta converter a string para data
        const data = new Date(dataString);
        
        // Verifica se a data é válida
        if (isNaN(data.getTime())) {
            console.error('Data inválida:', dataString);
            return 'Data inválida';
        }
        
        // Formata para DD/MM/YYYY
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        
        return `${dia}/${mes}/${ano}`;
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return 'Data inválida';
    }
}

