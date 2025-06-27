// Variáveis globais para o formulário de cliente rua
console.log('[CLIENTERUA] Inicializando variáveis globais');
let produtoIndex = 0;
let arquivoIndex = 0;
let produtosContainer = null;
let arquivosContainer = null;
let produtoTemplate = null;
let arquivoTemplate = null;
let acaoTemplate = null;
let documentoAcaoTemplate = null;

// Inicialização da lista de produtos
console.log('[CLIENTERUA] Inicializando lista de produtos');
window.listaProdutos = window.listaProdutos || {};

// Função para validar CPF
function validarCPF(cpf) {
    console.log('[CLIENTERUA] Validando CPF');
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11) {
        console.log('[CLIENTERUA] CPF inválido - tamanho incorreto');
        return false;
    }
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) {
        console.log('[CLIENTERUA] CPF inválido - todos dígitos iguais');
        return false;
    }
    
    // Validação do primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    let digitoVerificador1 = resto > 9 ? 0 : resto;
    if (digitoVerificador1 !== parseInt(cpf.charAt(9))) {
        console.log('[CLIENTERUA] CPF inválido - primeiro dígito verificador incorreto');
        return false;
    }
    
    // Validação do segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    let digitoVerificador2 = resto > 9 ? 0 : resto;
    if (digitoVerificador2 !== parseInt(cpf.charAt(10))) {
        console.log('[CLIENTERUA] CPF inválido - segundo dígito verificador incorreto');
        return false;
    }
    
    console.log('[CLIENTERUA] CPF válido');
    return true;
}

// Função para validar número de celular
function validarCelular(numero) {
    console.log('[CLIENTERUA] Validando número de celular');
    numero = numero.replace(/\D/g, '');
    const valido = numero.length === 11;
    console.log(`[CLIENTERUA] Número de celular ${valido ? 'válido' : 'inválido'}`);
    return valido;
}

// Função para preencher o select de produtos
function preencherSelectProdutos(selectElement) {
    console.log('[CLIENTERUA] Preenchendo select de produtos');
    selectElement.empty().append('<option value="">Selecione um produto</option>');
    
    // Verifica si a lista de produtos está disponível
    if (!window.listaProdutos) {
        console.error('[CLIENTERUA] Lista de produtos não encontrada');
        return;
    }
    
    const produtosArray = Object.values(window.listaProdutos);
    produtosArray.sort((a, b) => a.nome.localeCompare(b.nome));
    
    produtosArray.forEach(function(produto) {
        selectElement.append(`<option value="${produto.id}">${produto.nome}</option>`);
    });
    
    console.log('[CLIENTERUA] Select de produtos preenchido com sucesso');
}

// Função para carregar a lista de produtos
function carregarListaProdutos() {
    console.log('[CLIENTERUA] Carregando lista de produtos');
    
    $.ajax({
        url: '/inss/api/get/info-loja-funcionario/',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            console.log('[CLIENTERUA] Lista de produtos carregada com sucesso');
            window.listaProdutos = response.produtos || {};
        },
        error: function(xhr, status, error) {
            console.error('[CLIENTERUA] Erro ao carregar lista de produtos:', error);
        }
    });
}

// Carrega a lista de produtos ao iniciar
console.log('[CLIENTERUA] Iniciando carregamento da lista de produtos');
carregarListaProdutos();

// Função para adicionar produto
function adicionarProduto() {
    console.log('[CLIENTERUA] Adicionando novo produto, índice:', produtoIndex);
    
    // Verificar se o container existe
    if (!produtosContainer) {
        console.error('[CLIENTERUA] Container de produtos não encontrado');
        alertaErro('Erro ao adicionar produto: Container não encontrado');
        return;
    }
    
    if (produtosContainer.querySelector('.produto-bloco[data-adding]')) {
        console.log('[CLIENTERUA] Já existe um produto sendo adicionado');
        return;
    }

    // Verificar se o template existe
    if (!produtoTemplate) {
        console.error('[CLIENTERUA] Template de produto não encontrado');
        alertaErro('Erro ao adicionar produto: Template não encontrado');
        return;
    }

    console.log('[CLIENTERUA] Clonando template de produto');
    const clone = produtoTemplate.content.cloneNode(true);
    const blocoProduto = clone.querySelector('.produto-bloco');
    blocoProduto.setAttribute('data-adding', 'true');
    blocoProduto.setAttribute('data-index', produtoIndex);
    blocoProduto.innerHTML = blocoProduto.innerHTML.replace(/__INDEX__/g, produtoIndex);

    const btnRemove = blocoProduto.querySelector('.btn-remove-produto');
    btnRemove.addEventListener('click', function() {
        console.log('[CLIENTERUA] Removendo produto');
        blocoProduto.remove();
        handleTabulacaoVendedorInline();
    });

    const valorTacInput = blocoProduto.querySelector('.money');
    if (valorTacInput) {
        console.log('[CLIENTERUA] Aplicando máscara de dinheiro');
        aplicarMascaraDinheiro(valorTacInput);
    }
    
    const produtoSelect = blocoProduto.querySelector(`[name='produtos[${produtoIndex}][produto_id]']`);
    if (produtoSelect) {
        console.log('[CLIENTERUA] Preenchendo select de produtos');
        preencherSelectProdutos($(produtoSelect));
    }

    console.log('[CLIENTERUA] Adicionando produto ao container');
    produtosContainer.appendChild(blocoProduto);
    blocoProduto.removeAttribute('data-adding');
    produtoIndex++;
    handleTabulacaoVendedorInline();
    console.log('[CLIENTERUA] Produto adicionado, novo contador de produtos:', produtoIndex);
}

