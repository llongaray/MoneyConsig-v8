// Aguardar jQuery estar disponível
$(document).ready(function() {
    // Verificar se jQuery está disponível
    if (typeof $ === 'undefined') {
        console.error('jQuery não está carregado!');
        return;
    }
    // Debug: verificar elementos disponíveis na página
    console.log('Elementos encontrados na página:');
    console.log('- #lista-materiais:', $('#lista-materiais').length > 0);
    console.log('- #filtro_busca:', $('#filtro_busca').length > 0);
    console.log('- #filtro_orgao:', $('#filtro_orgao').length > 0);
    console.log('- #filtro_produto:', $('#filtro_produto').length > 0);
    console.log('- #formMaterial:', $('#formMaterial').length > 0);
    
    // Inicialização
    carregarOrgaos();
    carregarProdutos();
    
    // Só carregar tabela se os elementos existirem (para páginas de listagem)
    if ($('#lista-materiais').length > 0) {
        console.log('Carregando tabela de materiais...');
        carregarTabelaMateriais();
    } else {
        console.log('Página de formulário detectada - não carregando tabela de materiais');
    }
    
    // Event listeners para formulários
    $('#formMaterial').on('submit', salvarMaterial);
    $('#formProduto').on('submit', salvarProduto);
    $('#formOrgao').on('submit', salvarOrgao);
    
    // Event listeners para uploads
    $('#banner').on('change', function() {
        mostrarPreviewBanner(this);
    });
    
    $('#arquivo').on('change', function() {
        mostrarPreviewArquivo(this);
    });
    
    // Event listener para busca (só se o elemento existir)
    if ($('#filtro_busca').length > 0) {
        $('#filtro_busca').on('keyup', function(e) {
            if (e.key === 'Enter') {
                filtrarMateriais();
            }
        });
    }
    
    // Event listener para filtro de órgão (só se o elemento existir)
    if ($('#filtro_orgao').length > 0) {
        $('#filtro_orgao').on('change', function() {
            atualizarProdutosPorOrgao();
        });
    }
});

// ================================
// VARIÁVEIS GLOBAIS
// ================================
let paginaAtual = 1;
let totalPaginas = 1;
let produtos = [];
let orgaos = [];

// ================================
// CARREGAMENTO DE DADOS
// ================================

function carregarOrgaos() {
    $.get('/marketing/api/get/orgaos/')
        .done(function(response) {
            if (response.success) {
                orgaos = response.orgaos;
                
                // Popular dropdown do formulário de produto
                let optionsProduto = '<option value="">Selecione um órgão</option>';
                orgaos.forEach(orgao => {
                    optionsProduto += `<option value="${orgao.id}">${orgao.titulo} (${orgao.total_produtos} produtos)</option>`;
                });
                $('#orgao_id').html(optionsProduto);
                
                // Popular dropdown de filtro (se existir)
                if ($('#filtro_orgao').length > 0) {
                    let optionsFiltro = '<option value="">Todos os órgãos</option>';
                    orgaos.forEach(orgao => {
                        optionsFiltro += `<option value="${orgao.id}">${orgao.titulo} (${orgao.total_produtos})</option>`;
                    });
                    $('#filtro_orgao').html(optionsFiltro);
                }
            }
        })
        .fail(function() {
            mostrarAlerta('Erro ao carregar órgãos', 'error');
        });
}

