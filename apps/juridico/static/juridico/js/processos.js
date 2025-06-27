// ===== FUNÇÕES PARA GERENCIAR PROCESSOS =====

// Variável global para armazenar o ID do processo atual
let currentProcessoId = null;

// Função para atualizar dados automaticamente após operações
function atualizarDadosProcessos(acaoId, processoId = null, delay = 300) {
    console.log('[PROCESSOS] Iniciando atualização automática de dados...');
    
    // Mostrar indicador de atualização
    mostrarIndicadorAtualizacao();
    
    // Atualizar tabela de processos
    if (acaoId) {
        setTimeout(() => {
            console.log('[PROCESSOS] Recarregando tabela de processos...');
            carregarProcessosAcao(acaoId);
        }, delay);
    }
    
    // Atualizar detalhes do processo se estiver aberto
    if (processoId && $('#modalDetalhesProcesso').hasClass('show')) {
        setTimeout(() => {
            console.log('[PROCESSOS] Recarregando detalhes do processo...');
            visualizarProcesso(processoId);
        }, delay + 200);
    }
    
    // Recarregar tabela principal de ações se existir (para mostrar contadores atualizados)
    if (typeof carregarAcoesAberto === 'function') {
        setTimeout(() => {
            console.log('[PROCESSOS] Recarregando tabela principal de ações...');
            carregarAcoesAberto();
        }, delay + 400);
    }
    
    // Remover indicador após todas as atualizações
    setTimeout(() => {
        removerIndicadorAtualizacao();
    }, delay + 800);
}

// Função para mostrar indicador de atualização
function mostrarIndicadorAtualizacao() {
    // Remover indicador existente se houver
    $('.indicador-atualizacao').remove();
    
    // Criar novo indicador
    const $indicador = $(`
        <div class="indicador-atualizacao position-fixed top-0 end-0 m-3" style="z-index: 9999;">
            <div class="alert alert-info alert-dismissible fade show shadow-sm border-0" role="alert">
                <div class="d-flex align-items-center">
                    <div class="spinner-border spinner-border-sm text-info me-2" role="status">
                        <span class="visually-hidden">Atualizando...</span>
                    </div>
                    <small><strong>Atualizando dados...</strong></small>
                </div>
            </div>
        </div>
    `);
    
    $('body').append($indicador);
}

// Função para remover indicador de atualização
function removerIndicadorAtualizacao() {
    $('.indicador-atualizacao').fadeOut(300, function() {
        $(this).remove();
    });
}

// Função para mostrar indicador de carregamento na tabela
function mostrarLoadingTabela(selector, mensagem = 'Carregando...') {
    const $tabela = $(selector);
    if ($tabela.length) {
        $tabela.html(`
            <tr>
                <td colspan="100%" class="text-center p-4">
                    <div class="d-flex align-items-center justify-content-center">
                        <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
                            <span class="visually-hidden">Carregando...</span>
                        </div>
                        <span class="text-muted">${mensagem}</span>
                    </div>
                </td>
            </tr>
        `);
    }
}

// Função para abrir o modal de gerenciar processos
function gerenciarProcessos(acaoId) {
    $('#acaoIdProcessos').val(acaoId);
    carregarProcessosAcao(acaoId);
    $('#modalGerenciarProcessos').modal('show');
}

// Função para carregar os processos de uma ação
function carregarProcessosAcao(acaoId) {
    console.log(`[PROCESSOS] Carregando processos da ação ${acaoId}...`);
    
    // Mostrar loading na tabela
    mostrarLoadingTabela('#tabelaProcessos tbody', 'Carregando processos...');
    $('#nenhumProcesso').hide();
    $('#tabelaProcessos').show();
    
    $.get(`/juridico/api/processos-acao/${acaoId}/`, function(response) {
        if (response.status === 'success') {
            const tbody = $('#tabelaProcessos tbody');
            tbody.empty();
            
            if (response.data.length > 0) {
                response.data.forEach(processo => {
                    tbody.append(`
                        <tr>
                            <td>${processo.titulo}</td>
                            <td>${processo.numero_processo || 'N/A'}</td>
                            <td>${processo.data_inicio}</td>
                            <td>${processo.data_final || 'N/A'}</td>
                            <td>${criarBadgeStatus(processo.status_value, processo.status)}</td>
                            <td class="text-center">
                                <div class="btn-group">
                                    <button type="button" class="btn btn-primary btn-sm" onclick="visualizarProcesso(${processo.id})" data-tooltip="Ver Detalhes">
                                        <i class='bx bx-detail'></i>
                                    </button>
                                    <button type="button" class="btn btn-warning btn-sm" onclick="editarProcesso(${processo.id})" data-tooltip="Editar">
                                        <i class='bx bx-edit'></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `);
                });
                $('#nenhumProcesso').hide();
                $('#tabelaProcessos').show();
            } else {
                $('#tabelaProcessos').hide();
                $('#nenhumProcesso').show();
            }
        } else {
            mostrarToast('error', response.message || 'Erro ao carregar processos');
        }
    }).fail(function() {
        mostrarToast('error', 'Erro ao carregar processos');
    });
}

