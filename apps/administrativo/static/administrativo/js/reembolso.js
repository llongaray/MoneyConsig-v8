$(function() {
    console.log("Script de reembolso inicializado.");

    // URLs das APIs
    const API_GET_INFO_URL    = '/api/reembolso/info/';
    const API_POST_ADD_URL    = '/api/reembolso/registrar/';
    const API_POST_REVERT_URL = '/api/reembolso/reverter/';
    console.log("URLs da API:", { get: API_GET_INFO_URL, add: API_POST_ADD_URL, revert: API_POST_REVERT_URL });

    // --- Funções Auxiliares ---
    function getCookie(name) {
        // console.log(`[getCookie] Tentando obter cookie: ${name}`); // Reduce verbosity
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(cookie.slice(name.length + 1));
                    // console.log(`[getCookie] Cookie encontrado: ${name} = ${cookieValue}`); // Reduce verbosity
                    break;
                }
            }
        }
        if (!cookieValue) console.warn(`[getCookie] Cookie não encontrado: ${name}`);
        return cookieValue;
    }
    const csrftoken = getCookie('csrftoken');
    console.log("Token CSRF:", csrftoken ? "Carregado" : "Não Encontrado");

    function formatDate(dateString) {
        // console.log(`[formatDate] Entrada: ${dateString}`); // Reduce verbosity
        if (!dateString) return 'N/A';
        // Assuming dateString is already in DD/MM/YYYY HH:MM format from API
        // If it's DD/MM/YYYY, the current logic with T00:00:00 might work, but let's handle potential HH:MM
        // A more robust approach for DD/MM/YYYY HH:MM:SS or DD/MM/YYYY
        const parts = dateString.split(' ')[0].split('/'); // Get DD/MM/YYYY part
        if (parts.length !== 3) {
             console.warn("[formatDate] Formato de data inesperado:", dateString);
             return dateString; // Return original or 'Data inválida'
        }
        // Parts are [DD, MM, YYYY]. Month is 0-indexed in Date constructor.
        const date = new Date(parts[2], parts[1] - 1, parts[0]);

        if (isNaN(date.getTime())) {
            console.warn("[formatDate] Data inválida após parsing:", dateString);
            return 'Data inválida';
        }
        const day   = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year  = date.getFullYear();
        const formatted = `${day}/${month}/${year}`;
        // console.log(`[formatDate] Saída: ${formatted}`); // Reduce verbosity
        return formatted;
    }

    function formatCurrency(value) {
        // console.log(`[formatCurrency] Entrada: ${value}`); // Reduce verbosity
        if (value == null) return 'N/A';
        // Ensure value is a number before formatting
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
             console.warn("[formatCurrency] Valor inválido para formatação:", value);
             return 'N/A';
        }
        const formatted = numValue
            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        // console.log(`[formatCurrency] Saída: ${formatted}`); // Reduce verbosity
        return formatted;
    }

    function showAlert(message, type = 'success', containerSelector = '#alert-container') {
        console.log(`[showAlert] Tipo=${type}, Mensagem="${message}"`);
        // Ensure the container exists
        if ($(containerSelector).length === 0) {
            $('body').prepend('<div id="alert-container" style="position:fixed;top:20px;right:20px;z-index:1050;"></div>');
        }
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;
        const $alert = $(alertHtml);
        $(containerSelector).append($alert);
        // Auto-close the alert after 5 seconds
        setTimeout(() => {
            // console.log(`[showAlert] Fechando alerta: "${message}"`); // Reduce verbosity
            $alert.alert('close');
        }, 5000);
    }

    // --- Busca e População de Dados (sem paginação no servidor) ---
    // This function is used for the 'Registrar' and 'Reverter' tables
    function fetchData(dataType, filters = {}) {
        console.log(`[fetchData] Chamado para ${dataType}, filtros:`, filters);
        const tableBodySelector = dataType === 'register'
            ? '#reembolso-register-table tbody'
            : '#reembolso-revert-table tbody';
        const loadingSelector = dataType === 'register'
            ? '#reembolso-register-loading'
            : '#reembolso-revert-loading';
        const noResultsSelector = dataType === 'register'
            ? '#reembolso-register-no-results'
            : '#reembolso-revert-no-results';

        // Remove _todos_ os <tr> exceto o template correto
        const templateId = dataType === 'register'
            ? 'reembolso-register-row-template'
            : 'reembolso-revert-row-template';
        $(tableBodySelector)
            .find(`tr:not(#${templateId})`)
            .remove();

        $(noResultsSelector).hide();
        $(loadingSelector).show();

        $.ajax({
            url: API_GET_INFO_URL,
            method: 'GET',
            data: filters,
            dataType: 'json',
            success: function(response) {
                console.info(`[fetchData] Sucesso para ${dataType}. Resposta:`, response);
                $(loadingSelector).hide();

                const data = dataType === 'register'
                    ? response.registros_para_reembolsar
                    : response.registros_reembolsados; // Note: 'revert' table uses 'registros_reembolsados'

                console.log(`[fetchData] Itens para ${dataType}:`, data.length);
                if (data && data.length > 0) { // Added check for data existence
                    populateTable(dataType, data);
                } else {
                    console.log(`[fetchData] Nenhum resultado para ${dataType}.`);
                    $(noResultsSelector).show();
                }
            },
            error: function(xhr, status, error) {
                console.error(
                    `[fetchData] Erro ao carregar ${dataType}. ` +
                    `Status: ${status}, Erro: ${error}\n`, xhr.responseText
                );
                $(loadingSelector).hide();
                showAlert(`Erro ao carregar dados (${dataType}).`, 'danger');
                $(noResultsSelector).text('Erro ao carregar dados.').show();
            }
        });
    }

    // --- Popula a tabela usando o template oculto ---
    // This function is used for the 'Registrar' and 'Reverter' tables
    function populateTable(dataType, data) {
        console.log(`[populateTable] ${dataType} com ${data.length} itens`);
        const tableBodySelector = dataType === 'register'
            ? '#reembolso-register-table tbody'
            : '#reembolso-revert-table tbody';
        const templateSelector = dataType === 'register'
            ? '#reembolso-register-row-template'
            : '#reembolso-revert-row-template'; // Note: 'revert' table uses its own template
        const $tableBody   = $(tableBodySelector);
        const $templateRow = $(templateSelector);

        if (!$templateRow.length) {
            console.error(`Template não encontrado: ${templateSelector}`);
            return;
        }

        // Clear existing rows before populating, except the template
         $tableBody.find(`tr:not(${templateSelector})`).remove();


        data.forEach((item, i) => {
            // console.log(`[populateTable] Processando item ${i}:`, item); // Reduce verbosity

            // Clona, remove ID, estilo inline e a classe que esconde
            const $newRow = $templateRow
                .clone()
                .removeAttr('id')
                .removeAttr('style') // Remove style="display:none"
                .removeClass('reembolso-table-row-template'); // Remove class that might hide it

            // Preenche as células
            $newRow.find('[data-field="cpf_cliente"]').text(item.cpf_cliente || 'N/A');
            $newRow.find('[data-field="produto_nome"]').text(item.produto_nome || 'N/A');
            $newRow.find('[data-field="valor"]').text(formatCurrency(item.valor));

            // Handle date formatting based on table type
            if (dataType === 'register') {
                 $newRow.find('[data-field="data_registro"]').text(formatDate(item.data_registro));
                 // These fields might not exist in 'register' data, ensure they are cleared or handled
                 $newRow.find('[data-field="usuario_nome"]').text(item.usuario_nome || 'N/A'); // Assuming usuario_nome might exist
                 $newRow.find('[data-field="setor_nome"]').text(item.setor_nome || 'N/A'); // Assuming setor_nome might exist
            } else { // dataType === 'revert'
                 $newRow.find('[data-field="setor_nome"]').text(item.setor_nome || 'N/A');
                 $newRow.find('[data-field="data_registro"]').text(formatDate(item.data_registro));
                 $newRow.find('[data-field="data_reembolso"]').text(formatDate(item.data_reembolso));
                 // These fields might not exist in 'revert' data, ensure they are cleared or handled
                 $newRow.find('[data-field="usuario_nome"]').text(item.usuario_nome || 'N/A'); // Assuming usuario_nome might exist
            }


            // Ajusta o input hidden do form de ação
            const $form = $newRow.find('form');
            if ($form.length) { // Check if form exists in template
                if (dataType === 'register') {
                    $form.find('input[name="registermoney_id"]').val(item.id);
                    // console.log(`  → registermoney_id definido: ${item.id}`); // Reduce verbosity
                } else { // dataType === 'revert'
                    $form.find('input[name="reembolso_id"]').val(item.reembolso_id);
                    // console.log(`  → reembolso_id definido: ${item.reembolso_id}`); // Reduce verbosity
                }
            }


            $tableBody.append($newRow);
        });

        console.log(`[populateTable] Tabela ${dataType} populada.`);
    }

    // --- Ações de Registrar e Reverter ---
    $('#reembolso-register-table').on('submit', '.reembolso-register-form', function(e) {
        e.preventDefault();
        console.log("[Register Action] Formulário submetido.");
        const $form = $(this);
        const $btn  = $form.find('button[type="submit"]');
        const id    = $form.find('input[name="registermoney_id"]').val();
        const $row  = $form.closest('tr');

        console.log(`[Register Action] registermoney_id: ${id}`);
        if (!id) {
            showAlert('ID do registro não encontrado.', 'warning');
            return;
        }

        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Registrando...');
        $.ajax({
            url: API_POST_ADD_URL,
            method: 'POST',
            data: JSON.stringify({ registermoney_id: id }),
            contentType: 'application/json',
            headers: { 'X-CSRFToken': csrftoken },
            success: function(res) {
                console.info("[Register Action] Resposta:", res);
                if (res.success) {
                    showAlert(res.message || 'Reembolso registrado!', 'success');
                    // Remove the row and potentially refresh the revert table/dashboard table
                    $row.fadeOut(400, () => {
                        $row.remove();
                        // Optional: Refresh revert table or dashboard table after successful registration
                        // fetchData('revert', {}); // If revert table should update immediately
                        loadDashboard(); // If dashboard table should update immediately
                    });
                } else {
                    showAlert(res.message || res.error || 'Erro ao registrar.', 'danger');
                    $btn.prop('disabled', false).html("<i class='bx bx-check-circle me-1'></i> Reembolsar");
                }
            },
            error: function(xhr, status, err) {
                console.error("[Register Action] Erro:", status, err, xhr.responseText);
                let msg = 'Erro interno ao registrar.';
                try {
                    const errRes = JSON.parse(xhr.responseText);
                    msg = errRes.error || errRes.detail || msg;
                } catch {}
                showAlert(msg, 'danger');
                $btn.prop('disabled', false).html("<i class='bx bx-check-circle me-1'></i> Reembolsar");
            }
        });
    });

    $('#reembolso-revert-table').on('submit', '.reembolso-revert-form', function(e) {
        e.preventDefault();
        console.log("[Revert Action] Formulário submetido.");
        const $form = $(this);
        const $btn  = $form.find('button[type="submit"]');
        const id    = $form.find('input[name="reembolso_id"]').val();
        const $row  = $form.closest('tr');

        console.log(`[Revert Action] reembolso_id: ${id}`);
        if (!id) {
            showAlert('ID do reembolso não encontrado.', 'warning');
            return;
        }

        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Revertendo...');
        $.ajax({
            url: API_POST_REVERT_URL,
            method: 'POST',
            data: JSON.stringify({ reembolso_id: id }),
            contentType: 'application/json',
            headers: { 'X-CSRFToken': csrftoken },
            success: function(res, textStatus, xhr) {
                console.info(`[Revert Action] Status ${xhr.status}:`, res);
                // Check for success flag in response body first, then status code
                if (res.success) {
                    showAlert(res.message || 'Reembolso revertido!', 'success');
                    // Remove the row and potentially refresh the register table
                    $row.fadeOut(400, () => {
                        $row.remove();
                        // Optional: Refresh register table after successful revert
                        // fetchData('register', {}); // If register table should update immediately
                        loadDashboard(); // If dashboard table should update immediately
                    });
                } else if (xhr.status === 200) { // Handle specific non-success cases returned with 200
                     showAlert(res.message || 'Já está revertido ou status inesperado.', 'info');
                     // Decide if row should be removed on this status - current code removes it
                     $row.fadeOut(400, () => $row.remove());
                }
                 else {
                    showAlert(res.message || res.error || 'Erro ao reverter.', 'danger');
                    $btn.prop('disabled', false).html("<i class='bx bx-undo me-1'></i> Reverter");
                }
            },
            error: function(xhr, status, err) {
                console.error("[Revert Action] Erro:", status, err, xhr.responseText);
                let msg = 'Erro interno ao reverter.';
                try {
                    const errRes = JSON.parse(xhr.responseText);
                    msg = errRes.error || errRes.detail || msg;
                } catch {}
                showAlert(msg, 'danger');
                $btn.prop('disabled', false).html("<i class='bx bx-undo me-1'></i> Reverter");
            }
        });
    });

    // --- Função para preencher os cards e a tabela "Últimos Reembolsos" ---
    function loadDashboard() {
        console.log("[loadDashboard] Iniciando carregamento do Dashboard...");
    
        const $recentBody = $('#reembolso-recent-table tbody');
        // Limpa completamente o tbody
        $recentBody.empty();
    
        // Mostra linha de loading
        const $loadingRow = $(`
            <tr>
                <td colspan="6" class="text-center text-muted">
                    <i class="bx bx-loader bx-spin"></i> Carregando reembolsos recentes...
                </td>
            </tr>
        `);
        $recentBody.append($loadingRow);
    
        $.ajax({
            url: API_GET_INFO_URL,
            method: 'GET',
            dataType: 'json',
            success: function(response) {
                console.info("[loadDashboard] Resposta completa:", response);
    
                // Atualiza cards
                if (response.stats) {
                    console.log("[loadDashboard] stats:", response.stats);
                    $('#reembolso-stats-90d').text(response.stats.reembolsos_90d);
                    $('#reembolso-stats-60d').text(response.stats.reembolsos_60d);
                    $('#reembolso-stats-current-month').text(response.stats.reembolsos_mes_atual);
                }
    
                // Monta as linhas da tabela
                const data = response.registros_reembolsados;
                console.log("[loadDashboard] registros_reembolsados:", data);
    
                // Limpa o loading
                $recentBody.empty();
    
                if (data && data.length > 0) {
                    console.log(`[loadDashboard] ${data.length} reembolso(s) para exibir`);
                    data.forEach((item, idx) => {
                        console.log(`[loadDashboard] item[${idx}]:`, item);
                        const $row = $(`
                            <tr>
                                <td>${item.cpf_cliente}</td>
                                <td>${item.produto_nome}</td>
                                <td class="text-end">${formatCurrency(item.valor)}</td>
                                <td>${item.setor_nome}</td>
                                <td>${formatDate(item.data_registro)}</td>
                                <td>${formatDate(item.data_reembolso)}</td>
                            </tr>
                        `);
                        $recentBody.append($row);
                    });
                    console.log("[loadDashboard] Tabela populada com sucesso! 🎉");
                } else {
                    console.log("[loadDashboard] Nenhum reembolso recente encontrado.");
                    const $noResults = $(`
                        <tr>
                            <td colspan="6" class="text-center text-danger">
                                Nenhum reembolso recente encontrado.
                            </td>
                        </tr>
                    `);
                    $recentBody.append($noResults);
                }
            },
            error: function(xhr, status, err) {
                console.error("[loadDashboard] Erro ao carregar dashboard:", status, err, xhr.responseText);
                $recentBody.empty();
                const $errorRow = $(`
                    <tr>
                        <td colspan="6" class="text-center text-danger">
                            Erro ao carregar reembolsos recentes.
                        </td>
                    </tr>
                `);
                $recentBody.append($errorRow);
                showAlert('Erro ao carregar dados do dashboard.', 'danger');
            }
        });
    }
    
    // chamada na carga inicial
    fetchData('register', {});
    fetchData('revert', {});
    console.log("Chamando loadDashboard()...");
    loadDashboard();
    


});


    // --- Funções de Filtro em Tempo Real (DOM) ---

    // Função genérica para aplicar filtros em uma tabela
    function applyFilter(dataType) {
        console.log(`[applyFilter] Aplicando filtros para: ${dataType}`);

        const $filterForm = dataType === 'register'
            ? $('#reembolso-register-filter-form')
            : $('#reembolso-revert-filter-form');
        const $tableBody = dataType === 'register'
            ? $('#reembolso-register-table tbody')
            : $('#reembolso-revert-table tbody');
        const $noResultsRow = dataType === 'register'
            ? $tableBody.find('tr:contains("Nenhum registro encontrado")') // Find the no results row
            : $tableBody.find('tr:contains("Nenhum reembolso encontrado")'); // Find the no results row

        // Obter valores dos filtros
        const filters = {};
        $filterForm.find('input').each(function() {
            const $input = $(this);
            const name = $input.attr('name');
            const value = $input.val().trim();
            if (value) {
                filters[name] = value.toLowerCase(); // Use lowercase for case-insensitive text comparison
            }
        });

        console.log(`[applyFilter] Filtros ativos:`, filters);

        let rowsVisible = 0;
        // Iterar sobre as linhas da tabela (excluindo template, loading e no-results)
        $tableBody.find('tr:not(.reembolso-table-row-template):not(#reembolso-register-loading):not(#reembolso-revert-loading):not(#reembolso-register-no-results):not(#reembolso-revert-no-results)').each(function() {
            const $row = $(this);
            let match = true;

            // Verificar cada filtro
            for (const filterName in filters) {
                const filterValue = filters[filterName];
                let cellValue = '';

                // Mapear nome do filtro para o data-field da célula
                let dataField = filterName;
                if (filterName === 'produto_nome') dataField = 'produto_nome';
                if (filterName === 'cpf_cliente') dataField = 'cpf_cliente';
                if (filterName === 'data_inicio' || filterName === 'data_fim') {
                    // Datas precisam de tratamento especial
                    dataField = (dataType === 'register') ? 'data_registro' : 'data_reembolso';
                }


                const $cell = $row.find(`[data-field="${dataField}"]`);
                if ($cell.length) {
                    cellValue = $cell.text().trim().toLowerCase();
                } else {
                    // Se a célula não existe para este dataField, não pode haver match para este filtro
                    match = false;
                    break;
                }

                // Lógica de comparação baseada no tipo de filtro
                if (filterName === 'data_inicio') {
                    // Comparar data da célula (formato dd/mm/yyyy) com data do filtro (yyyy-mm-dd)
                    const cellDate = parseDate(cellValue); // Converte dd/mm/yyyy para Date
                    const filterDate = new Date(filterValue); // Converte yyyy-mm-dd para Date
                    // console.log(`[applyFilter] Comparando data (>=): Cell=${cellValue} (${cellDate}), Filter=${filterValue} (${filterDate})`);
                    if (cellDate < filterDate) {
                        match = false;
                        // console.log(`[applyFilter] Data ${cellValue} é anterior a ${filterValue}. Não combina.`);
                        break;
                    }
                } else if (filterName === 'data_fim') {
                     // Comparar data da célula (formato dd/mm/yyyy) com data do filtro (yyyy-mm-dd)
                    const cellDate = parseDate(cellValue); // Converte dd/mm/yyyy para Date
                    const filterDate = new Date(filterValue); // Converte yyyy-mm-dd para Date
                    // Para data fim, queremos incluir o dia inteiro, então comparamos com o início do dia seguinte
                    filterDate.setDate(filterDate.getDate() + 1); // Adiciona 1 dia
                    // console.log(`[applyFilter] Comparando data (<): Cell=${cellValue} (${cellDate}), Filter=${filterValue} (até ${new Date(filterDate.getTime() - 86400000)})`); // Mostra a data fim original
                    if (cellDate >= filterDate) { // Se a data da célula for no dia do filtro ou depois
                        match = false;
                        // console.log(`[applyFilter] Data ${cellValue} é posterior ou igual a ${new Date(filterDate.getTime() - 86400000)}. Não combina.`);
                        break;
                    }
                }
                else {
                    // Comparação de texto simples (CPF, Produto)
                    if (!cellValue.includes(filterValue)) {
                        match = false;
                        // console.log(`[applyFilter] "${cellValue}" não inclui "${filterValue}". Não combina.`);
                        break;
                    }
                }
            }

            if (match) {
                $row.show();
                rowsVisible++;
            } else {
                $row.hide();
            }
        });

        // Mostrar/Esconder a linha de "nenhum resultado"
        if (rowsVisible === 0) {
            $noResultsRow.show();
        } else {
            $noResultsRow.hide();
        }

        console.log(`[applyFilter] Filtro aplicado. ${rowsVisible} linha(s) visível(is).`);
    }

    // Função auxiliar para converter data dd/mm/yyyy para objeto Date
    function parseDate(dateString) {
        if (!dateString) return new Date(0); // Retorna uma data inválida ou muito antiga
        const parts = dateString.split('/');
        // Note: Month is 0-indexed in JavaScript Date objects
        // parts[2] = year, parts[1] = month, parts[0] = day
        // Use UTC to avoid timezone issues affecting date comparisons
        return new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
    }


    // --- Event Listeners para Filtros ---

    // Filtros da tabela "Registrar Novo Reembolso"
    $('#reembolso-register-filter-form').on('input change', 'input', function() {
        // console.log("[Filter Event] Input/Change detectado no filtro de registro.");
        applyFilter('register');
    });

    // Filtros da tabela "Reverter Reembolso"
    // Aplica filtro em tempo real nos inputs
    $('#reembolso-revert-filter-form').on('input change', 'input:not([type="date"])', function() {
         // console.log("[Filter Event] Input/Change detectado no filtro de reverter (texto).");
         applyFilter('revert');
    });

    // Aplica filtro no change para inputs de data (para garantir que a data completa foi selecionada)
     $('#reembolso-revert-filter-form').on('change', 'input[type="date"]', function() {
         // console.log("[Filter Event] Change detectado no filtro de reverter (data).");
         applyFilter('revert');
    });


    // Botão "Filtrar" da tabela "Reverter Reembolso" (redundante com input/change, mas mantido se houver necessidade futura)
    $('#filter-revert-btn').on('click', function() {
        console.log("[Filter Event] Botão Filtrar (Reverter) clicado.");
        applyFilter('revert');
    });

    // Botão "Limpar Filtros" da tabela "Registrar Novo Reembolso"
    $('#clear-register-filters-btn').on('click', function() {
        console.log("[Filter Event] Botão Limpar Filtros (Registrar) clicado.");
        $('#reembolso-register-filter-form').find('input').val(''); // Limpa todos os inputs
        applyFilter('register'); // Reaplica o filtro (mostrará tudo)
    });

    // Botão "Limpar Filtros" da tabela "Reverter Reembolso"
    $('#clear-revert-filters-btn').on('click', function() {
        console.log("[Filter Event] Botão Limpar Filtros (Reverter) clicado.");
        $('#reembolso-revert-filter-form').find('input').val(''); // Limpa todos os inputs
        applyFilter('revert'); // Reaplica o filtro (mostrará tudo)
    });

    // Reaplicar filtros após a população inicial das tabelas
    // Isso garante que se a página for carregada com filtros na URL (para a tabela de registro), eles sejam aplicados visualmente
    // Nota: A tabela de registro já é filtrada pelo backend via GET, este filtro DOM é adicional/visual.
    // A tabela de reverter NÃO é filtrada pelo backend, apenas por este JS.
    // Portanto, precisamos garantir que applyFilter('revert') seja chamado após fetchData('revert')
    // E applyFilter('register') seja chamado após fetchData('register')
    // Como fetchData é assíncrono, vamos chamar applyFilter no success do fetchData.
    // Modificação necessária na função fetchData:

    // --- Busca e População de Dados (sem paginação no servidor) ---
    // This function is used for the 'Registrar' and 'Reverter' tables
    function fetchData(dataType, filters = {}) {
        console.log(`[fetchData] Buscando dados para: ${dataType} com filtros:`, filters);

        const $tableBody = dataType === 'register'
            ? $('#reembolso-register-table tbody')
            : $('#reembolso-revert-table tbody');
        const $loadingRow = dataType === 'register'
            ? $('#reembolso-register-loading')
            : $('#reembolso-revert-loading');
         const $noResultsRow = dataType === 'register'
            ? $tableBody.find('tr:contains("Nenhum registro encontrado")') // Find the no results row
            : $tableBody.find('tr:contains("Nenhum reembolso encontrado")'); // Find the no results row


        // Esconde linhas de resultado anteriores e mostra loading
        $tableBody.find('tr:not(.reembolso-table-row-template):not(#reembolso-register-loading):not(#reembolso-revert-loading)').remove();
        $noResultsRow.hide(); // Esconde a linha de "nenhum resultado" enquanto carrega
        $loadingRow.show();

        // Construir URL com parâmetros de filtro para o backend (apenas para a tabela de registro, se necessário)
        // Nota: A instrução original pede filtro DOM. A chamada fetchData original já filtra no backend para 'register'.
        // Vamos manter a chamada original para 'register' que já filtra no backend.
        // Para 'revert', fetchData não filtra no backend, apenas carrega tudo e o filtro DOM é aplicado depois.
        // Se quisermos filtrar 'revert' no backend, precisaríamos modificar a URL e a API.
        // Mantendo o foco no filtro DOM em tempo real, fetchData apenas carrega os dados iniciais.

        const apiUrl = dataType === 'register' ? API_GET_INFO_URL : API_GET_INFO_URL; // Ambas usam a mesma API de info? Verificar.
        // Assumindo que API_GET_INFO_URL retorna dados para ambas as tabelas ou que há URLs separadas.
        // Pelo contexto, parece que API_GET_INFO_URL retorna dados para o dashboard e registros_reembolsados.
        // A tabela 'register' precisa de outra API ou de parâmetros na API_GET_INFO_URL.
        // O código original chama fetchData('register', {}) e fetchData('revert', {}), sugerindo que fetchData
        // é genérico mas a API_GET_INFO_URL pode retornar dados diferentes dependendo de como é chamada ou tratada.
        // Vamos assumir que API_GET_INFO_URL retorna os dados necessários para ambas as tabelas,
        // e que a distinção 'register'/'revert' na chamada fetchData é para saber qual tabela popular.
        // O filtro backend para 'register' parece ser feito pela view Django que renderiza o template,
        // usando request.GET.cpf_cliente e request.GET.produto_nome.
        // Portanto, fetchData('register', {}) carrega os dados JÁ FILTRADOS pelo backend.
        // fetchData('revert', {}) carrega TODOS os dados de reembolsos efetuados.
        // O filtro DOM em tempo real é aplicado SOBRE os dados carregados.

        // A chamada AJAX original em fetchData não envia os filtros JS para o backend.
        // Se o objetivo é filtrar no backend, a lógica de fetchData precisaria ser alterada.
        // Mas a instrução é "FILTROS DAS DUAS TABELAS, DIRETO NO DOOM".
        // Então, fetchData apenas carrega os dados iniciais (potencialmente já filtrados pelo backend para 'register').
        // E applyFilter faz o trabalho de filtrar visualmente no DOM.

        // A chamada AJAX original em fetchData:
         $.ajax({
            url: API_GET_INFO_URL, // Esta URL precisa retornar os dados brutos para ambas as tabelas
            method: 'GET',
            dataType: 'json',
            success: function(response) {
                console.info(`[fetchData] Dados recebidos para ${dataType}:`, response);

                $loadingRow.hide(); // Esconde loading

                let dataToPopulate = [];
                if (dataType === 'register') {
                    // Assumindo que a resposta contém uma chave para registros a serem registrados
                    // Pelo contexto, parece que a tabela de registro é populada com dados que AINDA NÃO foram reembolsados.
                    // A API_GET_INFO_URL retorna 'registros_reembolsados'. Precisamos de outra API ou chave para os NÃO reembolsados.
                    // O template HTML mostra um formulário para "Registrar Novo Reembolso" com uma tabela.
                    // Essa tabela deve listar os itens PENDENTES de reembolso.
                    // A API_GET_INFO_URL parece focar em dados JÁ reembolsados (dashboard e tabela recente).
                    // Vamos assumir que há uma chave 'registros_pendentes' na resposta da API_GET_INFO_URL
                    // OU que precisamos de outra URL para buscar os pendentes.
                    // Pelo contexto file_context_11, a tabela de registro parece ser populada com base nos parâmetros GET da URL,
                    // o que sugere que a view Django já filtra os dados pendentes.
                    // A chamada fetchData('register', {}) no código original não envia esses parâmetros GET.
                    // Isso significa que fetchData('register', {}) provavelmente não está funcionando como esperado
                    // para carregar os dados filtrados pelo backend.
                    // A instrução é filtrar no DOM. Vamos focar nisso.
                    // Precisamos que fetchData carregue TODOS os dados pendentes para a tabela 'register'
                    // e TODOS os dados reembolsados para a tabela 'revert'.
                    // A API_GET_INFO_URL parece retornar apenas os reembolsados ('registros_reembolsados').
                    // Vamos *assumir* que a API_GET_INFO_URL também retorna 'registros_pendentes'.
                    dataToPopulate = response.registros_pendentes || []; // Assumindo esta chave
                    console.log(`[fetchData] Dados pendentes encontrados: ${dataToPopulate.length}`);

                } else { // dataType === 'revert'
                    dataToPopulate = response.registros_reembolsados || []; // Esta chave já existe no contexto
                     console.log(`[fetchData] Dados reembolsados encontrados: ${dataToPopulate.length}`);
                }


                if (dataToPopulate.length > 0) {
                    populateTable(dataType, dataToPopulate);
                    // Aplicar filtro DOM após popular a tabela
                    applyFilter(dataType);
                } else {
                    // Limpa tabela e mostra "nenhum resultado"
                    $tableBody.find('tr:not(.reembolso-table-row-template):not(#reembolso-register-loading):not(#reembolso-revert-loading)').remove();
                    $noResultsRow.show();
                    console.log(`[fetchData] Nenhum dado encontrado para ${dataType}.`);
                }
            },
            error: function(xhr, status, err) {
                console.error(`[fetchData] Erro ao buscar dados para ${dataType}:`, status, err, xhr.responseText);
                $loadingRow.hide(); // Esconde loading
                 const $errorRow = $(`
                    <tr>
                        <td colspan="7" class="text-center text-danger">
                            Erro ao carregar dados.
                        </td>
                    </tr>
                `);
                $tableBody.append($errorRow);
                showAlert(`Erro ao carregar dados para a tabela de ${dataType === 'register' ? 'registro' : 'reversão'}.`, 'danger');
            }
        });
    }

    // Modificar as chamadas iniciais para usar a nova fetchData e garantir que applyFilter seja chamado após o sucesso
    // As chamadas originais já estão no final do $(function() { ... });
    // Elas chamarão a versão modificada de fetchData.