function carregarProdutos() {
    $.get('/marketing/api/get/infogeral/')
        .done(function(response) {
            if (response.success) {
                produtos = response.produtos;
                
                // Popular dropdown do formulário de material
                let options = '<option value="">Selecione um produto</option>';
                produtos.forEach(produto => {
                    options += `<option value="${produto.id}">${produto.titulo} - ${produto.orgao.titulo} (${produto.total_materiais} materiais)</option>`;
                });
                $('#produto_id').html(options);
                
                // Popular dropdown de filtro (se existir)
                if ($('#filtro_produto').length > 0) {
                    let optionsFiltro = '<option value="">Todos os produtos</option>';
                    produtos.forEach(produto => {
                        optionsFiltro += `<option value="${produto.id}">${produto.titulo} - ${produto.orgao.titulo} (${produto.total_materiais})</option>`;
                    });
                    $('#filtro_produto').html(optionsFiltro);
                }
                
                // Atualizar contador total (se o elemento existir)
                if ($('#total-materiais').length > 0) {
                    $('#total-materiais').text(response.estatisticas.total_materiais + ' materiais');
                }
            }
        })
        .fail(function() {
            mostrarAlerta('Erro ao carregar produtos', 'error');
        });
}

function atualizarProdutosPorOrgao() {
    // Verificar se os elementos necessários existem
    if ($('#filtro_orgao').length === 0 || $('#filtro_produto').length === 0) {
        return;
    }
    
    const orgaoSelecionado = $('#filtro_orgao').val();
    
    let produtosFiltrados = produtos;
    if (orgaoSelecionado) {
        produtosFiltrados = produtos.filter(produto => produto.orgao.id == orgaoSelecionado);
    }
    
    // Atualizar dropdown de filtro de produtos
    let optionsFiltro = '<option value="">Todos os produtos</option>';
    produtosFiltrados.forEach(produto => {
        optionsFiltro += `<option value="${produto.id}">${produto.titulo} - ${produto.orgao.titulo} (${produto.total_materiais})</option>`;
    });
    $('#filtro_produto').html(optionsFiltro);
    
    // Aplicar filtro automaticamente
    filtrarMateriais();
}

