$(document).ready(function() {
    // Adiciona animação de entrada aos elementos
    animarEntradaElementos();
    
    // Carrega os dados ao iniciar
    carregarDadosDashboardPresenca();

    // Configura os filtros para disparar a atualização ao mudar
    $('#data-inicio, #data-fim, #equipe, #usuario').change(function() {
        // Adiciona efeito visual ao aplicar filtro
        $(this).addClass('filter-applied');
        setTimeout(() => $(this).removeClass('filter-applied'), 300);
        
        carregarDadosDashboardPresenca();
    });

    // Carrega a lista de funcionários e equipes para os filtros
    carregarFuncionariosParaFiltro();
    carregarEquipesParaFiltro();
    
    // Adiciona efeito hover aos cards
    $('.card').hover(
        function() {
            $(this).addClass('card-hover-effect');
        },
        function() {
            $(this).removeClass('card-hover-effect');
        }
    );

    // Botão de teste de captura de IP
    $('#test-ip-capture').click(function() {
        testarCapturaIP();
    });

    // Função para executar consulta de ausências
    function executarConsultaAusencias() {
        const dataConsulta = $('#data-ausencias').val();
        const filtroEquipe = $('#filtro-equipe-ausencias').val();
        
        // console.log('=== EXECUTAR CONSULTA AUSÊNCIAS ===');
        // console.log('Data selecionada:', dataConsulta);
        // console.log('Filtro equipe:', filtroEquipe);
        
        if (!dataConsulta) {
            // console.log('Nenhuma data selecionada, limpando tabela');
            // Limpa a tabela se não há data selecionada
            const tbody = $('#tabela-ausencias-atrasos tbody');
            tbody.html('<tr><td colspan="6" class="text-center empty-state">📅 Selecione uma data para consultar ausências e atrasos</td></tr>');
            return;
        }
        
        // console.log('Chamando consultarAusenciasEAtrasos...');
        consultarAusenciasEAtrasos(dataConsulta, filtroEquipe);
    }

    // Consulta automática quando mudar a data
    $('#data-ausencias').change(function() {
        $(this).addClass('filter-applied');
        setTimeout(() => $(this).removeClass('filter-applied'), 1000);
        executarConsultaAusencias();
    });

    // Consulta automática quando mudar o filtro de equipe
    $('#filtro-equipe-ausencias').change(function() {
        $(this).addClass('filter-applied');
        setTimeout(() => $(this).removeClass('filter-applied'), 1000);
        executarConsultaAusencias();
    });

    // Botão de consulta manual (mantido como backup)
    $('#btn-consultar-ausencias').click(function() {
        executarConsultaAusencias();
    });

    // Define data de hoje como padrão para consulta de ausências
    const hoje = new Date().toISOString().split('T')[0];
    $('#data-ausencias').val(hoje);
    
    // Executa primeira consulta automaticamente após um pequeno delay
    setTimeout(function() {
        executarConsultaAusencias();
    }, 500);
});

function animarEntradaElementos() {
    // Anima entrada das seções do dashboard
    $('.dashboard-section').each(function(index) {
        $(this).css({
            'opacity': '0',
            'transform': 'translateY(30px)'
        });
        
        setTimeout(() => {
            $(this).css({
                'transition': 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                'opacity': '1',
                'transform': 'translateY(0)'
            });
        }, index * 150);
    });
}

