// Variáveis globais para o modal de edição
let produtoIndexEdicao = 0;
let produtosContainerEdicao = null;
let produtoTemplateEdicao = null;
let acaoTemplateEdicao = null;
let documentoAcaoTemplateEdicao = null;

// Função global para fechar modais
window.fecharModal = function(modalSelector) {
    console.log('[EDICAO] Fechando modal:', modalSelector);
    const modalElement = document.querySelector(modalSelector);
    if (modalElement) {
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        } else {
            // Fallback caso o bootstrap não esteja disponível
            $(modalSelector).modal('hide');
        }
    } else {
        console.error('[EDICAO] Modal não encontrado:', modalSelector);
    }
};

/**
 * Função para carregar os vendedores disponíveis em um select
 * @param {string} selectorId - Seletor do elemento select a ser preenchido
 * @param {number} lojaId - ID da loja para filtrar os vendedores
 */
function carregarVendedoresSelect(selectorId, lojaId) {
    console.log('[EDIÇÃO] Carregando vendedores para loja:', lojaId);
    const select = $(selectorId);
    
    if (!select.length) {
        console.error('[EDIÇÃO] Select não encontrado:', selectorId);
        return;
    }
    
    select.empty().append('<option value="">Carregando vendedores...</option>');
    
    // Validar se lojaId é um número válido
    if (!lojaId || isNaN(lojaId) || lojaId === '' || lojaId === 'undefined') {
        console.warn('[EDIÇÃO] Loja ID inválido:', lojaId);
        select.empty().append('<option value="">ID da loja inválido</option>');
        return;
    }
    
    const params = { loja_id: parseInt(lojaId) };
    console.log('[EDIÇÃO] Parâmetros da requisição:', params);
    
    $.ajax({
        url: '/inss/api/get/info-loja-funcionario/',
        type: 'GET',
        dataType: 'json',
        data: params,
        success: function(response) {
            console.log('[EDIÇÃO] Resposta vendedores:', response);
            select.empty().append('<option value="">Selecione um vendedor</option>');
            
            if (response.funcionarios && Object.keys(response.funcionarios).length > 0) {
                const funcionariosArray = Object.values(response.funcionarios);
                funcionariosArray.sort((a, b) => a.nome.localeCompare(b.nome));
                
                funcionariosArray.forEach(function(funcionario) {
                    select.append(`<option value="${funcionario.id}">${funcionario.nome}</option>`);
                });
                console.log('[EDIÇÃO] Vendedores carregados com sucesso:', funcionariosArray.length);
            } else {
                console.warn('[EDIÇÃO] Nenhum funcionário retornado pela API');
                select.append('<option value="">Nenhum vendedor disponível</option>');
            }
        },
        error: function(xhr, status, error) {
            console.error('[EDIÇÃO] Erro ao carregar vendedores:', error);
            console.error('[EDIÇÃO] Status:', xhr.status);
            console.error('[EDIÇÃO] Response:', xhr.responseText);
            select.empty().append('<option value="">Erro ao carregar vendedores</option>');
        }
    });
}

// Função para adicionar produto na edição
function adicionarProdutoEdicao(produtoExistente = null) {
    console.log('[EDICAO] Adicionando novo produto, índice:', produtoIndexEdicao);
    
    // Obter o template e substituir os placeholders
    const template = document.getElementById('produtoTemplateEdicao').innerHTML;
    const novoProdutoHtml = template.replace(/__INDEX__/g, produtoIndexEdicao);
    
    // Adicionar ao container
    const container = document.getElementById('produtosContainerEdicao');
    container.insertAdjacentHTML('beforeend', novoProdutoHtml);
    
    // Obter o elemento recém-adicionado
    const novoProduto = container.lastElementChild;
    
    // Carregar produtos no select
    const selectProduto = novoProduto.querySelector(`#tipo_negociacao_edicao_${produtoIndexEdicao}`);
    
    // Buscar produtos da URL correta
    $.ajax({
        url: '/inss/api/get/info-loja-funcionario/',
        type: 'GET',
        success: function(response) {
            console.log('[EDICAO] Produtos carregados:', response.produtos);
            // Limpar opções existentes exceto a primeira
            selectProduto.innerHTML = '<option value="">Selecione um produto</option>';
            // Adicionar novas opções
            if (response.produtos) {
                Object.entries(response.produtos).forEach(([id, produto]) => {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = produto.nome;
                    selectProduto.appendChild(option);
                });
            }
            // Se houver produto existente, selecionar
            if (produtoExistente && produtoExistente.produto_id) {
                selectProduto.value = produtoExistente.produto_id;
            }
            // Aplicar máscaras e outros eventos
            aplicarMascaraDinheiro(novoProduto.querySelector(`#valor_tac_edicao_${produtoIndexEdicao}`));
            // Adicionar evento de remoção
            novoProduto.querySelector('.btn-remove-produto').addEventListener('click', function() {
                novoProduto.remove();
                verificarVisibilidadeBotaoAddEdicao();
            });
            // Incrementar o índice de produtos
            produtoIndexEdicao++;
            // Verificar visibilidade do botão de adicionar
            verificarVisibilidadeBotaoAddEdicao();
        },
        error: function(xhr, status, error) {
            console.error('[EDICAO] Erro ao carregar produtos:', error);
            Swal.fire('Erro!', 'Não foi possível carregar os produtos.', 'error');
        }
    });
}

