// ==========================================
// JavaScript para a página de Ações INSS
// ==========================================

// Funções globais
function abrirModal(modalId) {
    const modal = document.querySelector(modalId);
    if (modal) {
        modal.classList.add('active');
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }
}

function fecharModal(modalId) {
    const modal = document.querySelector(modalId);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.classList.remove('active');
        }, 300);
    }
}

function abrirModalEnviarArquivos(acaoId) {
    document.getElementById('acaoIdEnviarArquivos').value = acaoId;
    document.getElementById('formEnviarArquivos').reset();
    abrirModal('#modalEnviarArquivos');
}

function enviarArquivo() {
    const form = document.getElementById('formEnviarArquivos');
    const btnSubmit = document.getElementById('btnEnviarArquivoSubmit');

    if (!validarFormulario(form)) {
        return;
    }

    const acaoIdInput = form.querySelector('#acaoIdEnviarArquivos');
    const tipoArquivoInput = form.querySelector('#tipoArquivo');
    const arquivoInput = form.querySelector('#arquivo');

    const formData = new FormData();
    formData.append('acao_id', acaoIdInput.value);
    formData.append('titulo', tipoArquivoInput.value);
    if (arquivoInput.files.length > 0) {
        formData.append('arquivo', arquivoInput.files[0]);
    }
    if (!arquivoInput.files[0]) {
        mostrarToast('Por favor, selecione um arquivo.', 'error');
        return;
    }

    const originalButtonHtml = btnSubmit.innerHTML;

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class='bx bx-loader-alt bx-spin me-1'></i>Enviando...`;

    // Obter o token CSRF do cookie
    const csrftoken = getCookie('csrftoken');

    fetch('/inss/api/post/arquivo/', {
        method: 'POST',
        body: formData,
        headers: {
            'X-CSRFToken': csrftoken
        },
        credentials: 'same-origin' // Importante para enviar cookies
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            mostrarToast('Arquivo enviado com sucesso!', 'success');
            fecharModal('#modalEnviarArquivos');
            carregarAcoes(); // Recarrega a lista de ações
        } else {
            mostrarToast(data.message || 'Erro ao enviar arquivo.', 'error');
        }
    })
    .catch(error => {
        console.error('Erro:', error);
        mostrarToast('Erro ao enviar arquivo. Tente novamente.', 'error');
    })
    .finally(() => {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalButtonHtml;
    });
}

function visualizarArquivos(acaoId) {
    fetch(`/inss/api/get/arquivosacoes/${acaoId}/`)
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('tabelaArquivos');
            const nenhumArquivo = document.getElementById('nenhumArquivo');
            
            tbody.innerHTML = '';
            
            if (data.arquivos && data.arquivos.length > 0) {
                nenhumArquivo.style.display = 'none';
                data.arquivos.forEach(arquivo => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${arquivo.titulo}</td>
                        <td>${arquivo.tipo}</td>
                        <td>${new Date(arquivo.data_upload).toLocaleDateString()}</td>
                        <td class="text-center">
                            <button class="btn btn-info btn-sm me-1" onclick="visualizarArquivo('${arquivo.url}')" data-tooltip="Visualizar">
                                <i class='bx bx-show'></i>
                            </button>
                            <button class="btn btn-primary btn-sm me-1" onclick="baixarArquivo('${arquivo.url}')" data-tooltip="Baixar">
                                <i class='bx bx-download'></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="excluirArquivo(${arquivo.id})" data-tooltip="Excluir">
                                <i class='bx bx-trash'></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                nenhumArquivo.style.display = 'block';
            }
            
            abrirModal('#modalVerArquivos');
        })
        .catch(error => {
            console.error('Erro:', error);
            mostrarToast('Erro ao carregar arquivos. Tente novamente.', 'error');
        });
}

function visualizarArquivo(url) {
    if (url) {
        window.open(url, '_blank');
    } else {
        mostrarToast('URL do arquivo não disponível', 'error');
    }
}

function baixarArquivo(url) {
    if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = url.split('/').pop();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        mostrarToast('URL do arquivo não disponível', 'error');
    }
}

function excluirArquivo(arquivoId) {
    if (confirm('Tem certeza que deseja excluir este arquivo?')) {
        $.ajax({
            url: `/inss/api/post/excluirarquivo/${arquivoId}/`,
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            success: function(response) {
                if (response.status === 'success') {
                    mostrarToast('Arquivo excluído com sucesso', 'success');
                    // Atualizar a lista de arquivos
                    const acaoId = $('#acaoIdEnviarArquivos').val();
                    visualizarArquivos(acaoId);
                } else {
                    mostrarToast(response.message || 'Erro ao excluir arquivo', 'error');
                }
            },
            error: function(xhr, status, error) {
                mostrarToast('Erro ao excluir arquivo: ' + error, 'error');
            }
        });
    }
}

function validarFormulario(form) {
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return false;
    }
    return true;
}

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
    // Inicializar máscaras
    inicializarMascaras();
    
    // Carregar ações iniciais
    carregarAcoes();
    
    // Inicializar eventos
    inicializarEventos();
});

// Função para inicializar máscaras
function inicializarMascaras() {
    $('#filtroCPF').mask('000.000.000-00');
}

// Função para carregar as ações
function carregarAcoes() {
    $.ajax({
        url: '/inss/api/get/acoes/',
        method: 'GET',
        data: {
            nome: $('#filtroNome').val(),
            cpf: $('#filtroCPF').val(),
            status: $('#filtroStatus').val(),
            loja: $('#filtroLoja').val()
        },
        success: function(response) {
            if (response.success) {
                atualizarTabelaAcoes(response.acoes);
            } else {
                mostrarToast(response.message || 'Erro ao carregar ações', 'error');
            }
        },
        error: function(xhr, status, error) {
            mostrarToast('Erro ao carregar ações: ' + error, 'error');
        }
    });
}

// Função para atualizar a tabela de ações
function atualizarTabelaAcoes(acoes) {
    const tbody = $('#tabelaAcoes tbody');
    tbody.empty();

    if (acoes.length === 0) {
        $('#nenhumResultadoAcoes').show();
        return;
    }

    $('#nenhumResultadoAcoes').hide();

    acoes.forEach(acao => {
        const tr = $('<tr>');
        let botoesAcao = `
            <button class="btn btn-action btn-upload" 
                    data-tooltip="Adicionar Arquivo"
                    data-acao-id="${acao.id}">
                <i class='bx bx-upload'></i>
            </button>
        `;

        if (acao.arquivos && acao.arquivos.length > 0) {
            botoesAcao += `
                <button class="btn btn-action" 
                        data-tooltip="Ver Arquivos"
                        onclick="visualizarArquivos(${acao.id})">
                    <i class='bx bx-file'></i>
                </button>
            `;
        }

        // Adicionar botão para "Ver Motivo" se o status for "Incompleto" e houver motivo
        if (acao.status === 'Incompleto' && acao.motivo_incompleto) {
            // É importante escapar o motivo_incompleto para evitar problemas com caracteres especiais no HTML/JS
            const motivoEscapado = $('<div>').text(acao.motivo_incompleto).html();
            botoesAcao += `
                <button class="btn btn-action btn-warning" 
                        data-tooltip="Ver Motivo Incompleto"
                        onclick="visualizarMotivoIncompleto('${motivoEscapado}')">
                    <i class='bx bx-comment-error'></i>
                </button>
            `;
        }
        
        // Adicionar botão para "Informações do Processo"
        botoesAcao += `
            <button class="btn btn-action btn-info" 
                    data-tooltip="Informações do Processo"
                    onclick="visualizarInfoProcesso(${acao.id})">
                <i class='bx bx-info-circle'></i>
            </button>
        `;

        tr.append(`
            <td>${acao.cliente}</td>
            <td>${acao.cpf}</td>
            <td>${acao.contato || '-'}</td>
            <td>${acao.atendente || '-'}</td>
            <td>${acao.loja || '-'}</td>
            <td>
                <span class="badge bg-${getStatusColor(acao.status)}">
                    ${acao.status}
                </span>
            </td>
            <td>
                <div class="btn-group">
                    ${botoesAcao}
                </div>
            </td>
        `);
        tbody.append(tr);
    });
}

// Função para obter a cor do status
function getStatusColor(status) {
    const cores = {
        'Em Espera': 'secondary',
        'Incompleto': 'warning',
        'Em Despacho': 'info',
        'Protocolado': 'primary',
        'Finalizado': 'success'
    };
    return cores[status] || 'secondary';
}

// Função para mostrar toast
function mostrarToast(mensagem, tipo) {
    const toast = $(`
        <div class="toast ${tipo === 'success' ? 'toast-success' : 'toast-error'}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-body">
                <i class='bx ${tipo === 'success' ? 'bx-check-circle' : 'bx-x-circle'} me-2'></i>
                ${mensagem}
                <i class='bx bx-x toast-close ms-auto' data-bs-dismiss="toast" aria-label="Fechar"></i>
            </div>
        </div>
    `);

    $('#toastContainer').append(toast);
    const bsToast = new bootstrap.Toast(toast[0], {
        animation: true,
        autohide: true,
        delay: 10000
    });
    bsToast.show();

    toast.on('hidden.bs.toast', function() {
        toast.remove();
    });
}

// Função para mostrar alerta
function mostrarAlerta(mensagem, tipo, container) {
    const alerta = $(`
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            <i class='bx ${tipo === 'success' ? 'bx-check-circle' : tipo === 'warning' ? 'bx-error' : 'bx-x-circle'}'></i>
            <div class="flex-grow-1">${mensagem}</div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
        </div>
    `);

    $(container).prepend(alerta);
}

// Função para inicializar eventos
function inicializarEventos() {
    // Evento de filtro
    $('#formFiltroAcoes input, #formFiltroAcoes select').on('change keyup', function() {
        carregarAcoes();
    });

    // Evento de envio de arquivo
    $('#formEnviarArquivos').on('submit', function(e) {
        e.preventDefault();
        enviarArquivo();
    });

    // Evento de clique no botão de enviar arquivos
    $(document).on('click', '.btn-action[data-tooltip="Adicionar Arquivo"]', function() {
        const acaoId = $(this).data('acao-id');
        abrirModalEnviarArquivos(acaoId);
    });

    // Evento quando o modal é fechado
    $('#modalEnviarArquivos').on('hidden.bs.modal', function() {
        $('#formEnviarArquivos')[0].reset();
        $('#acaoIdEnviarArquivos').val('');
        $('.alert').remove();
        $('.is-invalid').removeClass('is-invalid');
    });

    // Evento para remover classe de erro ao digitar
    $('input, select, textarea').on('input change', function() {
        $(this).removeClass('is-invalid');
    });
}

// Nova função para visualizar o motivo da incompletude
function visualizarMotivoIncompleto(motivo) {
    document.getElementById('motivoIncompletoTexto').innerText = motivo;
    abrirModal('#modalVerMotivoIncompleto');
}

// Função para visualizar informações detalhadas do processo
function visualizarInfoProcesso(acaoId) {
    // Mostrar indicador de carregamento
    document.getElementById('infoProcessoConteudo').innerHTML = `
        <div class="text-center p-5">
            <i class='bx bx-loader-alt bx-spin' style="font-size: 3rem;"></i>
            <p class="mt-3">Carregando informações do processo...</p>
        </div>
    `;
    
    // Abrir o modal enquanto carrega
    abrirModal('#modalInfoProcesso');
    
    // Buscar informações do processo
    fetch(`/inss/api/get/info_processo/${acaoId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Atualizar título do modal
                document.getElementById('modalInfoProcessoLabel').innerHTML = `
                    <i class='bx bx-info-circle me-2'></i>Informações do Processo - ${data.cliente.nome}
                `;
                
                // Construir HTML para as informações do cliente
                const clienteHTML = `
                    <div class="info-section mb-4">
                        <h6 class="info-section-title"><i class='bx bx-user me-2'></i>Informações do Cliente</h6>
                        <div class="row">
                            <div class="col-md-6 mb-2">
                                <strong>Nome:</strong> ${data.cliente.nome}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>CPF:</strong> ${data.cliente.cpf}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Contato:</strong> ${data.cliente.contato}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Data de Cadastro:</strong> ${data.cliente.data_criacao}
                            </div>
                        </div>
                    </div>
                `;
                
                // Construir HTML para as informações da ação
                const acaoHTML = `
                    <div class="info-section mb-4">
                        <h6 class="info-section-title"><i class='bx bx-file me-2'></i>Informações da Ação</h6>
                        <div class="row">
                            <div class="col-md-6 mb-2">
                                <strong>Tipo de Ação:</strong> ${data.acao.tipo_acao}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Status:</strong> 
                                <span class="badge bg-${getStatusColor(data.acao.status)}">
                                    ${data.acao.status}
                                </span>
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Data de Criação:</strong> ${data.acao.data_criacao}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Última Atualização:</strong> ${data.acao.data_atualizacao}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Número do Protocolo:</strong> ${data.acao.numero_protocolo}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Vendedor Responsável:</strong> ${data.acao.vendedor_responsavel}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Loja:</strong> ${data.acao.loja}
                            </div>
                            <div class="col-md-6 mb-2">
                                <strong>Advogado Responsável:</strong> ${data.acao.advogado_responsavel}
                            </div>
                            ${data.acao.senha_inss !== '-' ? `
                            <div class="col-md-6 mb-2">
                                <strong>Senha INSS:</strong> ${data.acao.senha_inss}
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                
                // Construir HTML para as informações de sentença, se disponíveis
                let sentencaHTML = '';
                if (data.acao.sentenca) {
                    sentencaHTML = `
                        <div class="info-section mb-4">
                            <h6 class="info-section-title"><i class='bx bx-gavel me-2'></i>Informações da Sentença</h6>
                            <div class="row">
                                <div class="col-md-6 mb-2">
                                    <strong>Sentença:</strong> ${data.acao.sentenca}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>Grau da Sentença:</strong> ${data.acao.grau_sentenca || '-'}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>Valor da Sentença:</strong> ${data.acao.valor_sentenca || '-'}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>Data da Sentença:</strong> ${data.acao.data_sentenca || '-'}
                                </div>
                                ${data.acao.recurso ? `
                                <div class="col-md-6 mb-2">
                                    <strong>Recurso:</strong> ${data.acao.recurso}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>Data do Recurso:</strong> ${data.acao.data_recurso || '-'}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>Resultado do Recurso:</strong> ${data.acao.resultado_recurso || '-'}
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }
                
                // Construir HTML para as informações de pagamento, se disponíveis
                let pagamentoHTML = '';
                if (Object.keys(data.pagamento).length > 0) {
                    pagamentoHTML = `
                        <div class="info-section mb-4">
                            <h6 class="info-section-title"><i class='bx bx-money me-2'></i>Informações de Pagamento</h6>
                            <div class="row">
                                <div class="col-md-6 mb-2">
                                    <strong>Tipo de Pagamento:</strong> ${data.pagamento.tipo_pagamento}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>Valor Total:</strong> ${data.pagamento.valor_total}
                                </div>
                                <div class="col-md-6 mb-2">
                                    <strong>Status:</strong> ${data.pagamento.status}
                                </div>
                                ${data.pagamento.valor_entrada !== '-' ? `
                                <div class="col-md-6 mb-2">
                                    <strong>Valor de Entrada:</strong> ${data.pagamento.valor_entrada}
                                </div>
                                ` : ''}
                                ${data.pagamento.parcelas_totais > 0 ? `
                                <div class="col-md-4 mb-2">
                                    <strong>Parcelas Totais:</strong> ${data.pagamento.parcelas_totais}
                                </div>
                                <div class="col-md-4 mb-2">
                                    <strong>Parcelas Pagas:</strong> ${data.pagamento.parcelas_pagas}
                                </div>
                                <div class="col-md-4 mb-2">
                                    <strong>Parcelas Restantes:</strong> ${data.pagamento.parcelas_restantes}
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }
                
                // Construir HTML para os arquivos, se disponíveis
                let arquivosHTML = '';
                if (data.arquivos && data.arquivos.length > 0) {
                    let arquivosRows = '';
                    data.arquivos.forEach(arquivo => {
                        arquivosRows += `
                            <tr>
                                <td>${arquivo.titulo}</td>
                                <td>${arquivo.data_upload}</td>
                                <td class="text-center">
                                    <button class="btn btn-info btn-sm" onclick="visualizarArquivo('${arquivo.url}')" data-tooltip="Visualizar">
                                        <i class='bx bx-show'></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                    
                    arquivosHTML = `
                        <div class="info-section mb-4">
                            <h6 class="info-section-title"><i class='bx bx-file me-2'></i>Arquivos do Processo</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-hover">
                                    <thead>
                                        <tr>
                                            <th>Título</th>
                                            <th>Data de Upload</th>
                                            <th class="text-center">Visualizar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${arquivosRows}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }
                
                // Construir HTML para os documentos, se disponíveis
                let documentosHTML = '';
                if (data.documentos && data.documentos.length > 0) {
                    let documentosRows = '';
                    data.documentos.forEach(documento => {
                        documentosRows += `
                            <tr>
                                <td>${documento.titulo}</td>
                                <td>${documento.data_upload}</td>
                                <td class="text-center">
                                    <button class="btn btn-info btn-sm" onclick="visualizarArquivo('${documento.url}')" data-tooltip="Visualizar">
                                        <i class='bx bx-show'></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                    
                    documentosHTML = `
                        <div class="info-section mb-4">
                            <h6 class="info-section-title"><i class='bx bx-file-blank me-2'></i>Documentos do Processo</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-hover">
                                    <thead>
                                        <tr>
                                            <th>Título</th>
                                            <th>Data de Upload</th>
                                            <th class="text-center">Visualizar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${documentosRows}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }
                
                // Atualizar o conteúdo do modal
                document.getElementById('infoProcessoConteudo').innerHTML = `
                    ${clienteHTML}
                    ${acaoHTML}
                    ${sentencaHTML}
                    ${pagamentoHTML}
                    ${arquivosHTML}
                    ${documentosHTML}
                `;
            } else {
                // Exibir mensagem de erro
                document.getElementById('infoProcessoConteudo').innerHTML = `
                    <div class="alert alert-danger">
                        <i class='bx bx-error-circle me-2'></i>${data.message || 'Erro ao carregar informações do processo'}
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            document.getElementById('infoProcessoConteudo').innerHTML = `
                <div class="alert alert-danger">
                    <i class='bx bx-error-circle me-2'></i>Erro ao carregar informações do processo. Tente novamente.
                </div>
            `;
        });
}