// Função para adicionar arquivo
function adicionarArquivo() {
    console.log('[CLIENTERUA] Adicionando novo arquivo, índice:', arquivoIndex);
    
    if (arquivosContainer.querySelector('.arquivo-bloco[data-adding]')) {
        console.log('[CLIENTERUA] Já existe um arquivo sendo adicionado');
        return;
    }

    console.log('[CLIENTERUA] Clonando template de arquivo');
    const clone = arquivoTemplate.content.cloneNode(true);
    const blocoArquivo = clone.querySelector('.arquivo-bloco');
    blocoArquivo.setAttribute('data-adding', 'true');
    blocoArquivo.innerHTML = blocoArquivo.innerHTML.replace(/__INDEX__/g, arquivoIndex);

    const btnRemove = blocoArquivo.querySelector('.btn-remove-arquivo');
    btnRemove.addEventListener('click', function() {
        console.log('[CLIENTERUA] Removendo arquivo');
        blocoArquivo.remove();
    });

    console.log('[CLIENTERUA] Adicionando arquivo ao container');
    arquivosContainer.appendChild(blocoArquivo);
    blocoArquivo.removeAttribute('data-adding');
    arquivoIndex++;
    console.log('[CLIENTERUA] Arquivo adicionado, novo contador de arquivos:', arquivoIndex);
}

// Função para lidar com a mudança no tipo de pagamento
function handleTipoPagamentoChange(index, isEdicao = false) {
    console.log(`[PAGAMENTO] Alterando tipo de pagamento para índice ${index}, edição: ${isEdicao}`);
    const prefix = isEdicao ? 'edicao_' : 'inline_';
    const tipoPagamento = $(`#tipo_pagamento_${prefix}${index}`).val();
    const camposPagamento = document.getElementById(`camposPagamento${isEdicao ? 'Edicao' : 'Inline'}_${index}`);
    const camposAVista = document.getElementById(`camposAVista${isEdicao ? 'Edicao' : 'Inline'}_${index}`);
    const camposParcelado = document.getElementById(`camposParcelado${isEdicao ? 'Edicao' : 'Inline'}_${index}`);

    console.log(`[PAGAMENTO] Tipo de pagamento alterado para: ${tipoPagamento}`);
    console.log('[PAGAMENTO] Elementos encontrados:', {
        camposPagamento: !!camposPagamento,
        camposAVista: !!camposAVista,
        camposParcelado: !!camposParcelado
    });

    // Esconder todos os campos primeiro
    console.log('[PAGAMENTO] Escondendo todos os campos');
    if (camposPagamento) camposPagamento.style.display = 'none';
    if (camposAVista) camposAVista.style.display = 'none';
    if (camposParcelado) camposParcelado.style.display = 'none';

    // Mostrar campos específicos baseado na seleção
    if (tipoPagamento === 'A_VISTA') {
        console.log('[PAGAMENTO] Mostrando campos à vista');
        if (camposPagamento) camposPagamento.style.display = 'block';
        if (camposAVista) camposAVista.style.display = 'block';
    } else if (tipoPagamento === 'PARCELADO') {
        console.log('[PAGAMENTO] Mostrando campos parcelado');
        if (camposPagamento) camposPagamento.style.display = 'block';
        if (camposParcelado) camposParcelado.style.display = 'block';
    } else if (tipoPagamento === 'SEM_PAGAMENTO') {
        console.log('[PAGAMENTO] Escondendo todos os campos de pagamento');
        if (camposPagamento) camposPagamento.style.display = 'none';
        if (camposAVista) camposAVista.style.display = 'none';
        if (camposParcelado) camposParcelado.style.display = 'none';
    }
}

// Função para controlar campos de pagamento no formulário de ação inline
function handleTipoPagamentoAcaoInline() {
    const tipoPagamento = $('#tipo_pagamento_rua_acao_inline').val();
    const camposPagamento = $('#camposPagamentoAcaoInline');
    const camposAVista = $('#camposAVistaAcaoInline');
    const camposParcelado = $('#camposParceladoAcaoInline');

    // Limpar valores anteriores
    $('#valor_total_rua_acao_inline').val('');
    $('#valor_entrada_rua_acao_inline').val('');
    $('#qtd_parcelas_rua_acao_inline').val('');
    $('#valor_parcela_rua_acao_inline').val('');

    if (tipoPagamento === 'SEM_PAGAMENTO') {
        camposPagamento.hide();
        camposAVista.hide();
        camposParcelado.hide();
    } else if (tipoPagamento === 'A_VISTA') {
        camposPagamento.show();
        camposAVista.show();
        camposParcelado.hide();
    } else if (tipoPagamento === 'PARCELADO') {
        camposPagamento.show();
        camposAVista.hide();
        camposParcelado.show();
    }
}

// Função para adicionar ação judicial e seus documentos
function adicionarAcaoInline() {
    console.log('[CLIENTERUA] Adicionando nova ação judicial');
    
    const template = document.getElementById('acaoTemplateInline');
    const container = document.getElementById('produtosContainerInline');
    const index = container.querySelectorAll('.produto-bloco[data-tipo="acao"]').length;
    
    console.log('[CLIENTERUA] Índice da nova ação:', index);
    
    const clone = template.content.cloneNode(true);
    const blocoAcao = clone.querySelector('.produto-bloco');
    
    // Adicionar atributo data-tipo
    blocoAcao.setAttribute('data-tipo', 'acao');
    
    // Substituir placeholders
    const html = blocoAcao.outerHTML
        .replace(/__INDEX__/g, index);
    
    // Adicionar ao container
    container.insertAdjacentHTML('beforeend', html);
    
    // Adicionar evento para remover ação
    const novoBloco = container.lastElementChild;
    novoBloco.querySelector('.btn-remove-produto').addEventListener('click', function() {
        novoBloco.remove();
        handleTabulacaoVendedorInline();
    });
    
    // Adicionar evento para adicionar documento
    novoBloco.querySelector('.btn-add-documento').addEventListener('click', function() {
        adicionarDocumentoAcaoInline(index);
    });
    
    // Atualizar contador de ações
    const acoesCount = container.querySelectorAll('.produto-bloco[data-tipo="acao"]').length;
    console.log('[CLIENTERUA] Ação judicial adicionada, novo contador:', acoesCount);
    
    // Verificar visibilidade do botão de adicionar
    handleTabulacaoVendedorInline();
}