function carregarDadosDashboardPresenca() {
    const dataInicio = $('#data-inicio').val();
    const dataFim = $('#data-fim').val();
    const equipeId = $('#equipe').val();
    const usuarioId = $('#usuario').val();

    // Mostra loading na tabela e limpa dashboard com animação
    $('#tabela-registros-ponto tbody').html('<tr><td colspan="7" class="text-center loading"><div class="loading-spinner"></div>Carregando dados...</td></tr>');
    
    // Anima os cards para loading
    $('.card .value, .card .value-text').addClass('loading-animation');
    
    limparValoresDashboard();

    $.ajax({
        url: '/rh/api/presenca/relatorio/',
        method: 'GET',
        data: {
            data_inicio: dataInicio,
            data_fim: dataFim,
            equipe_id: equipeId,
            usuario_id: usuarioId
        },
        success: function(response) {
            // Remove animação de loading
            $('.card .value, .card .value-text').removeClass('loading-animation');
            
            if (response && response.dashboard && response.registros_ponto) {
                atualizarDashboardPresenca(response.dashboard, dataInicio, dataFim);
                atualizarTabelaRegistrosPonto(response.registros_ponto);
                
                // Adiciona efeito de sucesso
                showSuccessToast('Dados carregados com sucesso!');
            } else {
                mostrarErro('Resposta inesperada do servidor ao carregar dados do dashboard.');
                $('#tabela-registros-ponto tbody').html('<tr><td colspan="7" class="text-center text-danger">❌ Erro ao processar dados</td></tr>');
            }
        },
        error: function(xhr) {
            $('.card .value, .card .value-text').removeClass('loading-animation');
            mostrarErro('Erro ao carregar dados do dashboard: ' + (xhr.responseJSON?.error || 'Erro desconhecido'));
            $('#tabela-registros-ponto tbody').html('<tr><td colspan="7" class="text-center text-danger">❌ Erro ao carregar dados</td></tr>');
        }
    });
}

function limparValoresDashboard() {
    // Anima a limpeza dos valores
    const campos = [
        '#total-checkins-hoje', '#total-funcionarios-ativos-contexto', 
        '#funcionarios-sem-checkin-hoje', '#total-entradas-hoje', 
        '#total-saidas-hoje', '#total-entradas-periodo', 
        '#total-saidas-periodo', '#total-ausencias-reportadas', 
        '#usuarios-com-ausencias'
    ];
    
    campos.forEach(campo => {
        $(campo).fadeOut(200, function() {
            $(this).text('-').fadeIn(200);
        });
    });
    
    $('#top-observacao-ausencia-texto').fadeOut(200, function() {
        $(this).text('Aguardando dados...').fadeIn(200);
    });
    $('#top-observacao-ausencia-count').text('');
    $('#data-ref-hoje-label').text('Data'); 
    $('.card-periodo').slideUp(300);
}

function atualizarDashboardPresenca(dashboardData, dataInicio, dataFim) {
    if (!dashboardData) {
        mostrarErro("Dados do dashboard não recebidos.");
        return;
    }

    // Data de Referência para "Hoje"
    let dataRefLabel = new Date().toLocaleDateString('pt-BR');
    if (dataFim && (!dataInicio || dataInicio === dataFim)) {
        try {
            const df = new Date(dataFim + 'T00:00:00');
            dataRefLabel = df.toLocaleDateString('pt-BR');
        } catch (e) { /* usa o padrão */ }
    }
    $('#data-ref-hoje-label').text(dataRefLabel);

    // Anima a atualização dos valores dos cards
    const atualizacoes = [
        { selector: '#total-checkins-hoje', valor: dashboardData.total_checkins_hoje || '0' },
        { selector: '#total-funcionarios-ativos-contexto', valor: dashboardData.total_funcionarios_ativos_contexto || '0' },
        { selector: '#funcionarios-sem-checkin-hoje', valor: dashboardData.funcionarios_sem_checkin_hoje || '0' },
        { selector: '#total-entradas-hoje', valor: dashboardData.total_entradas_hoje || '0' },
        { selector: '#total-saidas-hoje', valor: dashboardData.total_saidas_hoje || '0' },
        { selector: '#total-ausencias-reportadas', valor: dashboardData.total_ausencias_reportadas || '0' },
        { selector: '#usuarios-com-ausencias', valor: dashboardData.usuarios_com_ausencias || '0' }
    ];

    atualizacoes.forEach((item, index) => {
        setTimeout(() => {
            animarContador(item.selector, item.valor);
        }, index * 100);
    });

    // Cards de "Período" com animação
    if (dataInicio || dataFim) {
        setTimeout(() => {
            animarContador('#total-entradas-periodo', dashboardData.total_entradas_periodo || '0');
            animarContador('#total-saidas-periodo', dashboardData.total_saidas_periodo || '0');
            $('.card-periodo').slideDown(400, function() {
                $(this).addClass('bounce-in');
            });
        }, 500);
    } else {
        $('.card-periodo').slideUp(300);
    }

    // Cards de Ausências com animação especial
    if (dashboardData.top_observacoes_ausencias && dashboardData.top_observacoes_ausencias.length > 0) {
        const topObs = dashboardData.top_observacoes_ausencias[0];
        $('#top-observacao-ausencia-texto').fadeOut(300, function() {
            $(this).text(topObs.observacao || 'Não especificada').fadeIn(300);
        });
        $('#top-observacao-ausencia-count').fadeOut(300, function() {
            $(this).text(`(${topObs.count} ocorrência${topObs.count !== 1 ? 's' : ''})`).fadeIn(300);
        });
    } else {
        $('#top-observacao-ausencia-texto').fadeOut(300, function() {
            $(this).text('Nenhuma observação predominante').fadeIn(300);
        });
        $('#top-observacao-ausencia-count').text('');
    }
}

