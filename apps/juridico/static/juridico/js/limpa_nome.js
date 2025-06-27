// Função para obter o token CSRF do cookie
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

// Template para botões de ações
function templateBotoesLimpaNome(acao) {
    return `
        <div class="btn-group">
            <button class="btn btn-action btn-sm btn-danger" onclick="inativarAcao(${acao.id})" data-tooltip="Cancelar">
                <i class='bx bx-x-circle'></i>
            </button>
            <button class="btn btn-action btn-sm btn-success" onclick="verPagamentos(${acao.id})" data-tooltip="Ver Pagamentos">
                <i class='bx bx-money'></i>
            </button>
        </div>
    `;
}

// Função para carregar a tabela de ações Limpa Nome
async function carregarTabelaLimpaNome() {
    try {
        const nome = $('#filtroNomeLimpaNome').val();
        const cpf = $('#filtroCPFLimpaNome').val();
        const vendedor = $('#filtroVendedorLimpaNome').val();
        const status = $('#filtroStatusLimpaNome').val();

        const response = await fetch(`/juridico/api/tabelaacoes-limpanome/?nome=${nome}&cpf=${cpf}&vendedor=${vendedor}&status=${status}`);
        const data = await response.json();

        if (data.status === 'success') {
            const tbody = $('#tabelaAcoesLimpaNome tbody');
            tbody.empty();

            if (data.data.length === 0) {
                $('#nenhumResultadoAcoesLimpaNome').show();
                return;
            }

            $('#nenhumResultadoAcoesLimpaNome').hide();
            data.data.forEach(acao => {
                const row = `
                    <tr>
                        <td>${acao.cliente_nome}</td>
                        <td>${acao.cliente_cpf}</td>
                        <td>${acao.vendedor_nome}</td>
                        <td>${acao.data_criacao}</td>
                        <td class="text-center">
                            <span class="badge ${getStatusClass(acao.status)}">
                                ${acao.status}
                            </span>
                        </td>
                        <td class="text-center">
                            <span class="badge ${getSentencaClass(acao.sentenca)}">
                                ${acao.sentenca}
                            </span>
                        </td>
                        <td>${acao.loja}</td>
                        <td class="text-center">
                            ${templateBotoesLimpaNome(acao)}
                        </td>
                    </tr>
                `;
                tbody.append(row);
            });
        } else {
            console.error('Erro ao carregar dados:', data.message);
        }
    } catch (error) {
        console.error('Erro ao carregar tabela:', error);
    }
}

// Funções auxiliares para classes CSS
function getStatusClass(status) {
    const classes = {
        'Em Espera': 'bg-warning',
        'Incompleto': 'bg-danger',
        'Em Despacho': 'bg-info',
        'Protocolado': 'bg-primary',
        'Finalizado': 'bg-success',
        'Recusado': 'bg-danger'
    };
    return classes[status] || 'bg-secondary';
}

function getSentencaClass(sentenca) {
    const classes = {
        'Favorável': 'bg-success',
        'Não Favorável': 'bg-danger'
    };
    return classes[sentenca] || 'bg-secondary';
}

// Funções para manipulação de ações
async function editarAcao(id) {
    try {
        const response = await fetch(`/juridico/api_get_acao/${id}/`);
        const data = await response.json();

        if (data.success) {
            // Preencher e mostrar modal de edição
            $('#acaoIdEditar').val(id);
            $('#cpfClienteEditar').val(data.data.cpf_cliente);
            $('#tipoAcaoEditar').val(data.data.tipo_acao);
            $('#statusEmCaminhamentoEditar').val(data.data.status_emcaminhamento);
            $('#sentencaEditar').val(data.data.sentenca);
            $('#senhaInssEditar').val(data.data.senha_inss);
            
            $('#modalEditarAcao').modal('show');
        }
    } catch (error) {
        console.error('Erro ao carregar dados da ação:', error);
    }
}

async function alterarStatus(id) {
    $('#acaoIdStatus').val(id);
    $('#modalAtualizarStatus').modal('show');
}

async function inativarAcao(id) {
    $('#acaoIdRecusar').val(id);
    $('#modalRecusarAcao').modal('show');
}

async function reativarAcao(id) {
    if (confirm('Deseja reativar esta ação?')) {
        try {
            const response = await fetch('/juridico/api/acoes/reativar/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: `acao_id=${id}`
            });
            const data = await response.json();

            if (data.status === 'success') {
                alert('Ação reativada com sucesso!');
                carregarTabelaLimpaNome();
            } else {
                alert('Erro ao reativar ação: ' + data.message);
            }
        } catch (error) {
            console.error('Erro ao reativar ação:', error);
        }
    }
}

// Função global para redirecionar para a tela de pagamentos da ação
function verPagamentos(acaoId) {
    window.location.href = `/juridico/pagamentos/?acao_id=${acaoId}`;
}

// Configuração de eventos
$(document).ready(function() {
    // Carregar tabela inicial
    carregarTabelaLimpaNome();

    // Configurar máscaras
    $('#filtroCPFLimpaNome').mask('000.000.000-00');

    // Configurar listeners de filtros
    $('#filtroNomeLimpaNome, #filtroCPFLimpaNome, #filtroVendedorLimpaNome, #filtroStatusLimpaNome').on('input change', function() {
        carregarTabelaLimpaNome();
    });

    // Configurar formulário de atualizar status
    $('#formAtualizarStatus').on('submit', async function(e) {
        e.preventDefault();
        const id = $('#acaoIdStatus').val();
        const status = $('#novoStatus').val();
        const numeroProtocolo = $('#numeroProtocolo').val();

        try {
            const response = await fetch('/juridico/api/acoes/atualizar-status/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: `acao_id=${id}&status=${status}&numero_protocolo=${numeroProtocolo}`
            });
            const data = await response.json();

            if (data.status === 'success') {
                alert('Status atualizado com sucesso!');
                $('#modalAtualizarStatus').modal('hide');
                carregarTabelaLimpaNome();
            } else {
                alert('Erro ao atualizar status: ' + data.message);
            }
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
        }
    });

    // Configurar formulário de recusar ação
    $('#formRecusarAcao').on('submit', async function(e) {
        e.preventDefault();
        const id = $('#acaoIdRecusar').val();
        const motivo = $('#motivoRecusa').val();

        try {
            const response = await fetch('/juridico/api/acoes/inativar/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: `acao_id=${id}&motivo=${motivo}`
            });
            const data = await response.json();

            if (data.status === 'success') {
                alert('Ação inativada com sucesso!');
                $('#modalRecusarAcao').modal('hide');
                carregarTabelaLimpaNome();
            } else {
                alert('Erro ao inativar ação: ' + data.message);
            }
        } catch (error) {
            console.error('Erro ao inativar ação:', error);
        }
    });

    // Mostrar/esconder campo de número do protocolo baseado no status
    $('#novoStatus').on('change', function() {
        if ($(this).val() === 'PROTOCOLADO') {
            $('#divNumeroProtocolo').show();
        } else {
            $('#divNumeroProtocolo').hide();
        }
    });
});