function adicionarDocumentoAcaoInline(acaoIndex) {
    console.log('[CLIENTERUA] Adicionando documento para ação:', acaoIndex);
    
    const template = document.getElementById('documentoAcaoTemplateInline');
    if (!template) {
        console.error('[CLIENTERUA] Template de documento não encontrado');
        return;
    }

    const container = document.querySelector(`#documentos_acao_${acaoIndex}`);
    if (!container) {
        console.error('[CLIENTERUA] Container de documentos não encontrado para ação:', acaoIndex);
        return;
    }

    const docIndex = container.children.length;
    const clone = template.content.cloneNode(true);

    // Substituir placeholders
    clone.querySelectorAll('[id*="__ACAO_INDEX__"]').forEach(el => {
        el.id = el.id.replace('__ACAO_INDEX__', acaoIndex);
    });
    clone.querySelectorAll('[id*="__DOC_INDEX__"]').forEach(el => {
        el.id = el.id.replace('__DOC_INDEX__', docIndex);
    });
    clone.querySelectorAll('[name*="__ACAO_INDEX__"]').forEach(el => {
        el.name = el.name.replace('__ACAO_INDEX__', acaoIndex);
    });
    clone.querySelectorAll('[name*="__DOC_INDEX__"]').forEach(el => {
        el.name = el.name.replace('__DOC_INDEX__', docIndex);
    });

    // Adicionar evento de remoção
    const removeBtn = clone.querySelector('.btn-remove-documento');
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            const docItem = this.closest('.documento-item');
            if (docItem) {
                docItem.remove();
                reindexarDocumentosInline(acaoIndex);
            }
        });
    }

    container.appendChild(clone);
    console.log('[CLIENTERUA] Documento adicionado com sucesso');
}

function reindexarDocumentosInline(acaoIndex) {
    const container = document.querySelector(`#documentos_acao_${acaoIndex}`);
    if (!container) return;

    container.querySelectorAll('.documento-item').forEach((item, index) => {
        item.querySelectorAll('[id*="_documento_"]').forEach(el => {
            el.id = el.id.replace(/_\d+_\d+$/, `_${acaoIndex}_${index}`);
        });
        item.querySelectorAll('[name*="documentos"]["]').forEach(el => {
            el.name = el.name.replace(/\[\d+\]/, `[${index}]`);
        });
    });
}

// Função para lidar com a mudança na tabulação do vendedor
function handleTabulacaoVendedorInline() {
    console.log('[CLIENTERUA] Tabulação alterada - função chamada');
    
    const tabulacaoSelect = document.getElementById('tabulacao_vendedor_rua_inline');
    const addProdutoBtnContainerInss = document.getElementById('addProdutoBtnContainerInss');
    const motivoContainer = document.getElementById('motivoContainerInline');
    
    if (!tabulacaoSelect || !addProdutoBtnContainerInss || !motivoContainer) {
        console.error('[CLIENTERUA] Elementos necessários não encontrados');
        return;
    }
    
    const tabulacaoValue = tabulacaoSelect.value;
    console.log('[CLIENTERUA] Valor da tabulação:', tabulacaoValue);
   
    // Resetar visibilidade dos containers
    addProdutoBtnContainerInss.style.display = 'none';
    motivoContainer.style.display = 'none';
    
    // Aplicar lógica baseada na tabulação
    if (tabulacaoValue === 'NEGOCIO_FECHADO') {
        console.log('[CLIENTERUA] NEGÓCIO FECHADO selecionado');
        addProdutoBtnContainerInss.style.display = 'block';
    } else if (['INELEGIVEL', 'NÃO ACEITOU', 'NÃO QUIS OUVIR'].includes(tabulacaoValue)) {
        console.log('[CLIENTERUA] Mostrando container de motivo');
        motivoContainer.style.display = 'block';
    }
    
    console.log('[CLIENTERUA] Estado atual dos containers:', {
        addProdutoBtnContainerInss: addProdutoBtnContainerInss.style.display,
        motivoContainer: motivoContainer.style.display
    });
}

// Função para remover todos os arquivos
function removerTodosArquivos() {
    arquivosContainer.innerHTML = '';
    arquivoIndex = 0;
}

// Função para aplicar máscara de dinheiro
function aplicarMascaraDinheiro(input) {
    const $input = $(input);
    const inputId = $input.attr('id') || $input.attr('name') || 'undefined_input';
    console.log(`[CLIENTERUA_DEBUG] aplicarMascaraDinheiro START for ID: ${inputId}`);
    const valorAntes = $input.val();
    console.log(`[CLIENTERUA_DEBUG] Value BEFORE mask for ID ${inputId}: '${valorAntes}'`);

    // $input.mask('0.000.000.000.000,00', {
    //     reverse: true,
    //     placeholder: "0,00",
    //     onKeyPress: function(cep, e, field, options) {
    //         const fieldId = $(field).attr('id') || $(field).attr('name') || 'undefined_field';
    //         // Log only for the specific field if needed, e.g. if (fieldId === 'valor_total_rua_acao_inline')
    //         console.log(`[CLIENTERUA_DEBUG] onKeyPress for ID ${fieldId}. Key: ${e.originalEvent ? e.originalEvent.key : 'N/A'}, Current masked value (cep): '${cep}'`);
    //     },
    //     onChange: function(cep, e, field) {
    //         const fieldId = $(field).attr('id') || $(field).attr('name') || 'undefined_field';
    //         // Log only for the specific field if needed
    //         console.log(`[CLIENTERUA_DEBUG] onChange for ID ${fieldId}. New masked value (cep): '${cep}'`);
    //     }
    // });

    const valorDepois = $input.val(); 
    console.log(`[CLIENTERUA_DEBUG] Value AFTER mask call for ID ${inputId}: '${valorDepois}' (Note: onChange log provides the more definitive final value)`);
    console.log(`[CLIENTERUA_DEBUG] aplicarMascaraDinheiro END for ID: ${inputId}`);
}

