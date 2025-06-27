$(document).ready(function() {
    // Inicialização
    carregarMateriais();
    
    // Event listeners para fechar modais (usando delegação para elementos dinâmicos)
    $(document).on('click', '.btn-close, [data-bs-dismiss="modal"]', function() {
        fecharModal($(this).closest('.modal'));
    });
    
    // Fechar modal clicando fora do modal-dialog
    $(document).on('click', '.modal', function(e) {
        if (e.target === this) {
            fecharModal($(this));
        }
    });
    
    // Fechar modal com tecla ESC
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            $('.modal.show').each(function() {
                fecharModal($(this));
            });
        }
    });
});

// Variáveis globais
let materiaisCache = [];

// ================================
// FUNÇÕES DE CARREGAMENTO
// ================================

function carregarMateriais() {
    mostrarLoading(true);
    
    // Carregar todos os materiais ativos sem paginação
    const params = {
        status: '1', // Apenas ativos
        page: 'all'  // Retornar todos os materiais
    };
    
    $.get('/marketing/api/get/materiais/', params)
        .done(function(response) {
            if (response.success) {
                materiaisCache = response.materiais;
                renderizarMateriais(response.materiais);
                
                // Esconder estado vazio se há pelo menos um material
                if (response.materiais.length > 0) {
                    $('#empty-state-global').addClass('d-none');
                    $('#containers-orgaos').removeClass('d-none');
                } else {
                    $('#empty-state-global').removeClass('d-none');
                    $('#containers-orgaos').addClass('d-none');
                }
            } else {
                mostrarAlerta(response.error, 'error');
            }
        })
        .fail(function() {
            mostrarAlerta('Erro ao carregar materiais', 'error');
        })
        .always(function() {
            mostrarLoading(false);
        });
}

// ================================
// FUNÇÕES DE RENDERIZAÇÃO
// ================================

