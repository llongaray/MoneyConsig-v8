$(document).ready(function() {
    console.log("Dashboard Funcionários JS Carregado");

    const apiUrl = '/rh/api/get/dashboard/';

    // --- Funções Auxiliares --- //

    function formatCurrency(value) { // Mantida por segurança, pode não ser usada aqui
        if (value === null || value === undefined || value === 'N/A') {
            return 'N/A';
        }
        const number = parseFloat(value);
        if (isNaN(number)) {
            return 'N/A';
        }
        return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatInteger(value) {
        const number = parseInt(value, 10);
        return isNaN(number) ? '0' : number.toString();
    }

    function updateTimestamp(isoTimestamp) {
        let displayTime = "Falha na atualização";
        if (isoTimestamp) {
            try {
                const date = new Date(isoTimestamp);
                const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const dateString = date.toLocaleDateString('pt-BR');
                displayTime = `${dateString} ${timeString}`;
            } catch (e) {
                console.error("Erro ao formatar timestamp:", e);
                displayTime = "Data inválida";
            }
        }
        $('#last-update-time').text(displayTime);
    }

    // Função genérica para atualizar o valor de um card
    function updateCardValue(cardId, value, formatter = formatInteger) {
        const element = $(`#${cardId} .value`);
        if (element.length) {
            element.text(formatter(value));
        } else {
            console.warn(`Elemento .value não encontrado para o card: ${cardId}`);
        }
    }

    // Função para preencher uma tabela de distribuição (Nome | Qtd)
    function populateDistributionTable(tableBodyId, dataList, nameKey, valueKey) {
        const $tbody = $(`#${tableBodyId}`);
        $tbody.empty(); // Limpa linhas existentes
        if (dataList && dataList.length > 0) {
            // Limitar a exibição se necessário (ex: top 10)
             const displayList = dataList; // .slice(0, 10); // Descomente para limitar

            displayList.forEach(item => {
                const name = item[nameKey] || 'N/A';
                const value = item[valueKey] !== undefined ? formatInteger(item[valueKey]) : '0';
                const row = `<tr><td>${name}</td><td>${value}</td></tr>`;
                $tbody.append(row);
            });
        } else {
            $tbody.append('<tr><td colspan="2" class="text-center">Nenhum dado disponível.</td></tr>');
        }
    }

    // Função para preencher a tabela de aniversariantes
    function populateAniversariantesTable(aniversariantes) {
        const $tbody = $('#tbody-aniversarios');
        $tbody.empty();
        if (aniversariantes && aniversariantes.length > 0) {
            const hoje = new Date().getDate(); // Apenas o dia do mês
            aniversariantes.forEach(aniv => {
                let statusClass = '';
                if (aniv.status === "Dia de comemorar") {
                    statusClass = 'status-ok';
                } else if (aniv.status === "Quase lá") {
                    statusClass = 'status-proximo';
                } else {
                    statusClass = 'status-passou';
                }
                const row = `<tr>
                               <td>${aniv.nome || 'N/A'}</td>
                               <td>${aniv.departamento || 'N/A'}</td>
                               <td>${aniv.setor || 'N/A'}</td>
                               <td>${aniv.data || 'N/A'}</td>
                               <td class="${statusClass}">${aniv.status || 'N/A'}</td>
                           </tr>`;
                $tbody.append(row);
            });
        } else {
            $tbody.append('<tr><td colspan="5" class="text-center">Nenhum aniversariante este mês.</td></tr>');
        }
    }

    // --- Atualização Principal do Dashboard --- //

    function updateDashboardData(data) {
        console.log("Dados recebidos da API:", data);

        // 1. Seção Administração RH
        if (data.admin_rh) {
            const admin = data.admin_rh;
            updateCardValue('card-admin-empresas', admin.empresas);
            updateCardValue('card-admin-lojas-sede', admin.lojas_sede);
            updateCardValue('card-admin-lojas-filial', admin.lojas_filial);
            updateCardValue('card-admin-lojas-franquia', admin.lojas_franquia);
            updateCardValue('card-admin-departamentos', admin.departamentos);
            updateCardValue('card-admin-setores', admin.setores);
            updateCardValue('card-admin-cargos', admin.cargos);
            updateCardValue('card-admin-equipes', admin.equipes);
        } else {
             console.warn("Dados de admin_rh não encontrados na resposta da API.");
             // Resetar cards de admin se necessário
        }

        // 2. Seção Funcionários
        if (data.funcionarios) {
            const func = data.funcionarios;
            // Visão Geral
            if(func.geral){
                updateCardValue('card-rh-func-ativos', func.geral.ativos);
                updateCardValue('card-rh-func-inativos', func.geral.inativos);
            } else {
                 updateCardValue('card-rh-func-ativos', 0);
                 updateCardValue('card-rh-func-inativos', 0);
            }

            // Tabelas de Distribuição
            populateDistributionTable('tbody-func-por-empresa', func.por_empresa, 'empresa__nome', 'total');
            populateDistributionTable('tbody-func-por-loja', func.por_loja, 'loja__nome', 'total');
            populateDistributionTable('tbody-func-por-departamento', func.por_departamento, 'departamento__nome', 'total');
            populateDistributionTable('tbody-func-por-setor', func.por_setor, 'setor__nome', 'total');
            populateDistributionTable('tbody-func-por-cargo', func.por_cargo, 'cargo__nome', 'total');
            populateDistributionTable('tbody-func-por-equipe', func.por_equipe, 'equipe__nome', 'total');
        } else {
            console.warn("Dados de funcionarios não encontrados na resposta da API.");
            // Limpar/resetar tabelas de funcionarios
            $('[id^=tbody-func-por-]').empty().append('<tr><td colspan="2" class="text-center">Erro ao carregar dados.</td></tr>');
        }

        // 3. Seção Aniversariantes
        if (Array.isArray(data.aniversariantes) && data.aniversariantes.length > 0) {
            populateAniversariantesTable(data.aniversariantes);
        } else {
            // Mesmo que venha um array vazio, mostramos a mensagem de "nenhum aniversariante"
            $('#tbody-aniversarios')
              .empty()
              .append('<tr><td colspan="5" class="text-center">Nenhum aniversariante este mês.</td></tr>');
        }

        // 4. Timestamp
        updateTimestamp(data.timestamp);

        console.log("Dashboard atualizado com novos dados.");
    }

    // --- Busca Inicial de Dados --- //

    function fetchData() {
        console.log("Buscando dados da API...");
        $('#dashboard-container .value').text('...'); // Placeholder simples
        $('#dashboard-container tbody').html('<tr><td colspan="5" class="text-center">Carregando...</td></tr>'); // Placeholder tabelas

        $.ajax({
            url: apiUrl,
            method: 'GET', // Default é GET, mas explícito é bom
            dataType: 'json',
            success: function(data) {
                updateDashboardData(data);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error("Erro ao buscar dados do dashboard:", textStatus, errorThrown, jqXHR.responseText);
                // Exibir mensagem de erro mais clara
                $('#dashboard-container').children('.alert').remove(); // Remove alertas antigos
                $('#dashboard-container').prepend('<div class="alert alert-danger alert-dismissible fade show" role="alert">Erro ao carregar dados do dashboard. Verifique a conexão ou contate o suporte.<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>');
                // Resetar valores para indicar erro
                $('#dashboard-container .value').text('Erro');
                $('#dashboard-container tbody').html('<tr><td colspan="5" class="text-center">Falha ao carregar dados.</td></tr>');
                updateTimestamp(null);
            },
            complete: function() {
                // Remover indicadores de loading mais sofisticados, se houver
            }
        });
    }

    // --- Event Handlers (Filtros, etc. - Adicionar se necessário no futuro) --- //
    // Exemplo:
    // $('#algum-filtro').on('change', function() { fetchDataComFiltros(...) });

    // --- Inicialização --- //
    fetchData(); // Busca os dados iniciais ao carregar a página

    // Atualizar dados periodicamente (opcional)
    // setInterval(fetchData, 300000); // Atualiza a cada 5 minutos (300000 ms)
});