// Funções de alerta
function alertaErro(mensagem) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: mensagem,
            confirmButtonText: 'OK'
        });
    } else {
        alert('Erro: ' + mensagem);
    }
}

function alertaSucesso(mensagem) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Sucesso',
            text: mensagem,
            confirmButtonText: 'OK'
        });
    } else {
        alert('Sucesso: ' + mensagem);
    }
}

// Função para coletar dados do formulário
function coletarDadosFormulario() {
    const formData = new FormData();
    const produtos = [];
    
    // Coletar dados básicos do formulário
    formData.append('form_type', 'cliente_rua');
    formData.append('nome_cliente', $('#nome_cliente_rua_inline').val());
    formData.append('cpf_cliente', $('#cpf_cliente_rua_inline').val());
    formData.append('numero_cliente', $('#numero_cliente_rua_inline').val());
    formData.append('data_comparecimento', $('#data_comparecimento_rua_inline').val());
    formData.append('loja', $('#loja_rua_inline').val());
    formData.append('vendedor_id', $('#vendedor_rua_inline').val());
    formData.append('tabulacao_vendedor', $('#tabulacao_vendedor_rua_inline').val());
    
    // Se tiver motivo, adicionar
    if ($('#motivo_rua_inline').val()) {
        formData.append('motivo', $('#motivo_rua_inline').val());
    }
    
    // Coletar dados dos produtos SOMENTE do container correto
    $('#produtosContainerInline .produto-item').each(function(index) {
        const produto = {
            tipo_negociacao: $(this).find('[name^="produtos["][name$="[tipo_negociacao]"]').val(),
            banco: $(this).find('[name^="produtos["][name$="[banco]"]').val(),
            valor_tac: $(this).find('[name^="produtos["][name$="[valor_tac]"]').val(),
            subsidio: $(this).find('[name^="produtos["][name$="[subsidio]"]').val(),
            associacao: $(this).find('[name^="produtos["][name$="[associacao]"]').val(),
            aumento: $(this).find('[name^="produtos["][name$="[aumento]"]').val()
        };
        // Adicionar cada campo do produto ao FormData
        Object.keys(produto).forEach(key => {
            formData.append(`produtos[${index}][${key}]`, produto[key]);
        });
    });
    return formData;
}

// Função para enviar formulário
function enviarFormulario(formData) {
    $.ajax({
        url: '/inss/api/post/novavenda/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('[CLIENTERUA] Resposta do servidor:', response);
            if (response.success) {
                alertaSucesso('Cliente registrado com sucesso!');
                // Limpar formulário
                $('#formClienteRuaInline')[0].reset();
                // Remover produtos adicionados
                $('#produtosContainerInline').empty();
            } else {
                alertaErro(response.message || 'Erro ao registrar cliente');
            }
        },
        error: function(xhr, status, error) {
            console.error('[CLIENTERUA] Erro ao enviar formulário:', error);
            alertaErro('Erro ao registrar cliente. Tente novamente.');
        }
    });
}

// Função para coletar dados do formulário inline
function coletarDadosFormularioInline() {
    console.log('[CLIENTERUA] Coletando dados do formulário inline');
    const formData = new FormData(document.getElementById('formClienteRuaInline'));
    
    // Processar produtos manualmente
    const produtos = [];
    $('#produtosContainerInline .produto-bloco').each(function(index) {
        console.log('[CLIENTERUA] Processando produto', index);
        const produto = {};
        
        // Coletar todos os inputs, selects e textareas dentro deste produto
        $(this).find('input, select, textarea').each(function() {
            const name = $(this).attr('name');
            if (name) {
                // Extrair o nome do campo do formato produtos[X][campo]
                const match = name.match(/produtos\[(\d+)\]\[([^\]]+)\]/);
                if (match) {
                    const fieldName = match[2];
                    produto[fieldName] = $(this).val();
                    console.log(`[CLIENTERUA] Campo ${fieldName} = ${$(this).val()}`);
                }
            }
        });
        
        if (Object.keys(produto).length > 0) {
            produtos.push(produto);
        }
    });
    
    // Remover os campos de produtos originais e adicionar o array de produtos como JSON
    const originalEntries = Array.from(formData.entries());
    for (const [key, value] of originalEntries) {
        if (key.startsWith('produtos[')) {
            formData.delete(key);
        }
    }
    
    // Adicionar produtos como JSON string
    if (produtos.length > 0) {
        formData.append('produtos_json', JSON.stringify(produtos));
        console.log('[CLIENTERUA] Produtos JSON:', JSON.stringify(produtos));
    }
    
    return formData;
}

// Função para enviar o formulário
function enviarFormularioInline(formData) {
    console.log('[CLIENTERUA] Enviando formulário inline');
    
    // Mostrar indicador de carregamento
    const submitBtn = $('#formClienteRuaInline button[type="submit"]');
    const originalText = submitBtn.html();
    submitBtn.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i> Enviando...');
    
    $.ajax({
        url: '/inss/api/post/novavenda/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('[CLIENTERUA] Resposta do servidor:', response);
            if (response.status === 'success') {
                alertaSucesso(response.message || 'Cliente salvo com sucesso!');
                // Limpar formulário
                $('#formClienteRuaInline')[0].reset();
                $('#produtosContainerInline').empty();
                // Recarregar dados se necessário
                if (typeof carregarDados === 'function') {
                    carregarDados();
                }
            } else {
                alertaErro(response.message || 'Erro ao processar a solicitação');
            }
        },
        error: function(xhr) {
            console.error('[CLIENTERUA] Erro na requisição:', xhr);
            alertaErro('Erro ao salvar: ' + (xhr.responseJSON?.message || 'Erro desconhecido'));
        },
        complete: function() {
            submitBtn.prop('disabled', false).html(originalText);
        }
    });
}