// Função para adicionar ação judicial na edição
function adicionarAcaoEdicao(produtoExistente = null) {
    console.log('[EDICAO] Adicionando nova ação judicial, índice:', produtoIndexEdicao);
    
    const template = document.getElementById('acaoTemplateEdicao');
    if (!template) {
        console.error('[EDICAO] Template de ação não encontrado');
        return;
    }

    const clone = template.content.cloneNode(true);
    const blocoAcao = clone.querySelector('.produto-bloco');
    blocoAcao.setAttribute('data-index', produtoIndexEdicao);
    blocoAcao.innerHTML = blocoAcao.innerHTML.replace(/__INDEX__/g, produtoIndexEdicao);

    // Se tiver produto existente, preencher os campos
    if (produtoExistente) {
        const senhaInput = blocoAcao.querySelector(`[name='produtos[${produtoIndexEdicao}][senha_inss]']`);
        if (senhaInput) {
            senhaInput.value = produtoExistente.senha_inss || '';
        }

        // Adicionar documentos existentes
        if (produtoExistente.documentos) {
            produtoExistente.documentos.forEach(doc => {
                adicionarDocumentoAcaoEdicao(produtoIndexEdicao, doc);
            });
        }
    }

    const btnRemove = blocoAcao.querySelector('.btn-remove-produto');
    btnRemove.addEventListener('click', function() {
        blocoAcao.remove();
        verificarVisibilidadeBotaoAddEdicao();
    });

    const btnAddDocumento = blocoAcao.querySelector('.btn-add-documento');
    btnAddDocumento.addEventListener('click', function() {
        const acaoIndex = blocoAcao.getAttribute('data-index');
        adicionarDocumentoAcaoEdicao(acaoIndex);
    });

    // Adicionar listener para o tipo de pagamento
    const tipoPagamentoSelect = blocoAcao.querySelector(`#tipo_pagamento_edicao_${produtoIndexEdicao}`);
    if (tipoPagamentoSelect) {
        tipoPagamentoSelect.addEventListener('change', function() {
            handleTipoPagamentoChangeEdicao(produtoIndexEdicao);
        });
    }

    // Aplicar máscaras nos campos de valor
    blocoAcao.querySelectorAll('.money').forEach(input => {
        aplicarMascaraDinheiro(input);
    });

    produtosContainerEdicao.appendChild(blocoAcao);
    produtoIndexEdicao++;
    verificarVisibilidadeBotaoAddEdicao();
}

// Função para adicionar documento à ação na edição
function adicionarDocumentoAcaoEdicao(acaoIndex, documentoExistente = null) {
    console.log(`[EDICAO] Adicionando documento para ação ${acaoIndex}`);
    
    const template = document.getElementById('documentoAcaoTemplateEdicao');
    const clone = template.content.cloneNode(true);
    
    const container = document.getElementById(`documentosListEdicao_${acaoIndex}`);
    
    if (!container) {
        console.error(`[EDICAO] Container de documentos não encontrado para ação ${acaoIndex}`);
        return;
    }

    const documentoItem = clone.querySelector('.documento-item');
    
    documentoItem.innerHTML = documentoItem.innerHTML
        .replace(/__ACAO_INDEX__/g, acaoIndex)
        .replace(/__DOC_INDEX__/g, container.children.length);

    // Se tiver documento existente, preencher os campos
    if (documentoExistente) {
        const tituloInput = documentoItem.querySelector('input[name$="[titulo]"]');
        if (tituloInput) tituloInput.value = documentoExistente.titulo || '';
    }

    const btnRemove = documentoItem.querySelector('.btn-remove-documento');
    btnRemove.addEventListener('click', function() {
        documentoItem.remove();
        reindexarDocumentosEdicao(container, acaoIndex);
    });

    container.appendChild(documentoItem);
}

// Função para reindexar documentos na edição
function reindexarDocumentosEdicao(container, acaoIndex) {
    const documentos = container.querySelectorAll('.documento-item');
    documentos.forEach((doc, index) => {
        doc.querySelectorAll('[id*="titulo_documento"]').forEach(el => {
            el.id = el.id.replace(/titulo_documento.*$/, `titulo_documento_${acaoIndex}_${index}`);
            el.name = el.name.replace(/\[documentos\]\[\d+\]/, `[documentos][${index}]`);
        });
        
        doc.querySelectorAll('[id*="arquivo_documento"]').forEach(el => {
            el.id = el.id.replace(/arquivo_documento.*$/, `arquivo_documento_${acaoIndex}_${index}`);
            el.name = el.name.replace(/\[documentos\]\[\d+\]/, `[documentos][${index}]`);
        });
    });
}

// Função para verificar visibilidade do botão de adicionar na edição
function verificarVisibilidadeBotaoAddEdicao() {
    const container = document.getElementById('produtosContainerEdicao');
    const btnContainer = document.getElementById('addProdutoBtnContainerEdicao');
    
    if (container && btnContainer) {
        const produtos = container.querySelectorAll('.produto-bloco');
        btnContainer.style.display = produtos.length >= 3 ? 'none' : 'block';
    }
}

// Função para remouter todos os produtos na edição
function removerTodosProdutosEdicao() {
    produtosContainerEdicao.innerHTML = '';
    produtoIndexEdicao = 0;
    document.getElementById('addProdutoBtnContainerEdicao').style.display = 'none';
}

