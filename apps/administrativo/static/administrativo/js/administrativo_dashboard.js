$(document).ready(function() {
    console.log("Inicializando dashboard administrativo...");
    let dashboardData = {
        financeiro: {},
        lojas: {},
        rh: {},
        metas: {},
        siape: {}
    };

    // --- Helpers de formatação ---
    function formatCurrency(value) {
        console.log("Formatando valor monetário:", value);
        if (value == null) return 'R$ 0,00';
        return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatPercentage(value) {
        console.log("Formatando porcentagem:", value);
        if (value == null) return '0,0%';
        return Number(value).toFixed(1) + '%';
    }

    function formatInteger(value) {
        console.log("Formatando número inteiro:", value);
        if (value == null) return '0';
        return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }

    function updateCardValue(cardId, value, formatter = formatCurrency) {
        console.log(`Atualizando card ${cardId} com valor:`, value);
        const el = $(`#${cardId} .value`);
        if (!el.length) return console.warn(`Card não encontrado: ${cardId}`);
        el.text(formatter(value));
    }

    function populateSelect(selectId, options, defaultText = 'Selecione...') {
        console.log(`Populando select ${selectId} com ${options.length} opções`);
        const sel = $(`#${selectId}`);
        if (!sel.length) return console.warn(`Select não encontrado: ${selectId}`);
        sel.empty().append(`<option value="">${defaultText}</option>`);
        options.forEach((opt, i) => {
            const val = opt.id !== undefined ? opt.id : i;
            sel.append(`<option value="${val}">${opt.nome}</option>`);
        });
    }

    // --- Carrega e popula tudo ---
    function fetchDataAndPopulate() {
        console.log("Iniciando carregamento de dados do dashboard...");
        
        // Carrega dados financeiros
        $.getJSON('/api/dashboard/financeiro/')
            .done(data => {
                console.log("Dados financeiros recebidos:", data);
                dashboardData.financeiro = data;
                populateFinanceiro(data);
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                console.error("Erro ao carregar dados financeiros:", errorThrown);
            });

        // Carrega dados das lojas
        $.getJSON('/api/dashboard/lojas/')
            .done(data => {
                console.log("Dados das lojas recebidos:", data);
                dashboardData.lojas = data;
                populateLojas(data);
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                console.error("Erro ao carregar dados das lojas:", errorThrown);
            });

        // Carrega dados de RH
        $.getJSON('/api/dashboard/rh/')
            .done(data => {
                console.log("Dados de RH recebidos:", data);
                dashboardData.rh = data;
                populateRH(data);
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                console.error("Erro ao carregar dados de RH:", errorThrown);
            });

        // Carrega dados de metas
        $.getJSON('/api/dashboard/metas/')
            .done(data => {
                console.log("Dados de metas recebidos:", data);
                dashboardData.metas = data;
                populateMetas(data);
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                console.error("Erro ao carregar dados de metas:", errorThrown);
            });

        // Carrega dados do SIAPE
        $.getJSON('/api/dashboard/siape/')
            .done(data => {
                console.log("Dados do SIAPE recebidos:", data);
                dashboardData.siape = data;
                populateSiape(data);
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                console.error("Erro ao carregar dados do SIAPE:", errorThrown);
            });
    }

    function populateFinanceiro(data) {
        console.log("Populando dados financeiros:", data);
        
        // Empresas
        const empresasOptions = Object.entries(data.empresas).map(([nome, vals], i) => ({
            id: i,
            nome,
            faturamento_anual: vals.faturamento_ano,
            faturamento_mensal: vals.faturamento_mes
        }));
        console.log("Opções de empresas:", empresasOptions);
        populateSelect('select-empresa-financeiro', empresasOptions, 'Todas as empresas');
        updateFinanceiroEmpresaCards();

        // Financeiro interno (sedes)
        console.log("Dados financeiros internos:", data.interno);
        if (data.interno) {
            const internoOptions = Object.entries(data.interno).map(([nome, vals]) => ({
                id: nome,
                nome: nome,
                faturamento_ano: vals.faturamento_ano,
                faturamento_mes: vals.faturamento_mes
            }));
            populateSelect('select-interno-financeiro', internoOptions, 'Todas as sedes');
            updateFinanceiroInternoCards();
        }

        // Financeiro franquia
        console.log("Dados financeiros franquia:", data.franquia);
        if (data.franquia) {
            const franquiaOptions = Object.entries(data.franquia).map(([nome, vals]) => ({
                id: nome,
                nome: nome,
                faturamento_ano: vals.faturamento_ano,
                faturamento_mes: vals.faturamento_mes
            }));
            populateSelect('select-franquia-financeiro', franquiaOptions, 'Todas as franquias');
            updateFinanceiroFranquiaCards();
        }

        // Financeiro filial
        console.log("Dados financeiros filial:", data.filial);
        if (data.filial) {
            const filialOptions = Object.entries(data.filial).map(([nome, vals]) => ({
                id: nome,
                nome: nome,
                faturamento_ano: vals.faturamento_ano,
                faturamento_mes: vals.faturamento_mes
            }));
            populateSelect('select-filial-financeiro', filialOptions, 'Todas as filiais');
            updateFinanceiroFilialCards();
        }

        updateMetaCards();
    }

    function populateLojas(data) {
        // Lista de filiais e franquias
        console.log("Lista de filiais:", data.filiais_list);
        console.log("Lista de franquias:", data.franquias_list);
        populateSelect('select-filial-lojas', data.filiais_list, 'Todas as filiais');
        populateSelect('select-franquia-lojas', data.franquias_list, 'Todas as franquias');

        // Métricas da sede
        updateCardValue('card-sede-fat-ano', data.sede.faturamento_ano);
        updateCardValue('card-sede-fat-mes', data.sede.faturamento_mes);
        updateCardValue('card-sede-taxa-comp', data.sede.taxa_comparecimento, formatPercentage);
        updateCardValue('card-sede-cli-rua', data.sede.clientes_rua, formatInteger);
        updateCardValue('card-sede-neg-fechados', data.sede.negocios_fechados, formatInteger);
        updateCardValue('card-sede-agendamentos', data.sede.agendamentos, formatInteger);
        updateCardValue('card-sede-sem-interesse', data.sede.sem_interesse, formatInteger);

        // Atualiza cards de filiais e franquias
        updateLojasFilialCards();
        updateLojasFranquiaCards();
    }

    function populateRH(data) {
        // Lista de funcionários
        console.log("Lista de funcionários:", data.funcionarios_list);
        populateSelect('select-funcionario-rh', data.funcionarios_list, 'Todos os funcionários');

        // Métricas gerais
        updateCardValue('card-rh-func-ativos', data.geral.ativos, formatInteger);
        updateCardValue('card-rh-func-inativos', data.geral.inativos, formatInteger);

        // Atualiza cards de desempenho
        updateRhFuncionarioCards();
    }

    function populateMetas(data) {
        // Lista de metas
        console.log("Metas ativas:", data.ativas_list);
        console.log("Metas inativadas:", data.inativadas_list);
        populateSelect('select-meta-ativa', data.ativas_list, 'Todas as metas ativas');
        populateSelect('select-meta-inativada', data.inativadas_list, 'Todas as metas inativas');

        // Atualiza cards de metas
        updateMetaCards();
    }

    function populateSiape(data) {
        console.log("Populando dados SIAPE:", data);
        if (!data) return;

        updateCardValue('card-siape-fat-ano', data.faturamento_anual);
        updateCardValue('card-siape-fat-mes', data.faturamento_mensal);

        // Melhor Funcionário Ano
        const funcAnoNomeEl = $('#valor-siape-melhor-func-ano-nome');
        const funcAnoValorEl = $('#valor-siape-melhor-func-ano-valor');
        const funcAnoFotoEl = $('#icon-container-siape-melhor-func-ano .funcionario-foto-dashboard');
        const funcAnoIconFallbackEl = $('#icon-container-siape-melhor-func-ano .funcionario-icon-dashboard-fallback');

        if (funcAnoNomeEl.length && funcAnoValorEl.length && funcAnoFotoEl.length && funcAnoIconFallbackEl.length) {
            if (data.melhor_funcionario_ano && data.melhor_funcionario_ano.nome !== 'N/A') {
                funcAnoNomeEl.text(data.melhor_funcionario_ano.nome);
                funcAnoValorEl.text(formatCurrency(data.melhor_funcionario_ano.valor));
                if (data.melhor_funcionario_ano.foto_url) {
                    funcAnoFotoEl.attr('src', data.melhor_funcionario_ano.foto_url).show();
                    funcAnoIconFallbackEl.hide();
                } else {
                    funcAnoFotoEl.hide();
                    funcAnoIconFallbackEl.show();
                }
            } else {
                funcAnoNomeEl.text('-');
                funcAnoValorEl.text(formatCurrency(0));
            }
        } else {
            console.warn("Elementos do card de melhor funcionário (ano) do SIAPE não encontrados.");
        }

        // Melhor Funcionário Mês
        const funcMesNomeEl = $('#valor-siape-melhor-func-mes-nome');
        const funcMesValorEl = $('#valor-siape-melhor-func-mes-valor');
        const funcMesFotoEl = $('#icon-container-siape-melhor-func-mes .funcionario-foto-dashboard');
        const funcMesIconFallbackEl = $('#icon-container-siape-melhor-func-mes .funcionario-icon-dashboard-fallback');

        if (funcMesNomeEl.length && funcMesValorEl.length && funcMesFotoEl.length && funcMesIconFallbackEl.length) {
            if (data.melhor_funcionario_mes && data.melhor_funcionario_mes.nome !== 'N/A') {
                funcMesNomeEl.text(data.melhor_funcionario_mes.nome);
                funcMesValorEl.text(formatCurrency(data.melhor_funcionario_mes.valor));
                if (data.melhor_funcionario_mes.foto_url) {
                    funcMesFotoEl.attr('src', data.melhor_funcionario_mes.foto_url).show();
                    funcMesIconFallbackEl.hide();
                } else {
                    funcMesFotoEl.hide();
                    funcMesIconFallbackEl.show();
                }
            } else {
                funcMesNomeEl.text('-');
                funcMesValorEl.text(formatCurrency(0));
            }
        } else {
            console.warn("Elementos do card de melhor funcionário (mês) do SIAPE não encontrados.");
        }
    }

    function updateFinanceiroEmpresaCards() {
        const sel = $('#select-empresa-financeiro').val();
        console.log("Empresa selecionada:", sel);
        let ano = 0, mes = 0;
        const arr = Object.values(dashboardData.financeiro.empresas);
        if (sel) {
            const item = arr[sel];
            console.log("Dados da empresa selecionada:", item);
            ano = item.faturamento_ano;
            mes = item.faturamento_mes;
        } else {
            console.log("Calculando totais de todas as empresas");
            arr.forEach(i => {
                ano += i.faturamento_ano;
                mes += i.faturamento_mes;
            });
        }
        console.log("Valores calculados - Ano:", ano, "Mês:", mes);
        updateCardValue('card-empresa-fat-ano', ano);
        updateCardValue('card-empresa-fat-mes', mes);
    }

    function updateFinanceiroInternoCards() {
        const sel = $('#select-interno-financeiro').val();
        console.log("Sede selecionada:", sel);
        let ano = 0, mes = 0;
        const arr = Object.values(dashboardData.financeiro.interno);
        
        if (sel) {
            const item = dashboardData.financeiro.interno[sel];
            console.log("Dados da sede selecionada:", item);
            ano = item.faturamento_ano;
            mes = item.faturamento_mes;
        } else {
            console.log("Calculando totais de todas as sedes");
            arr.forEach(i => {
                ano += Number(i.faturamento_ano);
                mes += Number(i.faturamento_mes);
            });
        }
        console.log("Valores calculados - Ano:", ano, "Mês:", mes);
        updateCardValue('card-interno-fat-ano', ano);
        updateCardValue('card-interno-fat-mes', mes);
    }

    function updateFinanceiroFranquiaCards() {
        const sel = $('#select-franquia-financeiro').val();
        console.log("Franquia selecionada:", sel);
        let ano = 0, mes = 0;
        const arr = Object.values(dashboardData.financeiro.franquia);
        
        if (sel) {
            const item = dashboardData.financeiro.franquia[sel];
            console.log("Dados da franquia selecionada:", item);
            ano = item.faturamento_ano;
            mes = item.faturamento_mes;
        } else {
            console.log("Calculando totais de todas as franquias");
            arr.forEach(i => {
                ano += Number(i.faturamento_ano);
                mes += Number(i.faturamento_mes);
            });
        }
        console.log("Valores calculados - Ano:", ano, "Mês:", mes);
        updateCardValue('card-franquia-fat-ano', ano);
        updateCardValue('card-franquia-fat-mes', mes);
    }

    function updateFinanceiroFilialCards() {
        const sel = $('#select-filial-financeiro').val();
        console.log("Filial selecionada:", sel);
        let ano = 0, mes = 0;
        const arr = Object.values(dashboardData.financeiro.filial);
        
        if (sel) {
            const item = dashboardData.financeiro.filial[sel];
            console.log("Dados da filial selecionada:", item);
            ano = item.faturamento_ano;
            mes = item.faturamento_mes;
        } else {
            console.log("Calculando totais de todas as filiais");
            arr.forEach(i => {
                ano += Number(i.faturamento_ano);
                mes += Number(i.faturamento_mes);
            });
        }
        console.log("Valores calculados - Ano:", ano, "Mês:", mes);
        updateCardValue('card-filial-fat-ano', ano);
        updateCardValue('card-filial-fat-mes', mes);
    }

    function updateLojasFilialCards() {
        const id = $('#select-filial-lojas').val();
        console.log("Filial selecionada:", id);
        let metrics = {
            faturamento_ano: 0,
            faturamento_mes: 0,
            taxa_comparecimento: 0,
            clientes_rua: 0,
            negocios_fechados: 0,
            agendamentos: 0,
            sem_interesse: 0
        };

        if (id) {
            const loja = dashboardData.lojas.filiais_list.find(l => String(l.id) === id);
            console.log("Dados da filial encontrada:", loja);
            if (loja) metrics = loja.metrics;
        }

        console.log("Métricas da filial:", metrics);
        updateCardValue('card-filial-loja-fat-ano', metrics.faturamento_ano);
        updateCardValue('card-filial-loja-fat-mes', metrics.faturamento_mes);
        updateCardValue('card-filial-loja-taxa-comp', metrics.taxa_comparecimento, formatPercentage);
        updateCardValue('card-filial-loja-cli-rua', metrics.clientes_rua, formatInteger);
        updateCardValue('card-filial-loja-neg-fechados', metrics.negocios_fechados, formatInteger);
        updateCardValue('card-filial-loja-agendamentos', metrics.agendamentos, formatInteger);
        updateCardValue('card-filial-loja-sem-interesse', metrics.sem_interesse, formatInteger);
    }

    function updateLojasFranquiaCards() {
        const id = $('#select-franquia-lojas').val();
        console.log("Franquia selecionada:", id);
        let metrics = {
            faturamento_ano: 0,
            faturamento_mes: 0,
            taxa_comparecimento: 0,
            clientes_rua: 0,
            negocios_fechados: 0,
            agendamentos: 0,
            sem_interesse: 0
        };

        if (id) {
            const loja = dashboardData.lojas.franquias_list.find(l => String(l.id) === id);
            console.log("Dados da franquia encontrada:", loja);
            if (loja) metrics = loja.metrics;
        }

        console.log("Métricas da franquia:", metrics);
        updateCardValue('card-franquia-loja-fat-ano', metrics.faturamento_ano);
        updateCardValue('card-franquia-loja-fat-mes', metrics.faturamento_mes);
        updateCardValue('card-franquia-loja-taxa-comp', metrics.taxa_comparecimento, formatPercentage);
        updateCardValue('card-franquia-loja-cli-rua', metrics.clientes_rua, formatInteger);
        updateCardValue('card-franquia-loja-neg-fechados', metrics.negocios_fechados, formatInteger);
        updateCardValue('card-franquia-loja-agendamentos', metrics.agendamentos, formatInteger);
        updateCardValue('card-franquia-loja-sem-interesse', metrics.sem_interesse, formatInteger);
    }

    function updateRhFuncionarioCards() {
        const id = $('#select-funcionario-rh').val();
        console.log("Funcionário selecionado:", id);
        let desempenho = {
            faturamento_ano: 0,
            faturamento_mes: 0,
            clientes_concluidos: 0,
            comissao_total_mes: 0
        };

        if (id) {
            desempenho = dashboardData.rh.desempenho[id] || desempenho;
        }

        console.log("Desempenho do funcionário:", desempenho);
        updateCardValue('card-rh-func-fat-ano', desempenho.faturamento_ano);
        updateCardValue('card-rh-func-fat-mes', desempenho.faturamento_mes);
        updateCardValue('card-rh-func-clientes', desempenho.clientes_concluidos, formatInteger);
        updateCardValue('card-rh-func-comissao', desempenho.comissao_total_mes);
    }

    function updateMetaCards() {
        const idAtiva = $('#select-meta-ativa').val();
        const idInativa = $('#select-meta-inativada').val();
        console.log("Meta ativa selecionada:", idAtiva);
        console.log("Meta inativa selecionada:", idInativa);

        let metaAtiva = {
            valor_meta: 0,
            valor_atingido: 0,
            valor_restante: 0,
            percentual: 0,
            status: ''
        };

        let metaInativa = {
            valor_meta: 0,
            valor_atingido: 0,
            valor_restante: 0,
            status: ''
        };

        if (idAtiva) {
            metaAtiva = dashboardData.metas.ativas_list.find(m => String(m.id) === idAtiva) || metaAtiva;
        }

        if (idInativa) {
            metaInativa = dashboardData.metas.inativadas_list.find(m => String(m.id) === idInativa) || metaInativa;
        }

        console.log("Dados da meta ativa:", metaAtiva);
        console.log("Dados da meta inativa:", metaInativa);

        // Atualiza cards de meta ativa
        updateCardValue('card-meta-ativa-valor', metaAtiva.valor_meta);
        updateCardValue('card-meta-ativa-atingido', metaAtiva.valor_atingido);
        updateCardValue('card-meta-ativa-restante', metaAtiva.valor_restante);
        updateCardValue('card-meta-ativa-status', metaAtiva.percentual, formatPercentage);
        $('#card-meta-ativa-status .value').text(metaAtiva.status);

        // Atualiza cards de meta inativa
        updateCardValue('card-meta-inativa-valor', metaInativa.valor_meta);
        updateCardValue('card-meta-inativa-atingido', metaInativa.valor_atingido);
        updateCardValue('card-meta-inativa-restante', metaInativa.valor_restante);
        $('#card-meta-inativa-status .value').text(metaInativa.status);
    }

    // --- Event Listeners ---
    $('#select-empresa-financeiro').on('change', updateFinanceiroEmpresaCards);
    $('#select-interno-financeiro').on('change', updateFinanceiroInternoCards);
    $('#select-franquia-financeiro').on('change', updateFinanceiroFranquiaCards);
    $('#select-filial-financeiro').on('change', updateFinanceiroFilialCards);
    $('#select-filial-lojas').on('change', updateLojasFilialCards);
    $('#select-franquia-lojas').on('change', updateLojasFranquiaCards);
    $('#select-funcionario-rh').on('change', updateRhFuncionarioCards);
    $('#select-meta-ativa, #select-meta-inativada').on('change', updateMetaCards);

    // --- Inicialização ---
    fetchDataAndPopulate();
});