// Evento de submit do formulário
$('#formClienteRuaInline').on('submit', function(e) {
    e.preventDefault();
    // Validação do CPF
    const cpf = $('#cpf_cliente_rua_inline').val().replace(/\D/g, '');
    if (!validarCPF(cpf)) {
        alertaErro('CPF inválido');
        return;
    }
    // Validação do celular
    const celular = $('#numero_cliente_rua_inline').val().replace(/\D/g, '');
    if (!validarCelular(celular)) {
        alertaErro('Número de celular inválido');
        return;
    }
    // Validação de produtos se for NEGÓCIO FECHADO
    const tabulacao = $('#tabulacao_vendedor_rua_inline').val();
    if (tabulacao === 'NEGOCIO_FECHADO' && $('#produtosContainerInline .produto-bloco').length === 0) {
        alertaErro('Adicione pelo menos um produto para NEGÓCIO FECHADO');
        return;
    }
    // Coletar dados e enviar
    const formData = coletarDadosFormularioInline();
    console.log('[CLIENTERUA] Enviando formulário:', formData);
    enviarFormularioInline(formData);
});

// Função para controlar a exibição dos campos com base na tabulação selecionada
function handleTabulacaoVendedorInline() {
    console.log('[CLIENTERUA] Gerenciando campos com base na tabulação');
    const tabulacao = $('#tabulacao_vendedor_rua_inline').val();
    const motivoContainer = $('#motivoContainerInline');
    const addProdutoBtn = $('#addProdutoBtnContainerInss');
    const produtosContainer = $('#produtosContainerInline');
    
    console.log('[CLIENTERUA] Tabulação selecionada:', tabulacao);
    
    // Esconder todos os campos primeiro
    motivoContainer.hide();
    addProdutoBtn.hide();
    
    // Mostrar campos apropriados com base na tabulação
    if (tabulacao === 'NEGOCIO_FECHADO') {
        // Para NEGÓCIO FECHADO, mostrar botão de adicionar produto
        addProdutoBtn.show();
        motivoContainer.hide();
        // Tornar o campo de motivo não obrigatório
        $('#motivo_rua_inline').prop('required', false);
    } else if (tabulacao === 'INELEGIVEL' || tabulacao === 'NÃO ACEITOU' || tabulacao === 'NÃO QUIS OUVIR') {
        // Para outras opções, mostrar campo de motivo
        motivoContainer.show();
        addProdutoBtn.hide();
        // Tornar o campo de motivo obrigatório
        $('#motivo_rua_inline').prop('required', true);
    }
    
    // Verificar se há produtos e se a tabulação não é NEGÓCIO FECHADO
    if (tabulacao !== 'NEGOCIO_FECHADO' && $('#produtosContainerInline .produto-bloco').length > 0) {
        // Confirmar com o usuário se deseja remover os produtos
        if (confirm('A tabulação selecionada não permite produtos. Deseja remover os produtos já adicionados?')) {
            $('#produtosContainerInline').empty();
            console.log('[CLIENTERUA] Produtos removidos devido à mudança de tabulação');
        } else {
            // Se o usuário não confirmar, voltar para NEGÓCIO FECHADO
            $('#tabulacao_vendedor_rua_inline').val('NEGOCIO_FECHADO');
            addProdutoBtn.show();
            motivoContainer.hide();
            $('#motivo_rua_inline').prop('required', false);
        }
    }
}

