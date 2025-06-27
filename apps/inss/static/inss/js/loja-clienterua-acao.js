// Variáveis globais para o formulário de cliente rua ação
console.log('[CLIENTERUAACAO] ============ INICIALIZANDO SCRIPT ============');
console.log('[CLIENTERUAACAO] Inicializando variáveis globais');
if (typeof window.arquivoIndex === 'undefined') {
    window.arquivoIndex = 0;
}
if (typeof window.arquivosContainer === 'undefined') {
    window.arquivosContainer = null;
}
if (typeof window.arquivoTemplate === 'undefined') {
    window.arquivoTemplate = null;
}

// Função para validar CPF
function validarCPF(cpf) {
    console.log('[CLIENTERUAACAO] Validando CPF');
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11) {
        console.log('[CLIENTERUAACAO] CPF inválido - tamanho incorreto');
        return false;
    }
    
    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) {
        console.log('[CLIENTERUAACAO] CPF inválido - todos dígitos iguais');
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
        console.log('[CLIENTERUAACAO] CPF inválido - primeiro dígito verificador incorreto');
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
        console.log('[CLIENTERUAACAO] CPF inválido - segundo dígito verificador incorreto');
        return false;
    }
    
    console.log('[CLIENTERUAACAO] CPF válido');
    return true;
}

// Função para validar número de celular
function validarCelular(numero) {
    console.log('[CLIENTERUAACAO] Validando número de celular');
    numero = numero.replace(/\D/g, '');
    const valido = numero.length === 11;
    console.log(`[CLIENTERUAACAO] Número de celular ${valido ? 'válido' : 'inválido'}`);
    return valido;
}

// Função para lidar com a mudança no tipo de pagamento
function handleTipoPagamentoAcaoInline() {
    console.log('[CLIENTERUAACAO] Alterando tipo de pagamento');
    const tipoPagamento = $('#tipo_pagamento_rua_acao_inline').val();
    const camposPagamento = document.getElementById('camposPagamentoAcaoInline');
    const camposAVista = document.getElementById('camposAVistaAcaoInline');
    const camposParcelado = document.getElementById('camposParceladoAcaoInline');
    
    // Mostrar/ocultar campos de pagamento
    if (tipoPagamento === 'A_VISTA' || tipoPagamento === 'PARCELADO') {
        camposPagamento.style.display = 'block';
        
        // Mostrar campos específicos com base no tipo de pagamento
        if (tipoPagamento === 'A_VISTA') {
            camposAVista.style.display = 'block';
            camposParcelado.style.display = 'none';
            
            // Tornar campos obrigatórios
            $('#valor_total_rua_acao_inline').prop('required', true);
            $('#valor_entrada_rua_acao_inline').prop('required', false);
            $('#qtd_parcelas_rua_acao_inline').prop('required', false);
            $('#valor_parcela_rua_acao_inline').prop('required', false);
        } else if (tipoPagamento === 'PARCELADO') {
            camposAVista.style.display = 'none';
            camposParcelado.style.display = 'block';
            
            // Tornar campos obrigatórios
            $('#valor_total_rua_acao_inline').prop('required', false);
            $('#valor_entrada_rua_acao_inline').prop('required', true);
            $('#qtd_parcelas_rua_acao_inline').prop('required', true);
            $('#valor_parcela_rua_acao_inline').prop('required', true);
        }
    } else {
        camposPagamento.style.display = 'none';
        camposAVista.style.display = 'none';
        camposParcelado.style.display = 'none';
        
        // Remover obrigatoriedade dos campos
        $('#valor_total_rua_acao_inline').prop('required', false);
        $('#valor_entrada_rua_acao_inline').prop('required', false);
        $('#qtd_parcelas_rua_acao_inline').prop('required', false);
        $('#valor_parcela_rua_acao_inline').prop('required', false);
    }
}

