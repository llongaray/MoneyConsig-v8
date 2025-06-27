$(document).ready(function() {
    console.log('[MINHAS_ACOES] Página carregada, inicializando funcionalidades...');
    inicializarMascaras();
    carregarMinhasAcoes();
    configurarFiltros();
    configurarFormularios();
});

function configurarFormularios() {
    console.log('[CONFIGURAR_FORMULARIOS] Configurando eventos dos formulários...');
    
    // Formulário de adicionar arquivos
    $('#formAdicionarArquivos').on('submit', function(e) {
        e.preventDefault();
        enviarArquivos();
    });
}

function inicializarMascaras() {
    console.log('[INICIALIZAR_MASCARAS] Aplicando máscaras...');
    $('#filtroCPFMinhas').mask('000.000.000-00');
}

function configurarFiltros() {
    console.log('[CONFIGURAR_FILTROS] Configurando filtros de busca...');
    
    $('#filtroNomeMinhas, #filtroCPFMinhas, #filtroStatusMinhas').on('input change', function() {
        console.log('[FILTROS] Filtro alterado, recarregando lista...');
        carregarMinhasAcoes();
    });
}

function carregarMinhasAcoes() {
    console.log('[CARREGAR_MINHAS_ACOES] Iniciando carregamento das minhas ações...');
    
    const nome = $('#filtroNomeMinhas').val();
    const cpf = $('#filtroCPFMinhas').val();
    const status = $('#filtroStatusMinhas').val();
    
    const params = new URLSearchParams();
    if (nome) params.append('nome', nome);
    if (cpf) params.append('cpf', cpf);
    if (status) params.append('status', status);
    
    $.ajax({
        url: `/juridico/api/minhas-acoes-completa/?${params.toString()}`,
        method: 'GET',
        dataType: 'json',
        success: function(response) {
            console.log('[CARREGAR_MINHAS_ACOES] Resposta recebida:', response);
            if (response.status === 'success') {
                preencherTabelaMinhasAcoes(response.data);
            } else {
                console.error('[CARREGAR_MINHAS_ACOES] Erro na resposta:', response);
                mostrarErro('Erro ao carregar minhas ações: ' + (response.message || 'Erro desconhecido'));
            }
        },
        error: function(xhr, status, error) {
            console.error('[CARREGAR_MINHAS_ACOES] Erro na requisição:', {xhr, status, error});
            mostrarErro('Erro ao carregar minhas ações. Tente novamente.');
        }
    });
}

function preencherTabelaMinhasAcoes(acoes) {
    console.log('[PREENCHER_TABELA_MINHAS_ACOES] Preenchendo tabela com', acoes.length, 'ações');
    
    const tbody = $('#tabelaMinhasAcoes tbody');
    tbody.empty();
    
    if (acoes.length === 0) {
        $('#nenhumResultadoMinhasAcoes').show();
        return;
    }
    
    $('#nenhumResultadoMinhasAcoes').hide();
    
    acoes.forEach(acao => {
        const linha = `
            <tr>
                <td class="text-center">${acao.cliente_nome}</td>
                <td class="text-center">${formatarCPF(acao.cliente_cpf)}</td>
                <td class="text-center">${acao.tipo_acao}</td>
                <td class="text-center">${acao.data_criacao}</td>
                <td class="text-center">
                    <span class="badge ${getStatusColor(acao.status)}">${acao.status}</span>
                </td>
                <td class="text-center">${acao.sentenca}</td>
                <td class="text-center">${acao.loja}</td>
                <td class="text-center">
                    ${criarBotoesAcaoMinhas(acao)}
                </td>
            </tr>
        `;
        tbody.append(linha);
    });
}

function criarBotoesAcaoMinhas(acao) {
    let botoes = `
        <button class="btn btn-info btn-sm me-1" onclick="visualizarDadosAcao(${acao.id})" data-tooltip="Ver Detalhes">
            <i class='bx bx-show'></i>
        </button>
    `;
    
    // Botão para adicionar arquivos (só se status for 'EM_ESPERA' ou 'INCOMPLETO')
    const statusValue = getStatusValueFromDisplay(acao.status);
    if (statusValue === 'EM_ESPERA' || statusValue === 'INCOMPLETO') {
        botoes += `
            <button class="btn btn-primary btn-sm" onclick="adicionarArquivos(${acao.id})" data-tooltip="Adicionar Arquivos">
                <i class='bx bx-upload'></i>
            </button>
        `;
    }
    
    return botoes;
}