function animarContador(selector, valorFinal) {
    const elemento = $(selector);
    const valorAtual = parseInt(elemento.text()) || 0;
    const valorTarget = parseInt(valorFinal) || 0;
    
    if (valorAtual === valorTarget) return;
    
    elemento.addClass('counter-animation');
    
    $({ contador: valorAtual }).animate(
        { contador: valorTarget },
        {
            duration: 800,
            easing: 'swing',
            step: function() {
                elemento.text(Math.ceil(this.contador));
            },
            complete: function() {
                elemento.text(valorFinal);
                elemento.removeClass('counter-animation');
                elemento.addClass('value-updated');
                setTimeout(() => elemento.removeClass('value-updated'), 500);
            }
        }
    );
}

function carregarFuncionariosParaFiltro() {
    $.ajax({
        url: '/rh/api/presenca/funcionarios/', 
        method: 'GET',
        success: function(response) {
            const select = $('#usuario');
            select.empty().addClass('loading-select');
            select.append('<option value="">Carregando funcionários...</option>');
            
            setTimeout(() => {
                select.removeClass('loading-select');
                select.empty();
                select.append('<option value="">Todos os Funcionários</option>');
                
                if (Array.isArray(response)) {
                    response.forEach(function(funcionario, index) {
                        setTimeout(() => {
                            select.append(`<option value="${funcionario.id}">${funcionario.nome}</option>`);
                        }, index * 10);
                    });
                } else {
                    mostrarErro('Resposta inesperada ao carregar funcionários para filtro.');
                }
            }, 300);
        },
        error: function(xhr) {
            $('#usuario').removeClass('loading-select');
            mostrarErro('Erro ao carregar lista de funcionários para filtro: ' + (xhr.responseJSON?.error || 'Erro desconhecido'));
        }
    });
}

function carregarEquipesParaFiltro() {
    $.ajax({
        url: '/rh/api/presenca/equipes/', 
        method: 'GET',
        success: function(response) {
            const select = $('#equipe');
            select.empty().addClass('loading-select');
            select.append('<option value="">Carregando equipes...</option>');
            
            setTimeout(() => {
                select.removeClass('loading-select');
                select.empty();
                select.append('<option value="">Todas as Equipes</option>');
                
                if (Array.isArray(response)) {
                    response.forEach(function(equipe, index) {
                        setTimeout(() => {
                            select.append(`<option value="${equipe.id}">${equipe.nome}</option>`);
                        }, index * 10);
                    });
                } else {
                    mostrarErro('Resposta inesperada ao carregar equipes para filtro.');
                }
            }, 300);
        },
        error: function(xhr) {
            $('#equipe').removeClass('loading-select');
            mostrarErro('Erro ao carregar lista de equipes para filtro: ' + (xhr.responseJSON?.error || 'Erro desconhecido'));
        }
    });
}