function abrirModalEdicao(cliente) {
    console.log('[EDIÇÃO] Abrindo modal com dados:', cliente);
    console.log('[EDIÇÃO] Propriedades de agendamento:', {
        dia_agendado: cliente.dia_agendado,
        data_agendamento: cliente.data_agendamento,
        loja: cliente.loja,
        loja_agendada: cliente.loja_agendada,
        loja_nome: cliente.loja_nome,
        atendente: cliente.atendente,
        atendente_agendou: cliente.atendente_agendou,
        nome_atendente: cliente.nome_atendente
    });
    
    // Resetar o índice de produtos
    produtoIndexEdicao = 0;
    
    // Limpar o container de produtos
    if (produtosContainerEdicao) {
        produtosContainerEdicao.innerHTML = '';
    }

    // Preencher campos básicos
    $('#nomeClienteEdicao').val(cliente.nome || cliente.cliente_agendamento_nome || cliente.nome_completo || '');
    $('#cpfClienteEdicao').val(cliente.cpf || cliente.cliente_agendamento_cpf || '');
    $('#numeroClienteEdicao').val(cliente.numero || cliente.cliente_agendamento_numero || '');
    $('#dataComparecimentoEdicao').val(cliente.data_comparecimento || new Date().toISOString().split('T')[0]);
    $('#vendedorEdicao').val(cliente.vendedor_id);
    $('#tabulacaoEdicao').val(cliente.tabulacao_venda);

    // Preencher campos de agendamento
    $('#diaAgendadoEdicao').val(cliente.dia_agendado || cliente.data_agendamento || '');
    $('#lojaAgendadaEdicao').val(cliente.loja_agendada || cliente.loja || cliente.loja_nome || '');
    $('#atendenteAgendouEdicao').val(cliente.atendente_agendou || cliente.atendente || cliente.nome_atendente || '');

    // Se tiver presença, preencher data
    if (cliente.presenca) {
        $('#dataComparecimentoEdicao').val(cliente.presenca.data_presenca);
    } else {
        $('#dataComparecimentoEdicao').val(new Date().toISOString().split('T')[0]);
    }

    // Se for NEGÓCIO FECHADO, mostrar seção de produtos
    if (cliente.tabulacao_venda === 'NEGOCIO_FECHADO') {
        $('#secaoProdutosEdicao').show();
        carregarProdutosEdicao(cliente.produtos || []);
    } else {
        $('#secaoProdutosEdicao').hide();
    }

    // Carregar vendedores da loja
    const lojaId = cliente.loja_id || cliente.agendamento_loja_id;
    console.log('[EDIÇÃO] Loja ID extraído:', lojaId, 'de:', {
        loja_id: cliente.loja_id,
        agendamento_loja_id: cliente.agendamento_loja_id,
        loja: cliente.loja
    });
    
    // Se não tiver ID numérico, não carregar vendedores
    if (lojaId && !isNaN(lojaId)) {
        carregarVendedoresSelect('#vendedorLojaEdicao', lojaId);
    } else {
        console.warn('[EDIÇÃO] Loja ID não encontrado ou inválido:', lojaId);
        $('#vendedorLojaEdicao').empty().append('<option value="">Selecione uma loja primeiro</option>');
    }

    // Se houver presença, preencher os dados do vendedor
    if (cliente.vendedor_loja) {
        $('#vendedorLojaEdicao').val(cliente.vendedor_loja);
        $('#tabulacaoVendedorEdicao').val(cliente.tabulacao_vendedor);
        $('#dataComparecimentoEdicao').val(cliente.data_comparecimento || new Date().toISOString().split('T')[0]);
        
        // Se tiver produtos, adicionar cada um
        if (cliente.produtos && cliente.produtos.length > 0) {
            cliente.produtos.forEach(produto => {
                if (produto.acao) {
                    adicionarAcaoEdicao(produto);
                } else {
                    adicionarProdutoEdicao(produto);
                }
            });
        }
    } else {
        // Se não houver presença, definir a data de comparecimento como hoje
        $('#dataComparecimentoEdicao').val(new Date().toISOString().split('T')[0]);
    }

    // Mostrar o modal usando Bootstrap
    const modalElement = document.getElementById('modalEdicaoCliente');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    // Buscar dados completos do cliente usando a API, se tivermos um ID de agendamento
    if (cliente.id_agendamento || cliente.agendamento_id) {
        const agendamentoId = cliente.id_agendamento || cliente.agendamento_id;
        $('#agendamentoIdEdicao').val(agendamentoId);
        
        $.ajax({
            url: '/inss/api/get/submodal-cliente/',
            type: 'GET',
            data: { agendamento_id: agendamentoId },
            dataType: 'json',
            success: function(response) {
                console.log('[EDIÇÃO] Dados completos do cliente obtidos:', response);
                
                // Verificar se a resposta veio como string e tentar parsear
                let clienteInfo = response;
                if (typeof response === 'string') {
                    try {
                        clienteInfo = JSON.parse(response);
                    } catch (e) {
                        console.error('[EDIÇÃO] Erro ao parsear resposta:', e);
                    }
                }
                
                // Atualizar campos de agendamento com dados mais completos
                if (clienteInfo && typeof clienteInfo === 'object') {
                    $('#diaAgendadoEdicao').val(clienteInfo.dia_agendado || clienteInfo.data_agendamento || cliente.dia_agendado || '');
                    $('#lojaAgendadaEdicao').val(clienteInfo.loja_agendada || clienteInfo.loja_nome || cliente.loja || '');
                    $('#atendenteAgendouEdicao').val(clienteInfo.atendente_agendou || clienteInfo.nome_atendente || cliente.atendente || '');
                }
            },
            error: function(xhr, status, error) {
                console.error('[EDIÇÃO] Erro ao obter dados completos do cliente:', error);
            }
        });
    }

    // Garante que o botão de adicionar produto/ação seja exibido corretamente
    verificarVisibilidadeBotaoAddEdicao();
}

