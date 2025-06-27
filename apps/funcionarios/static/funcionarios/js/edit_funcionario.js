$(document).ready(function() {
    // --- Configuração ---
    const apiUrlGeral = '/rh/api/get/infogeral/';          // Corrigido prefixo /rh/
    const apiUrlFuncionarios = '/rh/api/get/infofuncionarios/'; // Corrigido prefixo /rh/
    const apiUrlGetFuncionario = '/rh/api/get/funcionario/'; // Corrigido prefixo /rh/
    const apiUrlEditFuncionario = '/rh/api/edit/funcionario/'; // Corrigido prefixo /rh/
    const apiUrlDeactivateFuncionario = '/rh/api/deactivate/funcionario/'; // Nova API
    const apiUrlGetComissao = '/rh/api/get/comissao/'; // API para buscar regras de comissão
    const apiUrlInfoGeralEmp = '/rh/api/get/infogeralemp/'; // API para buscar dados gerais (empresas, equipes, horários)
    const placeholderImg = '/static/img/profile_placeholder.png'; // Corrigido caminho da imagem

    // --- Elementos do DOM ---
    const $formFiltros = $('#form-filtros');
    const $filtroApelido = $('#filtro_apelido');
    const $filtroNome = $('#filtro_nome');
    const $filtroFuncao = $('#filtro_funcao');
    const $filtroSetor = $('#filtro_setor');
    const $filtroStatus = $('#filtro_status');
    const $filtroEquipe = $('#filtro_equipe');
    const $btnFiltrar = $('#btn-filtrar');
    const $tabelaResultadosBody = $('#tabelaResultadosBody');
    const $cardResultados = $('#card-resultados');
    const $cardEdicao = $('#card-edicao');
    const $formEdicao = $('#form-edicao');
    const $nomeFuncionarioEdicao = $('#nome-funcionario-edicao');
    const $btnCancelarEdicao = $('#btn-cancelar-edicao');
    const $fotoAtualPreview = $('#foto-atual-preview');
    const $fotoAtualNome = $('#foto-atual-nome');
    const $editFotoInput = $('#edit_foto');
    const $messageContainer = $('<div id="message-container" class="my-3"></div>');
    $cardResultados.before($messageContainer); // Insere container de msg antes dos resultados

    // Selects do Form Edição
    const $editEmpresaSelect = $('#edit_empresa');
    const $editLojaSelect = $('#edit_loja');
    const $editDepartamentoSelect = $('#edit_departamento');
    const $editSetorSelect = $('#edit_setor');
    const $editCargoSelect = $('#edit_cargo');
    const $editHorarioSelect = $('#edit_horario');
    const $editEquipeSelect = $('#edit_equipe');
    const $editTipoContratoSelect = $('#edit_tipo_contrato');
    const $editRegrasComissionamentoContainer = $('#edit_regras_comissionamento_container'); // Novo Container

    // Novos elementos para a seção de arquivos
    const $containerNovosArquivos = $('#container-novos-arquivos');
    const $btnAdicionarMaisArquivos = $('#btn-adicionar-mais-arquivos');
    const $listaArquivosExistentes = $('#lista-arquivos-existentes');
    const $semArquivosMsg = $('#sem-arquivos-msg');

    // Novo elemento para a área de arrastar e soltar
    const $dropArea = $('#drop-area');

    // Contador para IDs únicos de formulários de arquivo
    let contadorFormArquivos = 1;

    // Arrays para controlar arquivos
    let arquivosParaEnviar = [];
    let arquivosExistentes = [];

    // --- Cache de Dados ---
    let todosFuncionarios = [];
    let todosEmpresas = [];
    let todasLojas = [];
    let todosDepartamentos = [];
    let todosSetores = [];
    let todosCargos = [];
    let todosHorarios = [];
    let todasEquipes = [];
    let todasRegrasComissao = []; // Cache para regras de comissão
    let todosTiposContrato = []; // Novo cache

    // --- Funções Auxiliares ---

    // Obtém o token CSRF
    function getCsrfToken() {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Exibe mensagens
    function showMessage(type, message, container = $messageContainer) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        
        // Limpa timeout anterior se houver
        if (container.data('messageTimeout')) {
            clearTimeout(container.data('messageTimeout'));
        }
        
        container.html(`<div class="alert ${alertClass} alert-dismissible fade show" role="alert">
                            ${message}
                            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                         </div>`);
        
        // Auto-dismiss after 10 seconds (10000 ms)
        const timeoutId = setTimeout(() => {
            container.find('.alert').remove();
        }, 10000);
        
        // Armazena o ID do timeout no container
        container.data('messageTimeout', timeoutId);
    }

    // Limpa e reseta um select
    function resetSelect($select, defaultOptionText, disabled = true) {
        $select.empty().append(`<option value="">${defaultOptionText}</option>`).prop('disabled', disabled);
    }

    // Função genérica para popular um select
    function popularSelect($select, data, selectedValue = null) {
        if (!$select || !($select instanceof jQuery)) {
            console.error('Seletor inválido fornecido para popularSelect:', $select);
            return;
        }

        const selectId = $select.attr('id');
        console.log(`📝 Popularizando select: ${selectId}`);
        console.log('Dados recebidos:', data);
        console.log('Valor selecionado:', selectedValue);

        // Para selects de equipe, preserva opções especiais existentes
        if (selectId && (selectId.includes('equipe') || selectId.includes('Equipe'))) {
            popularSelectEquipes($select, data, selectedValue);
            return;
        }

        $select.empty();
        
        // Adiciona a opção padrão
        $select.append(new Option('--- Selecione ---', ''));
        
        // Verifica se data é um array ou um objeto com choices
        const items = Array.isArray(data) ? data : (data.choices || []);
        
        if (items && items.length > 0) {
            items.forEach(item => {
                // Garante que temos os campos necessários
                const value = item.value || item.id;
                // Usa nome_com_hierarquia se disponível, senão usa nome ou text
                let text = item.nome_com_hierarquia || item.display || item.nome || item.text;
                console.log(`Item sendo adicionado ao select ${selectId}:`, { value, text, item });
                
                if (value && text) {
                    // Converte o valor para string para garantir compatibilidade na comparação
                    const option = new Option(text, String(value));
                    $select.append(option);
                } else {
                    console.warn(`Item inválido encontrado no select ${selectId}:`, item);
                }
            });
            
            // Se houver um valor selecionado, tenta selecioná-lo
            if (selectedValue) {
                // Converte para string para garantir compatibilidade
                const strSelectedValue = String(selectedValue);
                console.log(`Tentando selecionar valor ${strSelectedValue} no select ${selectId}`);
                $select.val(strSelectedValue);
                
                // Verifica se o valor foi realmente selecionado
                if ($select.val() !== strSelectedValue) {
                    console.warn(`Valor ${strSelectedValue} não encontrado nas opções do select ${selectId}`);
                    // Verifica se existe alguma opção com o valor numérico
                    const numValue = parseInt(strSelectedValue, 10);
                    if (!isNaN(numValue)) {
                        $select.find('option').each(function() {
                            if (parseInt($(this).val(), 10) === numValue) {
                                $(this).prop('selected', true);
                                console.log(`Valor ${numValue} encontrado e selecionado como número no select ${selectId}`);
                                return false; // break
                            }
                        });
                    }
                }
            }
        } else {
            console.warn(`Nenhum item encontrado para popular o select ${selectId}`);
        }
    }

    // Função específica para popular selects de equipes preservando opções especiais
    function popularSelectEquipes($select, data, selectedValue = null) {
        const selectId = $select.attr('id');
        console.log(`🏆 Popularizando select de equipes: ${selectId}`);
        
        // Preserva opções especiais existentes (como "SEM EQUIPE")
        const opcoesEspeciais = [];
        $select.find('option').each(function() {
            const $option = $(this);
            const value = $option.val();
            const text = $option.text();
            
            // Identifica opções especiais (valores vazios, "sem_equipe", ou texto com "SEM", "NENHUMA", etc.)
            if (!value || value === 'sem_equipe' || 
                text.toUpperCase().includes('SEM EQUIPE') || 
                text.toUpperCase().includes('NENHUMA') ||
                text.toUpperCase().includes('SELECIONE') ||
                text.toUpperCase().includes('CARREGANDO')) {
                opcoesEspeciais.push({
                    value: value,
                    text: text,
                    selected: $option.is(':selected')
                });
            }
        });
        
        console.log(`Opções especiais preservadas para ${selectId}:`, opcoesEspeciais);
        
        // Limpa o select
        $select.empty();
        
        // Re-adiciona as opções especiais na ordem correta
        opcoesEspeciais.forEach(opcao => {
            const option = new Option(opcao.text, opcao.value);
            if (opcao.selected && !selectedValue) {
                option.selected = true;
            }
            $select.append(option);
        });
        
        // Se não há opção padrão e nenhuma opção especial foi preservada, adiciona uma
        if (opcoesEspeciais.length === 0) {
            $select.append(new Option('--- Nenhuma ---', ''));
        }
        
        // Verifica se data é um array ou um objeto com choices
        const items = Array.isArray(data) ? data : (data.choices || []);
        
        if (items && items.length > 0) {
            items.forEach(item => {
                // Garante que temos os campos necessários
                const value = item.value || item.id;
                let text = item.nome_com_hierarquia || item.display || item.nome || item.text;
                
                if (value && text) {
                    // Converte o valor para string para garantir compatibilidade na comparação
                    const option = new Option(text, String(value));
                    $select.append(option);
                } else {
                    console.warn(`Item inválido encontrado no select de equipes ${selectId}:`, item);
                }
            });
            
            // Se houver um valor selecionado, tenta selecioná-lo
            if (selectedValue) {
                // Converte para string para garantir compatibilidade
                const strSelectedValue = String(selectedValue);
                console.log(`Tentando selecionar valor ${strSelectedValue} no select de equipes ${selectId}`);
                $select.val(strSelectedValue);
                
                // Verifica se o valor foi realmente selecionado
                if ($select.val() !== strSelectedValue) {
                    console.warn(`Valor ${strSelectedValue} não encontrado nas opções do select de equipes ${selectId}`);
                    // Verifica se existe alguma opção com o valor numérico
                    const numValue = parseInt(strSelectedValue, 10);
                    if (!isNaN(numValue)) {
                        $select.find('option').each(function() {
                            if (parseInt($(this).val(), 10) === numValue) {
                                $(this).prop('selected', true);
                                console.log(`Valor ${numValue} encontrado e selecionado como número no select de equipes ${selectId}`);
                                return false; // break
                            }
                        });
                    }
                }
            }
        } else {
            console.warn(`Nenhum item encontrado para popular o select de equipes ${selectId}`);
        }
    }

    // Formato de tamanho de arquivo legível
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Truncar texto longo
    function truncateText(text, maxLength = 40) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    // Formatar data para exibição
    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    }

    // Obter a extensão do arquivo
    function getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
    }

    // Obter ícone baseado na extensão do arquivo
    function getFileIcon(filename) {
        const ext = getFileExtension(filename);
        
        // Mapeamento de extensões para ícones do BoxIcons
        const iconMap = {
            'pdf': 'bxs-file-pdf',
            'doc': 'bxs-file-doc',
            'docx': 'bxs-file-doc',
            'xls': 'bxs-file-xls',
            'xlsx': 'bxs-file-xls',
            'ppt': 'bxs-file-ppt',
            'pptx': 'bxs-file-ppt',
            'jpg': 'bxs-file-image',
            'jpeg': 'bxs-file-image',
            'png': 'bxs-file-image',
            'gif': 'bxs-file-gif',
            'zip': 'bxs-file-archive',
            'rar': 'bxs-file-archive',
            'txt': 'bxs-file-txt'
        };
        
        return iconMap[ext] || 'bxs-file';
    }

    // Nova função para popular checkboxes
    function popularCheckboxes($container, data, name, valueField, textField, checkedValues = []) {
        $container.empty(); // Limpa o container (remove "Carregando...")
        let hasOptions = false;
        // Converte checkedValues para um array de strings para comparação consistente
        const checkedValuesStr = Array.isArray(checkedValues) ? checkedValues.map(String) : [];

        if (data.length === 0) {
             $container.html('<p class="text-muted small m-0">Nenhuma regra de comissionamento encontrada.</p>');
             return;
        }

        data.forEach(item => {
            const value = item[valueField];
            const text = typeof textField === 'function' ? textField(item) : item[textField];
            const id = `${name}-${value}`;
            const isChecked = checkedValuesStr.includes(String(value));

            const $checkboxDiv = $(`
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="${name}" value="${value}" id="${id}" ${isChecked ? 'checked' : ''}>
                    <label class="form-check-label" for="${id}">
                        ${text}
                    </label>
                </div>
            `);
            $container.append($checkboxDiv);
            hasOptions = true;
        });
    }

    // --- Funções de Carregamento e Filtragem ---

    function carregarDadosIniciais() {
        console.log("🚀 Carregando dados iniciais...");
        $tabelaResultadosBody.html('<tr><td colspan="8" class="text-center"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Carregando dados...</td></tr>');

        // Carrega dados gerais (empresas, departamentos, setores, cargos)
        $.getJSON(apiUrlGeral)
            .done(function(data) {
                console.log("Dados gerais recebidos:", data);
                // Armazena os dados em cache
                todosEmpresas = data.empresas || [];
                todosDepartamentos = data.departamentos || [];
                todosSetores = data.setores || [];
                todosCargos = data.cargos || [];
                todosTiposContrato = data.tipo_contrato_choices || []; // Carrega os tipos de contrato
                
                // Extrai todas as lojas de todas as empresas
                todasLojas = [];
                if (data.empresas && data.empresas.length > 0) {
                    console.log('Processando lojas de', data.empresas.length, 'empresas');
                    data.empresas.forEach(empresa => {
                        console.log('Verificando lojas da empresa:', empresa.id, empresa.nome);
                        console.log('Lojas na empresa:', empresa.lojas ? empresa.lojas.length : 0);
                        
                        if (empresa.lojas && empresa.lojas.length > 0) {
                            console.log('Lojas encontradas para empresa', empresa.id, ':', empresa.lojas);
                            // Adiciona o ID da empresa a cada loja para facilitar o filtro
                            const lojasComEmpresa = empresa.lojas.map(loja => {
                                console.log('Processando loja:', loja.id, loja.nome);
                                return {
                                    ...loja,
                                    empresa_id: empresa.id
                                };
                            });
                            todasLojas = [...todasLojas, ...lojasComEmpresa];
                        } else {
                            console.log('Nenhuma loja encontrada para empresa', empresa.id);
                        }
                    });
                }
                console.log('Total de lojas carregadas:', todasLojas.length);
                console.log('Lojas carregadas:', todasLojas);
                
                // Popula os selects de edição com os dados recebidos
                popularSelect($editEmpresaSelect, todosEmpresas);
                
                // Popula os selects de filtro
                const $filtroEmpresa = $('#filtro_empresa');
                const $filtroDepartamento = $('#filtro_departamento');
                const $filtroSetor = $('#filtro_setor');
                const $filtroFuncao = $('#filtro_funcao');
                
                console.log("Populando selects de filtro...");
                if ($filtroEmpresa.length) {
                    console.log("Populando filtro de empresas");
                    popularSelect($filtroEmpresa, todosEmpresas);
                }
                if ($filtroDepartamento.length) {
                    console.log("Populando filtro de departamentos");
                    popularSelect($filtroDepartamento, todosDepartamentos);
                }
                if ($filtroSetor.length) {
                    console.log("Populando filtro de setores");
                    popularSelect($filtroSetor, todosSetores);
                }
                if ($filtroFuncao.length) {
                    console.log("Populando filtro de funções/cargos");
                    popularSelect($filtroFuncao, todosCargos);
                }
                
                // Popula o select de tipo de contrato no formulário de edição
                popularSelect($editTipoContratoSelect, todosTiposContrato);
                
                // Carrega equipes e horários
                $.getJSON(apiUrlInfoGeralEmp)
                    .done(function(dataGeral) {
                        console.log("Dados gerais recebidos:", dataGeral);
                        
                        // Processa equipes
                        todasEquipes = dataGeral.equipes || [];
                        popularSelect($editEquipeSelect, todasEquipes);
                        
                        // Popula o filtro de equipes
                        const $filtroEquipe = $('#filtro_equipe');
                        if ($filtroEquipe.length) {
                            console.log("Populando filtro de equipes");
                            popularSelect($filtroEquipe, todasEquipes);
                            // Adiciona a opção "SEM EQUIPE" após popular as equipes
                            $filtroEquipe.append(new Option('SEM EQUIPE', 'sem_equipe'));
                        }
                        
                        console.log("Select de equipes populado com sucesso.");
                        
                        // Processa horários (extrai de todas as empresas)
                        todosHorarios = [];
                        if (dataGeral.empresas && dataGeral.empresas.length > 0) {
                            // Extrai horários de todas as empresas e remove duplicados
                            const horarioIds = new Set();
                            dataGeral.empresas.forEach(empresa => {
                                if (empresa.horarios && empresa.horarios.length > 0) {
                                    empresa.horarios.forEach(horario => {
                                        if (!horarioIds.has(horario.id)) {
                                            horarioIds.add(horario.id);
                                            // Adiciona campo display para o select
                                            horario.display = `${horario.nome} (${horario.entrada || 'N/A'} - ${horario.saida || 'N/A'})`;
                                            todosHorarios.push(horario);
                                        }
                                    });
                                }
                            });
                        }
                        
                        // Popula o select de horários
                        popularSelect($editHorarioSelect, todosHorarios);
                        console.log("Select de horários populado com sucesso.");
                    })
                    .fail(function(jqXHR, textStatus, errorThrown) {
                        console.error("Erro ao carregar dados gerais (equipes e horários):", textStatus, errorThrown);
                    });
                
                // Carrega regras de comissionamento
                carregarRegrasComissionamento();
                
                console.log("Dados iniciais carregados e selects populados");
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                console.error("Erro ao carregar dados gerais:", textStatus, errorThrown);
                showMessage('error', 'Falha ao carregar dados necessários. Verifique a conexão ou contate o suporte.');
            });

        // Carrega dados para os cards
        carregarDadosCards();

        // Carrega lista de funcionários
        $.getJSON(apiUrlFuncionarios)
            .done(function(data) {
                console.log("Dados de funcionários recebidos:", data);
                // A API retorna um array diretamente, não um objeto com propriedade 'funcionarios'
                todosFuncionarios = Array.isArray(data) ? data : [];
                filtrarEAtualizarTabela();
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                console.error("Erro ao carregar funcionários:", textStatus, errorThrown);
                showMessage('error', 'Falha ao carregar lista de funcionários. Verifique a conexão ou contate o suporte.');
            });
    }

    // Função para carregar regras de comissionamento
    function carregarRegrasComissionamento() {
        console.log("Carregando regras de comissionamento...");
        $.getJSON(apiUrlGetComissao)
            .done(function(data) {
                console.log("Regras de comissionamento recebidas:", data);
                todasRegrasComissao = data.regras || [];
                
                console.log("Regras de comissionamento carregadas com sucesso.");
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                console.error("Erro ao carregar regras de comissionamento:", textStatus, errorThrown);
                showMessage('error', 'Falha ao carregar regras de comissionamento. Verifique a conexão ou contate o suporte.');
            });
    }

    function filtrarEAtualizarTabela() {
        console.log("Filtrando e atualizando tabela...");
        
        const filtros = {
            apelido: $filtroApelido.val().toLowerCase(),
            nome: $filtroNome.val().toLowerCase(),
            empresa: $('#filtro_empresa').val(),
            departamento: $('#filtro_departamento').val(),
            setor: $('#filtro_setor').val(),
            funcao: $('#filtro_funcao').val(),
            status: $('#filtro_status').val(),
            equipe: $('#filtro_equipe').val()
        };
        
        console.log("Filtros aplicados:", filtros);

        // Filtra os funcionários usando os dados em cache
        let funcionariosFiltrados = todosFuncionarios.filter(f => {
            // Filtro por apelido
            if (filtros.apelido && (!f.apelido || !f.apelido.toLowerCase().includes(filtros.apelido))) {
                return false;
            }
            
            // Filtro por nome
            if (filtros.nome && (!f.nome_completo || !f.nome_completo.toLowerCase().includes(filtros.nome))) {
                return false;
            }
            
            // Filtro por empresa
            if (filtros.empresa && f.empresa_id != filtros.empresa) {
                return false;
            }
            
            // Filtro por departamento
            if (filtros.departamento && f.departamento_id != filtros.departamento) {
                return false;
            }
            
            // Filtro por setor
            if (filtros.setor && f.setor_id != filtros.setor) {
                return false;
            }
            
            // Filtro por função
            if (filtros.funcao && f.cargo_id != filtros.funcao) {
                return false;
            }
            
            // Filtro por status
            if (filtros.status !== '') {
                const statusEsperado = (filtros.status === '1');
                if (f.status !== statusEsperado) {
                    return false;
                }
            }
            
            // Filtro por equipe
            if (filtros.equipe) {
                if (filtros.equipe === 'sem_equipe') {
                    // Mostra apenas funcionários sem equipe (equipe_id null ou undefined)
                    if (f.equipe_id) {
                        return false;
                    }
                } else {
                    // Mostra apenas funcionários da equipe específica
                    if (f.equipe_id != filtros.equipe) {
                        return false;
                    }
                }
            }
            
            return true;
        });
        
        console.log("Funcionários após filtragem:", funcionariosFiltrados);
        
        // Atualiza a tabela com os resultados filtrados
        popularTabelaResultados(funcionariosFiltrados);
        
        // Mostra o card de resultados
        $cardResultados.slideDown(400);
    }

    function popularTabelaResultados(funcionarios) {
        console.log("Populando tabela de resultados...");
        $tabelaResultadosBody.empty(); // Limpa a tabela

        if (funcionarios.length === 0) {
            $tabelaResultadosBody.html('<tr><td colspan="8" class="text-center text-muted">Nenhum funcionário encontrado com os filtros aplicados.</td></tr>');
            return;
        }

        const csrfToken = getCsrfToken(); // Obter o token CSRF uma vez para reutilizar

        funcionarios.forEach(f => {
            console.log("Processando funcionário:", f);
            const statusBadge = f.status ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-danger">Inativo</span>';
            const row = `
                <tr>
                    <td>${f.apelido || '-'}</td>
                    <td>${f.nome_completo}</td>
                    <td>${f.cpf || '-'}</td>
                    <td>${f.cargo_nome || '-'} (${f.departamento_nome || '-'})</td>
                    <td>${f.setor_nome || '-'}</td>
                    <td>${f.equipe_nome || '-'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-info btn-editar" data-id="${f.id}" title="Editar">
                            <i class='bx bx-edit'></i>
                        </button>
                    </td>
                </tr>
            `;
            $tabelaResultadosBody.append(row);
        });
        
        console.log("Tabela populada com sucesso!");
    }

    // --- Funções de Edição ---

    function handleEditarClick(funcionarioId) {
        console.log(`Editando funcionário ID: ${funcionarioId}`);
        showMessage('info', 'Carregando dados do funcionário...'); // Feedback visual
        
        // Esconde a tabela de resultados e mostra o card de edição
        $('#card-resultados').hide();
        $('#card-edicao').show();

        $.getJSON(`${apiUrlGetFuncionario}${funcionarioId}/`)
            .done(function(data) {
                console.log("Dados do funcionário recebidos:", data);
                popularFormEdicao(data);
                $messageContainer.empty(); // Limpa msg de carregamento
                
                // Rola a página até o card de edição
                $('html, body').animate({
                    scrollTop: $('#card-edicao').offset().top - 20
                }, 500);
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                console.error("Erro ao buscar dados do funcionário:", textStatus, errorThrown, jqXHR.responseText);
                showMessage('error', `Erro ao buscar dados do funcionário: ${jqXHR.responseJSON?.error || errorThrown}`);
                // Em caso de erro, volta a mostrar a tabela
                $('#card-edicao').hide();
                $('#card-resultados').show();
            });
    }

    function popularFormEdicao(funcionario) {
        console.log('Populando formulário com dados:', funcionario);

        // ID e dados básicos
        $('#edit_funcionario_id').val(funcionario.id || '');
        $('#edit_apelido').val(funcionario.apelido || '');
        $('#edit_nome_completo').val(funcionario.nome_completo || '');
        $('#edit_cpf').val(funcionario.cpf || '');
        $('#edit_matricula').val(funcionario.matricula || '');
        $('#edit_pis').val(funcionario.pis || '');
        
        // Tipo de Contrato
        console.log('Populando tipo_contrato:', funcionario.tipo_contrato);
        $('#edit_tipo_contrato').val(funcionario.tipo_contrato || '');
        
        // Dados pessoais
        $('#edit_data_nascimento').val(funcionario.data_nascimento || '');
        $('#edit_genero').val(funcionario.genero || '');
        $('#edit_estado_civil').val(funcionario.estado_civil || '');
        $('#edit_nome_mae').val(funcionario.nome_mae || '');
        $('#edit_nome_pai').val(funcionario.nome_pai || '');
        $('#edit_nacionalidade').val(funcionario.nacionalidade || '');
        $('#edit_naturalidade').val(funcionario.naturalidade || '');
        
        // Contato
        $('#edit_celular1').val(funcionario.celular1 || '');
        $('#edit_celular2').val(funcionario.celular2 || '');
        
        // Endereço
        $('#edit_cep').val(funcionario.cep || '');
        $('#edit_endereco').val(funcionario.endereco || '');
        $('#edit_bairro').val(funcionario.bairro || '');
        $('#edit_cidade').val(funcionario.cidade || '');
        $('#edit_estado').val(funcionario.estado || '');

        // Foto
        if (funcionario.foto_url) {
            $('#foto-atual-preview').attr('src', funcionario.foto_url).show();
        } else {
            $('#foto-atual-preview').hide();
        }

        // Primeiro popula o select de empresa
        console.log('Populando empresa:', funcionario.empresa_id);
        popularSelect($('#edit_empresa'), todosEmpresas, funcionario.empresa_id);

        // Aguarda o carregamento da empresa para continuar
        setTimeout(function() {
            // Popula departamentos e cargos
            console.log('Carregando departamentos e cargos...');
            popularEditDepartamentosCargos(
                funcionario.empresa_id,
                funcionario.departamento_id,
                funcionario.cargo_id
            );

            // Popula horário e equipe
            console.log('Selecionando horário:', funcionario.horario_id);
            $('#edit_horario').val(funcionario.horario_id || '');
            console.log('Selecionando equipe:', funcionario.equipe_id);
            $('#edit_equipe').val(funcionario.equipe_id || '');

            // Aguarda o carregamento dos departamentos para carregar setores
            setTimeout(function() {
                console.log('Carregando setores para departamento:', funcionario.departamento_id);
                popularEditSetores(funcionario.departamento_id, funcionario.setor_id);
            }, 300);
        }, 300);

        // Lojas (checkboxes)
        console.log('Carregando lojas...');
        const lojasIds = (funcionario.lojas || []).map(l => l.id);
        popularEditLojas(funcionario.empresa_id, lojasIds);

        // Regras de comissionamento
        console.log('Carregando regras de comissionamento...');
        const regrasIds = (funcionario.regras_comissionamento || []).map(r => r.id);
        popularCheckboxes(
            $('#edit_regras_comissionamento_container'),
            todasRegrasComissao,
            'regras_comissionamento',
            'id',
            'titulo',
            regrasIds
        );

        // Datas
        $('#edit_data_admissao').val(funcionario.data_admissao || '');
        $('#edit_data_demissao').val(funcionario.data_demissao || '');

        // Atualiza o nome no cabeçalho
        $('#nome-funcionario-edicao').text(funcionario.nome_completo || 'Funcionário');

        // Status (checkbox)
        $('#edit_status').prop('checked', !!funcionario.status);

        // Carrega arquivos existentes
        if (funcionario.arquivos) {
            carregarArquivosExistentes(funcionario.arquivos);
        } else {
            carregarArquivosExistentes([]);
        }

        // Exibe o formulário
        $('#form-edicao').show();
        $('#card-edicao').show();
        $('#card-resultados').hide();

        // Log de verificação
        console.log('Formulário populado com sucesso');
        console.log('Campos preenchidos:', {
            id: $('#edit_funcionario_id').val(),
            apelido: $('#edit_apelido').val(),
            nome_completo: $('#edit_nome_completo').val(),
            cpf: $('#edit_cpf').val(),
            matricula: $('#edit_matricula').val(),
            pis: $('#edit_pis').val(),
            tipo_contrato: $('#edit_tipo_contrato').val(),
            data_nascimento: $('#edit_data_nascimento').val(),
            genero: $('#edit_genero').val(),
            estado_civil: $('#edit_estado_civil').val(),
            nome_mae: $('#edit_nome_mae').val(),
            nome_pai: $('#edit_nome_pai').val(),
            nacionalidade: $('#edit_nacionalidade').val(),
            naturalidade: $('#edit_naturalidade').val(),
            celular1: $('#edit_celular1').val(),
            celular2: $('#edit_celular2').val(),
            cep: $('#edit_cep').val(),
            endereco: $('#edit_endereco').val(),
            bairro: $('#edit_bairro').val(),
            cidade: $('#edit_cidade').val(),
            estado: $('#edit_estado').val(),
            empresa: $('#edit_empresa').val(),
            departamento: $('#edit_departamento').val(),
            setor: $('#edit_setor').val(),
            cargo: $('#edit_cargo').val(),
            horario: $('#edit_horario').val(),
            equipe: $('#edit_equipe').val(),
            data_admissao: $('#edit_data_admissao').val(),
            data_demissao: $('#edit_data_demissao').val(),
            status: $('#edit_status').prop('checked')
        });
    }

    // Popula Departamentos e Cargos no form de edição
    function popularEditDepartamentosCargos(empresaId, selectedDepartamentoId = null, selectedCargoId = null) {
        console.log('Populando departamentos e cargos para empresa:', empresaId);
        console.log('Departamento selecionado:', selectedDepartamentoId);
        console.log('Cargo selecionado:', selectedCargoId);
        
        resetSelect($editDepartamentoSelect, '--- Carregando Departamentos ---', false);
        resetSelect($editCargoSelect, '--- Carregando Cargos ---', false);
        resetSelect($editSetorSelect, '--- Selecione o Departamento ---', true);

        if (!empresaId) {
            console.warn('Nenhuma empresa selecionada');
            resetSelect($editDepartamentoSelect, '--- Selecione a Empresa ---', true);
            resetSelect($editCargoSelect, '--- Selecione a Empresa ---', true);
            return;
        }

        // Filtra departamentos da empresa
        const deptsFiltrados = todosDepartamentos.filter(d => d.empresa_id == empresaId);
        console.log('Departamentos filtrados:', deptsFiltrados);
        
        if (deptsFiltrados.length === 0) {
            console.warn('Nenhum departamento encontrado para a empresa:', empresaId);
            resetSelect($editDepartamentoSelect, '--- Nenhum Departamento Encontrado ---', true);
        } else {
            popularSelect($editDepartamentoSelect, deptsFiltrados, selectedDepartamentoId);
        }

        // Filtra cargos da empresa
        const cargosFiltrados = todosCargos.filter(c => c.empresa_id == empresaId);
        console.log('Cargos filtrados:', cargosFiltrados);
        
        if (cargosFiltrados.length === 0) {
            console.warn('Nenhum cargo encontrado para a empresa:', empresaId);
            resetSelect($editCargoSelect, '--- Nenhum Cargo Encontrado ---', true);
        } else {
            popularSelect($editCargoSelect, cargosFiltrados, selectedCargoId);
        }

        // Se um departamento foi pré-selecionado, dispara o change dele também para carregar setores
        if (selectedDepartamentoId) {
            setTimeout(() => {
                console.log('Disparando change do departamento para carregar setores');
                $editDepartamentoSelect.trigger('editFormDepartamentoChange');
            }, 50);
        }

        // Log de verificação
        console.log('Departamentos e cargos populados:', {
            departamento_selecionado: $editDepartamentoSelect.val(),
            cargo_selecionado: $editCargoSelect.val(),
            departamentos_disponiveis: deptsFiltrados.length,
            cargos_disponiveis: cargosFiltrados.length
        });
    }

    // Popula Setores no form de edição
    function popularEditSetores(departamentoId, selectedSetorId = null) {
        console.log('Populando setores para departamento:', departamentoId);
        console.log('Setor selecionado:', selectedSetorId);
        
        resetSelect($editSetorSelect, '--- Carregando Setores ---', false);

        if (!departamentoId) {
            console.warn('Nenhum departamento selecionado');
            resetSelect($editSetorSelect, '--- Selecione o Departamento ---', true);
            return;
        }

        // Filtra setores do departamento
        const setoresFiltrados = todosSetores.filter(s => s.departamento_id == departamentoId);
        console.log('Setores filtrados:', setoresFiltrados);
        
        if (setoresFiltrados.length === 0) {
            console.warn('Nenhum setor encontrado para o departamento:', departamentoId);
            resetSelect($editSetorSelect, '--- Nenhum Setor Encontrado ---', true);
        } else {
            popularSelect($editSetorSelect, setoresFiltrados, selectedSetorId);
        }

        // Log de verificação
        console.log('Setores populados:', {
            setor_selecionado: $editSetorSelect.val(),
            setores_disponiveis: setoresFiltrados.length
        });
    }

    // Popula Lojas no form de edição
    function popularEditLojas(empresaId, selectedLojasIds = []) {
        console.log('Populando lojas para empresa:', empresaId);
        console.log('Lojas selecionadas:', selectedLojasIds);
        
        const $container = $('#edit_lojas_container');
        $container.empty();

        if (!empresaId) {
            console.warn('Nenhuma empresa selecionada');
            $container.html('<div class="alert alert-warning">Selecione uma empresa primeiro</div>');
            return;
        }
        
        // Busca diretamente da API para garantir que temos os dados mais recentes
        console.log('Buscando lojas diretamente da API infogeralemp...');
        $.getJSON(apiUrlInfoGeralEmp)
            .done(function(data) {
                console.log('Dados recebidos da API:', data);
                
                // Procura a empresa específica
                let lojasDaEmpresa = [];
                if (data.empresas && data.empresas.length > 0) {
                    // Encontra a empresa pelo ID
                    const empresa = data.empresas.find(e => String(e.id) === String(empresaId));
                    
                    if (empresa && empresa.lojas && empresa.lojas.length > 0) {
                        console.log(`Encontrou empresa ${empresaId} com ${empresa.lojas.length} lojas:`, empresa.lojas);
                        lojasDaEmpresa = empresa.lojas.map(loja => ({
                            ...loja,
                            empresa_id: empresa.id
                        }));
                    } else {
                        console.warn(`Empresa ${empresaId} não encontrada ou sem lojas`);
                    }
                }
                
                // Atualiza o cache global de lojas
                if (lojasDaEmpresa.length > 0) {
                    // Adiciona apenas as lojas desta empresa (substitui se já existirem)
                    const lojasDeOutrasEmpresas = todasLojas.filter(l => String(l.empresa_id) !== String(empresaId));
                    todasLojas = [...lojasDeOutrasEmpresas, ...lojasDaEmpresa];
                }
                
                console.log(`Lojas encontradas para empresa ${empresaId}:`, lojasDaEmpresa);
                
                // Exibe as lojas
                if (lojasDaEmpresa.length === 0) {
                    console.warn('Nenhuma loja encontrada para a empresa:', empresaId);
                    $container.html('<div class="alert alert-warning">Nenhuma loja encontrada para esta empresa</div>');
                    return;
                }
                
                // Cria os checkboxes
                lojasDaEmpresa.forEach(loja => {
                    console.log('Criando checkbox para loja:', loja.id, loja.nome);
                    
                    // Converte para string para garantir compatibilidade na comparação
                    const lojaId = String(loja.id);
                    const isChecked = Array.isArray(selectedLojasIds) && 
                                      selectedLojasIds.some(id => String(id) === lojaId);
                    
                    console.log(`Loja ${lojaId} (${loja.nome}) selecionada:`, isChecked);
                    
                    const $div = $('<div class="form-check">');
                    const $input = $('<input>', {
                        type: 'checkbox',
                        class: 'form-check-input loja-checkbox',
                        id: `edit_loja_${lojaId}`,
                        name: 'edit_lojas',
                        value: lojaId,
                        checked: isChecked
                    });
                    
                    const $label = $('<label>', {
                        class: 'form-check-label',
                        for: `edit_loja_${lojaId}`,
                        text: loja.nome
                    });
                    
                    $div.append($input).append($label);
                    $container.append($div);
                });
                
                console.log('Checkboxes de lojas criados com sucesso!');
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                console.error('Erro ao carregar lojas:', textStatus, errorThrown);
                $container.html('<div class="alert alert-danger">Erro ao carregar lojas. Tente novamente.</div>');
            });
    }
    
    // Função para obter as lojas associadas a um funcionário
    function obterLojasDoFuncionario(funcionarioId) {
        // Esta função pode ser expandida no futuro para buscar as lojas associadas a um funcionário
        // Por enquanto, retorna um array vazio
        return [];
    }

    // Função para enviar o formulário de edição
    function enviarFormularioEdicao() {
        console.log('[EDITFUNC] Iniciando envio do formulário de edição');
        const formData = new FormData();
        
        // Adiciona o ID do funcionário primeiro
        const funcionarioId = $('#edit_funcionario_id').val();
        if (!funcionarioId) {
            console.error('[EDITFUNC] Erro: ID do funcionário não encontrado');
            showMessage('error', 'Erro: ID do funcionário não encontrado.');
            return;
        }
        formData.append('funcionario_id', funcionarioId);
        console.log('[EDITFUNC] ID do funcionário adicionado:', funcionarioId);
        
        // Adiciona todos os campos do formulário
        $('#form-edicao').serializeArray().forEach(item => {
            formData.append(item.name, item.value);
        });
        console.log('[EDITFUNC] Campos do formulário adicionados');
        
        // Adiciona as lojas selecionadas
        const lojasSelecionadas = [];
        $('.loja-checkbox:checked').each(function() {
            lojasSelecionadas.push($(this).val());
        });
        lojasSelecionadas.forEach(lojaId => {
            formData.append('edit_lojas', lojaId);
        });
        console.log('[EDITFUNC] Lojas selecionadas:', lojasSelecionadas);
        
        // Adiciona a foto se houver
        const fotoInput = $('#edit_foto')[0];
        if (fotoInput && fotoInput.files.length > 0) {
            formData.append('foto', fotoInput.files[0]);
            console.log('[EDITFUNC] Nova foto adicionada');
        }
        
        // Adiciona os arquivos
        $('.arquivo-form').each(function(index) {
            const titulo = $(this).find('.input-arquivo-titulo').val();
            const descricao = $(this).find('.input-arquivo-descricao').val();
            const arquivo = $(this).find('.input-arquivo-file')[0].files[0];
            
            if (titulo && arquivo) {
                formData.append('arquivo_titulos[]', titulo);
                formData.append('arquivo_descricoes[]', descricao || '');
                formData.append('arquivo_files[]', arquivo);
                console.log(`[EDITFUNC] Arquivo ${index} adicionado:`, titulo);
            }
        });

        // Adiciona o status manualmente (checkbox)
        formData.append('status', $('#edit_status').is(':checked') ? 'on' : 'off');

        // Log para debug
        console.log('[EDITFUNC] Dados do funcionário preparados:', {
            funcionario_id: funcionarioId,
            lojas_selecionadas: lojasSelecionadas
        });

        // Envia o formulário
        console.log('[EDITFUNC] Iniciando requisição AJAX');
        $.ajax({
            url: '/rh/api/edit/funcionario/',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-CSRFToken': $('input[name="csrfmiddlewaretoken"]').val()
            },
            success: function(response) {
                console.log('[EDITFUNC] Funcionário atualizado com sucesso');
                showMessage('success', 'Funcionário atualizado com sucesso!');
                setTimeout(() => {
                    console.log('[EDITFUNC] Recarregando página');
                    location.reload();
                }, 2000);
            },
            error: function(xhr) {
                console.error('[EDITFUNC] Erro ao atualizar funcionário:', xhr);
                const error = xhr.responseJSON?.error || 'Erro ao atualizar funcionário';
                showMessage('error', error);
            }
        });
    }

    function handleCancelarClick() {
        console.log('[EDITFUNC] Cancelando edição');
        $cardEdicao.slideUp(400, function() {
            // Atualiza a tabela antes de mostrar
            filtrarEAtualizarTabela();
            // Mostra a tabela com animação
            $cardResultados.slideDown(400);
            // Rola a página até a tabela de resultados
            $('html, body').animate({
                scrollTop: $cardResultados.offset().top - 20
            }, 500);
        });
    }

    // Função para atualizar a tabela de resultados
    function atualizarTabelaResultados() {
        console.log('[EDITFUNC] Atualizando tabela de resultados');
        filtrarEAtualizarTabela();
        $cardResultados.show();
    }

    // --- Event Listeners ---

    // Filtragem em tempo real nos inputs de texto
    $filtroApelido.on('input', filtrarEAtualizarTabela);
    $filtroNome.on('input', filtrarEAtualizarTabela);

    // Filtragem em tempo real nos selects
    $('#filtro_empresa').on('change', function() {
        const empresaId = $(this).val();
        console.log("Empresa selecionada:", empresaId);
        
        // Filtra departamentos e setores pela empresa selecionada
        const departamentosFiltrados = todosDepartamentos.filter(d => d.empresa_id == empresaId);
        const setoresFiltrados = todosSetores.filter(s => s.empresa_id == empresaId);
        
        console.log("Departamentos filtrados:", departamentosFiltrados);
        console.log("Setores filtrados:", setoresFiltrados);
        
        // Atualiza os selects
        popularSelect($('#filtro_departamento'), departamentosFiltrados, 'id', 'nome', 'Todos os Departamentos', false);
        popularSelect($('#filtro_setor'), setoresFiltrados, 'id', 'nome', 'Todos os Setores', false);
        
        // Reseta os selects dependentes
        $('#filtro_funcao').val('');
        
        // Atualiza a tabela
        filtrarEAtualizarTabela();
    });

    $('#filtro_departamento').on('change', function() {
        const departamentoId = $(this).val();
        console.log("Departamento selecionado:", departamentoId);
        
        // Filtra setores pelo departamento selecionado
        const setoresFiltrados = todosSetores.filter(s => s.departamento_id == departamentoId);
        
        console.log("Setores filtrados:", setoresFiltrados);
        
        // Atualiza o select de setores
        popularSelect($('#filtro_setor'), setoresFiltrados, 'id', 'nome', 'Todos os Setores', false);
        
        // Atualiza a tabela
        filtrarEAtualizarTabela();
    });

    // Filtragem em tempo real nos outros selects
    $('#filtro_setor').on('change', filtrarEAtualizarTabela);
    $('#filtro_funcao').on('change', filtrarEAtualizarTabela);
    $('#filtro_status').on('change', filtrarEAtualizarTabela);
    $('#filtro_equipe').on('change', filtrarEAtualizarTabela);

    // Prevenir submit do form de filtros (ele só atualiza a tabela via JS)
    $formFiltros.submit(function(e) { e.preventDefault(); });

    // Delegação de evento para o botão Editar na tabela
    $tabelaResultadosBody.on('click', '.btn-editar', function() {
        const funcionarioId = $(this).data('id');
        handleEditarClick(funcionarioId);
    });

    // Listeners para selects dependentes NO FORMULÁRIO DE EDIÇÃO
    // Removidos parâmetros de pré-seleção, a seleção é feita diretamente em popularFormEdicao
    $editEmpresaSelect.on('change editFormEmpresaChange', function(event) {
        const empresaId = $(this).val();
        console.log("Event: Empresa Changed/Triggered. Loading dependents for Empresa ID:", empresaId);
        popularEditLojas(empresaId); // Popula Loja SEM pré-seleção aqui
        popularEditDepartamentosCargos(empresaId); // Popula Depto e Cargo SEM pré-seleção aqui
        resetSelect($editSetorSelect, '--- Selecione o Departamento ---', true); // Reseta setor ao mudar empresa
    });

    $editDepartamentoSelect.on('change editFormDepartamentoChange', function(event) {
        const departamentoId = $(this).val();
         console.log("Event: Departamento Changed/Triggered. Loading Setores for Depto ID:", departamentoId);
        popularEditSetores(departamentoId); // Popula Setor SEM pré-seleção aqui
    });

    // Submissão do formulário de edição
    $formEdicao.submit(enviarFormularioEdicao);

    // Botão Cancelar Edição
    $btnCancelarEdicao.click(handleCancelarClick);

    // Listeners para a seção de arquivos
    $btnAdicionarMaisArquivos.on('click', adicionarFormularioArquivo);
    
    // Remover validação quando o usuário corrige o campo
    $(document).on('input', '.input-arquivo-titulo, .input-arquivo-file', function() {
        $(this).removeClass('is-invalid');
    });

    // --- Event Listeners para Arrastar e Soltar ---
    if ($dropArea.length) {
        // Prevenir comportamentos padrão
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            $dropArea.on(eventName, function(e) {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Adicionar classe de destaque ao arrastar sobre
        ['dragenter', 'dragover'].forEach(eventName => {
            $dropArea.on(eventName, function() {
                $dropArea.addClass('highlight');
            });
        });

        // Remover classe de destaque ao sair ou soltar
        ['dragleave', 'drop'].forEach(eventName => {
            $dropArea.on(eventName, function() {
                $dropArea.removeClass('highlight');
            });
        });

        // Lidar com o evento de soltar arquivos
        $dropArea.on('drop', function(e) {
            const dt = e.originalEvent.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                console.log(`${files.length} arquivo(s) solto(s).`);
                Array.from(files).forEach(file => {
                    adicionarFormularioArquivo(file); // Passa o arquivo para a função
                });
            }
        });
    }

    // --- Inicialização ---
    carregarDadosIniciais();
    $cardEdicao.hide(); // Garante que o card de edição começa oculto
    $cardResultados.hide(); // Esconde resultados até carregar dados

    // Aplica máscaras (se usar jQuery Mask Plugin)
    if ($.fn.mask) {
        $('#edit_cpf').mask('000.000.000-00');
        $('#edit_cep').mask('00000-000');
        $('#edit_celular1').mask('(00) 00000-0000');
    } else {
        console.warn('jQuery Mask Plugin não encontrado. Máscaras não aplicadas.');
    }

    // Função para carregar dados dos cards (funcionários ativos e inativos)
    function carregarDadosCards() {
        console.log("Carregando dados dos cards de funcionários...");
        
        // URL da API que retorna as quantidades
        const apiUrlCards = '/rh/api/get/infocardsnovo/';
        
        // Requisição AJAX para obter os dados
        $.ajax({
            url: apiUrlCards,
            type: 'GET',
            success: function(response) {
                console.log("Dados dos cards recebidos:", response);
                
                // Atualiza o card de funcionários ativos
                const $cardAtivos = $('.dashboard-card.border-success .card-body p');
                $cardAtivos.text(response.qtd_ativos || 0);
                
                // Atualiza o card de funcionários inativos
                const $cardInativos = $('.dashboard-card.border-danger .card-body p');
                $cardInativos.text(response.qtd_inativos || 0);
                
                console.log("Cards atualizados com sucesso.");
            },
            error: function(xhr, status, error) {
                console.error("Erro ao carregar dados dos cards:", error);
                // Não exibe mensagem de erro para o usuário para não interromper a experiência
            }
        });
    }

    // --- Funções para gerenciamento de arquivos ---

    // Carregar arquivos existentes do funcionário
    function carregarArquivosExistentes(arquivos) {
        $listaArquivosExistentes.empty();
        
        if (!arquivos || arquivos.length === 0) {
            $semArquivosMsg.show();
            return;
        }
        
        $semArquivosMsg.hide();
        
        arquivos.forEach(arquivo => {
            const iconClass = getFileIcon(arquivo.nome_arquivo);
            const $item = $(`
              <div class="arquivo-item">
                <div class="arquivo-info">
                  <div class="arquivo-titulo">${arquivo.titulo}</div>
                  <a href="${arquivo.download_url}" class="arquivo-nome-link" download>
                    <i class='bx ${iconClass} me-1'></i>
                    ${arquivo.nome_arquivo}
                  </a>
                  ${arquivo.descricao ? `<div class="arquivo-descricao">${arquivo.descricao}</div>` : ''}
                  <div class="arquivo-data">Enviado em: ${formatDate(arquivo.data_upload)}</div>
                </div>
              </div>
            `);
            $listaArquivosExistentes.append($item);
        });
    }

    // Adicionar novo formulário de arquivo
    // Modificada para aceitar um arquivo pré-selecionado (para o drag and drop)
    function adicionarFormularioArquivo(arquivoPreSelecionado = null) {
        const novoId = contadorFormArquivos++;
        
        const $novoFormulario = $(`
            <div class="arquivo-form mb-3" id="arquivo-form-${novoId}">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label">Título do Arquivo *</label>
                        <input type="text" class="form-control input-arquivo-titulo" name="arquivo_titulos[]" placeholder="Título do arquivo (obrigatório)" required>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Descrição</label>
                        <input type="text" class="form-control input-arquivo-descricao" name="arquivo_descricoes[]" placeholder="Descrição (opcional)">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Arquivo *</label>
                        <div class="input-group">
                            <input type="file" class="form-control input-arquivo-file" name="arquivo_files[]" required>
                            <button type="button" class="btn btn-danger btn-remover-arquivo" data-form-id="${novoId}">
                                <i class='bx bx-trash'></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        
        // Adicionar evento para o botão remover
        $novoFormulario.find('.btn-remover-arquivo').on('click', function() {
            const formId = $(this).data('form-id');
            $(`#arquivo-form-${formId}`).remove();
        });
        
        $containerNovosArquivos.append($novoFormulario);

        // Se um arquivo foi pré-selecionado (do drag and drop), atribui-o ao input
        if (arquivoPreSelecionado) {
            const $fileInput = $novoFormulario.find('.input-arquivo-file');
            if ($fileInput.length > 0 && $fileInput[0].files) {
                // Criar um DataTransfer para simular a seleção do arquivo
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(arquivoPreSelecionado);
                $fileInput[0].files = dataTransfer.files;

                // Opcional: disparar um evento 'change' se necessário para alguma lógica de UI
                // $fileInput.trigger('change');
                console.log(`Arquivo '${arquivoPreSelecionado.name}' atribuído ao novo formulário de arquivo.`);
            }
        }
        
        // Dar foco ao campo de título do novo formulário
        $novoFormulario.find('.input-arquivo-titulo').focus();
    }

    // Função para carregar dados do funcionário
    function carregarDadosFuncionario(funcionarioId) {
        console.log('🔄 Carregando dados do funcionário:', funcionarioId);
        
        $.ajax({
            url: `/rh/api/get/funcionario/${funcionarioId}/`,
            method: 'GET',
            success: function(response) {
                console.log('✅ Dados recebidos da API:', response);
                
                // Verifica se todos os campos necessários estão presentes
                const camposObrigatorios = [
                    'id', 'nome_completo', 'apelido', 'cpf', 'matricula', 'pis',
                    'data_nascimento', 'genero', 'estado_civil',
                    'celular1', 'celular2',
                    'cep', 'endereco', 'bairro', 'cidade', 'estado',
                    'nome_mae', 'nome_pai', 'nacionalidade', 'naturalidade',
                    'empresa_id', 'departamento_id', 'setor_id', 'cargo_id',
                    'horario_id', 'equipe_id', 'status',
                    'data_admissao', 'data_demissao'
                ];
                
                const camposFaltantes = camposObrigatorios.filter(campo => !(campo in response));
                if (camposFaltantes.length > 0) {
                    console.warn('⚠️ Campos faltando na resposta:', camposFaltantes);
                }
                
                // Popula o formulário com os dados
                popularFormEdicao(response);
                
                // Exibe o modal de edição
                $('#modalEditarFuncionario').modal('show');
            },
            error: function(xhr, status, error) {
                console.error('❌ Erro ao carregar dados do funcionário:', {
                    status: status,
                    error: error,
                    response: xhr.responseText
                });
                
                // Exibe mensagem de erro para o usuário
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao carregar dados',
                    text: 'Não foi possível carregar os dados do funcionário. Por favor, tente novamente.',
                    confirmButtonText: 'OK'
                });
            }
        });
    }

    // Função para desativar funcionário
    function desativarFuncionario(funcionarioId) {
        console.log(`Desativando funcionário ID: ${funcionarioId}`);
        
        // Confirma com o usuário
        Swal.fire({
            title: 'Desativar Funcionário?',
            text: "Esta ação marcará o funcionário como inativo no sistema.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sim, desativar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                // Envia requisição para desativar
                $.ajax({
                    url: apiUrlDeactivateFuncionario,
                    type: 'POST',
                    data: {
                        funcionario_id: funcionarioId
                    },
                    headers: {
                        'X-CSRFToken': getCsrfToken()
                    },
                    success: function(response) {
                        console.log("Funcionário desativado com sucesso:", response);
                        
                        // Exibe mensagem de sucesso
                        Swal.fire(
                            'Desativado!',
                            'O funcionário foi desativado com sucesso.',
                            'success'
                        );
                        
                        // Atualiza a tabela
                        setTimeout(() => {
                            filtrarEAtualizarTabela();
                        }, 1000);
                    },
                    error: function(xhr, status, error) {
                        console.error("Erro ao desativar funcionário:", error);
                        
                        // Exibe mensagem de erro
                        Swal.fire(
                            'Erro!',
                            `Não foi possível desativar o funcionário: ${xhr.responseJSON?.error || error}`,
                            'error'
                        );
                    }
                });
            }
        });
    }
});