function renderizarMateriais(materiais) {
    const container = $('#containers-orgaos');
    container.empty();
    
    if (materiais.length === 0) {
        return; // Estado vazio será mostrado pela função carregarMateriais
    }
    
    // Agrupar materiais por órgão e depois por produto
    const materiaisPorOrgao = {};
    materiais.forEach(material => {
        const orgaoId = material.produto.orgao.id;
        const produtoId = material.produto.id;
        
        if (!materiaisPorOrgao[orgaoId]) {
            materiaisPorOrgao[orgaoId] = {
                orgao: material.produto.orgao,
                produtos: {}
            };
        }
        
        if (!materiaisPorOrgao[orgaoId].produtos[produtoId]) {
            materiaisPorOrgao[orgaoId].produtos[produtoId] = {
                produto: material.produto,
                materiais: []
            };
        }
        
        materiaisPorOrgao[orgaoId].produtos[produtoId].materiais.push(material);
    });
    
    // Renderizar cada órgão
    Object.values(materiaisPorOrgao).forEach(grupoOrgao => {
        const totalMateriais = Object.values(grupoOrgao.produtos).reduce((acc, grupo) => acc + grupo.materiais.length, 0);
        
        // Criar container do órgão
        const containerOrgaoHtml = `
            <div class="container mb-5">
                <h1 class="titulo-pagina mb-4">
                    <i class='bx bx-building me-2'></i>${grupoOrgao.orgao.titulo}
                    <span class="badge bg-light text-dark ms-3" style="font-size: 0.6em; vertical-align: middle;">
                        ${totalMateriais} ${totalMateriais === 1 ? 'material' : 'materiais'}
                    </span>
                </h1>
                <div id="lista-materiais-orgao-${grupoOrgao.orgao.id}">
                    <!-- Produtos deste órgão serão inseridos aqui -->
                </div>
            </div>
        `;
        
        container.append(containerOrgaoHtml);
        const orgaoContainer = $(`#lista-materiais-orgao-${grupoOrgao.orgao.id}`);
        
        // Renderizar produtos deste órgão
        Object.values(grupoOrgao.produtos).forEach(grupoProduto => {
            const containerProdutoHtml = `
                <div class="container-produto mb-4">
                    <div class="container-produto-header">
                        <h4><i class='bx bx-package me-2'></i>${grupoProduto.produto.titulo}</h4>
                        <span class="badge bg-light text-dark">${grupoProduto.materiais.length} ${grupoProduto.materiais.length === 1 ? 'material' : 'materiais'}</span>
                    </div>
                    <div class="materiais-flex-container" id="materiais-produto-${grupoProduto.produto.id}">
                        <!-- Cards dos materiais serão inseridos aqui com flex-wrap -->
                    </div>
                </div>
            `;
            
            orgaoContainer.append(containerProdutoHtml);
            
            // Renderizar cada material deste produto
            const materiaisContainer = $(`#materiais-produto-${grupoProduto.produto.id}`);
            grupoProduto.materiais.forEach(material => {
                const statusClass = material.status ? 'status-active' : 'status-inactive';
                const statusText = material.status ? 'Ativo' : 'Inativo';
                
                const bannerHtml = material.banner_url 
                    ? `<img src="${material.banner_url}" class="material-banner" alt="${material.titulo}">`
                    : `<div class="material-banner-placeholder">
                           <i class='bx bx-image bx-lg'></i>
                           <p class="mt-2 mb-0">Sem banner</p>
                       </div>`;
                
                const cardHtml = `
                    <div class="card material-card" onclick="mostrarDetalhes(${material.id})">
                        <div class="header-banner">
                            ${bannerHtml}
                            <div class="material-overlay">
                                <span class="status-badge ${statusClass}">${statusText}</span>
                                <span class="download-count">
                                    <i class='bx bx-download me-1'></i>
                                    ${material.total_downloads}
                                </span>
                            </div>
                        </div>
                        <div class="body-titulo">
                            <div class="material-title" title="${material.titulo}">
                                ${material.titulo}
                            </div>
                            <div class="material-info">
                                <div class="info-item">
                                    <i class='bx bx-calendar'></i>
                                    <span>${material.data_criacao}</span>
                                </div>
                                <div class="info-item">
                                    <i class='bx bx-file'></i>
                                    <span>${material.arquivo_nome || 'Arquivo disponível'}</span>
                                </div>
                            </div>
                            <div class="material-actions mt-3">
                                <button type="button" class="btn-download" 
                                        onclick="event.stopPropagation(); confirmarDownload(${material.id}, '${material.titulo}', '${material.produto.titulo}')"
                                        ${!material.status ? 'disabled' : ''}>
                                    <i class='bx bx-download me-1'></i>
                                    ${material.status ? 'Baixar Material' : 'Indisponível'}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                materiaisContainer.append(cardHtml);
            });
        });
    });
    
    // Animação de entrada dos cards
    $('.material-card').each(function(index) {
        $(this).css('opacity', '0').delay(index * 100).animate({opacity: 1}, 300);
    });
}



// ================================
// FUNÇÕES DE MODAL E DETALHES
// ================================

function mostrarDetalhes(materialId) {
    const material = materiaisCache.find(m => m.id === materialId);
    if (!material) {
        mostrarAlerta('Material não encontrado', 'error');
        return;
    }
    
    // Preencher modal de detalhes
    $('#detalhe-titulo').text(material.titulo);
    $('#detalhe-produto').text(material.produto.titulo);
    $('#detalhe-orgao').text(material.produto.orgao.titulo);
    $('#detalhe-data').text(material.data_criacao);
    $('#detalhe-downloads').text(material.total_downloads);
    $('#detalhe-arquivo').text(material.arquivo_nome || 'Arquivo disponível');
    
    const statusHtml = material.status 
        ? '<span class="badge bg-success">Ativo</span>'
        : '<span class="badge bg-danger">Inativo</span>';
    $('#detalhe-status').html(statusHtml);
    
    // Banner no modal
    const bannerHtml = material.banner_url 
        ? `<img src="${material.banner_url}" class="img-fluid rounded" alt="${material.titulo}">`
        : `<div class="text-center p-4 bg-light rounded">
               <i class="fas fa-image fa-3x text-muted"></i>
               <p class="mt-2 mb-0 text-muted">Sem banner</p>
           </div>`;
    $('#detalhe-banner').html(bannerHtml);
    
    // Botão de download no modal
    const btnDownload = $('#btn-download-detalhe');
    if (material.status) {
        btnDownload.prop('disabled', false).attr('onclick', `confirmarDownload(${material.id}, '${material.titulo}', '${material.produto.titulo}')`);
    } else {
        btnDownload.prop('disabled', true).removeAttr('onclick');
    }
    
    // Mostrar modal
    abrirModal('#modalDetalhes');
}

function confirmarDownload(materialId, titulo, produto) {
    $('#download_material_id').val(materialId);
    $('#download-material-titulo').text(titulo);
    $('#download-material-produto').text(produto);
    
    abrirModal('#modalDownload');
}

function confirmarDownloadFinal() {
    const materialId = $('#download_material_id').val();
    const formData = new FormData();
    formData.append('material_id', materialId);
    
    // Desabilitar botão durante o download
    const btn = $('.btn-success').filter(':contains("Baixar")');
    const originalText = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Processando...');
    
    $.ajax({
        url: '/marketing/api/post/download/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            if (response.success) {
                // Fechar modais
                fecharModal($('#modalDownload'));
                fecharModal($('#modalDetalhes'));
                
                // Mostrar sucesso
                mostrarAlerta('Download iniciado com sucesso!', 'success');
                
                // Forçar download
                setTimeout(() => {
                    window.open(response.download_url, '_blank');
                }, 500);
                
                // Atualizar materiais
                setTimeout(() => {
                    carregarMateriais();
                }, 1000);
            } else {
                mostrarAlerta(response.error, 'error');
            }
        },
        error: function() {
            mostrarAlerta('Erro ao processar download', 'error');
        },
        complete: function() {
            btn.prop('disabled', false).html(originalText);
        }
    });
}



// ================================
// FUNÇÕES UTILITÁRIAS
// ================================



function mostrarLoading(show) {
    if (show) {
        // Criar loading dinamicamente se não existe
        if ($('#loading').length === 0) {
            const loadingHtml = `
                <div id="loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Carregando...</span>
                    </div>
                    <p class="mt-3 text-muted">Carregando materiais...</p>
                </div>
            `;
            $('#containers-orgaos').before(loadingHtml);
        }
        
        $('#loading').removeClass('d-none');
        $('#containers-orgaos').addClass('d-none');
        $('#empty-state-global').addClass('d-none');
    } else {
        $('#loading').addClass('d-none');
        // A visibilidade de #containers-orgaos e #empty-state-global será controlada pela função carregarMateriais
    }
}

function mostrarAlerta(message, type = 'info') {
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[type] || 'alert-info';
    
    const iconClass = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert" style="border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <i class="fas ${iconClass} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Remover alertas anteriores
    $('.alert').remove();
    
    // Adicionar novo alerta no topo da página
    $('body').prepend(`
        <div style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 350px; max-width: 400px;">
            ${alertHtml}
        </div>
    `);
    
    // Auto-remover após 6 segundos
    setTimeout(() => {
        $('.alert').fadeOut(300, function() {
            $(this).remove();
        });
    }, 6000);
}

// ================================
// FUNÇÕES DE CONTROLE DE MODAL
// ================================

function abrirModal(modalSelector) {
    const $modal = $(modalSelector);
    if ($modal.length === 0) return;
    
    // Fechar outros modais que possam estar abertos
    $('.modal.show').each(function() {
        fecharModal($(this));
    });
    
    // Mostrar modal
    $modal.css('display', 'block').attr('aria-hidden', 'false');
    
    // Aguardar um frame para garantir que o display foi aplicado
    requestAnimationFrame(() => {
        $modal.addClass('show');
        $('body').addClass('modal-open');
        
        // Focar no modal para acessibilidade
        $modal.focus();
    });
}

function fecharModal($modal) {
    if (!$modal || $modal.length === 0) return;
    
    // Remover classe show para iniciar animação de saída
    $modal.removeClass('show').attr('aria-hidden', 'true');
    
    // Aguardar animação terminar antes de ocultar
    setTimeout(() => {
        $modal.css('display', 'none');
        
        // Remover modal-open apenas se não há outros modais abertos
        if ($('.modal.show').length === 0) {
            $('body').removeClass('modal-open');
        }
    }, 300);
}