// Função para obter a cor e ícone do status do processo
function getStatusProcessoColor(status) {
    switch(status) {
        case 'ATIVO':
            return 'success';
        case 'FINALIZADO':
            return 'primary';
        case 'ARQUIVADO':
            return 'secondary';
        case 'INATIVO':
            return 'danger';
        default:
            return 'secondary';
    }
}

// Função para obter ícone do status do processo
function getStatusProcessoIcon(status) {
    switch(status) {
        case 'ATIVO':
            return 'bx-play-circle';
        case 'FINALIZADO':
            return 'bx-check-circle';
        case 'ARQUIVADO':
            return 'bx-archive';
        case 'INATIVO':
            return 'bx-pause-circle';
        default:
            return 'bx-info-circle';
    }
}

// Função para criar badge de status do processo
function criarBadgeStatus(status, statusDisplay) {
    const color = getStatusProcessoColor(status);
    const icon = getStatusProcessoIcon(status);
    return `<span class="badge bg-${color}"><i class='bx ${icon} me-1'></i>${statusDisplay}</span>`;
}

// Função para criar novo processo
function novoProcesso() {
    $('#modalCriarEditarProcessoLabel').html('<i class="bx bx-plus-circle me-2"></i>Novo Processo');
    $('#formCriarEditarProcesso')[0].reset();
    $('#processoId').val('');
    $('#acaoIdProcesso').val($('#acaoIdProcessos').val());
    $('#modalCriarEditarProcesso').modal('show');
}

// Função para editar processo
function editarProcesso(processoId) {
    $.get(`/juridico/api/processos/${processoId}/`, function(response) {
        if (response.success) {
            const processo = response.data;
            $('#modalCriarEditarProcessoLabel').html('<i class="bx bx-edit me-2"></i>Editar Processo');
            $('#processoId').val(processo.id);
            $('#acaoIdProcesso').val(processo.acao_id);
            $('#tituloProcesso').val(processo.titulo);
            $('#numeroProcesso').val(processo.numero_processo || '');
            $('#dataInicioProcesso').val(processo.data_inicio);
            $('#dataFinalProcesso').val(processo.data_final || '');
            $('#statusProcesso').val(processo.status);
            $('#resultadoProcesso').val(processo.resultado || '');
            $('#modalCriarEditarProcesso').modal('show');
        } else {
            mostrarToast('error', response.message || 'Erro ao carregar dados do processo');
        }
    }).fail(function() {
        mostrarToast('error', 'Erro ao carregar dados do processo');
    });
}

// Função para visualizar detalhes do processo
function visualizarProcesso(processoId) {
    console.log(`[PROCESSOS] Visualizando processo ${processoId}...`);
    currentProcessoId = processoId;
    
    // Mostrar loading nos containers principais
    $('#dadosProcesso').html(`
        <div class="text-center p-4">
            <div class="spinner-border text-primary me-2" role="status">
                <span class="visually-hidden">Carregando...</span>
            </div>
            <span class="text-muted">Carregando dados do processo...</span>
        </div>
    `);
    
    mostrarLoadingTabela('#tabelaArquivosProcesso tbody', 'Carregando arquivos...');
    
    $.get(`/juridico/api/processos/${processoId}/`, function(response) {
        if (response.success) {
            const processo = response.data;
            
            // Preencher dados do processo
            $('#dadosProcesso').html(`
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Título:</strong> ${processo.titulo}</p>
                        <p><strong>Número do Processo:</strong> ${processo.numero_processo || 'N/A'}</p>
                        <p><strong>Data de Início:</strong> ${new Date(processo.data_inicio).toLocaleDateString('pt-BR')}</p>
                        <p><strong>Status:</strong> ${criarBadgeStatus(processo.status, processo.status_display)}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Data Final:</strong> ${processo.data_final ? new Date(processo.data_final).toLocaleDateString('pt-BR') : 'N/A'}</p>
                        <p><strong>Data de Criação:</strong> ${processo.data_criacao}</p>
                    </div>
                    <div class="col-12">
                        <p><strong>Resultado:</strong></p>
                        <p class="text-muted">${processo.resultado || 'Nenhum resultado informado'}</p>
                    </div>
                </div>
            `);
            
            // Carregar arquivos do processo
            carregarArquivosProcesso(processo.arquivos);
            
            $('#modalDetalhesProcesso').modal('show');
        } else {
            mostrarToast('error', response.message || 'Erro ao carregar detalhes do processo');
        }
    }).fail(function() {
        mostrarToast('error', 'Erro ao carregar detalhes do processo');
    });
}