function carregarTabelaMateriais(pagina = 1) {
    // Verificar se os elementos necessários existem
    if ($('#lista-materiais').length === 0) {
        return; // Não fazer nada se não estiver em uma página de listagem
    }
    
    mostrarLoading(true);
    
    const params = {
        page: pagina,
        search: $('#filtro_busca').length > 0 ? $('#filtro_busca').val().trim() : '',
        produto_id: $('#filtro_produto').length > 0 ? $('#filtro_produto').val() : '',
        status: $('#filtro_status').length > 0 ? $('#filtro_status').val() : ''
    };
    
    $.get('/marketing/api/get/materiais/', params)
        .done(function(response) {
            if (response.success) {
                paginaAtual = response.pagination.current_page;
                totalPaginas = response.pagination.total_pages;
                
                renderizarListaMateriais(response.materiais);
                renderizarPaginacao(response.pagination);
                
                // Atualizar contador (se o elemento existir)
                if ($('#total-materiais').length > 0) {
                    $('#total-materiais').text(response.pagination.total_items + ' materiais');
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
// RENDERIZAÇÃO
// ================================

function renderizarListaMateriais(materiais) {
    const container = $('#lista-materiais');
    container.empty();
    
    if (materiais.length === 0) {
        container.html(`
            <div class="col-12">
                <div class="text-center py-5">
                    <i class='bx bx-folder-open' style="font-size: 3rem; color: var(--color-text-light);"></i>
                    <h5 class="mt-3 text-muted">Nenhum material encontrado</h5>
                    <p class="text-muted">Não há materiais cadastrados com os filtros aplicados.</p>
                </div>
            </div>
        `);
        return;
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
    
    // Renderizar containers por órgão
    Object.values(materiaisPorOrgao).forEach(grupoOrgao => {
        const totalMateriais = Object.values(grupoOrgao.produtos).reduce((acc, grupo) => acc + grupo.materiais.length, 0);
        
        const orgaoHeaderHtml = `
            <div class="col-12 mb-3">
                <div class="container-orgao">
                    <div class="container-orgao-header">
                        <h3><i class='bx bx-building me-2'></i>${grupoOrgao.orgao.titulo}</h3>
                        <span class="badge bg-light text-dark">${totalMateriais} ${totalMateriais === 1 ? 'material' : 'materiais'}</span>
                    </div>
                    <div class="container-orgao-body" id="orgao-${grupoOrgao.orgao.id}">
                        <!-- Produtos deste órgão serão inseridos aqui -->
                    </div>
                </div>
            </div>
        `;
        
        container.append(orgaoHeaderHtml);
        const orgaoContainer = $(`#orgao-${grupoOrgao.orgao.id}`);
        
        // Renderizar produtos deste órgão
        Object.values(grupoOrgao.produtos).forEach(grupoProduto => {
            const containerHtml = `
                <div class="mb-4">
                    <div class="container-produto">
                        <div class="container-produto-header">
                            <h4><i class='bx bx-package me-2'></i>${grupoProduto.produto.titulo}</h4>
                            <span class="badge bg-light text-dark">${grupoProduto.materiais.length} ${grupoProduto.materiais.length === 1 ? 'material' : 'materiais'}</span>
                        </div>
                        <div class="container-produto-body">
                            <div class="row" id="materiais-produto-${grupoProduto.produto.id}">
                                <!-- Cards dos materiais serão inseridos aqui -->
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            orgaoContainer.append(containerHtml);
            
            // Renderizar cards dos materiais deste produto
            const materiaisContainer = $(`#materiais-produto-${grupoProduto.produto.id}`);
            grupoProduto.materiais.forEach(material => {
                const bannerHtml = material.banner_url 
                    ? `<img src="${material.banner_url}" class="material-banner" alt="${material.titulo}">`
                    : `<div class="material-banner-placeholder">
                           <i class='bx bx-image' style="font-size: 2rem;"></i>
                           <small>Sem banner</small>
                       </div>`;
                
                const cardHtml = `
                    <div class="col-lg-3 col-md-4 col-sm-6 mb-3">
                        <div class="card">
                            <div class="card-header-material">
                                ${bannerHtml}
                                <button type="button" class="btn-download-header" 
                                        onclick="baixarMaterial(${material.id})" 
                                        title="Download">
                                    <i class='bx bx-download'></i>
                                </button>
                            </div>
                            <div class="card-body">
                                <h6 class="card-title">${material.titulo}</h6>
                                <div class="card-meta">
                                    <small class="text-muted">
                                        <i class='bx bx-calendar me-1'></i>${material.data_criacao}
                                    </small>
                                    <small class="text-muted">
                                        <i class='bx bx-download me-1'></i>${material.total_downloads}
                                    </small>
                                </div>
                                <div class="card-actions mt-2">
                                    <button type="button" class="btn btn-sm btn-outline-primary" 
                                            onclick="editarMaterial(${material.id})" 
                                            title="Editar">
                                        <i class='bx bx-edit'></i>
                                    </button>
                                    <button type="button" class="btn btn-sm btn-outline-danger" 
                                            onclick="confirmarExclusaoMaterial(${material.id})" 
                                            title="Excluir">
                                        <i class='bx bx-trash'></i>
                                    </button>
                                    <span class="status-badge-small ${material.status ? 'status-active' : 'status-inactive'}">
                                        ${material.status ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                materiaisContainer.append(cardHtml);
            });
        });
    });
}

function renderizarPaginacao(pagination) {
    const container = $('#paginacao');
    container.empty();
    
    if (pagination.total_pages <= 1) return;
    
    let html = '';
    
    // Botão anterior
    if (pagination.has_previous) {
                    html += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="carregarTabelaMateriais(${pagination.current_page - 1})">
                        <i class='bx bx-chevron-left'></i>
                    </a>
                </li>
            `;
    }
    
    // Números das páginas
    const startPage = Math.max(1, pagination.current_page - 2);
    const endPage = Math.min(pagination.total_pages, pagination.current_page + 2);
    
            for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === pagination.current_page ? 'active' : '';
            html += `
                <li class="page-item ${activeClass}">
                    <a class="page-link" href="#" onclick="carregarTabelaMateriais(${i})">${i}</a>
                </li>
            `;
        }
    
    // Botão próximo
    if (pagination.has_next) {
                    html += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="carregarTabelaMateriais(${pagination.current_page + 1})">
                        <i class='bx bx-chevron-right'></i>
                    </a>
                </li>
            `;
    }
    
    container.html(html);
}

// ================================
// FORMULÁRIOS
// ================================

function salvarMaterial(e) {
    e.preventDefault();
    
    const form = $(this);
    const formData = new FormData(form[0]);
    const btn = form.find('button[type="submit"]');
    const isEdit = $('#material_id').val() !== '';
    
    // Corrigir valor do checkbox de status
    if (isEdit) {
        const statusChecked = $('#material_status').is(':checked');
        formData.set('status', statusChecked ? '1' : '0');
    }
    
    // Desabilitar botão
    const originalText = btn.html();
    const loadingText = isEdit ? '<i class="fas fa-spinner fa-spin me-2"></i>Atualizando...' : '<i class="fas fa-spinner fa-spin me-2"></i>Salvando...';
    btn.prop('disabled', true).html(loadingText);
    
    $.ajax({
        url: '/marketing/api/post/material/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            if (response.success) {
                mostrarAlerta(response.message, 'success');
                
                // Se foi edição, cancelar modo de edição
                if (isEdit) {
                    cancelarEdicaoMaterial();
                } else {
                    limparFormularioMaterial();
                }
                
                carregarTabelaMateriais(paginaAtual);
                carregarProdutos(); // Recarregar para atualizar contadores
            } else {
                mostrarAlerta(response.error, 'error');
            }
        },
        error: function(xhr) {
            const response = xhr.responseJSON;
            const errorMsg = response?.error || (isEdit ? 'Erro ao atualizar material' : 'Erro ao salvar material');
            mostrarAlerta(errorMsg, 'error');
        },
        complete: function() {
            btn.prop('disabled', false).html(originalText);
        }
    });
}

function salvarProduto(e) {
    e.preventDefault();
    
    const form = $(this);
    const formData = new FormData(form[0]);
    const btn = form.find('button[type="submit"]');
    
    // Desabilitar botão
    const originalText = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Criando...');
    
    $.ajax({
        url: '/marketing/api/post/produto/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            if (response.success) {
                mostrarAlerta(response.message, 'success');
                limparFormularioProduto();
                carregarOrgaos(); // Recarregar órgãos para atualizar contadores
                carregarProdutos(); // Recarregar produtos
            } else {
                mostrarAlerta(response.error, 'error');
            }
        },
        error: function(xhr) {
            const response = xhr.responseJSON;
            const errorMsg = response?.error || 'Erro ao criar produto';
            mostrarAlerta(errorMsg, 'error');
        },
        complete: function() {
            btn.prop('disabled', false).html(originalText);
        }
    });
}

function salvarOrgao(e) {
    e.preventDefault();
    
    const form = $(this);
    const formData = new FormData(form[0]);
    const btn = form.find('button[type="submit"]');
    
    // Desabilitar botão
    const originalText = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Criando...');
    
    $.ajax({
        url: '/marketing/api/post/orgao/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            if (response.success) {
                mostrarAlerta(response.message, 'success');
                limparFormularioOrgao();
                carregarOrgaos();
                carregarProdutos(); // Recarregar produtos para atualizar dropdowns
            } else {
                mostrarAlerta(response.error, 'error');
            }
        },
        error: function(xhr) {
            const response = xhr.responseJSON;
            const errorMsg = response?.error || 'Erro ao criar órgão';
            mostrarAlerta(errorMsg, 'error');
        },
        complete: function() {
            btn.prop('disabled', false).html(originalText);
        }
    });
}

// ================================
// UPLOAD E PREVIEW
// ================================

function mostrarPreviewBanner(input) {
    const file = input.files[0];
    const preview = $('#banner-preview');
    
    if (file) {
        // Validar se é imagem
        if (!file.type.startsWith('image/')) {
            mostrarAlerta('Por favor, selecione apenas arquivos de imagem', 'error');
            input.value = '';
            return;
        }
        
        // Validar tamanho (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            mostrarAlerta('O arquivo deve ter no máximo 5MB', 'error');
            input.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.addClass('has-image').html(`
                <img src="${e.target.result}" alt="Preview do banner">
            `);
        };
        reader.readAsDataURL(file);
        
        $('.banner-upload').addClass('upload-success');
    }
}

function mostrarPreviewArquivo(input) {
    const file = input.files[0];
    const preview = $('#arquivo-preview');
    
    if (file) {
        // Validar tamanho (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
            mostrarAlerta('O arquivo deve ter no máximo 50MB', 'error');
            input.value = '';
            return;
        }
        
        const fileName = file.name;
        const fileSize = formatarTamanhoArquivo(file.size);
        
        preview.addClass('has-file').html(`
            <i class='bx bx-file-blank'></i>
            <p><strong>${fileName}</strong></p>
            <small>${fileSize} - Será convertido para ZIP</small>
        `);
        
        $('.arquivo-upload').addClass('upload-success');
    }
}

// ================================
// AÇÕES DOS MATERIAIS
// ================================

function editarMaterial(materialId) {
    $.get(`/marketing/api/get/material/${materialId}/`)
        .done(function(response) {
            if (response.success) {
                const material = response.material;
                
                // Alterar para modo de edição
                entrarModoEdicaoMaterial(material);
                
                // Scroll para o formulário
                $('html, body').animate({
                    scrollTop: $('#card-material').offset().top - 100
                }, 500);
                
            } else {
                mostrarAlerta(response.error || 'Material não encontrado', 'error');
            }
        })
        .fail(function() {
            mostrarAlerta('Erro ao carregar dados do material', 'error');
        });
}

function entrarModoEdicaoMaterial(material) {
    // Alterar título do card
    $('#card-material-title').text('Editando Material');
    
    // Mostrar botão cancelar
    $('#material-actions').removeClass('d-none');
    
    // Preencher formulário
    $('#material_id').val(material.id);
    $('#titulo_material').val(material.titulo);
    $('#produto_id').val(material.produto.id);
    $('#material_status').prop('checked', material.status);
    
    // Mostrar container de status
    $('#status-container').removeClass('d-none');
    
    // Tornar arquivos opcionais na edição
    $('#banner').prop('required', false);
    $('#arquivo').prop('required', false);
    $('#banner-required').text('');
    $('#arquivo-required').text('');
    
    // Mostrar arquivos atuais
    $('#banner_atual').html(material.banner_url 
        ? `<div class="d-flex align-items-center gap-2 p-2 bg-light rounded">
               <img src="${material.banner_url}" style="width: 60px; height: 32px; object-fit: cover; border-radius: 4px;">
               <small class="text-muted">Banner atual</small>
           </div>` 
        : '<small class="text-muted">Nenhum banner atual</small>'
    );
    
    $('#arquivo_atual').html(material.arquivo_nome 
        ? `<div class="d-flex align-items-center gap-2 p-2 bg-light rounded">
               <i class='bx bx-file text-primary'></i>
               <small class="text-primary">${material.arquivo_nome}</small>
           </div>`
        : '<small class="text-muted">Nenhum arquivo atual</small>'
    );
    
    // Alterar texto do botão
    $('#btn-salvar-material').html('<i class="bx bx-save me-2"></i>Atualizar Material');
}

function cancelarEdicaoMaterial() {
    // Resetar formulário
    limparFormularioMaterial();
    
    // Voltar para modo de criação
    $('#card-material-title').text('Cadastrar Novo Material');
    $('#material-actions').addClass('d-none');
    $('#status-container').addClass('d-none');
    $('#btn-salvar-material').html('<i class="bx bx-save me-2"></i>Salvar Material');
    
    // Tornar arquivos obrigatórios novamente
    $('#banner').prop('required', true);
    $('#arquivo').prop('required', true);
    $('#banner-required').text('*');
    $('#arquivo-required').text('*');
    
    // Limpar campos hidden e de arquivos atuais
    $('#material_id').val('');
    $('#banner_atual').empty();
    $('#arquivo_atual').empty();
}

function baixarMaterial(materialId) {
    const formData = new FormData();
    formData.append('material_id', materialId);
    
    $.ajax({
        url: '/marketing/api/post/download/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            if (response.success) {
                // Forçar download
                window.open(response.download_url, '_blank');
                mostrarAlerta('Download iniciado com sucesso!', 'success');
                
                // Atualizar tabela após 1 segundo
                setTimeout(() => carregarTabelaMateriais(paginaAtual), 1000);
            } else {
                mostrarAlerta(response.error, 'error');
            }
        },
        error: function() {
            mostrarAlerta('Erro ao processar download', 'error');
        }
    });
}

function confirmarExclusaoMaterial(materialId) {
    // Confirmação simples com confirm()
    if (confirm('Tem certeza que deseja excluir este material?\n\nEsta ação não pode ser desfeita.')) {
        excluirMaterial(materialId);
    }
}

function excluirMaterial(materialId) {
    // Por enquanto apenas mostra aviso
    mostrarAlerta('Funcionalidade de exclusão será implementada em breve', 'warning');
}

// ================================
// FILTROS E BUSCA
// ================================

function filtrarMateriais() {
    // Só filtrar se estivermos em uma página de listagem
    if ($('#lista-materiais').length > 0) {
        paginaAtual = 1;
        carregarTabelaMateriais(1);
    }
}

function recarregarTabela() {
    // Só recarregar se estivermos em uma página de listagem
    if ($('#lista-materiais').length > 0) {
        if ($('#filtro_busca').length > 0) {
            $('#filtro_busca').val('');
        }
        paginaAtual = 1;
        carregarTabelaMateriais(1);
    }
}

// ================================
// UTILITÁRIOS
// ================================

function limparFormularioMaterial() {
    $('#formMaterial')[0].reset();
    
    // Limpar campo hidden
    $('#material_id').val('');
    
    // Resetar previews
    $('#banner-preview').removeClass('has-image').html(`
        <i class='bx bx-image-add'></i>
        <p>Clique para selecionar banner</p>
        <small>Recomendado: 840x360px | JPG, PNG</small>
    `);
    
    $('#arquivo-preview').removeClass('has-file').html(`
        <i class='bx bx-file-plus'></i>
        <p>Clique para selecionar arquivo</p>
        <small>Será convertido para ZIP automaticamente</small>
    `);
    
    $('.banner-upload, .arquivo-upload').removeClass('upload-success upload-error');
    
    // Limpar divs de arquivos atuais
    $('#banner_atual').empty();
    $('#arquivo_atual').empty();
}

function limparFormularioProduto() {
    $('#formProduto')[0].reset();
}

function limparFormularioOrgao() {
    $('#formOrgao')[0].reset();
}

function mostrarLoading(show) {
    if (show) {
        if ($('#loading-table').length > 0) {
            $('#loading-table').removeClass('d-none');
        }
        if ($('#lista-materiais').length > 0) {
            $('#lista-materiais').addClass('opacity-50');
        }
    } else {
        if ($('#loading-table').length > 0) {
            $('#loading-table').addClass('d-none');
        }
        if ($('#lista-materiais').length > 0) {
            $('#lista-materiais').removeClass('opacity-50');
        }
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
        'success': 'bx-check-circle',
        'error': 'bx-x-circle',
        'warning': 'bx-error-circle',
        'info': 'bx-info-circle'
    }[type] || 'bx-info-circle';
    
    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show alert-floating" role="alert">
            <i class='bx ${iconClass} me-2'></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Remover alertas anteriores
    $('.alert-floating').remove();
    
    // Adicionar novo alerta
    $('body').append(alertHtml);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        $('.alert-floating').fadeOut(() => {
            $('.alert-floating').remove();
        });
    }, 5000);
}

function formatarTamanhoArquivo(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
