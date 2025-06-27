// CRM Kanban - JavaScript
$(document).ready(function() {
    let dragula_instance = null;
    let currentCardData = null;
    
    // Inicializar o CRM Kanban
    init();
    
    function init() {
        // Configurar data inicial (últimos 30 dias)
        const hoje = new Date();
        const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        $('#data-inicio').val(formatarDataInput(trintaDiasAtras));
        $('#data-fim').val(formatarDataInput(hoje));
        
        // Carregar funcionários para o filtro
        carregarFuncionarios();
        
        // Chamar API de teste primeiro para debug
        chamarApiTeste();
        
        // Carregar dados iniciais do Kanban
        carregarDadosKanban();
        
        // Configurar eventos
        configurarEventos();
        
        // Configurar sincronização de scroll
        configurarScrollSync();
        
        // Configurar listener para redimensionamento
        configurarListenerRedimensionamento();
    }
    
    function configurarEventos() {
        // Toggle dos filtros
        $('#toggle-filters').click(function() {
            const content = $('#filter-content');
            const icon = $(this).find('i');
            
            if (content.hasClass('collapsed')) {
                content.removeClass('collapsed');
                icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            } else {
                content.addClass('collapsed');
                icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
            }
        });
        
        // Aplicar filtros
        $('#aplicar-filtros').click(function() {
            carregarDadosKanban();
        });
        
        // Limpar filtros
        $('#limpar-filtros').click(function() {
            $('#data-inicio').val('');
            $('#data-fim').val('');
            $('#funcionario-filtro').val('');
            carregarDadosKanban();
        });
        
        // Refresh do Kanban
        $('#refresh-kanban').click(function() {
            carregarDadosKanban();
        });
        
        // Salvar alterações de tabulação
        $('#btn-salvar-tabulacao').click(function() {
            salvarAlteracoesTabulacao();
        });
        
        // Editar tabulação do modal de detalhes
        $('#btn-editar-tabulacao').click(function() {
            if (currentCardData) {
                $('#novo-status').val(currentCardData.tabulacao_status);
                $('#tabulacao-id-edicao').val(currentCardData.tabulacao_id);
                $('#observacoes-edicao').val('');
                
                fecharModal('modal-detalhes-overlay', 'ABRIR EDIÇÃO');
                abrirModal('modal-edicao-overlay');
            }
        });
        
        // Eventos dos botões de fechar modais
        $('#btn-close-detalhes, #btn-fechar-detalhes').click(function() {
            fecharModal('modal-detalhes-overlay', 'BOTÃO FECHAR');
        });
        
        $('#btn-close-edicao, #btn-cancelar-edicao').click(function() {
            fecharModal('modal-edicao-overlay', 'BOTÃO CANCELAR/FECHAR');
        });
        
        // Tecla ESC para fechar modais
        $(document).keydown(function(e) {
            if (e.keyCode === 27) { // ESC
                fecharTodosModais('TECLA ESC');
            }
        });
        
        // Configurar eventos de modais (delegação)
        configurarEventosModais();
    }
    
    function configurarEventosModais() {
        // Fechar modal clicando no overlay (usar delegação de eventos)
        $(document).off('click.modal-overlay').on('click.modal-overlay', '.modal-overlay', function(e) {
            // Verificar se clicou exatamente no overlay (não nos filhos)
            if (e.target === this) {
                console.log('🔒 CLIQUE NO OVERLAY DETECTADO');
                fecharModal(this.id, 'CLIQUE NO OVERLAY');
            } else {
                console.log('🔍 CLIQUE DENTRO DO MODAL - NÃO FECHANDO');
            }
        });
        
        // Prevenir fechamento ao clicar dentro do modal (usar delegação)
        $(document).off('click.modal-content').on('click.modal-content', '.modal-kanban', function(e) {
            console.log('🛡️ CLIQUE DENTRO DO MODAL - PREVENINDO PROPAGAÇÃO');
            e.stopPropagation();
        });
        
        // Debug: monitorar todos os cliques em modais
        $(document).off('click.modal-debug').on('click.modal-debug', '.modal-overlay *', function(e) {
            console.log('🔍 DEBUG MODAL - ELEMENTO CLICADO:', this, 'EVENTO:', e);
        });
    }
    
    function configurarScrollSync() {
        const scrollTop = $('#kanban-scroll-top');
        const scrollBottom = $('#kanban-board-wrapper');
        
        // Sincronizar scroll superior com inferior
        scrollTop.on('scroll', function() {
            const scrollLeft = $(this).scrollLeft();
            scrollBottom.scrollLeft(scrollLeft);
        });
        
        // Sincronizar scroll inferior com superior
        scrollBottom.on('scroll', function() {
            const scrollLeft = $(this).scrollLeft();
            scrollTop.scrollLeft(scrollLeft);
        });
    }
    
    function configurarListenerRedimensionamento() {
        let timeoutRedimensionamento;
        
        $(window).on('resize', function() {
            // Debounce para evitar muitas execuções
            clearTimeout(timeoutRedimensionamento);
            timeoutRedimensionamento = setTimeout(function() {
                console.log('🔄 Janela redimensionada, reajustando colunas...');
                ajustarAlturasColunas();
                atualizarLarguraScrollSuperior();
            }, 300);
        });
    }
    
    function chamarApiTeste() {
        console.log('🧪 Chamando API de teste do Kanban...');
        
        $.get('/siape/api/get/kanban-teste/')
            .done(function(response) {
                console.log('🧪 Dados da API de teste:', response);
                if (response.success) {
                    console.log('📊 Estatísticas do sistema:', response.dados);
                    console.log('📈 Total agendamentos:', response.dados.total_agendamentos);
                    console.log('📈 Total tabulações:', response.dados.total_tabulacoes);
                    console.log('📈 Agendamentos com tabulação:', response.dados.agendamentos_com_tabulacao);
                    console.log('📈 Agendamentos SEM tabulação:', response.dados.agendamentos_sem_tabulacao);
                    console.log('📈 Meus agendamentos:', response.dados.meus_agendamentos);
                    console.log('🔑 Pode ver todos:', response.dados.pode_ver_todos);
                    
                    // Se há agendamentos sem tabulação, sugerir criação automática
                    if (response.dados.agendamentos_sem_tabulacao > 0) {
                        console.log(`⚠️ ATENÇÃO: Existem ${response.dados.agendamentos_sem_tabulacao} agendamentos sem tabulação!`);
                        console.log('💡 Sugestão: Execute criarTabulacoesAutomaticas() no console para corrigir');
                        
                        // Criar função global para fácil acesso no console
                        window.criarTabulacoesAutomaticas = function() {
                            console.log('🔧 Criando tabulações automáticas...');
                            
                            $.ajax({
                                url: '/siape/api/post/criar-tabulacoes-automaticas/',
                                method: 'POST',
                                headers: {
                                    'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
                                }
                            })
                            .done(function(response) {
                                if (response.success) {
                                    console.log('✅ Tabulações criadas:', response.message);
                                    console.log('📊 Total criadas:', response.tabulacoes_criadas);
                                    mostrarToast('Sucesso', response.message, 'success');
                                    
                                    // Recarregar dados após criar tabulações
                                    setTimeout(() => {
                                        chamarApiTeste();
                                        carregarDadosKanban();
                                    }, 1000);
                                } else {
                                    console.error('❌ Erro ao criar tabulações:', response.message);
                                    mostrarToast('Erro', response.message, 'error');
                                }
                            })
                            .fail(function(xhr) {
                                console.error('💥 Erro na requisição:', xhr);
                                mostrarToast('Erro', 'Erro de conexão', 'error');
                            });
                        };
                    }
                }
            })
            .fail(function(xhr) {
                console.error('💥 Erro na API de teste:', xhr);
            });
    }

    function carregarFuncionarios() {
        $.get('/siape/api/get/funcionarios-lista/')
            .done(function(response) {
                if (response.result) {
                    const select = $('#funcionario-filtro');
                    select.empty().append('<option value="">Todos os funcionários</option>');
                    
                    response.funcionarios.forEach(function(funcionario) {
                        select.append(`<option value="${funcionario.id}">${funcionario.nome}</option>`);
                    });
                }
            })
            .fail(function() {
                console.error('Erro ao carregar lista de funcionários');
            });
    }
    
    function carregarDadosKanban() {
        console.log('🔄 Iniciando carregamento do Kanban...');
        mostrarLoading(true);
        
        const params = {
            data_inicio: $('#data-inicio').val(),
            data_fim: $('#data-fim').val(),
            funcionario_id: $('#funcionario-filtro').val()
        };
        
        console.log('📋 Parâmetros antes da limpeza:', params);
        
        // Remove parâmetros vazios
        Object.keys(params).forEach(key => {
            if (!params[key]) delete params[key];
        });
        
        console.log('📋 Parâmetros após limpeza:', params);
        console.log('🌐 Fazendo requisição para:', '/siape/api/get/kanban-dados/', params);
        
        $.get('/siape/api/get/kanban-dados/', params)
            .done(function(response) {
                console.log('✅ Resposta recebida da API:', response);
                
                if (response.success) {
                    console.log('📊 Dados do Kanban:', response.data);
                    console.log('🔑 Permissões:', response.permissoes);
                    
                    renderizarKanban(response.data);
                    atualizarEstatisticas(response.data);
                    
                    // Configurar interface baseada nas permissões
                    if (response.permissoes) {
                        configurarPermissoes(response.permissoes);
                    }
                } else {
                    console.error('❌ Erro na resposta da API:', response.message);
                    mostrarToast('Erro', response.message || 'Erro ao carregar dados do Kanban', 'error');
                }
            })
            .fail(function(xhr) {
                console.error('💥 Erro ao carregar dados do Kanban:', xhr);
                console.error('💥 Status:', xhr.status);
                console.error('💥 Response Text:', xhr.responseText);
                mostrarToast('Erro', 'Erro de conexão ao carregar dados do Kanban', 'error');
            })
            .always(function() {
                mostrarLoading(false);
            });
    }
    
    function renderizarKanban(dados) {
        console.log('🎨 Iniciando renderização do Kanban com dados:', dados);
        
        const kanbanBoard = $('#kanban-board');
        kanbanBoard.empty();
        
        // Ordem das colunas conforme organograma Money Promotora
        const ordemColunas = [
            'SEM_RESPOSTA',
            'EM_NEGOCIACAO',
            'REVERSAO',
            'REVERTIDO',
            'DESISTIU',
            'CHECAGEM',
            'CHECAGEM_OK',
            'ALTO_RISCO',
            'CONCLUIDO_PG'
        ];
        
        console.log('📋 Ordem das colunas:', ordemColunas);
        
        // Criar colunas na ordem definida
        ordemColunas.forEach(function(status) {
            const coluna = dados[status] || { nome: getNomeStatus(status), cards: [] };
            console.log(`🏛️ Criando coluna ${status}:`, coluna);
            console.log(`📊 Número de cards na coluna ${status}:`, coluna.cards.length);
            
            const colunaHtml = criarColunaHtml(status, coluna);
            kanbanBoard.append(colunaHtml);
        });
        
        // Configurar drag and drop
        configurarDragDrop();
        
        // Animação de entrada
        $('.kanban-column').addClass('fade-in');
        
        // Atualizar largura do scroll superior
        atualizarLarguraScrollSuperior();
        
        // Ajustar altura das colunas baseado no número de cards
        ajustarAlturasColunas();
        
        // Configurar eventos dos cards (após renderização)
        configurarEventosCards();
    }
    
    function criarColunaHtml(status, coluna) {
        const cards = coluna.cards.map(card => criarCardHtml(card)).join('');
        
        return `
            <div class="kanban-column" data-status="${status}">
                <div class="column-header">
                    <div class="column-title">
                        ${coluna.nome}
                        <span class="column-count">${coluna.cards.length}</span>
                    </div>
                </div>
                <div class="column-cards">
                    ${cards}
                </div>
            </div>
        `;
    }
    
    function criarCardHtml(card) {
        const telefones = card.telefones.slice(0, 2).map(tel => 
            `<span class="phone-badge">${tel}</span>`
        ).join('');
        
        const telefonesMais = card.telefones.length > 2 ? 
            `<span class="phone-badge">+${card.telefones.length - 2}</span>` : '';
        
        // Determinar qual data/hora mostrar e se deve piscar
        let dataHoraDisplay = '';
        let classesPiscante = '';
        
        if (card.horario_checagem && card.horario_checagem.existe) {
            // Mostrar data/hora de checagem se existir
            dataHoraDisplay = `${card.horario_checagem.data} ${card.horario_checagem.hora}`;
            
            // Verificar se está próximo da hora (dentro de 30 minutos)
            if (verificarProximoHorario(card.horario_checagem.data_hora_raw)) {
                classesPiscante = 'checagem-proxima';
            }
        } else {
            // Se não tem horário de checagem, não mostrar data
            dataHoraDisplay = '';
        }
        
        // Apenas mostrar o footer de data se há data para mostrar
        const footerDataHtml = dataHoraDisplay ? `
            <div class="card-date ${classesPiscante}">
                <i class="fas fa-clock"></i>
                ${dataHoraDisplay}
            </div>
        ` : '';
        
        // Mostrar valor TC se existir e for maior que 0
        const valorTcHtml = (card.valor_tc && card.valor_tc > 0) ? `
            <div class="card-info-item tc-item">
                <i class="fas fa-star"></i>
                TC: R$ ${formatarMoeda(card.valor_tc)}
            </div>
        ` : '';
        
        return `
            <div class="kanban-card ${classesPiscante}" 
                 data-status="${card.tabulacao_status}"
                 data-card-id="${card.id}"
                 data-tabulacao-id="${card.tabulacao_id}"
                 data-agendamento-id="${card.agendamento_id}">
                <div class="card-header">
                    <h6 class="card-title">${card.cliente_nome}</h6>
                    <span class="card-status">${card.tabulacao_nome}</span>
                </div>
                <div class="card-info">
                    <div class="card-info-item">
                        <i class="fas fa-id-card"></i>
                        ${card.cliente_cpf}
                    </div>
                    <div class="card-info-item">
                        <i class="fas fa-dollar-sign"></i>
                        R$ ${formatarMoeda(card.renda_bruta)}
                    </div>
                    <div class="card-info-item">
                        <i class="fas fa-wallet"></i>
                        Saldo: R$ ${formatarMoeda(card.total_saldo)}
                    </div>
                    ${valorTcHtml}
                    <div class="card-info-item">
                        <i class="fas fa-user-tie"></i>
                        ${card.funcionario_nome}
                    </div>
                </div>
                <div class="card-footer">
                    ${footerDataHtml}
                    <div class="card-phones">
                        ${telefones}${telefonesMais}
                    </div>
                </div>
            </div>
        `;
    }
    
    function configurarDragDrop() {
        // Destruir instância anterior se existir
        if (dragula_instance) {
            dragula_instance.destroy();
        }
        
        // Criar nova instância do Dragula
        const containers = $('.column-cards').toArray();
        
        dragula_instance = dragula(containers, {
            moves: function(el, container, handle) {
                return $(el).hasClass('kanban-card');
            },
            accepts: function(el, target, source, sibling) {
                // Verificar se pode aceitar o drop baseado nas permissões
                const cardElement = $(el);
                const novaColuna = $(target).closest('.kanban-column');
                const novoStatus = novaColuna.data('status');
                const colunaOrigem = $(source).closest('.kanban-column');
                const statusOrigem = colunaOrigem.data('status');
                
                // Verificar permissões antes de permitir o drop
                if (window.kanbanPermissoes && !window.kanbanPermissoes.pode_ver_todos) {
                    const infoUsuario = window.kanbanPermissoes.info_usuario || {};
                    const hierarquia = infoUsuario.hierarquia;
                    
                    if (hierarquia && (hierarquia === 1 || hierarquia === 2)) { // ESTAGIO = 1, PADRAO = 2
                        // Restrição 1: Não pode MOVER PARA status restritos
                        if (['REVERSAO', 'CHECAGEM', 'REVERTIDO', 'CHECAGEM_OK', 'DESISTIU'].includes(novoStatus)) {
                            return false; // Impedir o drop
                        }
                        
                        // Restrição 2: Não pode MOVER DE REVERSAO ou CHECAGEM para qualquer lugar
                        if (statusOrigem === 'REVERSAO' || statusOrigem === 'CHECAGEM') {
                            return false; // Impedir o drop
                        }
                        
                        // Restrição 3: Não pode MOVER DE DESISTIU para qualquer lugar
                        if (statusOrigem === 'DESISTIU') {
                            return false; // Impedir o drop
                        }
                        
                        // Restrição 4: DE REVERTIDO/CHECAGEM_OK pode mover, mas não para status restritos
                        if ((statusOrigem === 'REVERTIDO' || statusOrigem === 'CHECAGEM_OK') && 
                            ['REVERSAO', 'CHECAGEM'].includes(novoStatus)) {
                            return false; // Impedir o drop
                        }
                    }
                }
                
                return $(target).hasClass('column-cards');
            }
        });
        
        // Evento quando o drop é rejeitado
        dragula_instance.on('invalid', function(el, container) {
            const cardElement = $(el);
            const colunaDestino = $(container).closest('.kanban-column');
            const novoStatus = colunaDestino.data('status');
            const colunaOrigem = cardElement.closest('.kanban-column');
            const statusOrigem = colunaOrigem.data('status');
            
            // Verificar qual restrição foi violada e mostrar modal específico
            if (window.kanbanPermissoes && !window.kanbanPermissoes.pode_ver_todos) {
                const infoUsuario = window.kanbanPermissoes.info_usuario || {};
                const hierarquia = infoUsuario.hierarquia;
                
                if (hierarquia && (hierarquia === 1 || hierarquia === 2)) {
                    // Restrição para DESISTIU - não pode mover de lá
                    if (statusOrigem === 'DESISTIU') {
                        mostrarModalAlerta(
                            'Restrição de Hierarquia',
                            'Cards em "Desistiu" não podem ser movidos para nenhum outro status.',
                            'info'
                        );
                        return;
                    }
                    
                    // Restrição para REVERSAO/CHECAGEM - não pode mover de lá
                    if (statusOrigem === 'REVERSAO' || statusOrigem === 'CHECAGEM') {
                        const statusOrigemNome = getNomeStatus(statusOrigem);
                        mostrarModalAlerta(
                            'Restrição de Hierarquia',
                            `Apenas superiores podem mover cards que estão em ${statusOrigemNome.toLowerCase()}.`,
                            'info'
                        );
                        return;
                    }
                    
                    // Restrição para mover PARA status restritos
                    if (['REVERSAO', 'CHECAGEM', 'REVERTIDO', 'CHECAGEM_OK', 'DESISTIU'].includes(novoStatus)) {
                        const statusNome = getNomeStatus(novoStatus);
                        
                        if (novoStatus === 'REVERSAO' || novoStatus === 'CHECAGEM') {
                            mostrarModalAlerta(
                                'Restrição de Hierarquia',
                                `Para adicionar a ${statusNome.toLowerCase()} deve usar o formulário em consulta cliente.`,
                                'info'
                            );
                        } else {
                            mostrarModalAlerta(
                                'Restrição de Hierarquia',
                                `Apenas superiores podem mover cards para ${statusNome.toLowerCase()}.`,
                                'info'
                            );
                        }
                        return;
                    }
                    
                    // Restrição para mover DE REVERTIDO/CHECAGEM_OK PARA REVERSAO/CHECAGEM
                    if ((statusOrigem === 'REVERTIDO' || statusOrigem === 'CHECAGEM_OK') && 
                        ['REVERSAO', 'CHECAGEM'].includes(novoStatus)) {
                        const statusNome = getNomeStatus(novoStatus);
                        mostrarModalAlerta(
                            'Restrição de Hierarquia',
                            `Para mover para ${statusNome.toLowerCase()} deve usar o formulário em consulta cliente.`,
                            'info'
                        );
                        return;
                    }
                }
            }
        });
        
        // Evento ao mover card (só executa se o drop foi aceito)
        dragula_instance.on('drop', function(el, target, source, sibling) {
            const cardElement = $(el);
            const novaColuna = $(target).closest('.kanban-column');
            const novoStatus = novaColuna.data('status');
            const tabulacaoId = cardElement.data('tabulacao-id');
            
            // Atualizar visualmente o card
            cardElement.attr('data-status', novoStatus);
            
            // Fazer a requisição para mover o card
            moverCard(tabulacaoId, novoStatus, cardElement);
            
            // Atualizar contadores
            atualizarContadores();
            
            // Reajustar alturas após mover card
            ajustarAlturasColunas();
        });
    }
    
    function moverCard(tabulacaoId, novoStatus, cardElement) {
        const dados = {
            tabulacao_id: tabulacaoId,
            novo_status: novoStatus,
            observacoes: `Movido via drag-and-drop para ${getNomeStatus(novoStatus)}`
        };
        
        $.ajax({
            url: '/siape/api/post/mover-card-kanban/',
            method: 'POST',
            data: JSON.stringify(dados),
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
            }
        })
        .done(function(response) {
            if (response.success) {
                mostrarToast('Sucesso', 'Card movido com sucesso!', 'success');
                
                // Atualizar o card visualmente
                const novoNome = getNomeStatus(novoStatus);
                cardElement.find('.card-status').text(novoNome);
            } else {
                // Verificar se é uma restrição de hierarquia
                if (response.restricao_hierarquia) {
                    mostrarModalAlerta(
                        'Restrição de Hierarquia',
                        response.message,
                        'info'
                    );
                } else {
                    mostrarToast('Erro', response.message || 'Erro ao mover card', 'error');
                }
                // Reverter movimento se houver erro
                carregarDadosKanban();
            }
        })
        .fail(function() {
            mostrarToast('Erro', 'Erro de conexão ao mover card', 'error');
            // Reverter movimento se houver erro
            carregarDadosKanban();
        });
    }
    
    function configurarEventosCards() {
        console.log('🎯 Configurando eventos dos cards...');
        
        // Remover eventos anteriores e adicionar novos (delegação de eventos)
        $(document).off('click.kanban-card').on('click.kanban-card', '.kanban-card', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Prevenir múltiplos cliques
            if ($(this).hasClass('clicking')) {
                console.log('⚠️ Card já está sendo processado, ignorando clique');
                return;
            }
            
            $(this).addClass('clicking');
            console.log('🃏 Card clicado!', this);
            
            const tabulacaoId = $(this).data('tabulacao-id');
            const agendamentoId = $(this).data('agendamento-id');
            
            console.log('📊 Dados do card:', { tabulacaoId, agendamentoId });
            
            if (tabulacaoId && agendamentoId) {
                carregarDetalhesCard(tabulacaoId, agendamentoId);
            } else {
                console.error('❌ Dados do card inválidos:', { tabulacaoId, agendamentoId });
                mostrarToast('Erro', 'Dados do card inválidos', 'error');
                $(this).removeClass('clicking');
            }
        });
        
        console.log('✅ Eventos dos cards configurados');
    }
    
    function carregarDetalhesCard(tabulacaoId, agendamentoId) {
        console.log('🔄 Carregando detalhes do card:', { tabulacaoId, agendamentoId });
        mostrarLoading(true);
        
        const params = {
            tabulacao_id: tabulacaoId,
            agendamento_id: agendamentoId
        };
        
        console.log('🌐 Fazendo requisição para detalhes:', '/siape/api/get/detalhes-card-kanban/', params);
        
        $.get('/siape/api/get/detalhes-card-kanban/', params)
            .done(function(response) {
                console.log('✅ Resposta da API de detalhes:', response);
                
                if (response.success) {
                    currentCardData = response.data;
                    currentCardData.tabulacao_id = tabulacaoId;
                    currentCardData.agendamento_id = agendamentoId;
                    currentCardData.tabulacao_status = response.data.tabulacao.status;
                    
                    console.log('📋 Renderizando modal com dados:', response.data);
                    renderizarDetalhesModal(response.data);
                    abrirModal('modal-detalhes-overlay');
                } else {
                    console.error('❌ Erro na resposta da API:', response.message);
                    mostrarToast('Erro', response.message || 'Erro ao carregar detalhes', 'error');
                }
            })
            .fail(function(xhr, status, error) {
                console.error('💥 Erro na requisição de detalhes:', { xhr, status, error });
                console.error('💥 Response Text:', xhr.responseText);
                mostrarToast('Erro', 'Erro de conexão ao carregar detalhes', 'error');
            })
            .always(function() {
                console.log('🔄 Finalizando carregamento de detalhes');
                mostrarLoading(false);
                // Remover a classe clicking de todos os cards
                $('.kanban-card').removeClass('clicking');
            });
    }
    
    function renderizarDetalhesModal(dados) {
        const { cliente, agendamento, tabulacao, telefones, documentos, historico, dados_negociacao, permissoes } = dados;
        
        const telefonesHtml = telefones.map(tel => 
            `<div class="detalhe-item">
                <span class="detalhe-label">${tel.tipo} ${tel.principal ? '(Principal)' : ''}</span>
                <span class="detalhe-valor">${tel.numero}</span>
            </div>`
        ).join('');
        
        const documentosHtml = documentos.map(doc => 
            `<div class="detalhe-item">
                <span class="detalhe-label">${doc.tipo_documento}</span>
                <span class="detalhe-valor">${doc.nome_documento}</span>
            </div>`
        ).join('');
        
        // Histórico só para superusers
        const historicoHtml = (permissoes && permissoes.pode_ver_historico) ? historico.map(hist => 
            `<div class="timeline-item">
                <div class="timeline-icon">
                    <i class="fas fa-exchange-alt"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">
                        ${hist.status_anterior || 'Inicial'} → ${hist.status_novo}
                    </div>
                    <div class="timeline-meta">
                        <i class="fas fa-calendar-alt"></i>
                        ${hist.data_alteracao}
                        <i class="fas fa-user"></i>
                        ${hist.usuario}
                    </div>
                    ${hist.observacoes ? `<div class="timeline-obs"><i class="fas fa-comment-dots"></i> ${hist.observacoes}</div>` : ''}
                </div>
            </div>`
        ).join('') : '';
        
        // Renderização dos arquivos de negociação para qualquer status que tenha arquivos
        let arquivosNegociacaoHtml = '';
        if (dados_negociacao && Array.isArray(dados_negociacao.arquivos) && dados_negociacao.arquivos.length > 0) {
            arquivosNegociacaoHtml = `
            <div class="secao-negociacao">
                <div class="detalhe-secao">
                    <h6 class="detalhe-titulo">
                        <i class="fas fa-paperclip"></i>
                        Arquivos da Negociação
                    </h6>
                    <div class="card-content-wrap">
                        ${dados_negociacao.arquivos.map(arq => `
                            <div class="detalhe-item">
                                <span class="detalhe-label">
                                    <i class="fas fa-file-alt"></i> ${arq.titulo_arquivo}
                                </span>
                                <span class="detalhe-valor">
                                    <a href="${arq.arquivo_url}" target="_blank" title="Visualizar arquivo">
                                        <i class="fas fa-external-link-alt"></i> Abrir
                                    </a>
                                    <span style="font-size:0.75em;color:#888;margin-left:8px;">${arq.tamanho_arquivo || ''}</span>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            `;
        }
        
        // Dados de negociação - exibir para qualquer status se tiver dados com TC
        const dadosNegociacaoHtml = (dados_negociacao && dados_negociacao.existe && dados_negociacao.tc > 0) ? `
            <div class="secao-negociacao">
                <div class="detalhe-secao">
                    <h6 class="detalhe-titulo">
                        <i class="fas fa-handshake"></i>
                        Dados da Negociação
                    </h6>
                    <div class="card-content-wrap">
                        ${dados_negociacao.banco_nome ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Banco</span>
                            <span class="detalhe-valor">${dados_negociacao.banco_nome}</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.valor_liberado > 0 ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Valor Liberado</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(dados_negociacao.valor_liberado)}</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.saldo_devedor > 0 ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Saldo Devedor</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(dados_negociacao.saldo_devedor)}</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.parcela_atual > 0 ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Parcela Atual</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(dados_negociacao.parcela_atual)}</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.parcela_nova > 0 ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Parcela Nova</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(dados_negociacao.parcela_nova)}</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.tc > 0 ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">TC</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(dados_negociacao.tc)}</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.troco > 0 ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Troco</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(dados_negociacao.troco)}</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.prazo_atual > 0 ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Prazo Atual</span>
                            <span class="detalhe-valor">${dados_negociacao.prazo_atual} meses</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.prazo_acordado > 0 ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Prazo Acordado</span>
                            <span class="detalhe-valor">${dados_negociacao.prazo_acordado} meses</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.descricao ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Descrição</span>
                            <span class="detalhe-valor">${dados_negociacao.descricao}</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.data_criacao ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Data de Criação</span>
                            <span class="detalhe-valor">${dados_negociacao.data_criacao}</span>
                        </div>
                        ` : ''}
                        ${dados_negociacao.data_ultima_modificacao ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Última Modificação</span>
                            <span class="detalhe-valor">${dados_negociacao.data_ultima_modificacao}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        ` : '';
        
        const modalContent = `
            <div class="cliente-detalhes">
                <!-- Dados do Cliente -->
                <div class="detalhe-secao">
                    <h6 class="detalhe-titulo">
                        <i class="fas fa-user"></i>
                        Dados do Cliente
                    </h6>
                    <div class="card-content-wrap">
                        <div class="detalhe-item">
                            <span class="detalhe-label">Nome</span>
                            <span class="detalhe-valor">${cliente.nome}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">CPF</span>
                            <span class="detalhe-valor">${cliente.cpf}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">UF</span>
                            <span class="detalhe-valor">${cliente.uf || 'N/A'}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Situação Funcional</span>
                            <span class="detalhe-valor">${cliente.situacao_funcional || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Dados Financeiros -->
                <div class="detalhe-secao">
                    <h6 class="detalhe-titulo">
                        <i class="fas fa-dollar-sign"></i>
                        Dados Financeiros
                    </h6>
                    <div class="card-content-wrap">
                        <div class="detalhe-item">
                            <span class="detalhe-label">Renda Bruta</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(cliente.renda_bruta)}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Saldo 5%</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(cliente.saldo_5)}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Saldo 35%</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(cliente.saldo_35)}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Total Saldo</span>
                            <span class="detalhe-valor valor-monetario">R$ ${formatarMoeda(cliente.total_saldo)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Agendamento -->
                <div class="detalhe-secao">
                    <h6 class="detalhe-titulo">
                        <i class="fas fa-calendar"></i>
                        Agendamento
                    </h6>
                    <div class="card-content-wrap">
                        <div class="detalhe-item">
                            <span class="detalhe-label">Data/Hora</span>
                            <span class="detalhe-valor">${agendamento.data} ${agendamento.hora}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Status</span>
                            <span class="detalhe-valor">${agendamento.status_nome}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Funcionário</span>
                            <span class="detalhe-valor">${agendamento.funcionario}</span>
                        </div>
                        ${agendamento.observacao ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Observação</span>
                            <span class="detalhe-valor">${agendamento.observacao}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Tabulação Atual -->
                <div class="detalhe-secao">
                    <h6 class="detalhe-titulo">
                        <i class="fas fa-tags"></i>
                        Tabulação Atual
                    </h6>
                    <div class="card-content-wrap">
                        <div class="detalhe-item">
                            <span class="detalhe-label">Status</span>
                            <span class="detalhe-valor">${tabulacao.status_nome}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Última Atualização</span>
                            <span class="detalhe-valor">${tabulacao.data_atualizacao}</span>
                        </div>
                        <div class="detalhe-item">
                            <span class="detalhe-label">Responsável</span>
                            <span class="detalhe-valor">${tabulacao.usuario_responsavel}</span>
                        </div>
                        ${tabulacao.observacoes ? `
                        <div class="detalhe-item">
                            <span class="detalhe-label">Observações</span>
                            <span class="detalhe-valor">${tabulacao.observacoes}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            ${dadosNegociacaoHtml}
            
            ${telefones.length > 0 ? `
            <div class="secao-telefones">
                <div class="detalhe-secao">
                    <h6 class="detalhe-titulo">
                        <i class="fas fa-phone"></i>
                        Telefones de Contato
                    </h6>
                    <div class="card-content-wrap">
                        ${telefonesHtml}
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${documentos.length > 0 ? `
            <div class="secao-documentos">
                <div class="detalhe-secao">
                    <h6 class="detalhe-titulo">
                        <i class="fas fa-file-alt"></i>
                        Documentos do Cliente
                    </h6>
                    <div class="card-content-wrap">
                        ${documentosHtml}
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${(permissoes && permissoes.pode_ver_historico && historico.length > 0) ? `
            <div class="secao-historico">
                <div class="detalhe-secao">
                    <h6 class="detalhe-titulo">
                        <i class="fas fa-history"></i>
                        Histórico de Tabulações
                    </h6>
                    <div class="historico-timeline">
                        ${historicoHtml}
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${arquivosNegociacaoHtml}
        `;
        
        $('#modal-detalhes-content').html(modalContent);
        $('#modalDetalhesCardLabel').html(`<i class="fas fa-user me-2"></i>Detalhes - ${cliente.nome}`);
    }
    
    function salvarAlteracoesTabulacao() {
        const novoStatus = $('#novo-status').val();
        const observacoes = $('#observacoes-edicao').val();
        const tabulacaoId = $('#tabulacao-id-edicao').val();
        
        if (!novoStatus) {
            mostrarToast('Aviso', 'Selecione um status', 'warning');
            return;
        }
        
        const dados = {
            tabulacao_id: tabulacaoId,
            novo_status: novoStatus,
            observacoes: observacoes
        };
        
        $.ajax({
            url: '/siape/api/post/mover-card-kanban/',
            method: 'POST',
            data: JSON.stringify(dados),
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': $('[name=csrfmiddlewaretoken]').val()
            }
        })
        .done(function(response) {
            if (response.success) {
                mostrarToast('Sucesso', 'Tabulação atualizada com sucesso!', 'success');
                fecharModal('modal-edicao-overlay', 'SALVAR TABULAÇÃO');
                carregarDadosKanban(); // Recarregar dados
            } else {
                mostrarToast('Erro', response.message || 'Erro ao atualizar tabulação', 'error');
            }
        })
        .fail(function() {
            mostrarToast('Erro', 'Erro de conexão ao atualizar tabulação', 'error');
        });
    }
    
    function atualizarEstatisticas(dados) {
        let totalCards = 0;
        
        Object.values(dados).forEach(coluna => {
            totalCards += coluna.cards.length;
        });
        
        $('#total-cards').text(totalCards);
    }
    
    function atualizarContadores() {
        $('.kanban-column').each(function() {
            const cards = $(this).find('.kanban-card').length;
            $(this).find('.column-count').text(cards);
        });
    }
    
    function atualizarLarguraScrollSuperior() {
        // Calcular largura total do kanban-board
        const kanbanBoard = $('#kanban-board');
        if (kanbanBoard.length) {
            const larguraTotal = kanbanBoard[0].scrollWidth;
            $('#kanban-scroll-top .scroll-content').css('width', larguraTotal + 'px');
        }
    }
    
    function ajustarAlturasColunas() {
        // Detectar se está em dispositivo móvel
        const isMobile = window.innerWidth <= 768;
        const maxCardsVisiveis = isMobile ? 4 : 5; // 4 cards em mobile, 5 em desktop
        
        $('.kanban-column').each(function() {
            const $coluna = $(this);
            const $containerCards = $coluna.find('.column-cards');
            const numeroCards = $coluna.find('.kanban-card').length;
            
            console.log(`Coluna ${$coluna.data('status')}: ${numeroCards} cards (Mobile: ${isMobile})`);
            
            // Remover classes anteriores
            $containerCards.removeClass('empty few-cards many-cards');
            
            if (numeroCards === 0) {
                // Se não tem cards, altura mínima
                $containerCards.addClass('empty');
                console.log(`Coluna ${$coluna.data('status')}: vazia - altura mínima`);
            } else if (numeroCards <= maxCardsVisiveis) {
                // Se tem até o máximo de cards, mostra todos sem scroll
                $containerCards.addClass('few-cards');
                console.log(`Coluna ${$coluna.data('status')}: ${numeroCards} cards (sem scroll)`);
            } else {
                // Se tem mais cards que o máximo, fixa altura e ativa scroll
                $containerCards.addClass('many-cards');
                console.log(`Coluna ${$coluna.data('status')}: ${numeroCards} cards (com scroll para ${numeroCards - maxCardsVisiveis} cards ocultos)`);
                
                // Garantir que o scroll está funcionando
                setTimeout(() => {
                    if ($containerCards[0].scrollHeight > $containerCards[0].clientHeight) {
                        console.log(`✅ Scroll ativado para coluna ${$coluna.data('status')} - Altura scroll: ${$containerCards[0].scrollHeight}px, Altura visível: ${$containerCards[0].clientHeight}px`);
                    }
                }, 100);
            }
        });
    }
    
    // ========== FUNÇÕES DE CONTROLE DE MODAIS ==========
    function abrirModal(modalId) {
        console.log('🔓 MODAL ABRINDO...', modalId);
        
        const modal = $('#' + modalId);
        if (modal.length) {
            // Verificar se o modal já está aberto
            if (modal.hasClass('show')) {
                console.log('⚠️ MODAL JÁ ESTÁ ABERTO:', modalId);
                return;
            }
            
            // Fechar outros modais se necessário
            $('.modal-overlay').not('#' + modalId).removeClass('show');
            
            modal.addClass('show');
            $('.crm-kanban-container').addClass('modal-open');
            console.log('✅ MODAL ABERTO COM SUCESSO:', modalId);
        } else {
            console.error('❌ MODAL NÃO ENCONTRADO:', modalId);
        }
    }
    
    function fecharModal(modalId, motivo = 'AÇÃO DO USUÁRIO') {
        console.log('🔒 MODAL FECHADO POR:', motivo, '- Modal ID:', modalId);
        
        const modal = $('#' + modalId);
        if (modal.length) {
            modal.removeClass('show');
            
            // Verificar se há outros modais abertos no Kanban
            if ($('.crm-kanban-container .modal-overlay.show').length === 0) {
                $('.crm-kanban-container').removeClass('modal-open');
            }
            console.log('✅ MODAL FECHADO COM SUCESSO:', modalId);
        } else {
            console.error('❌ MODAL NÃO ENCONTRADO PARA FECHAR:', modalId);
        }
    }
    
    function fecharTodosModais(motivo = 'FECHAMENTO GERAL') {
        console.log('🔒 MODAL FECHADO POR:', motivo, '- TODOS OS MODAIS');
        $('.modal-overlay').removeClass('show');
        $('.crm-kanban-container').removeClass('modal-open');
        console.log('✅ TODOS OS MODAIS FECHADOS COM SUCESSO');
    }
    
    // ========== FUNÇÕES UTILITÁRIAS ==========
    function verificarProximoHorario(dataHoraRaw) {
        if (!dataHoraRaw) return false;
        
        try {
            // Parse da data/hora de checagem
            const dataHoraChecagem = new Date(dataHoraRaw);
            const agora = new Date();
            
            // Calcular diferença em minutos
            const diferencaMs = dataHoraChecagem.getTime() - agora.getTime();
            const diferencaMinutos = Math.floor(diferencaMs / (1000 * 60));
            
            // Retorna true se a checagem está em até 30 minutos (e não passou)
            return diferencaMinutos >= 0 && diferencaMinutos <= 30;
        } catch (error) {
            console.error('Erro ao verificar proximidade do horário:', error);
            return false;
        }
    }
    
    function formatarMoeda(valor) {
        if (!valor || valor === 0) return '0,00';
        return parseFloat(valor).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    function formatarDataInput(data) {
        return data.toISOString().split('T')[0];
    }
    
    function getNomeStatus(status) {
        const nomes = {
            'SEM_RESPOSTA': 'Sem Resposta',
            'EM_NEGOCIACAO': 'Em Negociação',
            'REVERSAO': 'Reversão',
            'REVERTIDO': 'Revertido',
            'DESISTIU': 'Desistiu',
            'CHECAGEM': 'Checagem',
            'CHECAGEM_OK': 'Checagem OK',
            'ALTO_RISCO': 'Alto Risco',
            'CONCLUIDO_PG': 'Concluído PG'
        };
        return nomes[status] || status;
    }
    
    function mostrarLoading(mostrar) {
        if (mostrar) {
            $('#loading-overlay').show();
        } else {
            $('#loading-overlay').hide();
        }
    }
    
    function mostrarToast(titulo, mensagem, tipo = 'info') {
        const toastId = 'toast-' + Date.now();
        const icones = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle', 
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        
        const toastHtml = `
            <div id="${toastId}" class="toast-kanban toast-${tipo}">
                <div class="toast-header-kanban">
                    <div>
                        <i class="fas ${icones[tipo]} me-2"></i>
                        <strong>${titulo}</strong>
                    </div>
                    <button type="button" class="btn-close-toast" onclick="fecharToast('${toastId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="toast-body-kanban">
                    ${mensagem}
                </div>
            </div>
        `;
        
        $('#toast-container').append(toastHtml);
        
        // Mostrar toast
        setTimeout(() => {
            $('#' + toastId).addClass('show');
        }, 100);
        
        // Auto remover após 5 segundos
        setTimeout(() => {
            fecharToast(toastId);
        }, 5000);
    }
    
    function mostrarModalAlerta(titulo, mensagem, tipo = 'info') {
        const icones = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle', 
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };
        
        const modalHtml = `
            <div class="modal-overlay" id="modal-alerta-overlay">
                <div class="modal-kanban modal-medium">
                    <div class="modal-header-kanban">
                        <h5 class="modal-title-kanban">
                            <i class="fas ${icones[tipo]} me-2"></i>
                            ${titulo}
                        </h5>
                        <button type="button" class="btn-close-kanban" id="btn-close-alerta">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body-kanban">
                        <p class="mb-0">${mensagem}</p>
                    </div>
                    <div class="modal-footer-kanban">
                        <button type="button" class="btn btn-primary" id="btn-ok-alerta">
                            <i class="fas fa-check me-2"></i>Entendi
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal anterior se existir
        $('#modal-alerta-overlay').remove();
        
        // Adicionar novo modal
        $('body').append(modalHtml);
        
        // Configurar eventos do modal
        $('#btn-close-alerta, #btn-ok-alerta').click(function() {
            fecharModal('modal-alerta-overlay', 'BOTÃO FECHAR/OK');
        });
        
        // Abrir modal
        abrirModal('modal-alerta-overlay');
    }
    
    // Função global para fechar toast
    window.fecharToast = function(toastId) {
        const toast = $('#' + toastId);
        if (toast.length) {
            toast.removeClass('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    };
    
    function configurarPermissoes(permissoes) {
        // Se não pode ver todos, desabilitar/ocultar filtro de funcionário
        if (!permissoes.pode_filtrar_funcionario) {
            $('#funcionario-filtro').prop('disabled', true);
            $('#funcionario-filtro').closest('.filter-group').hide();
            
            // Adicionar indicador de visualização restrita
            const infoUsuario = permissoes.info_usuario || {};
            const cargoInfo = infoUsuario.cargo ? ` (${infoUsuario.cargo})` : '';
            
            const indicador = `
                <div class="alert alert-info mb-3" id="indicador-restricao">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Visualização Restrita:</strong> Você está vendo apenas seus próprios agendamentos${cargoInfo}
                </div>
            `;
            
            if ($('#indicador-restricao').length === 0) {
                $('.kanban-header').after(indicador);
            }
            
            // Remover indicador de acesso completo se existir
            $('#indicador-acesso-completo').remove();
        } else {
            // Remover restrições se existirem
            $('#funcionario-filtro').prop('disabled', false);
            $('#funcionario-filtro').closest('.filter-group').show();
            $('#indicador-restricao').remove();
            
            // Adicionar indicador de acesso completo
            const infoUsuario = permissoes.info_usuario || {};
            const cargoInfo = infoUsuario.cargo ? ` (${infoUsuario.cargo})` : '';
            const isSuperuser = infoUsuario.is_superuser ? ' - Superusuário' : '';
            
            const indicadorCompleto = `
                <div class="alert alert-success mb-3" id="indicador-acesso-completo">
                    <i class="fas fa-shield-alt me-2"></i>
                    <strong>Acesso Completo:</strong> Você pode visualizar todos os agendamentos${cargoInfo}${isSuperuser}
                </div>
            `;
            
            if ($('#indicador-acesso-completo').length === 0) {
                $('.kanban-header').after(indicadorCompleto);
            }
            
            // Remover indicador de restrição se existir
            $('#indicador-restricao').remove();
        }
        
        // Garantir que a hierarquia esteja disponível nas permissões
        if (permissoes.info_usuario && permissoes.info_usuario.hierarquia) {
            console.log('Hierarquia do usuário:', permissoes.info_usuario.hierarquia);
        }
        
        // Armazenar permissões globalmente para uso em outras funções
        window.kanbanPermissoes = permissoes;
        
        console.log('Permissões configuradas:', permissoes);
    }
}); 