// Função para carregar arquivos do processo
function carregarArquivosProcesso(arquivos) {
    console.log('[PROCESSOS] Carregando arquivos do processo...');
    const tbody = $('#tabelaArquivosProcesso tbody');
    tbody.empty();
    
    if (arquivos && arquivos.length > 0) {
        arquivos.forEach(arquivo => {
            tbody.append(`
                <tr>
                    <td>${arquivo.titulo}</td>
                    <td>${arquivo.data_criacao}</td>
                    <td><span class="badge bg-success"><i class='bx bx-check-circle me-1'></i>${arquivo.status}</span></td>
                    <td class="text-center">
                        <div class="btn-group">
                            <button type="button" class="btn btn-info btn-sm" onclick="visualizarArquivoProcesso(${arquivo.id})" data-tooltip="Visualizar">
                                <i class='bx bx-show'></i>
                            </button>
                            <button type="button" class="btn btn-primary btn-sm" onclick="baixarArquivoProcesso(${arquivo.id})" data-tooltip="Baixar">
                                <i class='bx bx-download'></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `);
        });
        $('#nenhumArquivoProcesso').hide();
        $('#tabelaArquivosProcesso').show();
    } else {
        $('#tabelaArquivosProcesso').hide();
        $('#nenhumArquivoProcesso').show();
    }
}

// Função para adicionar arquivo ao processo
function adicionarArquivoProcesso() {
    $('#processoIdArquivo').val(currentProcessoId);
    $('#formAdicionarArquivoProcesso')[0].reset();
    $('#modalAdicionarArquivoProcesso').modal('show');
}

// Função para visualizar arquivo do processo
function visualizarArquivoProcesso(arquivoId) {
    $.get(`/juridico/api/arquivo-processo/${arquivoId}/`, function(response) {
        if (response.success) {
            const arquivo = response.data;
            const modalBody = $('#modalVisualizarDocumento .modal-body');
            
            // Limpar conteúdo anterior
            modalBody.empty();
            
            // Verificar se é um PDF para embed ou apenas link de download
            if (arquivo.arquivo.toLowerCase().endsWith('.pdf')) {
                modalBody.html(`
                    <div class="text-center mb-3">
                        <h6>${arquivo.titulo}</h6>
                        <p class="text-muted">Enviado em: ${arquivo.data_criacao}</p>
                    </div>
                    <div class="embed-responsive" style="height: 600px;">
                        <iframe src="${arquivo.arquivo}" width="100%" height="100%" style="border: none;"></iframe>
                    </div>
                `);
            } else {
                modalBody.html(`
                    <div class="text-center p-5">
                        <i class='bx bx-file' style="font-size: 4rem; color: #6c757d;"></i>
                        <h5 class="mt-3">${arquivo.titulo}</h5>
                        <p class="text-muted">Arquivo: ${arquivo.arquivo.split('/').pop()}</p>
                        <p class="text-muted">Data: ${arquivo.data_criacao}</p>
                        <a href="${arquivo.arquivo}" target="_blank" class="btn btn-primary">
                            <i class='bx bx-download me-1'></i>Baixar Arquivo
                        </a>
                    </div>
                `);
            }
            
            $('#modalVisualizarDocumento').modal('show');
        } else {
            mostrarToast('error', response.message || 'Erro ao carregar arquivo');
        }
    }).fail(function() {
        mostrarToast('error', 'Erro ao carregar arquivo');
    });
}

// Função para baixar arquivo do processo
function baixarArquivoProcesso(arquivoId) {
    $.get(`/juridico/api/arquivo-processo/${arquivoId}/`, function(response) {
        if (response.success) {
            const link = document.createElement('a');
            link.href = response.data.arquivo;
            link.download = response.data.titulo;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            mostrarToast('error', response.message || 'Erro ao baixar arquivo');
        }
    }).fail(function() {
        mostrarToast('error', 'Erro ao baixar arquivo');
    });
}

