// ==========================================
// Gerenciamento de Comunicados - Lado do Servidor
// ==========================================

// Aguarda o documento estar pronto
document.addEventListener('DOMContentLoaded', function() {
    // Verifica se o jQuery está disponível
    if (typeof jQuery === 'undefined') {
        console.error('jQuery não está disponível');
        return;
    }
    console.log('jQuery está disponível');

    // Cache de dados
    let cacheData = {
        empresas: [],
        departamentos: [],
        setores: [],
        lojas: [],
        equipes: [],
        funcionarios: []
    };

    // Elementos do DOM
    const $tipoDestinatario = $('#tipo-destinatario');
    const $containerCheckboxes = $('#container-checkboxes');
    const $colunaEsquerda = $('#coluna-esquerda');
    const $colunaDireita = $('#coluna-direita');
    const $loadingSpinner = $('.loading-spinner');
    const $errorMessage = $('.error-message');

    // Função para carregar todos os dados necessários
    function carregarTodosDados() {
        console.log('Carregando todos os dados...');
        $loadingSpinner.addClass('active');
        $errorMessage.removeClass('active');
        
        $.ajax({
            url: '/rh/api/get/infosgerais/',
            method: 'GET',
            success: function(response) {
                if (response.status === 'success') {
                    cacheData = response.data;
                    console.log('Dados carregados com sucesso');
                    $loadingSpinner.removeClass('active');
                } else {
                    showError('Erro ao carregar dados');
                }
            },
            error: function(error) {
                console.error('Erro ao carregar dados:', error);
                showError('Erro ao carregar dados');
            }
        });
    }

    // Função para mostrar erro
    function showError(message) {
        $loadingSpinner.removeClass('active');
        $errorMessage.text(message).addClass('active');
        setTimeout(() => {
            $errorMessage.removeClass('active');
        }, 5000);
    }

    // Função para renderizar checkboxes
    function renderizarCheckboxes(tipo) {
        console.log(`Renderizando checkboxes para ${tipo}`);
        const dados = cacheData[tipo] || [];
        
        // Limpa as colunas
        $colunaEsquerda.empty();
        $colunaDireita.empty();

        // Divide os dados em duas colunas
        const meio = Math.ceil(dados.length / 2);
        dados.forEach((item, index) => {
            const checkbox = criarCheckbox(tipo, item);
            if (index < meio) {
                $colunaEsquerda.append(checkbox);
            } else {
                $colunaDireita.append(checkbox);
            }
        });

        // Atualiza o estado do "Marcar Todos"
        atualizarEstadoMarcarTodos();
    }

    // Função para criar checkbox
    function criarCheckbox(tipo, item) {
        console.log(`Criando checkbox para ${tipo}:`, item);
        return $(`
            <div class="form-check">
                <input class="form-check-input ${tipo}-checkbox" type="checkbox" 
                       name="${tipo}" value="${item.id}" id="${tipo}_${item.id}">
                <label class="form-check-label" for="${tipo}_${item.id}">
                    ${item.nome}
                </label>
            </div>
        `);
    }

    // Função para atualizar estado do "Marcar Todos"
    function atualizarEstadoMarcarTodos() {
        const tipo = $tipoDestinatario.val();
        const totalCheckboxes = $(`.${tipo}-checkbox`).length;
        const checkedCheckboxes = $(`.${tipo}-checkbox:checked`).length;
        
        $('#marcar-todos').prop('checked', totalCheckboxes > 0 && totalCheckboxes === checkedCheckboxes);
    }

    // Função para validar destinatários
    function validateDestinatarios() {
        const destinatarios = $('.empresas-checkbox:checked, .departamentos-checkbox:checked, .setores-checkbox:checked, .lojas-checkbox:checked, .equipes-checkbox:checked, .funcionarios-checkbox:checked');
        console.log('Validando destinatários:', destinatarios.length);
        if (destinatarios.length === 0) {
            showToast('danger', 'Selecione pelo menos um destinatário');
            return false;
        }
        return true;
    }

    // Função para validar campos
    function validateField(field, errorMessage) {
        console.log('Validando campo:', field.attr('id'));
        if (!field.val().trim()) {
            field.addClass('is-invalid');
            showToast('danger', errorMessage);
            return false;
        }
        field.removeClass('is-invalid');
        return true;
    }

    // Função para mostrar toast
    function showToast(type, message) {
        console.log('Mostrando toast:', type, message);
        const toast = $(`
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                <i class='bx ${type === 'success' ? 'bx-check-circle' : 'bx-error-circle'}'></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `);
        
        $('#toast-container-fixed').append(toast);
        setTimeout(() => {
            toast.remove();
            console.log('Toast removido');
        }, 5000);
    }

    // Event Listeners

    // Mudança no tipo de destinatário
    $tipoDestinatario.on('change', function() {
        const tipo = $(this).val();
        if (tipo) {
            $containerCheckboxes.addClass('active');
            renderizarCheckboxes(tipo);
        } else {
            $containerCheckboxes.removeClass('active');
        }
    });

    // Marcar/desmarcar todos
    $('#marcar-todos').on('change', function() {
        const checked = $(this).prop('checked');
        const tipo = $tipoDestinatario.val();
        console.log('Marcar todos:', checked, 'para', tipo);
        $(`.${tipo}-checkbox`).prop('checked', checked);
    });

    // Atualizar estado do "Marcar Todos" quando checkboxes individuais mudam
    $containerCheckboxes.on('change', '.form-check-input', function() {
        atualizarEstadoMarcarTodos();
    });

    // Controle do tipo de conteúdo
    $('input[name="tipo_conteudo"]').on('change', function() {
        const tipo = $(this).val();
        console.log('Tipo de conteúdo selecionado:', tipo);
        if (tipo === 'texto') {
            $('#campo_texto').show();
            $('#campo_banner').hide();
            $('#comunicado_texto').prop('required', true);
            $('#comunicado_banner').prop('required', false);
        } else {
            $('#campo_texto').hide();
            $('#campo_banner').show();
            $('#comunicado_texto').prop('required', false);
            $('#comunicado_banner').prop('required', true);
        }
    });

    // Preview do banner
    $('#comunicado_banner').on('change', function() {
        const file = this.files[0];
        console.log('Arquivo de banner selecionado:', file);
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#preview_banner').attr('src', e.target.result).show();
                console.log('Preview do banner atualizado');
            };
            reader.readAsDataURL(file);
        }
    });

    // Validação do formulário
    $('#form-comunicado').on('submit', function(e) {
        e.preventDefault();
        console.log('Formulário enviado');

        // Validação do assunto
        if (!validateField($('#comunicado_assunto'), 'O assunto é obrigatório')) {
            return;
        }

        // Validação do conteúdo
        const tipoConteudo = $('input[name="tipo_conteudo"]:checked').val();
        console.log('Tipo de conteúdo para validação:', tipoConteudo);
        if (tipoConteudo === 'texto') {
            if (!validateField($('#comunicado_texto'), 'O texto é obrigatório')) {
                return;
            }
        } else {
            if (!validateField($('#comunicado_banner'), 'O banner é obrigatório')) {
                return;
            }
        }

        // Validação dos destinatários
        if (!validateDestinatarios()) {
            return;
        }

        // Envio do formulário
        const formData = new FormData(this);
        
        // Adiciona os destinatários selecionados
        const destinatarios = {
            empresas: [],
            departamentos: [],
            setores: [],
            lojas: [],
            equipes: [],
            funcionarios: []
        };

        // Coleta os IDs selecionados por categoria
        $('.empresas-checkbox:checked').each(function() {
            destinatarios.empresas.push($(this).val());
        });
        $('.departamentos-checkbox:checked').each(function() {
            destinatarios.departamentos.push($(this).val());
        });
        $('.setores-checkbox:checked').each(function() {
            destinatarios.setores.push($(this).val());
        });
        $('.lojas-checkbox:checked').each(function() {
            destinatarios.lojas.push($(this).val());
        });
        $('.equipes-checkbox:checked').each(function() {
            destinatarios.equipes.push($(this).val());
        });
        $('.funcionarios-checkbox:checked').each(function() {
            destinatarios.funcionarios.push($(this).val());
        });

        formData.append('destinatarios', JSON.stringify(destinatarios));
        
        // Adiciona o CSRF token
        const csrfToken = $('input[name="csrfmiddlewaretoken"]').val();
        
        $.ajax({
            url: $(this).attr('action'),
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-CSRFToken': csrfToken
            },
            success: function(response) {
                console.log('Resposta do servidor:', response);
                if (response.status === 'success') {
                    showToast('success', 'Comunicado enviado com sucesso');
                    $('#form-comunicado')[0].reset();
                    $('#preview_banner').hide();
                    $containerCheckboxes.removeClass('active');
                    $tipoDestinatario.val('');
                } else {
                    showToast('danger', response.message || 'Erro ao enviar comunicado');
                }
            },
            error: function(error) {
                console.error('Erro ao enviar comunicado:', error);
                showToast('danger', 'Erro ao enviar comunicado');
            }
        });
    });

    // Carrega todos os dados ao iniciar
    carregarTodosDados();
});

// ==========================================
// Funções Auxiliares
// ==========================================

// Adiciona estilos CSS necessários
$('<style>')
    .text(`
        .success-animation {
            animation: successPulse 2s ease;
        }
        
        @keyframes successPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
        }
        
        .invalid-feedback {
            display: block;
            color: #dc3545;
            font-size: 0.875em;
            margin-top: 0.25rem;
        }
        
        .is-invalid {
            border-color: #dc3545 !important;
        }
        
        .is-invalid:focus {
            box-shadow: 0 0 0 0.25rem rgba(220, 53, 69, 0.25) !important;
        }
    `)
    .appendTo('head');