// Inicialização quando o documento estiver pronto
$(document).ready(function() {
    console.log('[AMS] Inicializando script loja-clienterua.js');
    
    // Inicializar variáveis globais
    produtosContainer = document.getElementById('produtosContainerInline');
    arquivosContainer = document.getElementById('arquivosContainerInline');
    produtoTemplate = document.getElementById('produtoTemplateInline');
    arquivoTemplate = document.getElementById('arquivoTemplateInline');
    acaoTemplate = document.getElementById('acaoTemplateInline');
    documentoAcaoTemplate = document.getElementById('documentoAcaoTemplateInline');
    
    // Verificar se os elementos foram encontrados
    if (!produtosContainer) {
        console.warn('[AMS] Container de produtos não encontrado. Tentando buscar novamente...');
        // Tentar buscar novamente com um pequeno atraso
        setTimeout(function() {
            produtosContainer = document.getElementById('produtosContainerInline');
            if (!produtosContainer) {
                console.error('[AMS] Container de produtos não encontrado mesmo após nova tentativa');
            } else {
                console.log('[AMS] Container de produtos encontrado na segunda tentativa');
            }
        }, 500);
    }
    
    if (!produtoTemplate) {
        console.warn('[AMS] Template de produto não encontrado. Tentando buscar novamente...');
        // Tentar buscar novamente com um pequeno atraso
        setTimeout(function() {
            produtoTemplate = document.getElementById('produtoTemplateInline');
            if (!produtoTemplate) {
                console.error('[AMS] Template de produto não encontrado mesmo após nova tentativa');
            } else {
                console.log('[AMS] Template de produto encontrado na segunda tentativa');
            }
        }, 500);
    }
    
    // Inicializar a exibição dos campos com base na tabulação inicial
    handleTabulacaoVendedorInline();
    console.log('[AMS] Variáveis globais inicializadas');

    // Remover todos os event listeners existentes antes de adicionar novos
    $('#formClienteRuaInline #tabulacao_vendedor_rua_inline').off('change');
    $('#formClienteRuaInline #btnAddProdutoInss').off('click');
    $('#formClienteRuaInline #btnAddArquivoInline').off('click');
    $('#formClienteRuaAcaoInline #btnAddArquivoInline').off('click');
    $('#tipo_pagamento_rua_acao_inline').off('change');
    console.log('[AMS] Event listeners antigos removidos');

    // Adicionar os event listeners apenas dentro do formulário inline
    $('#formClienteRuaInline #tabulacao_vendedor_rua_inline').on('change', handleTabulacaoVendedorInline);
    console.log('[AMS] Event listener para tabulação vendedor adicionado');
    
    // Chamar a função handleTabulacaoVendedorInline para configurar o estado inicial
    setTimeout(function() {
        console.log('[AMS] Verificando estado inicial da tabulação');
        handleTabulacaoVendedorInline();
    }, 500);

    // Adicionar event listener para o tipo de pagamento
    $('#tipo_pagamento_rua_acao_inline').on('change', handleTipoPagamentoAcaoInline);
    handleTipoPagamentoAcaoInline(); // Configurar campos inicialmente
    console.log('[AMS] Event listener para tipo de pagamento adicionado');
    
    // Usar namespace para os eventos para evitar duplicação
    $('#formClienteRuaInline #btnAddProdutoInss').on('click.inline', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[AMS] Botão adicionar produto clicado');
        adicionarProduto();
    });
    
    // Adicionar event listener para o select de tabulação
    $('#tabulacao_vendedor_rua_inline').on('change.inline', function() {
        console.log('[AMS] Tabulação alterada');
        handleTabulacaoVendedorInline();
    });

    $('#formClienteRuaInline #btnAddAcaoInline').on('click.inline', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[AMS] Botão adicionar ação clicado');
        adicionarAcaoInline();
    });

    // Adicionar event listener para o botão de adicionar arquivo
    $('#btnAddArquivoInline').on('click.inline', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[AMS] Botão adicionar arquivo clicado');
        adicionarArquivo();
    });

    // Verificar se os elementos necessários estão presentes e exibir alertas se não estiverem
    if (!produtosContainer) {
        console.error('[AMS] Container de produtos não encontrado');
    }
    if (!arquivosContainer) {
        console.error('[AMS] Container de arquivos não encontrado');
    }
    if (!produtoTemplate) {
        console.error('[AMS] Template de produto não encontrado');
    }
    if (!arquivoTemplate) {
        console.error('[AMS] Template de arquivo não encontrado');
    }

    // Delegar eventos para elementos dinâmicos
    $('#produtosContainerInline')
        .off('click', '.btn-remove-produto')
        .on('click', '.btn-remove-produto', function() {
            console.log('[AMS] Produto removido');
            $(this).closest('.produto-bloco').remove();
            handleTabulacaoVendedorInline();
        })
        .off('click', '.btn-add-documento')
        .on('click', '.btn-add-documento', function(e) {
            e.preventDefault();
            const acaoIndex = $(this).data('acao-index');
            console.log('[CLIENTERUA] Botão adicionar documento clicado para ação:', acaoIndex);
            adicionarDocumentoAcaoInline(acaoIndex);
        })
        .off('click', '.btn-remove-documento')
        .on('click', '.btn-remove-documento', function(e) {
            e.preventDefault();
            const docItem = $(this).closest('.documento-item');
            const acaoIndex = $(this).closest('[id^="documentos_acao_"]').attr('id').split('_')[2];
            docItem.remove();
            reindexarDocumentosInline(acaoIndex);
        })
        .off('focus', '.money')
        .on('focus', '.money', function() {
            console.log('[AMS] Aplicando máscara monetária');
            $(this).mask('#.##0,00', {reverse: true});
        })
        .off('change', 'select[name$="[tipo_pagamento]"]')
        .on('change', 'select[name$="[tipo_pagamento]"]', function() {
            const index = $(this).closest('.produto-bloco').data('index');
            console.log(`[AMS] Tipo de pagamento alterado para produto ${index}`);
            handleTipoPagamentoChange(index);
        });

    // Delegar eventos para container de arquivos
    $('#arquivosContainerInline')
        .off('click', '.btn-remove-arquivo')
        .on('click', '.btn-remove-arquivo', function() {
            console.log('[AMS] Arquivo removido');
            $(this).closest('.arquivo-bloco').remove();
        });

    // Máscaras
    $('#cpf_cliente_rua_inline').mask('000.000.000-00');
    $('#numero_cliente_rua_inline').mask('(00) 0 0000-0000');
    console.log('[AMS] Máscaras de CPF e telefone aplicadas');

    // Aplicar máscara de dinheiro aos campos relevantes
    console.log('[AMS] Procurando campos .money para aplicar máscara de dinheiro...');
    $('#formNovaAcaoClienteRua .money').each(function() {
        const fieldId = $(this).attr('id') || $(this).attr('name') || 'input_sem_id_ou_nome';
        console.log(`[AMS] Encontrado campo .money: #${fieldId}. Tentando aplicar máscara...`);
        aplicarMascaraDinheiro(this);
    });

    // Data de comparecimento padrão como hoje
    const dataComparecimentoInput = document.getElementById('data_comparecimento_rua_inline');
    if (dataComparecimentoInput && !dataComparecimentoInput.value) {
        const hoje = new Date().toISOString().split('T')[0];
        dataComparecimentoInput.value = hoje;
        console.log(`[AMS] Data de comparecimento definida para hoje: ${hoje}`);
    }

    // Adicionando evento para buscar nome do cliente com base no CPF
    $('#cpf_cliente_rua_inline').on('blur', function() {
        var cpf = $(this).val().replace(/[^\d]/g, '');
        console.log(`[AMS] CPF inserido: ${cpf}`);
        
        if (cpf.length === 11 && validarCPF(cpf)) {
            console.log('[AMS] CPF válido, iniciando busca de cliente');
            $.ajax({
                url: '/inss/api/get/cpfclientenome/',
                method: 'GET',
                data: { cpf: cpf },
                success: function(response) {
                    if (response && response.nome) {
                        console.log(`[AMS] Cliente encontrado: ${response.nome}`);
                        $('#nome_cliente_rua_inline').val(response.nome);
                    } else {
                        console.log('[AMS] CPF não encontrado');
                        alert('CPF não encontrado ou erro na busca.');
                    }
                },
                error: function() {
                    console.log('[AMS] Erro na requisição AJAX');
                    alert('Erro ao buscar dados do cliente.');
                }
            });
        } else {
            console.log('[AMS] CPF inválido ou incompleto');
        }
    });
    
    console.log('[AMS] Inicialização concluída com sucesso');

    // Adicionar no final do document.ready ou após a inicialização das variáveis globais
    console.log('[CLIENTERUA] Carregando opções de loja e vendedor');

    function carregarLojas() {
        console.log('[CLIENTERUA] Carregando opções de loja');
        $.ajax({
            url: '/inss/api/get/infogeral/',
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                // Popular select de loja para Cliente Rua INSS
                const selectLojaInline = $('#loja_rua_inline');
                selectLojaInline.empty().append('<option value="">Selecione uma loja</option>');
                
                // Popular select de loja para Cliente Rua com Ação
                const selectLojaAcaoInline = $('#loja_rua_acao_inline');
                selectLojaAcaoInline.empty().append('<option value="">Selecione uma loja</option>');
                
                if (response.lojas) {
                    response.lojas.forEach(function(loja) {
                        // Adicionar opção para ambos os selects
                        selectLojaInline.append(`<option value="${loja.id}">${loja.nome}</option>`);
                        selectLojaAcaoInline.append(`<option value="${loja.id}">${loja.nome}</option>`);
                    });
                    console.log('[CLIENTERUA] Opções de loja carregadas com sucesso');
                } else {
                    console.error('[CLIENTERUA] Nenhum dado de lojas encontrado na resposta');
                }
            },
            error: function(xhr, status, error) {
                console.error('[CLIENTERUA] Erro ao carregar lojas:', error);
            }
        });
    }

    function carregarVendedores() {
        console.log('[CLIENTERUA] Carregando opções de vendedor');
        $.ajax({
            url: '/inss/api/get/infogeral/',
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                // Popular select de vendedor para Cliente Rua INSS
                const selectVendedorInline = $('#vendedor_rua_inline');
                selectVendedorInline.empty().append('<option value="">Selecione um vendedor</option>');
                
                // Popular select de vendedor para Cliente Rua com Ação
                const selectVendedorAcaoInline = $('#vendedor_rua_acao_inline');
                selectVendedorAcaoInline.empty().append('<option value="">Selecione um vendedor</option>');
                
                if (response.funcionarios) {
                    response.funcionarios.forEach(function(vendedor) {
                        // Adicionar opção para ambos os selects
                        selectVendedorInline.append(`<option value="${vendedor.id}">${vendedor.apelido || vendedor.nome_completo}</option>`);
                        selectVendedorAcaoInline.append(`<option value="${vendedor.id}">${vendedor.apelido || vendedor.nome_completo}</option>`);
                    });
                    console.log('[CLIENTERUA] Opções de vendedor carregadas com sucesso');
                } else {
                    console.error('[CLIENTERUA] Nenhum dado de funcionarios encontrado na resposta');
                }
            },
            error: function(xhr, status, error) {
                console.error('[CLIENTERUA] Erro ao carregar vendedores:', error);
            }
        });
    }

    // Chamar as funções no document.ready
    carregarLojas();
    carregarVendedores();
    
    // Adicionar evento de change para o select de tabulação do vendedor
    $('#tabulacao_vendedor_rua_inline').on('change', function() {
        console.log('[CLIENTERUA] Evento change do select de tabulação capturado');
        
        // Não precisamos fazer nada aqui além de chamar a função handleTabulacaoVendedorInline
        // que já aplica as classes CSS corretas com base no valor selecionado
        handleTabulacaoVendedorInline();
        
        // Log para debug
        const formContainer = $(this).closest('form').parent();
        console.log('[CLIENTERUA] Classes do container após evento change:', formContainer.attr('class'));
    });
    
    // Verificar o valor inicial da tabulação no carregamento da página
    const tabulacaoInicial = $('#tabulacao_vendedor_rua_inline').val();
    console.log('[CLIENTERUA] Valor inicial da tabulação no carregamento:', tabulacaoInicial);
    
    // Se já estiver selecionado NEGOCIO_FECHADO, acionar a função manualmente
    if (tabulacaoInicial === 'NEGOCIO_FECHADO') {
        console.log('[CLIENTERUA] NEGOCIO_FECHADO já selecionado no carregamento, acionando função');
        handleTabulacaoVendedorInline();
    }
});