function carregarProdutosEdicao(produtos) {
    const container = $('#produtosContainerEdicao');
    container.empty();

    produtos.forEach((produto, index) => {
        const produtoHtml = `
            <div class="produto-item" data-index="${index}">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Tipo de Ação*</label>
                            <select class="form-control tipo-acao" required>
                                <option value="">Selecione...</option>
                                <option value="REVISAO" ${produto.tipo_acao === 'REVISAO' ? 'selected' : ''}>Revisão</option>
                                <option value="APOSENTADORIA" ${produto.tipo_acao === 'APOSENTADORIA' ? 'selected' : ''}>Aposentadoria</option>
                                <option value="AUXILIO_DOENCA" ${produto.tipo_acao === 'AUXILIO_DOENCA' ? 'selected' : ''}>Auxílio Doença</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Senha INSS*</label>
                            <input type="text" class="form-control senha-inss" value="${produto.senha_inss || ''}" required>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Tipo de Pagamento*</label>
                            <select class="form-control tipo-pagamento" required>
                                <option value="">Selecione...</option>
                                <option value="A_VISTA" ${produto.tipo_pagamento === 'A_VISTA' ? 'selected' : ''}>À Vista</option>
                                <option value="PARCELADO" ${produto.tipo_pagamento === 'PARCELADO' ? 'selected' : ''}>Parcelado</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="row pagamento-detalhes" style="display: ${produto.tipo_pagamento === 'PARCELADO' ? 'flex' : 'none'}">
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Valor Entrada*</label>
                            <input type="number" class="form-control valor-entrada" value="${produto.valor_entrada || ''}" step="0.01" required>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Qtd. Parcelas*</label>
                            <input type="number" class="form-control qtd-parcelas" value="${produto.qtd_parcelas || ''}" required>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Valor Parcela*</label>
                            <input type="number" class="form-control valor-parcela" value="${produto.valor_parcela || ''}" step="0.01" required>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Valor Total</label>
                            <input type="text" class="form-control valor-total" readonly>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <div class="form-group">
                            <label>Documentos</label>
                            <div class="documentos-container">
                                ${(produto.documentos || []).map((doc, docIndex) => `
                                    <div class="documento-item">
                                        <input type="text" class="form-control" value="${doc.titulo}" placeholder="Título do documento">
                                        <input type="file" class="form-control" name="documentos[${index}][${docIndex}]">
                                    </div>
                                `).join('')}
                            </div>
                            <button type="button" class="btn btn-sm btn-info adicionar-documento">
                                <i class="fas fa-plus"></i> Adicionar Documento
                            </button>
                        </div>
                    </div>
                </div>

                <hr>
            </div>
        `;
        container.append(produtoHtml);
    });

    // Adicionar botão para novo produto
    container.append(`
        <button type="button" class="btn btn-primary adicionar-produto">
            <i class="fas fa-plus"></i> Adicionar Produto
        </button>
    `);

    // Inicializar eventos
    inicializarEventosProdutos();
}

function inicializarEventosProdutos() {
    // Evento para tipo de pagamento
    $(document).on('change', '.tipo-pagamento', function() {
        const detalhes = $(this).closest('.produto-item').find('.pagamento-detalhes');
        detalhes.toggle($(this).val() === 'PARCELADO');
    });

    // Evento para cálculo do valor total
    $(document).on('input', '.valor-entrada, .qtd-parcelas, .valor-parcela', function() {
        const item = $(this).closest('.produto-item');
        const entrada = parseFloat(item.find('.valor-entrada').val()) || 0;
        const parcelas = parseInt(item.find('.qtd-parcelas').val()) || 0;
        const valorParcela = parseFloat(item.find('.valor-parcela').val()) || 0;
        
        const total = entrada + (parcelas * valorParcela);
        item.find('.valor-total').val(total.toFixed(2));
    });

    // Evento para adicionar documento
    $(document).on('click', '.adicionar-documento', function() {
        const container = $(this).siblings('.documentos-container');
        const index = container.children().length;
        const produtoIndex = $(this).closest('.produto-item').data('index');
        
        const docHtml = `
            <div class="documento-item">
                <input type="text" class="form-control" placeholder="Título do documento">
                <input type="file" class="form-control" name="documentos[${produtoIndex}][${index}]">
            </div>
        `;
        container.append(docHtml);
    });

    // Evento para adicionar produto
    $(document).on('click', '.adicionar-produto', function() {
        const container = $('#produtosContainerEdicao');
        const index = container.find('.produto-item').length;
        
        const produtoHtml = `
            <div class="produto-item" data-index="${index}">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Tipo de Ação*</label>
                            <select class="form-control tipo-acao" required>
                                <option value="">Selecione...</option>
                                <option value="REVISAO">Revisão</option>
                                <option value="APOSENTADORIA">Aposentadoria</option>
                                <option value="AUXILIO_DOENCA">Auxílio Doença</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Senha INSS*</label>
                            <input type="text" class="form-control senha-inss" required>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Tipo de Pagamento*</label>
                            <select class="form-control tipo-pagamento" required>
                                <option value="">Selecione...</option>
                                <option value="A_VISTA">À Vista</option>
                                <option value="PARCELADO">Parcelado</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="row pagamento-detalhes" style="display: none">
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Valor Entrada*</label>
                            <input type="number" class="form-control valor-entrada" step="0.01" required>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Qtd. Parcelas*</label>
                            <input type="number" class="form-control qtd-parcelas" required>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Valor Parcela*</label>
                            <input type="number" class="form-control valor-parcela" step="0.01" required>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Valor Total</label>
                            <input type="text" class="form-control valor-total" readonly>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <div class="form-group">
                            <label>Documentos</label>
                            <div class="documentos-container"></div>
                            <button type="button" class="btn btn-sm btn-info adicionar-documento">
                                <i class="fas fa-plus"></i> Adicionar Documento
                            </button>
                        </div>
                    </div>
                </div>

                <hr>
            </div>
        `;
        
        // Inserir antes do botão de adicionar
        $(this).before(produtoHtml);
    });
}