function atualizarTabelaRegistrosPonto(registros) {
    const tbody = $('#tabela-registros-ponto tbody');
    tbody.empty();

    if (!registros || registros.length === 0) {
        tbody.html('<tr><td colspan="7" class="text-center empty-state">📋 Nenhum registro de ponto encontrado para os filtros selecionados</td></tr>');
        return;
    }

    registros.forEach(function(registro, index) {
        const tr = $('<tr>')
            .addClass('table-row-animated')
            .css({
                'opacity': '0',
                'transform': 'translateX(-20px)'
            });
            
        tr.append(`<td><span class="table-data">${registro.data}</span></td>`);
        tr.append(`<td><span class="table-data">${registro.hora}</span></td>`);
        tr.append(`<td><span class="table-data user-name">${registro.usuario_nome || 'N/A'}</span></td>`);
        tr.append(`<td><span class="table-data">${registro.departamento || 'N/A'}</span></td>`);
        tr.append(`<td><span class="table-data team-name">${registro.equipe || 'N/A'}</span></td>`);
        tr.append(`<td><span class="table-data type-badge ${registro.tipo?.toLowerCase()}">${registro.tipo || 'N/A'}</span></td>`);
        tr.append(`<td><span class="table-data ip-address">${registro.ip_usado || 'N/A'}</span></td>`);
        
        tbody.append(tr);
        
        // Anima a entrada de cada linha com delay
        setTimeout(() => {
            tr.css({
                'transition': 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                'opacity': '1',
                'transform': 'translateX(0)'
            });
        }, index * 50);
    });
    
    // Adiciona efeito de conclusão
    setTimeout(() => {
        showSuccessToast(`${registros.length} registros carregados com sucesso!`);
    }, registros.length * 50 + 200);
}

function mostrarErro(mensagem) {
    console.error(mensagem);
    
    // Cria toast de erro moderno
    const toastHtml = `
        <div class="toast-modern toast-error" style="opacity: 0; transform: translateY(-20px);">
            <div class="toast-icon">❌</div>
            <div class="toast-content">
                <div class="toast-title">Erro</div>
                <div class="toast-message">${mensagem}</div>
            </div>
            <div class="toast-close">×</div>
        </div>
    `;
    
    $('body').append(toastHtml);
    const toast = $('.toast-modern').last();
    
    // Anima entrada
    setTimeout(() => {
        toast.css({
            'transition': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            'opacity': '1',
            'transform': 'translateY(0)'
        });
    }, 10);
    
    // Auto remove
    setTimeout(() => {
        toast.css({
            'opacity': '0',
            'transform': 'translateY(-20px)'
        });
        setTimeout(() => toast.remove(), 300);
    }, 5000);
    
    // Click para fechar
    toast.find('.toast-close').click(() => {
        toast.css({
            'opacity': '0',
            'transform': 'translateY(-20px)'
        });
        setTimeout(() => toast.remove(), 300);
    });
}

function showSuccessToast(mensagem) {
    const toastHtml = `
        <div class="toast-modern toast-success" style="opacity: 0; transform: translateY(-20px);">
            <div class="toast-icon">✅</div>
            <div class="toast-content">
                <div class="toast-title">Sucesso</div>
                <div class="toast-message">${mensagem}</div>
            </div>
            <div class="toast-close">×</div>
        </div>
    `;
    
    $('body').append(toastHtml);
    const toast = $('.toast-modern').last();
    
    // Anima entrada
    setTimeout(() => {
        toast.css({
            'transition': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            'opacity': '1',
            'transform': 'translateY(0)'
        });
    }, 10);
    
    // Auto remove
    setTimeout(() => {
        toast.css({
            'opacity': '0',
            'transform': 'translateY(-20px)'
        });
        setTimeout(() => toast.remove(), 300);
    }, 3000);
    
    // Click para fechar
    toast.find('.toast-close').click(() => {
        toast.css({
            'opacity': '0',
            'transform': 'translateY(-20px)'
        });
        setTimeout(() => toast.remove(), 300);
    });
}