// Eventos para os formulários de processos
$(document).ready(function() {
    // Variáveis para controlar envio duplicado
    let isSubmittingProcesso = false;
    let isSubmittingArquivo = false;
    
    // Evento de submit do formulário de criar/editar processo
    $('#formCriarEditarProcesso').off('submit').on('submit', function(e) {
        e.preventDefault();
        
        // Prevenir envio duplicado
        if (isSubmittingProcesso) {
            console.log('[PROCESSOS] Envio já em andamento, ignorando...');
            return false;
        }
        
        isSubmittingProcesso = true;
        const $submitBtn = $(this).find('button[type="submit"]');
        const originalText = $submitBtn.html();
        
        // Desabilitar botão e mostrar loading
        $submitBtn.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i>Salvando...');
        
        const formData = new FormData(this);
        const processoId = $('#processoId').val();
        const isEdicao = processoId !== '';
        const url = isEdicao ? '/juridico/api/processos/editar/' : '/juridico/api/processos/criar/';
        
        $.ajax({
            url: url,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.status === 'success') {
                    $('#modalCriarEditarProcesso').modal('hide');
                    mostrarToast('success', isEdicao ? 'Processo atualizado!' : 'Processo criado!');
                    
                    // Atualização automática usando função centralizada
                    const acaoId = $('#acaoIdProcessos').val();
                    const processoIdParaAtualizar = isEdicao ? currentProcessoId : null;
                    
                    atualizarDadosProcessos(acaoId, processoIdParaAtualizar, 200);
                    
                    // Limpar formulário para próximo uso
                    $('#formCriarEditarProcesso')[0].reset();
                    $('#processoId').val('');
                } else {
                    mostrarToast('error', response.message || 'Erro ao salvar processo');
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON?.message || 'Erro ao salvar processo';
                mostrarToast('error', errorMsg);
                console.error('[PROCESSOS] Erro ao salvar processo:', xhr);
            },
            complete: function() {
                // Reabilitar botão e restaurar texto
                isSubmittingProcesso = false;
                $submitBtn.prop('disabled', false).html(originalText);
            }
        });
    });
    
    // Evento de submit do formulário de adicionar arquivo ao processo
    $('#formAdicionarArquivoProcesso').off('submit').on('submit', function(e) {
        e.preventDefault();
        
        // Prevenir envio duplicado
        if (isSubmittingArquivo) {
            console.log('[PROCESSOS] Upload já em andamento, ignorando...');
            return false;
        }
        
        // Validação básica do arquivo
        const arquivo = $('#arquivoProcesso')[0].files[0];
        if (!arquivo) {
            mostrarToast('error', 'Por favor, selecione um arquivo para enviar.');
            return false;
        }
        
        // Validação do tamanho do arquivo (máx 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (arquivo.size > maxSize) {
            mostrarToast('error', 'Arquivo muito grande. Tamanho máximo permitido: 10MB');
            return false;
        }
        
        isSubmittingArquivo = true;
        const $submitBtn = $(this).find('button[type="submit"]');
        const originalText = $submitBtn.html();
        
        // Desabilitar botão e mostrar loading
        $submitBtn.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i>Enviando...');
        
        const formData = new FormData(this);
        
        $.ajax({
            url: '/juridico/api/processos/upload-arquivo/',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                // Criar XHR personalizado para mostrar progresso do upload
                const xhr = new window.XMLHttpRequest();
                xhr.upload.addEventListener("progress", function(evt) {
                    if (evt.lengthComputable) {
                        const percentComplete = Math.round((evt.loaded / evt.total) * 100);
                        $submitBtn.html(`<i class="bx bx-loader-alt bx-spin me-1"></i>Enviando... ${percentComplete}%`);
                    }
                }, false);
                return xhr;
            },
            success: function(response) {
                if (response.status === 'success') {
                    $('#modalAdicionarArquivoProcesso').modal('hide');
                    mostrarToast('success', 'Arquivo adicionado!');
                    
                    // Atualização automática usando função centralizada
                    const acaoId = $('#acaoIdProcessos').val();
                    
                    atualizarDadosProcessos(acaoId, currentProcessoId, 200);
                    
                    // Limpar formulário para próximo uso
                    $('#formAdicionarArquivoProcesso')[0].reset();
                } else {
                    mostrarToast('error', response.message || 'Erro ao adicionar arquivo');
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON?.message || 'Erro ao adicionar arquivo';
                mostrarToast('error', errorMsg);
                console.error('[PROCESSOS] Erro ao enviar arquivo:', xhr);
            },
            complete: function() {
                // Reabilitar botão e restaurar texto
                isSubmittingArquivo = false;
                $submitBtn.prop('disabled', false).html(originalText);
            }
        });
    });
    
    // Limpar estados quando modais fecham
    $('#modalCriarEditarProcesso').on('hidden.bs.modal', function() {
        isSubmittingProcesso = false;
        $('#formCriarEditarProcesso button[type="submit"]').prop('disabled', false).html('<i class="bx bx-save me-1"></i>Salvar');
        // Limpar formulário completamente
        $('#formCriarEditarProcesso')[0].reset();
        $('#processoId').val('');
    });
    
    $('#modalAdicionarArquivoProcesso').on('hidden.bs.modal', function() {
        isSubmittingArquivo = false;
        $('#formAdicionarArquivoProcesso button[type="submit"]').prop('disabled', false).html('<i class="bx bx-upload me-1"></i>Enviar Arquivo');
        // Limpar formulário completamente
        $('#formAdicionarArquivoProcesso')[0].reset();
    });
    
    // Otimização: atualizar dados quando modal de gerenciar processos é aberto
    $('#modalGerenciarProcessos').on('shown.bs.modal', function() {
        const acaoId = $('#acaoIdProcessos').val();
        if (acaoId) {
            console.log('[PROCESSOS] Modal aberto, recarregando dados automaticamente...');
            carregarProcessosAcao(acaoId);
        }
    });
    
    // Auto-refresh para manter dados sempre atualizados (opcional)
    // Descomente as linhas abaixo se desejar auto-refresh automático a cada 30 segundos
    /*
    setInterval(function() {
        // Só atualizar se algum modal de processos estiver visível
        if ($('#modalGerenciarProcessos').hasClass('show') || $('#modalDetalhesProcesso').hasClass('show')) {
            const acaoId = $('#acaoIdProcessos').val();
            if (acaoId) {
                console.log('[PROCESSOS] Auto-refresh de dados...');
                atualizarDadosProcessos(acaoId, currentProcessoId, 100);
            }
        }
    }, 30000); // 30 segundos
    */
}); 