function carregarProdutosCliente(idAgendamento) {
    console.log('[EDIÇÃO] Carregando produtos do cliente:', idAgendamento);
    $.ajax({
        url: `/inss/api/get/produtosCliente/${idAgendamento}/`,
        type: 'GET',
        success: function(response) {
            console.log('[EDIÇÃO] Produtos carregados:', response);
            const container = $('#produtosContainerEdicao');
            container.empty();
            
            if (response.produtos && response.produtos.length > 0) {
                response.produtos.forEach(function(produto) {
                    const novoProduto = $(produtoTemplateEdicao);
                    novoProduto.find('[name="produto[]"]').val(produto.produto);
                    novoProduto.find('[name="valor_produto[]"]').val(produto.valor_produto);
                    novoProduto.find('[name="parcelas_produto[]"]').val(produto.parcelas_produto);
                    container.append(novoProduto);
                });
            }
        },
        error: function(xhr, status, error) {
            console.error('[EDIÇÃO] Erro ao carregar produtos:', error);
        }
    });
}

function carregarAcoesCliente(idAgendamento) {
    console.log('[EDICAO] Carregando ações do cliente:', idAgendamento);
    $.ajax({
        url: `/inss/api/get/acoesCliente/${idAgendamento}/`,
        type: 'GET',
        success: function(response) {
            console.log('[EDICAO] Resposta ações:', response);
            if (response.acoes && response.acoes.length > 0) {
                response.acoes.forEach(function(acao) {
                    const blocoAcao = adicionarAcaoEdicao();
                    
                    // Preencher os campos da ação
                    $(`#tipo_acao_edicao_${produtoIndexEdicao - 1}`).val(acao.tipo_acao);
                    $(`#tipo_pagamento_edicao_${produtoIndexEdicao - 1}`).val(acao.tipo_pagamento);
                    $(`#senha_inss_acao_edicao_${produtoIndexEdicao - 1}`).val(acao.senha_inss);

                    // Preencher campos de pagamento se necessário
                    if (acao.tipo_pagamento === 'A_VISTA') {
                        $(`#valor_total_edicao_${produtoIndexEdicao - 1}`).val(acao.valor_total);
                    } else if (acao.tipo_pagamento === 'PARCELADO') {
                        $(`#valor_entrada_edicao_${produtoIndexEdicao - 1}`).val(acao.valor_entrada);
                        $(`#qtd_parcelas_edicao_${produtoIndexEdicao - 1}`).val(acao.qtd_parcelas);
                        $(`#valor_parcela_edicao_${produtoIndexEdicao - 1}`).val(acao.valor_parcela);
                    }

                    // Carregar documentos da ação
                    if (acao.documentos && acao.documentos.length > 0) {
                        acao.documentos.forEach(function(doc) {
                            adicionarDocumentoAcaoEdicao(produtoIndexEdicao - 1, doc);
                        });
                    }
                });
            }
        },
        error: function(xhr, status, error) {
            console.error('[EDICAO] Erro ao carregar ações:', error);
        }
    });
}

function handleTabulacaoVendedorChange() {
    const tabulacaoValue = $('#tabulacaoVendedorEdicao').val();
    console.log('[EDIÇÃO] Tabulação alterada para:', tabulacaoValue);
    
    if (tabulacaoValue === 'NEGOCIO_FECHADO') {
        $('#fechouNegocioContainerEdicao').slideDown();
        $('#addProdutoBtnContainerEdicao').show();
    } else {
        $('#fechouNegocioContainerEdicao').slideUp();
        removerTodosProdutosEdicao();
    }
}