// Função para adicionar arquivo
function adicionarArquivo() {
    console.log('[CLIENTERUAACAO] Adicionando novo arquivo, índice:', window.arquivoIndex);
    
    if (window.arquivosContainer.querySelector('.arquivo-bloco[data-adding]')) {
        console.log('[CLIENTERUAACAO] Já existe um arquivo sendo adicionado');
        return;
    }

    console.log('[CLIENTERUAACAO] Clonando template de arquivo');
    const clone = window.arquivoTemplate.content.cloneNode(true);
    const blocoArquivo = clone.querySelector('.arquivo-bloco');
    blocoArquivo.setAttribute('data-adding', 'true');
    blocoArquivo.innerHTML = blocoArquivo.innerHTML.replace(/__INDEX__/g, window.arquivoIndex);

    const btnRemove = blocoArquivo.querySelector('.btn-remove-arquivo');
    btnRemove.addEventListener('click', function() {
        console.log('[CLIENTERUAACAO] Removendo arquivo');
        blocoArquivo.remove();
    });

    console.log('[CLIENTERUAACAO] Adicionando arquivo ao container');
    window.arquivosContainer.appendChild(blocoArquivo);
    blocoArquivo.removeAttribute('data-adding');
    window.arquivoIndex++;
    console.log('[CLIENTERUAACAO] Arquivo adicionado, novo contador de arquivos:', window.arquivoIndex);
}

// Funções de alerta
function alertaErro(mensagem) {
    Swal.fire({
        icon: 'error',
        title: 'Erro',
        text: mensagem,
        confirmButtonColor: '#3085d6'
    });
}

function alertaSucesso(mensagem) {
    Swal.fire({
        icon: 'success',
        title: 'Sucesso',
        text: mensagem,
        confirmButtonColor: '#3085d6'
    });
}

// Função para aplicar máscara de dinheiro
function aplicarMascaraDinheiro(input) {
    $(input).on('input', function() {
        // Remover tudo que não é número
        let value = $(this).val().replace(/\D/g, '');
        
        // Converter para número e formatar
        value = (parseInt(value) / 100).toFixed(2);
        
        // Formatar com separador de milhar e decimal
        value = value.replace('.', ',');
        value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        
        // Atualizar o valor no input
        $(this).val(value);
    });
}

// Função para carregar lojas
function carregarLojas() {
    console.log('[CLIENTERUAACAO] Carregando lojas');
    $.ajax({
        url: '/inss/api/get/infogeral/',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            if (response.lojas) {
                const select = $('#loja_rua_acao_inline');
                select.empty().append('<option value="">Selecione uma loja</option>');
                
                // Ordenar lojas por nome
                const lojas = response.lojas.sort((a, b) => a.nome.localeCompare(b.nome));
                
                lojas.forEach(function(loja) {
                    select.append(`<option value="${loja.id}">${loja.nome}</option>`);
                });
                
                console.log('[CLIENTERUAACAO] Lojas carregadas com sucesso');
            } else {
                console.error('[CLIENTERUAACAO] Erro ao carregar lojas:', response.message);
            }
        },
        error: function(xhr, status, error) {
            console.error('[CLIENTERUAACAO] Erro ao carregar lojas:', error);
        }
    });
}

// Função para carregar vendedores
function carregarVendedores() {
    console.log('[CLIENTERUAACAO] Carregando vendedores');
    $.ajax({
        url: '/inss/api/get/infogeral/',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            if (response.funcionarios) {
                const select = $('#vendedor_rua_acao_inline');
                select.empty().append('<option value="">Selecione um vendedor</option>');
                
                // Ordenar vendedores por nome
                const vendedores = response.funcionarios.sort((a, b) => 
                    (a.apelido || a.nome_completo).localeCompare(b.apelido || b.nome_completo)
                );
                
                vendedores.forEach(function(vendedor) {
                    select.append(`<option value="${vendedor.id}">${vendedor.apelido || vendedor.nome_completo}</option>`);
                });
                
                console.log('[CLIENTERUAACAO] Vendedores carregados com sucesso');
            } else {
                console.error('[CLIENTERUAACAO] Erro ao carregar vendedores:', response.message);
            }
        },
        error: function(xhr, status, error) {
            console.error('[CLIENTERUAACAO] Erro ao carregar vendedores:', error);
        }
    });
}