function formatarCPF(cpf) {
    if (!cpf) return 'N/A';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function getStatusColor(status) {
    const cores = {
        'Em Espera': 'bg-warning text-dark',
        'Em Despacho': 'bg-info text-white',
        'Protocolado': 'bg-primary text-white',
        'Finalizado': 'bg-success text-white',
        'Incompleto': 'bg-danger text-white'
    };
    return cores[status] || 'bg-secondary text-white';
}

function getStatusDisplayFromValue(statusValue) {
    const statusMap = {
        'EM_ESPERA': 'Em Espera',
        'INCOMPLETO': 'Incompleto',
        'EM_DESPACHO': 'Em Despacho',
        'PROTOCOLADO': 'Protocolado',
        'FINALIZADO': 'Finalizado'
    };
    return statusMap[statusValue] || statusValue;
}

function getStatusValueFromDisplay(statusDisplay) {
    const displayMap = {
        'Em Espera': 'EM_ESPERA',
        'Incompleto': 'INCOMPLETO',
        'Em Despacho': 'EM_DESPACHO',
        'Protocolado': 'PROTOCOLADO',
        'Finalizado': 'FINALIZADO'
    };
    return displayMap[statusDisplay] || statusDisplay;
}

function visualizarDadosAcao(acaoId) {
    console.log('[VISUALIZAR_DADOS_ACAO] Carregando dados da ação ID:', acaoId);
    
    $('#conteudoDetalhesAcao').html(`
        <div class="text-center">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Carregando...</span>
            </div>
            <p class="mt-2">Carregando dados da ação...</p>
        </div>
    `);
    
    $('#modalDetalhesAcao').modal('show');
    
    $.ajax({
        url: `/juridico/api_get_acao/${acaoId}/`,
        method: 'GET',
        dataType: 'json',
        success: function(response) {
            console.log('[VISUALIZAR_DADOS_ACAO] Resposta recebida:', response);
            if (response.success === true) {
                preencherDetalhesAcao(response.data);
            } else {
                $('#conteudoDetalhesAcao').html(`
                    <div class="alert alert-danger">
                        <i class='bx bx-error-circle me-2'></i>${response.message || 'Erro ao carregar informações da ação'}
                    </div>
                `);
            }
        },
        error: function(xhr, status, error) {
            console.error('[VISUALIZAR_DADOS_ACAO] Erro na requisição:', {xhr, status, error});
            $('#conteudoDetalhesAcao').html(`
                <div class="alert alert-danger">
                    <i class='bx bx-error-circle me-2'></i>Erro ao carregar informações da ação. Tente novamente.
                </div>
            `);
        }
    });
}

function preencherDetalhesAcao(acao) {
    const statusDisplay = getStatusDisplayFromValue(acao.status_emcaminhamento);
    
    // Separar arquivos e documentos
    const arquivos = acao.documentos_acao ? acao.documentos_acao.filter(doc => doc.tipo === 'arquivo') : [];
    const documentos = acao.documentos_acao ? acao.documentos_acao.filter(doc => doc.tipo === 'documento') : [];
    
    const html = `
        <!-- Informações do Cliente -->
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-light">
                        <h6 class="mb-0"><i class='bx bx-user me-2'></i>Informações do Cliente</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>Nome:</strong> ${acao.nome_cliente || 'N/A'}</p>
                        <p><strong>CPF:</strong> ${formatarCPF(acao.cpf_cliente) || 'N/A'}</p>
                        <p><strong>Contato:</strong> ${acao.contato_cliente || 'N/A'}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-light">
                        <h6 class="mb-0"><i class='bx bx-file me-2'></i>Informações da Ação</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>Tipo:</strong> ${acao.tipo_acao || 'N/A'}</p>
                        <p><strong>Status:</strong> <span class="badge ${getStatusColor(statusDisplay)}">${statusDisplay || 'N/A'}</span></p>
                        <p><strong>Data de Criação:</strong> ${acao.data_criacao || 'N/A'}</p>
                        <p><strong>Loja:</strong> ${acao.loja || 'N/A'}</p>
                        <p><strong>Advogado:</strong> ${acao.advogado_nome || 'N/A'}</p>
                        ${acao.numero_protocolo ? `<p><strong>Número do Protocolo:</strong> ${acao.numero_protocolo}</p>` : ''}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Observação de Incompleto -->
        ${acao.status_emcaminhamento === 'INCOMPLETO' && acao.motivo_incompleto && acao.motivo_incompleto.trim() !== '' ? `
            <div class="row mb-4">
                <div class="col-12">
                    <div class="card border-warning">
                        <div class="card-header bg-warning text-dark">
                            <h6 class="mb-0"><i class='bx bx-error-circle me-2'></i>Observação - Documentação Incompleta</h6>
                        </div>
                        <div class="card-body">
                            <p class="mb-0">${acao.motivo_incompleto}</p>
                        </div>
                    </div>
                </div>
            </div>
        ` : ''}
        
        <!-- Arquivos da Ação (ArquivosAcoesINSS) -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header bg-light">
                        <h6 class="mb-0"><i class='bx bx-folder me-2'></i>Arquivos da Ação</h6>
                    </div>
                    <div class="card-body">
                        ${arquivos.length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-sm table-hover">
                                    <thead>
                                        <tr>
                                            <th>Título</th>
                                            <th>Data de Upload</th>
                                            <th class="text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${arquivos.map(arquivo => `
                                            <tr>
                                                <td>${arquivo.titulo}</td>
                                                <td>${arquivo.data_import ? new Date(arquivo.data_import).toLocaleDateString('pt-BR') : 'N/A'}</td>
                                                <td class="text-center">
                                                    <button class="btn btn-info btn-sm me-1" onclick="visualizarArquivo(${arquivo.id}, 'arquivo')" data-tooltip="Visualizar">
                                                        <i class='bx bx-show'></i>
                                                    </button>
                                                    <button class="btn btn-primary btn-sm" onclick="baixarArquivo(${arquivo.id}, 'arquivo')" data-tooltip="Baixar">
                                                        <i class='bx bx-download'></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="alert alert-info text-center mb-0">
                                <i class='bx bx-info-circle me-2'></i>Nenhum arquivo encontrado.
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Documentos da Ação (DocAcoesINSS) -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header bg-light">
                        <h6 class="mb-0"><i class='bx bx-file-blank me-2'></i>Documentos da Ação</h6>
                    </div>
                    <div class="card-body">
                        ${documentos.length > 0 ? `
                            <div class="table-responsive">
                                <table class="table table-sm table-hover">
                                    <thead>
                                        <tr>
                                            <th>Título</th>
                                            <th>Data de Upload</th>
                                            <th class="text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${documentos.map(documento => `
                                            <tr>
                                                <td>${documento.titulo}</td>
                                                <td>${documento.data_import ? new Date(documento.data_import).toLocaleDateString('pt-BR') : 'N/A'}</td>
                                                <td class="text-center">
                                                    <button class="btn btn-info btn-sm me-1" onclick="visualizarArquivo(${documento.id}, 'documento')" data-tooltip="Visualizar">
                                                        <i class='bx bx-show'></i>
                                                    </button>
                                                    <button class="btn btn-primary btn-sm" onclick="baixarArquivo(${documento.id}, 'documento')" data-tooltip="Baixar">
                                                        <i class='bx bx-download'></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="alert alert-info text-center mb-0">
                                <i class='bx bx-info-circle me-2'></i>Nenhum documento encontrado.
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Processos -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header bg-light">
                        <h6 class="mb-0"><i class='bx bx-briefcase me-2'></i>Processos</h6>
                    </div>
                    <div class="card-body">
                        <div id="listaProcessos">
                            <div class="text-center">
                                <div class="spinner-border spinner-border-sm text-primary" role="status">
                                    <span class="visually-hidden">Carregando...</span>
                                </div>
                                <p class="mt-2 mb-0">Carregando processos...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $('#conteudoDetalhesAcao').html(html);
    
    // Carregar processos da ação
    carregarProcessosAcao(acao.id);
}

function carregarProcessosAcao(acaoId) {
    console.log('[CARREGAR_PROCESSOS] Carregando processos da ação ID:', acaoId);
    
    $.ajax({
        url: `/juridico/api/processos-acao/${acaoId}/`,
        method: 'GET',
        dataType: 'json',
        success: function(response) {
            console.log('[CARREGAR_PROCESSOS] Resposta recebida:', response);
            if (response.success === true && response.data) {
                preencherListaProcessos(response.data);
            } else {
                $('#listaProcessos').html(`
                    <div class="alert alert-info text-center mb-0">
                        <i class='bx bx-info-circle me-2'></i>Nenhum processo encontrado para esta ação.
                    </div>
                `);
            }
        },
        error: function(xhr, status, error) {
            console.error('[CARREGAR_PROCESSOS] Erro na requisição:', {xhr, status, error});
            $('#listaProcessos').html(`
                <div class="alert alert-info text-center mb-0">
                    <i class='bx bx-info-circle me-2'></i>Nenhum processo encontrado para esta ação.
                </div>
            `);
        }
    });
}

function preencherListaProcessos(processos) {
    if (processos.length === 0) {
        $('#listaProcessos').html(`
            <div class="alert alert-info text-center mb-0">
                <i class='bx bx-info-circle me-2'></i>Nenhum processo encontrado para esta ação.
            </div>
        `);
        return;
    }
    
    const html = `
        <div class="table-responsive">
            <table class="table table-sm table-hover">
                <thead>
                    <tr>
                        <th>Título</th>
                        <th>Número</th>
                        <th>Data Início</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${processos.map(processo => `
                        <tr>
                            <td>${processo.titulo || 'N/A'}</td>
                            <td>${processo.numero_processo || 'N/A'}</td>
                            <td>${processo.data_inicio ? new Date(processo.data_inicio).toLocaleDateString('pt-BR') : 'N/A'}</td>
                            <td><span class="badge ${getProcessoStatusColor(processo.status)}">${processo.status || 'N/A'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    $('#listaProcessos').html(html);
}

function getProcessoStatusColor(status) {
    const cores = {
        'ATIVO': 'bg-success text-white',
        'FINALIZADO': 'bg-primary text-white',
        'ARQUIVADO': 'bg-secondary text-white',
        'INATIVO': 'bg-danger text-white'
    };
    return cores[status] || 'bg-secondary text-white';
}

function visualizarArquivo(arquivoId, tipo) {
    console.log('[VISUALIZAR_ARQUIVO] Abrindo arquivo ID:', arquivoId, 'Tipo:', tipo);
    
    const url = tipo === 'arquivo' ? 
        `/juridico/serve/arquivo-acao/${arquivoId}/` :         // ArquivosAcoesINSS
        `/juridico/serve/documento-acao/${arquivoId}/`;        // DocsAcaoINSS
    
    window.open(url, '_blank');
}

function baixarArquivo(arquivoId, tipo) {
    console.log('[BAIXAR_ARQUIVO] Baixando arquivo ID:', arquivoId, 'Tipo:', tipo);
    
    const url = tipo === 'arquivo' ? 
        `/juridico/download/arquivo-acao/${arquivoId}/` :      // ArquivosAcoesINSS
        `/juridico/download/documento-acao/${arquivoId}/`;     // DocsAcaoINSS
    
    const link = document.createElement('a');
    link.href = url;
    link.download = true;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function adicionarArquivos(acaoId) {
    console.log('[ADICIONAR_ARQUIVOS] Abrindo modal para ação ID:', acaoId);
    
    // Limpar formulário
    $('#formAdicionarArquivos')[0].reset();
    $('#acaoIdArquivos').val(acaoId);
    
    // Resetar container de arquivos para apenas um campo
    $('#arquivosContainer').html(`
        <div class="arquivo-item mb-3">
            <div class="row">
                <div class="col-md-6">
                    <input type="text" class="form-control" name="titulo_arquivo_0" placeholder="Título do arquivo..." required>
                </div>
                <div class="col-md-5">
                    <input type="file" class="form-control" name="arquivo_0" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" required>
                </div>
                <div class="col-md-1">
                    <button type="button" class="btn btn-danger btn-sm" onclick="removerArquivo(this)" style="display: none;">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            </div>
        </div>
    `);
    
    // Mostrar modal
    $('#modalAdicionarArquivos').modal('show');
}

function adicionarCampoArquivo() {
    console.log('[ADICIONAR_CAMPO_ARQUIVO] Adicionando novo campo de arquivo...');
    
    const container = $('#arquivosContainer');
    const novoIndice = container.children().length;
    
    const novoCampo = `
        <div class="arquivo-item mb-3">
            <div class="row">
                <div class="col-md-6">
                    <input type="text" class="form-control" name="titulo_arquivo_${novoIndice}" placeholder="Título do arquivo..." required>
                </div>
                <div class="col-md-5">
                    <input type="file" class="form-control" name="arquivo_${novoIndice}" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" required>
                </div>
                <div class="col-md-1">
                    <button type="button" class="btn btn-danger btn-sm" onclick="removerArquivo(this)">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.append(novoCampo);
    
    // Mostrar botão de remover no primeiro campo se houver mais de um
    if (container.children().length > 1) {
        container.children().first().find('.btn-danger').show();
    }
}

function removerArquivo(btn) {
    console.log('[REMOVER_ARQUIVO] Removendo campo de arquivo...');
    
    const container = $('#arquivosContainer');
    $(btn).closest('.arquivo-item').remove();
    
    // Reindexar os campos restantes
    container.children().each(function(index) {
        $(this).find('input[type="text"]').attr('name', `titulo_arquivo_${index}`);
        $(this).find('input[type="file"]').attr('name', `arquivo_${index}`);
    });
    
    // Esconder botão de remover no primeiro campo se só houver um
    if (container.children().length === 1) {
        container.children().first().find('.btn-danger').hide();
    }
}

function enviarArquivos() {
    console.log('[ENVIAR_ARQUIVOS] Iniciando envio de arquivos...');
    
    const formData = new FormData();
    const acaoId = $('#acaoIdArquivos').val();
    
    if (!acaoId) {
        mostrarErro('ID da ação não encontrado.');
        return;
    }
    
    formData.append('acao_id', acaoId);
    
    // Coletar todos os arquivos e títulos
    let arquivosEncontrados = false;
    $('#arquivosContainer .arquivo-item').each(function(index) {
        const titulo = $(this).find('input[type="text"]').val();
        const arquivo = $(this).find('input[type="file"]')[0].files[0];
        
        if (titulo && titulo.trim() !== '' && arquivo) {
            formData.append(`titulo_arquivo_${index}`, titulo);
            formData.append(`arquivo_${index}`, arquivo);
            arquivosEncontrados = true;
        }
    });
    
    if (!arquivosEncontrados) {
        mostrarErro('Pelo menos um título e arquivo são obrigatórios.');
        return;
    }
    
    // Desabilitar botão de envio
    const btnEnviar = $('#formAdicionarArquivos button[type="submit"]');
    const textoOriginal = btnEnviar.html();
    btnEnviar.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i>Enviando...');
    
    $.ajax({
        url: '/juridico/api/acoes/upload-arquivo-acao/',
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('[ENVIAR_ARQUIVOS] Resposta recebida:', response);
            if (response.status === 'success') {
                let mensagem = response.message;
                if (response.status_atualizado) {
                    mensagem += ' A ação foi movida para "Em Espera".';
                }
                mostrarSucesso(mensagem);
                $('#modalAdicionarArquivos').modal('hide');
                // Recarregar a página para atualizar a lista
                location.reload();
            } else {
                mostrarErro('Erro ao enviar arquivos: ' + (response.message || 'Erro desconhecido'));
            }
        },
        error: function(xhr, status, error) {
            console.error('[ENVIAR_ARQUIVOS] Erro na requisição:', {xhr, status, error});
            mostrarErro('Erro ao enviar arquivos. Tente novamente.');
        },
        complete: function() {
            // Reabilitar botão
            btnEnviar.prop('disabled', false).html(textoOriginal);
        }
    });
}

function mostrarErro(mensagem) {
    console.error('[ERRO]', mensagem);
    // Implementar sistema de notificações ou usar toast
    alert('Erro: ' + mensagem);
}

function mostrarSucesso(mensagem) {
    console.log('[SUCESSO]', mensagem);
    // Implementar sistema de notificações ou usar toast
    alert('Sucesso: ' + mensagem);
}

function mostrarInfo(mensagem) {
    console.info('[INFO]', mensagem);
    // Implementar sistema de notificações ou usar toast
    alert('Info: ' + mensagem);
} 