// Manipulador de envio do formulário de edição
$('#formEdicaoCliente').on('submit', function(e) {
    e.preventDefault();
    
    const $form = $(this);
    const $submitButton = $form.find('.btn-submit');
    const originalButtonText = $submitButton.html();
    
    // Desabilitar o botão para evitar múltiplos envios
    $submitButton.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i> Salvando...');
    
    // Obter o ID do agendamento
    const agendamentoId = $('#agendamentoIdEdicao').val();
    if (!agendamentoId) {
        alertaErro('ID do agendamento não encontrado');
        $submitButton.prop('disabled', false).html(originalButtonText);
        return;
    }
    
    // Verificar se o vendedor foi selecionado
    const vendedorId = $('#vendedorLojaEdicao').val();
    if (!vendedorId) {
        alertaErro('Por favor, selecione um vendedor.');
        $submitButton.prop('disabled', false).html(originalButtonText);
        return;
    }
    
    // Verificar se a tabulação foi selecionada
    let tabulacaoVendedor = $('#tabulacaoVendedorEdicao').val();
    // Normalizar tabulações com acentos
    if (tabulacaoVendedor === 'NÃO ACEITOU') {
        tabulacaoVendedor = 'NAO_ACEITOU';
    } else if (tabulacaoVendedor === 'NEGÓCIO FECHADO') {
        tabulacaoVendedor = 'NEGOCIO_FECHADO';
    }
    if (!tabulacaoVendedor) {
        alertaErro('Por favor, selecione uma tabulação.');
        $submitButton.prop('disabled', false).html(originalButtonText);
        return;
    }

    // Verificar se a data de comparecimento foi preenchida
    const dataComparecimento = $('#dataComparecimentoEdicao').val();
    if (!dataComparecimento) {
        alertaErro('Por favor, selecione a data de comparecimento.');
        $submitButton.prop('disabled', false).html(originalButtonText);
        return;
    }
    
    // Criar FormData para envio
    const formData = new FormData(this);
    formData.append('agendamento_id', agendamentoId);
    formData.append('vendedor_id', vendedorId);
    formData.append('tabulacao_vendedor', tabulacaoVendedor);
    formData.append('data_comparecimento', dataComparecimento);
    
    // Se a tabulação for NEGOCIO_FECHADO, processar produtos
    if (tabulacaoVendedor === 'NEGOCIO_FECHADO') {
        const produtos = $('#produtosContainerEdicao .produto-bloco');
        if (produtos.length === 0) {
            alertaErro('Para tabulação "NEGÓCIO FECHADO", adicione pelo menos um produto ou ação');
            $submitButton.prop('disabled', false).html(originalButtonText);
            return;
        }
        
        const produtosArray = [];
        produtos.each(function(index) {
            const produto = {};
            $(this).find('input:not([type="file"]), select').each(function() {
                const nome = $(this).attr('name').match(/\[([^\]]+)\]$/)[1];
                produto[nome] = $(this).val();
            });
            
            // Processar documentos se for uma ação
            const documentos = $(this).find('.documento-item');
            if (documentos.length > 0) {
                produto.documentos = [];
                documentos.each(function(docIndex) {
                    const doc = $(this);
                    const arquivo = doc.find('input[type="file"]')[0].files[0];
                    if (arquivo) {
                        formData.append(`produtos[${index}][documentos][${docIndex}][file]`, arquivo);
                        formData.append(`produtos[${index}][documentos][${docIndex}][titulo]`, 
                            doc.find('input[name$="[titulo]"]').val());
                        formData.append(`produtos[${index}][documentos][${docIndex}][acao_judicial]`, 'true');
                    }
                });
            }
            
            produtosArray.push(produto);
        });
        
        formData.append('produtos_json', JSON.stringify(produtosArray));
    }
    
    // Enviar formulário
    $.ajax({
        url: '/inss/api/post/addvenda/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            if (response.status === 'success') {
                alertaSucesso(response.message);
                fecharModal('#modalEdicaoCliente');
                carregarAgendadosHoje();
                carregarAgendamentosPendentes();
            } else {
                alertaErro(response.message || 'Erro ao processar a solicitação');
            }
        },
        error: function(xhr) {
            alertaErro(xhr.responseJSON?.message || 'Erro ao processar a solicitação');
        },
        complete: function() {
            $submitButton.prop('disabled', false).html(originalButtonText);
        }
    });
});

