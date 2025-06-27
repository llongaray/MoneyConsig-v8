// Função para formatar a data
function formatarData(dataString) {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Função para criar o HTML de um comunicado
function criarComunicadoHTML(comunicado) {
    const dataFormatada = formatarData(comunicado.data_criacao);
    const statusIcon = comunicado.lido ? 'bx-message-square-check' : 'bx-message-square-x';
    const statusClass = comunicado.lido ? 'text-success' : 'text-warning';

    let arquivosHTML = '';
    if (comunicado.arquivos && comunicado.arquivos.length > 0) {
        arquivosHTML = '<div class="comunicado-files">';
        comunicado.arquivos.forEach(arquivo => {
            arquivosHTML += `
                <a href="/rh/api/comunicados/download/${arquivo.id}/" class="btn btn-sm btn-outline-primary">
                    <i class='bx bx-file'></i> ${arquivo.nome}
                </a>
            `;
        });
        arquivosHTML += '</div>';
    }

    return `
        <div class="comunicado-card" data-id="${comunicado.id}">
            <div class="comunicado-header">
                <div class="d-flex align-items-center">
                    <i class='bx ${statusIcon} me-2 ${statusClass}'></i>
                    <h3 class="comunicado-title">${comunicado.titulo}</h3>
                </div>
                <span class="comunicado-date">${dataFormatada}</span>
            </div>
            <div class="comunicado-content">
                ${comunicado.conteudo}
            </div>
            ${arquivosHTML}
            ${!comunicado.lido ? `
                <div class="mt-3">
                    <button class="btn btn-primary btn-sm marcar-lido" data-id="${comunicado.id}">
                        <i class='bx bx-check'></i> Marcar como Lido
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// Função para atualizar a lista de comunicados
function atualizarListaComunicados(comunicados) {
    const naoLidos = comunicados.filter(c => !c.lido);
    const lidos = comunicados.filter(c => c.lido);

    // Atualiza a lista de não lidos
    const containerNaoLidos = $('#comunicados-nao-lidos');
    containerNaoLidos.empty();
    if (naoLidos.length === 0) {
        containerNaoLidos.html('<div class="alert alert-info">Não há comunicados não lidos.</div>');
    } else {
        naoLidos.forEach(comunicado => {
            containerNaoLidos.append(criarComunicadoHTML(comunicado));
        });
    }

    // Atualiza a lista de lidos
    const containerLidos = $('#comunicados-lidos');
    containerLidos.empty();
    if (lidos.length === 0) {
        containerLidos.html('<div class="alert alert-info">Não há comunicados lidos.</div>');
    } else {
        lidos.forEach(comunicado => {
            containerLidos.append(criarComunicadoHTML(comunicado));
        });
    }

    // Atualiza o dashboard
    atualizarDashboard(comunicados);
}

// Função para atualizar o dashboard
function atualizarDashboard(comunicados) {
    const total = comunicados.length;
    const lidos = comunicados.filter(c => c.lido).length;
    const naoLidos = total - lidos;

    $('#total-comunicados').text(total);
    $('#comunicados-lidos').text(lidos);
    $('#comunicados-nao-lidos').text(naoLidos);
}

// Função para marcar comunicado como lido
function marcarComoLido(id) {
    $.ajax({
        url: `/rh/api/comunicados/${id}/marcar-lido/`,
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        success: function(response) {
            // Recarrega a lista de comunicados
            carregarComunicados();
        },
        error: function(xhr, status, error) {
            console.error('Erro ao marcar comunicado como lido:', error);
            alert('Erro ao marcar comunicado como lido. Por favor, tente novamente.');
        }
    });
}

// Função para carregar os comunicados
function carregarComunicados() {
    $.get('/rh/api/comunicados/list/', function(response) {
        atualizarListaComunicados(response);
    }).fail(function(xhr, status, error) {
        console.error('Erro ao carregar comunicados:', error);
        alert('Erro ao carregar comunicados. Por favor, tente novamente.');
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

// Inicialização quando o documento estiver pronto
$(document).ready(function() {
    // Carrega os comunicados inicialmente
    carregarComunicados();

    // Manipulação das tabs
    $('.comunicados-tab').click(function() {
        const tab = $(this).data('tab');
        
        // Atualiza classes das tabs
        $('.comunicados-tab').removeClass('active');
        $(this).addClass('active');
        
        // Atualiza visibilidade do conteúdo
        $('.comunicados-content').removeClass('active');
        $(`#comunicados-${tab}`).addClass('active');
    });

    // Delegação de eventos para o botão "Marcar como Lido"
    $(document).on('click', '.marcar-lido', function() {
        const id = $(this).data('id');
        marcarComoLido(id);
    });
}); 