function abrirModalClienteRua() {
    // Limpar formulário
    $('#formClienteRua')[0].reset();
    
    // Definir data atual
    $('#dataComparecimentoClienteRua').val(new Date().toISOString().split('T')[0]);
    
    // Mostrar modal
    $('#modalClienteRua').modal('show');
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
        
        // Inserir antes do botão de adicionar
        $(this).before(docHtml);
    });

    // Evento para adicionar produto
    $(document).on('click', '.adicionar-produto', function() {
        const container = $('#produtosContainerClienteRua');
        const index = container.find('.produto-item').length;
        
        const produtoHtml = `
            <div class="produto-item" data-index="[__INDEX__]">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Tipo de Negociação*</label>
                            <input type="text" class="form-control tipo-negociacao" name="produtos[__INDEX__][tipo_negociacao]" required>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Banco*</label>
                            <input type="text" class="form-control banco-input" name="produtos[__INDEX__][banco]" required>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Valor TAC*</label>
                            <input type="text" class="form-control valor-tac-input" name="produtos[__INDEX__][valor_tac]" required>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Subsídio</label>
                            <select class="form-control subsidio-checkbox" name="produtos[__INDEX__][subsidio]">
                                <option value="false">Não</option>
                                <option value="true">Sim</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Associação</label>
                            <select class="form-control associacao-checkbox" name="produtos[__INDEX__][associacao]">
                                <option value="false">Não</option>
                                <option value="true">Sim</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group">
                            <label>Aumento Margem</label>
                            <select class="form-control aumento-checkbox" name="produtos[__INDEX__][aumento]">
                                <option value="false">Não</option>
                                <option value="true">Sim</option>
                            </select>
                        </div>
                    </div>
                </div>
                <hr>
            </div>
        `;
        
        // Substituir [__INDEX__] pelo índice real
        const produtoHtmlFinal = produtoHtml.replace(/\[__INDEX__\]/g, index);
        
        // Inserir antes do botão de adicionar
        $(this).before(produtoHtmlFinal);
        
        // Log para debug
        console.log(`[CLIENTERUA] Produto ${index} adicionado com sucesso`);
    });
}