// Inicialização quando o documento estiver pronto
$(document).ready(function() {
    // Inicializar variáveis globais
    produtosContainerEdicao = document.getElementById('produtosContainerEdicao');
    produtoTemplateEdicao = document.getElementById('produtoTemplateEdicao');
    acaoTemplateEdicao = document.getElementById('acaoTemplateEdicao');
    documentoAcaoTemplateEdicao = document.getElementById('documentoAcaoTemplateEdicao');

    // Máscaras para campos do modal Adicionar Ação
    $('#cpfClienteAcao').mask('000.000.000-00');
    $('#numeroClienteAcao').mask('(00) 00000-0000');
    $('.money').mask('#.##0,00', { reverse: true });

    // Inicializar evento para tipo de pagamento no modal Adicionar Ação
    $('#tipo_pagamento_acao').on('change', handleTipoPagamentoAcao);
    
    // Botão para adicionar documento no modal Adicionar Ação
    $('#btnAddDocumentoAcao').on('click', function() {
        console.log('[EDICAO] Botão adicionar documento clicado');
        const template = $('#acaoDocumentoTemplate').html();
        if (!template) {
            console.error('[EDICAO] Template de documento não encontrado');
            return;
        }
        
        const docIndexAcao = $('#documentosAcaoContainer').children().length;
        const novoDocumentoHtml = template.replace(/__DOC_INDEX__/g, docIndexAcao);
        $('#documentosAcaoContainer').append(novoDocumentoHtml);
    });

    // Remover documento no modal Adicionar Ação
    $('#documentosAcaoContainer').on('click', '.btn-remove-documento', function() {
        $(this).closest('.documento-item').remove();
    });
    
    // Submissão do formulário do modal Adicionar Ação
    // Usar delegação de eventos para pegar ambos os IDs possíveis
    $(document).on('submit', '#formAcaoAgendamentoGenerico, #formAdicionarAcao', function(e) {
        e.preventDefault();
        console.log('[EDICAO] Formulário submetido:', this.id);
        
        const $thisForm = $(this);
        const $submitButton = $thisForm.find('button[type="submit"]');
        const originalButtonText = $submitButton.html();

        $submitButton.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i> Salvando...');

        const formData = new FormData(this);
        
        // Adicionar o ID do agendamento ao formData
        const agendamentoId = $('#agendamentoIdAcao').val();
        if (!agendamentoId) {
            alertaErro('ID do agendamento não encontrado');
            $submitButton.prop('disabled', false).html(originalButtonText);
            return;
        }
        formData.append('agendamento_id', agendamentoId);

        $.ajax({
            url: '/inss/api/post/adicionaracao/',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: response.message || 'Ação adicionada com sucesso!',
                        timer: 2500,
                        showConfirmButton: false
                    });
                    
                    // Fechar modal usando a instância do Bootstrap
                    const modalElement = document.getElementById('modalAdicionarAcao');
                    if (modalElement) {
                        const modalInstance = bootstrap.Modal.getInstance(modalElement);
                        if (modalInstance) modalInstance.hide();
                    }
                    
                    // Recarregar dados das tabelas
                    carregarAgendadosHoje();
                    carregarAgendamentosPendentes();
                    carregarClientesNaoPresentes();
                } else {
                    Swal.fire('Erro!', response.message || 'Não foi possível adicionar a ação.', 'error');
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON?.message || xhr.responseJSON?.error || 'Erro ao processar a solicitação.';
                Swal.fire('Erro de Servidor!', errorMsg, 'error');
            },
            complete: function() {
                $submitButton.prop('disabled', false).html(originalButtonText);
            }
        });
    });

    // Remover todos os event listeners existentes antes de adicionar novos
    $('#modalEdicaoCliente #tabulacaoVendedorEdicao').off('change');
    $('#modalEdicaoCliente #btnAddProdutoEdicao').off('click');
    $('#modalEdicaoCliente #btnAddAcaoEdicao').off('click');

    // Adicionar os event listeners apenas dentro do modal de edição
    $('#modalEdicaoCliente #tabulacaoVendedorEdicao').on('change', handleTabulacaoVendedorChange);
    
    // Usar namespace para os eventos para evitar duplicação
    $('#modalEdicaoCliente #btnAddProdutoEdicao').on('click.edicao', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[EDIÇÃO] Botão adicionar produto clicado');
        adicionarProdutoEdicao();
    });

    $('#modalEdicaoCliente #btnAddAcaoEdicao').on('click.edicao', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[EDIÇÃO] Botão adicionar ação clicado');
        const agendamentoId = $('#agendamentoIdEdicao').val();
        const clienteData = {
            id_agendamento: agendamentoId,
            nome: $('#nomeClienteEdicao').val(),
            cpf: $('#cpfClienteEdicao').val(),
            numero: $('#numeroClienteEdicao').val(),
            dia_agendado: $('#diaAgendadoEdicao').val(),
            loja: $('#lojaAgendadaEdicao').val(),
            atendente: $('#atendenteAgendouEdicao').val()
        };
        abrirModalAdicionarAcao(clienteData);
    });

    // Delegar eventos para elementos dinâmicos
    $('#produtosContainerEdicao')
        .off('click', '.btn-remove-produto')
        .on('click', '.btn-remove-produto', function() {
            $(this).closest('.produto-bloco').remove();
            verificarVisibilidadeBotaoAddEdicao();
        })
        .off('focus', '.money')
        .on('focus', '.money', function() {
            $(this).mask('#.##0,00', {reverse: true});
        })
        .off('change', 'select[name$="[tipo_pagamento]"]')
        .on('change', 'select[name$="[tipo_pagamento]"]', function() {
            const index = $(this).closest('.produto-item').data('index');
            handleTipoPagamentoChangeEdicao(index);
        });

    // Garantir que o container de produtos esteja vazio ao abrir o modal
    $('#modalEdicaoCliente').on('show.bs.modal', function() {
        removerTodosProdutosEdicao();
    });

    // Evento para mostrar/ocultar seção de produtos
    $(document).on('change', '#tabulacaoEdicao', function() {
        const secaoProdutos = $('#secaoProdutosEdicao');
        if ($(this).val() === 'NEGOCIO_FECHADO') {
            secaoProdutos.show();
            // Se não houver produtos, adicionar um novo
            if ($('#produtosContainerEdicao .produto-item').length === 0) {
                $('.adicionar-produto').click();
            }
        } else {
            secaoProdutos.hide();
        }
    });
});

// Função para lidar com a mudança no tipo de pagamento na edição
function handleTipoPagamentoChangeEdicao(index) {
    console.log(`[EDIÇÃO] Tipo de pagamento alterado para índice ${index}`);
    handleTipoPagamentoChange(index, true);
}