$(document).ready(function () {
    console.log('[CLIENTERUAACAO] Inicializando script loja-clienterua-acao.js');

    window.arquivosContainer = document.getElementById('arquivosContainerInline');
    window.arquivoTemplate = document.getElementById('arquivoTemplateInline');

    if (!window.arquivosContainer) console.warn('[CLIENTERUAACAO] Container de arquivos não encontrado');
    if (!window.arquivoTemplate) console.warn('[CLIENTERUAACAO] Template de arquivo não encontrado');

    $('#cpf_cliente_rua_acao_inline').mask('000.000.000-00');
    $('#numero_cliente_rua_acao_inline').mask('(00) 0 0000-0000');

    aplicarMascaraDinheiro($('#valor_total_rua_acao_inline'));
    aplicarMascaraDinheiro($('#valor_entrada_rua_acao_inline'));
    aplicarMascaraDinheiro($('#valor_parcela_rua_acao_inline'));

    carregarLojas();
    carregarVendedores();

    $('#btnAddArquivoInline').on('click', function (e) {
        e.preventDefault();
        console.log('[CLIENTERUAACAO] Botão de adicionar arquivo clicado');
        adicionarArquivo();
    });

    $(document).on('submit', '#formClienteRuaAcaoInline', function (e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[CLIENTERUAACAO] ============ FORM SUBMIT INICIADO ============');

        const cpf = $('#cpf_cliente_rua_acao_inline').val().replace(/\D/g, '');
        if (!validarCPF(cpf)) {
            alertaErro('CPF inválido');
            return false;
        }

        const celular = $('#numero_cliente_rua_acao_inline').val().replace(/\D/g, '');
        if (!validarCelular(celular)) {
            alertaErro('Número de celular inválido');
            return false;
        }

        const tipoPagamento = $('#tipo_pagamento_rua_acao_inline').val();

        if (tipoPagamento === 'A_VISTA') {
            const valorTotal = $('#valor_total_rua_acao_inline').val();
            if (!valorTotal) {
                alertaErro('Informe o valor total para pagamento à vista');
                return false;
            }
        } else if (tipoPagamento === 'PARCELADO') {
            const valorEntrada = $('#valor_entrada_rua_acao_inline').val();
            const qtdParcelas = $('#qtd_parcelas_rua_acao_inline').val();
            const valorParcela = $('#valor_parcela_rua_acao_inline').val();
            if (!valorEntrada || !qtdParcelas || !valorParcela) {
                alertaErro('Preencha todos os campos do parcelamento');
                return false;
            }
        }

        const submitBtn = $(this).find('button[type="submit"]');
        const originalText = submitBtn.html();
        submitBtn.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i> Enviando...');

        const formData = new FormData(this);

        $('#arquivosContainerInline .arquivo-bloco').each(function (index) {
            const titulo = $(this).find('input[type="text"]').val();
            const inputFile = $(this).find('input[type="file"]')[0];
            const arquivo = inputFile?.files[0];

            if (arquivo) {
                formData.append(`arquivo_${index}`, arquivo);
                formData.append(`titulo_arquivo_${index}`, titulo || `Arquivo ${index + 1}`);
            }
        });

        $.ajax({
            url: '/inss/api/post/clienterua_acao/',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                window.respostaClienteRuaAcao = response;
            },
            error: function (xhr) {
                window.respostaClienteRuaAcao = xhr.responseJSON || {
                    status: 'error',
                    message: 'Erro desconhecido'
                };
            },
            complete: function () {
                submitBtn.prop('disabled', false).html(originalText);

                const resposta = window.respostaClienteRuaAcao;

                if (resposta?.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: resposta.message || 'Cliente com ação registrado com sucesso!',
                        confirmButtonColor: '#3085d6',
                        confirmButtonText: 'OK'
                    }).then(() => {
                        $('#formClienteRuaAcaoInline')[0].reset();
                        $('#arquivosContainerInline').empty();
                        $('#collapseClienteRuaAcaoForm').collapse('hide');
                        if (typeof carregarDados === 'function') carregarDados();
                    });
                } else {
                    alertaErro(resposta?.message || 'Erro ao processar a solicitação');
                }
            }
        });

        return false; // 🔐 impede redirecionamento em qualquer cenário
    });
});