// ===== FUNÇÕES UTILITÁRIAS PARA INTERFACE =====

// Função para detectar se estamos no modo detalhes
function estaNoModoDetalhes() {
    return $('#modalDetalhesProcesso').hasClass('show');
}

// Função para otimizar atualizações baseado no contexto atual
function atualizarContextoAtual() {
    const acaoId = $('#acaoIdProcessos').val();
    
    if (estaNoModoDetalhes() && currentProcessoId) {
        // Estamos visualizando detalhes, priorizar atualização dos detalhes
        console.log('[PROCESSOS] Atualizando contexto atual: detalhes do processo');
        setTimeout(() => visualizarProcesso(currentProcessoId), 100);
    } else if ($('#modalGerenciarProcessos').hasClass('show') && acaoId) {
        // Estamos na lista de processos, atualizar a tabela
        console.log('[PROCESSOS] Atualizando contexto atual: lista de processos');
        setTimeout(() => carregarProcessosAcao(acaoId), 100);
    }
}

// Função para feedback visual melhorado
function mostrarFeedbackOperacao(tipo, mensagem, duracao = 3000) {
    const cores = {
        'criado': 'success',
        'atualizado': 'info', 
        'deletado': 'warning',
        'erro': 'danger'
    };
    
    const cor = cores[tipo] || 'info';
    mostrarToast(cor, mensagem);
    
    // Se for sucesso, também mostrar indicador visual rápido
    if (['criado', 'atualizado'].includes(tipo)) {
        $('body').append(`
            <div class="operacao-sucesso position-fixed top-50 start-50 translate-middle" style="z-index: 99999;">
                <div class="alert alert-${cor} alert-dismissible fade show shadow-lg border-0 rounded-pill px-4" role="alert">
                    <i class="bx bx-check-circle me-2"></i>
                    <strong>${mensagem}</strong>
                </div>
            </div>
        `);
        
        setTimeout(() => {
            $('.operacao-sucesso').fadeOut(500, function() {
                $(this).remove();
            });
        }, duracao);
    }
}