// Função para testar a captura de IP
function testarCapturaIP() {
    showInfoToast('Testando captura de IP...', 3000);
    
    $.ajax({
        url: '/rh/api/test/ip/',
        method: 'GET',
        success: function(response) {
            let mensagem = `
                <strong>IP Capturado:</strong> ${response.ip_capturado}<br>
                <strong>Headers Disponíveis:</strong><br>
            `;
            
            for (let header in response.headers_disponiveis) {
                mensagem += `• ${header}: ${response.headers_disponiveis[header]}<br>`;
            }
            
            // Mostra um toast com resultado detalhado
            showDetailedToast('Resultado do Teste de IP', mensagem, 'info', 10000);
            
            console.log('Teste de captura de IP:', response);
        },
        error: function(xhr, status, error) {
            mostrarErro('Erro ao testar captura de IP: ' + error);
            console.error('Erro no teste de IP:', error);
        }
    });
}

// Função para mostrar toast com informações detalhadas
function showDetailedToast(titulo, mensagem, tipo = 'info', duracao = 5000) {
    const tipoClass = tipo === 'success' ? 'toast-success' : 
                     tipo === 'error' ? 'toast-error' : 'toast-info';
    
    const toast = $(`
        <div class="toast-modern ${tipoClass}" style="display: none;">
            <div class="toast-content">
                <div class="toast-title">${titulo}</div>
                <div class="toast-message">${mensagem}</div>
            </div>
            <button type="button" class="toast-close">&times;</button>
        </div>
    `);
    
    $('body').append(toast);
    toast.slideDown(300);
    
    // Auto-remove após a duração especificada
    setTimeout(() => {
        toast.slideUp(300, () => toast.remove());
    }, duracao);
    
    // Botão de fechar manual
    toast.find('.toast-close').click(() => {
        toast.slideUp(300, () => toast.remove());
    });
}

// Toast de informação
function showInfoToast(mensagem, duracao = 3000) {
    showDetailedToast('Informação', mensagem, 'info', duracao);
}