// Handler para o formulário de ação em agendamento
$('#formAcaoAgendamentoGenerico').on('submit', function(e) {
    e.preventDefault();
    
    // Criar FormData
    const formData = new FormData(this);
    
    // Mapear nome_cliente para nome_completo
    const nomeCliente = $('#nomeClienteAcao').val();
    formData.append('nome_completo', nomeCliente);
    formData.delete('nome_cliente'); // Remove o campo original
    
    // Enviar formulário
    $.ajax({
        url: '/inss/api/post/novavenda/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            if (response.status === 'success') {
                alertaSucesso(response.message);
                fecharModal('#modalAdicionarAcao');
                // Recarregar dados das tabelas
                carregarAgendadosHoje();
                carregarAgendamentosPendentes();
                carregarClientesNaoPresentes();
            } else {
                alertaErro(response.message || 'Erro ao adicionar ação');
            }
        },
        error: function(xhr) {
            alertaErro(xhr.responseJSON?.message || 'Erro ao adicionar ação');
        }
    });
});

// Atualizar o handler do formulário
$('#formClienteRua').on('submit', function(e) {
    e.preventDefault();
    
    const submitBtn = $(this).find('button[type="submit"]');
    const originalText = submitBtn.html();
    submitBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Salvando...');

    // Validar campos obrigatórios
    const nome = $('#nomeClienteRua').val();
    const cpf = $('#cpfClienteRua').val();
    const numero = $('#numeroClienteRua').val();
    const dataComparecimento = $('#dataComparecimentoClienteRua').val();
    const vendedor = $('#vendedorClienteRua').val();
    const tabulacao = $('#tabulacaoClienteRua').val();

    if (!nome || !cpf || !numero || !dataComparecimento || !vendedor || !tabulacao) {
        alertaErro('Por favor, preencha todos os campos obrigatórios.');
        submitBtn.prop('disabled', false).html(originalText);
        return;
    }

    // Criar FormData
    const formData = new FormData(this);
    const logObj = {};
    formData.forEach((v, k) => { logObj[k] = v; });
    console.log('[ENVIANDO FORM CLIENTE RUA MODAL]', logObj);
    formData.append('data_comparecimento', dataComparecimento);

    // Enviar requisição
    $.ajax({
        url: '/inss/api/post/novavenda/',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            if (response.status === 'success') {
                alertaSucesso(response.message);
                $('#modalClienteRua').modal('hide');
                // Recarregar dados se necessário
                if (typeof carregarDados === 'function') {
                    carregarDados();
                }
            } else {
                alertaErro(response.message || 'Erro ao processar a solicitação');
            }
        },
        error: function(xhr) {
            alertaErro('Erro ao salvar: ' + (xhr.responseJSON?.message || 'Erro desconhecido'));
        },
        complete: function() {
            submitBtn.prop('disabled', false).html(originalText);
        }
    });
});

// Evento para mostrar/ocultar seção de produtos
$(document).on('change', '#tabulacaoClienteRua', function() {
    const secaoProdutos = $('#secaoProdutosClienteRua');
    if ($(this).val() === 'NEGOCIO_FECHADO') {
        secaoProdutos.show();
        // Se não houver produtos, adicionar um novo
        if ($('#produtosContainerClienteRua .produto-item').length === 0) {
            $('.adicionar-produto').click();
        }
    } else {
        secaoProdutos.hide();
    }
});

function initializeEventListeners() {
    console.log('[CLIENTERUA] Iniciando initializeEventListeners');
    
    // Remover listeners existentes para evitar duplicação
    $(document).off('click', '.btn-add-documento');
    $(document).off('click', '.btn-remove-documento');
    
    // Adicionar documento
    $(document).on('click', '.btn-add-documento', function(e) {
        e.preventDefault();
        const acaoIndex = $(this).data('acao-index');
        console.log('[CLIENTERUA] Botão de adicionar documento clicado para ação:', acaoIndex);
        adicionarDocumentoAcaoInline(acaoIndex);
    });

    // Remover documento
    $(document).on('click', '.btn-remove-documento', function(e) {
        e.preventDefault();
        const docItem = $(this).closest('.documento-item');
        const acaoIndex = docItem.closest('[id^="documentos_acao_"]').attr('id').split('_')[2];
        docItem.remove();
        reindexarDocumentosInline(acaoIndex);
    });

    // Adicionar eventos para os botões de adicionar arquivo
    $('#btnAddArquivoInline').on('click', function(e) {
        e.preventDefault();
        console.log('[CLIENTERUA] Botão de adicionar arquivo clicado');
        adicionarArquivo();
    });

    // Adiciona evento para o botão de adicionar arquivo usando jQuery
    console.log('[CLIENTERUA] Configurando evento para botão de adicionar arquivo');
    $('.btn-add-arquivo-acao').on('click', function(e) {
        console.log('[CLIENTERUA] Botão de adicionar arquivo clicado via jQuery');
        e.preventDefault();
        adicionarArquivo();
    });
}

function removerTodosProdutos() {
    if (produtosContainer) {
        produtosContainer.innerHTML = '';
        produtoIndex = 0;
    }
}