// Função para lidar com a mudança no tipo de pagamento do modal de adicionar ação
function handleTipoPagamentoAcao() {
    console.log('[EDICAO] Tipo de pagamento alterado no modal Adicionar Ação');
    const tipo = $('#tipo_pagamento_acao').val();
    const detalhesContainer = $('#camposPagamentoAcao');
    const valorTotalContainer = $('#camposAVistaAcao');
    const parceladoContainer = $('#camposParceladoAcao');

    // Resetar required e visibilidade
    valorTotalContainer.find('input').prop('required', false);
    parceladoContainer.find('input').prop('required', false);
    valorTotalContainer.hide();
    parceladoContainer.hide();
    detalhesContainer.hide();

    if (tipo === 'A_VISTA') {
        valorTotalContainer.show();
        valorTotalContainer.find('input').prop('required', true);
        detalhesContainer.show();
    } else if (tipo === 'PARCELADO') {
        parceladoContainer.show();
        parceladoContainer.find('input').prop('required', true);
        detalhesContainer.show();
    }
}

// Função para aplicar máscara de dinheiro
function aplicarMascaraDinheiro(elemento) {
    console.log('[EDICAO] Tentando aplicar máscara de dinheiro em:', elemento);
    // $(elemento).mask('#.##0,00', {reverse: true}); // Comentado para desativar formatação
    console.log('[EDICAO] Máscara de dinheiro (desativada) para:', elemento);
}

// Função para abrir o modal de adicionar ação a um agendamento
window.abrirModalAdicionarAcao = function(clienteData) {
    console.log('[EDICAO] Abrindo modal adicionar ação com dados:', clienteData);
    
    // Obter o ID do agendamento do objeto cliente
    let agendamentoId = null;
    
    // O objeto clienteData pode ter estruturas diferentes dependendo de onde vem
    if (typeof clienteData === 'string') {
        try {
            clienteData = JSON.parse(clienteData);
        } catch (e) {
            console.error('[EDICAO] Erro ao parsear dados do cliente:', e);
        }
    }
    
    // Obter o ID do agendamento dependendo da estrutura do objeto
    if (clienteData) {
        agendamentoId = clienteData.id_agendamento || clienteData.agendamento_id;
    }
    
    if (!agendamentoId) {
        console.error('[EDICAO] ID do agendamento não encontrado');
        return;
    }
    
    // Resetar o modal
    let docIndexAcao = 0;
    $('#documentosAcaoContainer').empty();
    
    // Verificar qual o formulário correto no modal
    const formAcao = $('#formAcaoAgendamentoGenerico');
    console.log('[EDICAO] Form encontrado:', formAcao.length ? 'Sim' : 'Não');
    
    if (formAcao.length > 0) {
        formAcao[0].reset();
    } else {
        console.warn('[EDICAO] Formulário não encontrado com ID: formAcaoAgendamentoGenerico');
        // Verificar outros IDs possíveis
        const otherForm = $('#formAdicionarAcao');
        if (otherForm.length > 0) {
            console.log('[EDICAO] Formulário alternativo encontrado: formAdicionarAcao');
            otherForm[0].reset();
        }
    }
    
    // Ocultar campos condicionais
    $('#camposPagamentoAcao').hide();
    $('#camposAVistaAcao').hide();
    $('#camposParceladoAcao').hide();
    
    // Preencher campos do formulário com os dados do cliente
    $('#agendamentoIdAcao').val(agendamentoId);
    $('#acao_agendamento_id').val(agendamentoId);
    
    // Preencher informações do cliente no modal
    // Dados do cliente (tenta vários campos possíveis para maior compatibilidade)
    $('#nomeClienteAcao').val(clienteData.nome || clienteData.nome_cliente || clienteData.cliente_agendamento_nome || '');
    $('#cpfClienteAcao').val(clienteData.cpf || clienteData.cpf_cliente || clienteData.cliente_agendamento_cpf || '');
    $('#numeroClienteAcao').val(clienteData.numero || clienteData.numero_cliente || clienteData.cliente_agendamento_numero || '');
    
    // Dados do agendamento
    $('#diaAgendadoAcao').val(clienteData.dia_agendado || clienteData.data_agendamento || '');
    $('#lojaAgendadaAcao').val(clienteData.loja || clienteData.loja_agendada || clienteData.loja_nome || '');
    $('#atendenteAgendouAcao').val(clienteData.atendente || clienteData.atendente_agendou || clienteData.nome_atendente || '');
    
    // Também preencher os campos alternativos, se existirem
    if ($('#acao_nome_cliente').length) $('#acao_nome_cliente').val(clienteData.nome || clienteData.nome_cliente || '');
    if ($('#acao_cpf_cliente').length) $('#acao_cpf_cliente').val(clienteData.cpf || clienteData.cpf_cliente || '');
    if ($('#acao_numero_cliente').length) $('#acao_numero_cliente').val(clienteData.numero || clienteData.numero_cliente || '');
    
    // Carregar vendedores para o select
    // Tenta encontrar o select de vendedor em ambos os possíveis formulários
    const vendedorSelect = $('#vendedor_acao');
    const lojaId = clienteData.loja_id || clienteData.agendamento_loja_id;
    
    if (vendedorSelect.length > 0) {
        console.log('[EDICAO] Carregando vendedores para o select de vendedor');
        carregarVendedoresSelect('#vendedor_acao', lojaId);
    } else {
        console.warn('[EDICAO] Select de vendedor não encontrado');
    }
    
    // Abrir o modal
    const modalElement = document.getElementById('modalAdicionarAcao');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('[EDICAO] Modal não encontrado');
    }
};