// Função para consultar ausências e atrasos
function consultarAusenciasEAtrasos(dataConsulta, filtroEquipe = '') {
    // console.log('=== CONSULTAR AUSÊNCIAS E ATRASOS ===');
    // console.log('Parâmetros recebidos:');
    // console.log('  - dataConsulta:', dataConsulta);
    // console.log('  - filtroEquipe:', filtroEquipe);
    
    const tbody = $('#tabela-ausencias-atrasos tbody');
    const btn = $('#btn-consultar-ausencias');
    
    // Mostra loading
    btn.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-2"></i>Consultando...');
    tbody.html('<tr><td colspan="6" class="text-center loading">Verificando ausências e atrasos...</td></tr>');
    
    // Prepara dados para enviar
    const dados = { data: dataConsulta };
    if (filtroEquipe) {
        dados.filtro_equipe = filtroEquipe;
    }
    
    // console.log('Dados para enviar na requisição:', dados);
    
    $.ajax({
        url: '/rh/api/ausencias-atrasos/',
        method: 'GET',
        data: dados,
        success: function(response) {
            // console.log('=== RESPOSTA DA API ===');
            // console.log('Response completa:', response);
            // console.log('Dados recebidos:', response.dados);
            // console.log('Total problemas:', response.total_problemas);
            // console.log('Funcionários analisados:', response.funcionarios_analisados);
            // console.log('Funcionários excluídos:', response.funcionarios_excluidos);
            // console.log('Filtro info:', response.filtro_info);
            // console.log('Filtro aplicado no backend:', response.filtro_aplicado);
            
            // Verificação detalhada do filtro
            // if (filtroEquipe === 'com_equipe') {
            //     console.log('🔍 ANÁLISE DO FILTRO "COM_EQUIPE":');
            //     response.dados.forEach((item, index) => {
            //         console.log(`  Item ${index + 1}: ${item.funcionario_nome}`);
            //         console.log(`    - Equipe: ${item.equipe}`);
            //         console.log(`    - Tem equipe? ${item.equipe !== null && item.equipe !== undefined && item.equipe !== ''}`);
            //         if (item.equipe === null || item.equipe === undefined || item.equipe === '') {
            //             console.warn(`    ⚠️ PROBLEMA: Funcionário sem equipe passou pelo filtro!`);
            //         }
            //     });
            // } else if (filtroEquipe === 'sem_equipe') {
            //     console.log('🔍 ANÁLISE DO FILTRO "SEM_EQUIPE":');
            //     response.dados.forEach((item, index) => {
            //         console.log(`  Item ${index + 1}: ${item.funcionario_nome}`);
            //         console.log(`    - Equipe: ${item.equipe}`);
            //         console.log(`    - Sem equipe? ${item.equipe === null || item.equipe === undefined || item.equipe === ''}`);
            //         if (item.equipe !== null && item.equipe !== undefined && item.equipe !== '') {
            //             console.warn(`    ⚠️ PROBLEMA: Funcionário com equipe passou pelo filtro!`);
            //         }
            //     });
            // }
            
            // Aplicar filtro no frontend como fallback
            let dadosFiltrados = response.dados || [];
            
            if (filtroEquipe === 'com_equipe') {
                // console.log('🔧 Aplicando filtro "com_equipe" no frontend como fallback');
                const dadosOriginais = [...dadosFiltrados];
                dadosFiltrados = dadosFiltrados.filter(item => {
                    const temEquipe = item.equipe !== null && item.equipe !== undefined && item.equipe !== '';
                    // if (!temEquipe) {
                    //     console.log(`  Removendo ${item.funcionario_nome} - sem equipe`);
                    // }
                    return temEquipe;
                });
                // console.log(`  Filtro frontend: ${dadosOriginais.length} -> ${dadosFiltrados.length} itens`);
            } else if (filtroEquipe === 'sem_equipe') {
                // console.log('🔧 Aplicando filtro "sem_equipe" no frontend como fallback');
                const dadosOriginais = [...dadosFiltrados];
                dadosFiltrados = dadosFiltrados.filter(item => {
                    const semEquipe = item.equipe === null || item.equipe === undefined || item.equipe === '';
                    // if (!semEquipe) {
                    //     console.log(`  Removendo ${item.funcionario_nome} - tem equipe: ${item.equipe}`);
                    // }
                    return semEquipe;
                });
                // console.log(`  Filtro frontend: ${dadosOriginais.length} -> ${dadosFiltrados.length} itens`);
            }
            
            atualizarTabelaAusenciasAtrasos(dadosFiltrados);
            
            let mensagem = `Consulta realizada para ${formatarData(dataConsulta)}:\n`;
            mensagem += `• ${dadosFiltrados.length} problema(s) encontrado(s) (após filtro)\n`;
            mensagem += `• ${response.funcionarios_analisados || 0} funcionário(s) analisado(s)\n`;
            if (response.funcionarios_excluidos > 0) {
                mensagem += `• ${response.funcionarios_excluidos} funcionário(s) sem horário (excluídos)\n`;
            }
            if (filtroEquipe) {
                const filtroTexto = filtroEquipe === 'com_equipe' ? 'Apenas com equipe' : 
                                  filtroEquipe === 'sem_equipe' ? 'Apenas sem equipe' : 'Todos';
                mensagem += `• Filtro aplicado: ${filtroTexto}`;
            }
            
            // console.log('Mensagem do toast:', mensagem);
            showSuccessToast(mensagem);
        },
        error: function(xhr) {
            // console.log('=== ERRO NA API ===');
            // console.log('xhr:', xhr);
            // console.log('Status:', xhr.status);
            // console.log('Response Text:', xhr.responseText);
            // console.log('Response JSON:', xhr.responseJSON);
            
            mostrarErro('Erro ao consultar ausências e atrasos: ' + (xhr.responseJSON?.error || 'Erro desconhecido'));
            tbody.html('<tr><td colspan="6" class="text-center empty-state">❌ Erro ao carregar dados</td></tr>');
        },
        complete: function() {
            // console.log('=== REQUISIÇÃO FINALIZADA ===');
            btn.prop('disabled', false).html('<i class="bx bx-search me-2"></i>Consultar');
        }
    });
}

// Função para atualizar a tabela de ausências e atrasos
function atualizarTabelaAusenciasAtrasos(dados) {
    // console.log('=== ATUALIZAR TABELA AUSÊNCIAS ===');
    // console.log('Dados recebidos para tabela:', dados);
    // console.log('Tipo dos dados:', typeof dados);
    // console.log('É array?:', Array.isArray(dados));
    // console.log('Quantidade de itens:', dados ? dados.length : 'N/A');
    
    const tbody = $('#tabela-ausencias-atrasos tbody');
    tbody.empty();

    if (!dados || dados.length === 0) {
        // console.log('Nenhum dado encontrado, exibindo mensagem vazia');
        tbody.html('<tr><td colspan="6" class="text-center empty-state">🎉 Nenhuma ausência ou atraso encontrado para esta data!</td></tr>');
        return;
    }

    // console.log('Processando', dados.length, 'itens para a tabela');
    
    dados.forEach(function(item, index) {
        // console.log(`Item ${index + 1}:`, item);
        
        const tr = $('<tr>')
            .addClass('table-row-animated')
            .css({
                'opacity': '0',
                'transform': 'translateX(-20px)'
            });

        // Monta o badge da situação
        let situacaoBadge = '';
        if (item.situacao === 'ausente') {
            situacaoBadge = '<span class="situacao-badge ausente"><i class="bx bx-user-x"></i>Ausente</span>';
        } else if (item.situacao === 'atrasado') {
            situacaoBadge = '<span class="situacao-badge atrasado"><i class="bx bx-time"></i>Atrasado</span>';
        }

        // console.log(`Situação do item ${index + 1}:`, item.situacao, '-> Badge:', situacaoBadge);

        // Formata o horário do primeiro registro
        const primeiroRegistro = item.primeiro_registro ? 
            `<span class="horario-registro">${item.primeiro_registro}</span>` : 
            '<span class="text-muted">-</span>';

        tr.append(`<td><span class="table-data user-name">${item.funcionario_nome || 'N/A'}</span></td>`);
        tr.append(`<td><span class="table-data">${item.departamento || 'N/A'}</span></td>`);
        tr.append(`<td><span class="table-data team-name">${item.equipe || 'Sem equipe'}</span></td>`);
        tr.append(`<td>${situacaoBadge}</td>`);
        tr.append(`<td>${primeiroRegistro}</td>`);
        tr.append(`<td><span class="table-data">${item.observacao || '-'}</span></td>`);

        tbody.append(tr);

        // Anima a entrada da linha
        setTimeout(() => {
            tr.animate({
                opacity: 1,
                transform: 'translateX(0)'
            }, 300);
        }, index * 50);
    });
    
    // console.log('Tabela de ausências atualizada com', dados.length, 'itens');
}

// Função auxiliar para formatar data
function formatarData(dataString) {
    const data = new Date(dataString + 'T00:00:00');
    return data.toLocaleDateString('pt-BR');
}

// Função para mostrar toast de erro
function showErrorToast(mensagem) {
    showDetailedToast('Erro', mensagem, 'error', 5000);
} 