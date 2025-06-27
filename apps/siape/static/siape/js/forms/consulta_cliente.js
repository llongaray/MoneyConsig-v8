// static/js/siape/forms/consulta_cliente.js

// ===== VERIFICAÇÃO DE DEPENDÊNCIAS =====
// Verifica se o Bootstrap está disponível
if (typeof bootstrap === 'undefined') {
  console.warn('Bootstrap não encontrado. Usando fallback para modais.');
  // Cria um objeto bootstrap fake para compatibilidade
  window.bootstrap = {
    Modal: {
      getInstance: function(element) {
        return null;
      }
    }
  };
}

// ===== COMPATIBILIDADE COM BOOTSTRAP =====
// Variáveis de compatibilidade serão definidas no document ready principal

// ===== FUNÇÕES AUXILIARES REMOVIDAS TEMPORARIAMENTE =====
// Funções auxiliares removidas para simplificar e resolver problemas de carregamento

// --- Função para formatar número para o padrão BR (1.234,56) ---
function formatCurrencyBR(value) {
  if (value === null || value === undefined || value === '') {
    return '0,00'; // Retorna 0,00 para valores nulos ou vazios
  }
  // Tenta converter para número, tratando possíveis erros
  let num = parseFloat(value);
  if (isNaN(num)) {
    console.warn('Valor inválido para formatação:', value);
    return 'Inválido'; // Ou retorna 0,00 ou outra string indicativa
  }
  // Usa toLocaleString para formatação correta em pt-BR
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// --- Fim da função de formatação ---

// ===== VARIÁVEIS GLOBAIS =====
// Variáveis globais para controle de edição (movidas do HTML)
let tabulacaoOriginal = {};
let modoEdicaoAtivo = false;

// Array para gerenciar arquivos selecionados do modal de negociação
let arquivosNegociacaoSelecionados = [];

// ===== FUNÇÕES PARA TABULAÇÃO =====
// Função para carregar tabulação do cliente (movida do HTML)
function carregarTabulacaoCliente(cpf, agendamentoId = null) {
  let url = `/siape/api/get/tabulacao-cliente/?cpf=${cpf}`;
  if (agendamentoId) {
    url += `&agendamento_id=${agendamentoId}`;
  }
  console.log('[GET] Carregando tabulação do cliente:', url);
  
  fetch(url)
    .then(response => {
      console.log('[GET] Resposta carregarTabulacaoCliente:', response.status, response.statusText);
      return response.json();
    })
    .then(data => {
      console.log('[GET] Dados recebidos carregarTabulacaoCliente:', data);
      if (data.result) {
        // A API retorna a estrutura em data.data.tabulacao_atual quando agendamento_id é especificado
        const tabulacao = data.tabulacao || (data.data && data.data.tabulacao_atual);
        
        // Atualiza a visualização se há tabulação
        if (tabulacao) {
          const statusBadge = document.getElementById('detalhe_tabulacao_status');
          if (statusBadge) {
            statusBadge.textContent = tabulacao.status_display;
            statusBadge.className = `badge ${getStatusBadgeClass(tabulacao.status)}`;
          }
          
          const atualizacaoElement = document.getElementById('detalhe_tabulacao_atualizacao');
          if (atualizacaoElement) {
            atualizacaoElement.textContent = `Atualizado em: ${tabulacao.data_atualizacao}`;
          }
          
          // Mostra/oculta a observação da tabulação se existe
          const observacaoView = $('#tabulacao-observacao-view');
          const observacaoTexto = $('#detalhe_tabulacao_observacao');
          
          if (tabulacao.observacoes && tabulacao.observacoes.trim()) {
            if (observacaoTexto.length) {
              observacaoTexto.text(tabulacao.observacoes);
            }
            if (observacaoView.length) {
              observacaoView.show();
            }
          } else {
            if (observacaoView.length) {
              observacaoView.hide();
            }
          }
          
          // No modo visualização, os campos sempre ficam desabilitados
          $('#tabulacao-select').prop('disabled', true);
          $('#tabulacao-observacoes').prop('disabled', true);
          
          // Controla o estado dos botões baseado no status
          controlarBotaoEditarAgendamento(tabulacao.status);
          controlarBotaoDadosNegociacao(tabulacao.status);
        } else {
          // Se não há tabulação, mostra status padrão
          const statusBadge = document.getElementById('detalhe_tabulacao_status');
          if (statusBadge) {
            statusBadge.textContent = 'Em Negociação';
            statusBadge.className = 'badge bg-primary';
          }
          
          const atualizacaoElement = document.getElementById('detalhe_tabulacao_atualizacao');
          if (atualizacaoElement) {
            atualizacaoElement.textContent = 'Aguardando primeira tabulação';
          }
          
          // Atualiza o campo de output para nova tabulação
          $('#tabulacao-atual-text').text('Sem tabulação');
          
          // Oculta a observação da tabulação
          $('#tabulacao-observacao-view').hide();
          
          // Habilita os botões quando não há tabulação
          controlarBotaoEditarAgendamento(null);
          controlarBotaoDadosNegociacao(null);
        }
      }
    })
    .catch(error => {
      console.error('[GET] Erro ao carregar tabulação:', error);
    });
}

// Função para obter classe CSS do badge baseado no status (movida do HTML)
function getStatusBadgeClass(status) {
  const classes = {
    'SEM_RESPOSTA': 'bg-secondary',
    'EM_NEGOCIACAO': 'bg-warning',
    'REVERSAO': 'bg-danger',
    'REVERTIDO': 'bg-warning',
    'DESISTIU': 'bg-danger',
    'CHECAGEM': 'bg-info',
    'CHECAGEM_OK': 'bg-success',
    'ALTO_RISCO': 'bg-danger',
    'CONCLUIDO_PG': 'bg-success'
  };
  return classes[status] || 'bg-secondary';
}

// Função para obter o texto amigável do status
function getStatusText(status) {
  const textos = {
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
  return textos[status] || status;
}

// Função para mostrar notificações temporárias
function mostrarNotificacao(mensagem, tipo = 'info') {
  const classe = tipo === 'success' ? 'alert-success' : 
                 tipo === 'error' ? 'alert-danger' : 'alert-info';
  
  // Gera um ID único para cada notificação
  const notificacaoId = `notificacao-consulta-cliente-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const notificacao = $(`
    <div id="${notificacaoId}" class="alert ${classe} alert-dismissible fade show notificacao-consulta-cliente" 
         data-tipo="${tipo}">
      <i class="bx ${tipo === 'success' ? 'bx-check-circle' : tipo === 'error' ? 'bx-error-circle' : 'bx-info-circle'} me-2"></i>
      ${mensagem}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Fechar"></button>
    </div>
  `);
  
  // Verifica se já existe o container, se não, cria
  let container = $('#container-notificacoes-consulta-cliente');
  if (container.length === 0) {
    container = $('<div id="container-notificacoes-consulta-cliente" class="container-notificacoes-consulta-cliente"></div>');
    $('body').append(container);
  }
  
  container.append(notificacao);
  
  // Remove automaticamente após 5 segundos
  setTimeout(() => {
    notificacao.fadeOut(function() {
      $(this).remove();
      // Remove o container se estiver vazio
      if (container.children().length === 0) {
        container.remove();
      }
    });
  }, 5000);
  
  return notificacaoId;
}

// Função para verificar se deve exibir o subcard de negociação
function verificarExibirBotaoNegociacao(status) {
  const subcardNegociacao = $('#subcard-negociacao');
  const selectTabulacao = $('#tabulacao-select');
  
  // Só funciona se estiver em modo de edição (quando o tabulacao-edit está visível)
  if (!$('#tabulacao-edit').is(':visible')) {
    // Se não está em modo de edição, sempre esconde o subcard
    subcardNegociacao.hide();
    return;
  }
  
  // Verifica se o status atual é CHECAGEM ou se o select está em CHECAGEM
  const statusAtual = status || selectTabulacao.val();
  
  if (statusAtual === 'CHECAGEM') {
    // Mostra o subcard com animação suave
    subcardNegociacao.slideDown(300).css('display', 'block');
  } else {
    // Esconde o subcard com animação suave
    subcardNegociacao.slideUp(300);
  }
}

// Função para controlar o estado do botão "Editar Agendamento"
function controlarBotaoEditarAgendamento(statusTabulacao) {
  const btnEditarDetalhes = $('#btn-editar-detalhes');
  
  if (!btnEditarDetalhes.length) {
    return; // Botão não existe na página
  }
  
  // Se o status for REVERSAO ou CHECAGEM, desabilita o botão
  if (statusTabulacao === 'REVERSAO' || statusTabulacao === 'CHECAGEM') {
    btnEditarDetalhes.prop('disabled', true);
    btnEditarDetalhes.removeClass('btn-outline-primary').addClass('btn-outline-secondary');
    btnEditarDetalhes.attr('title', 'Agendamento não pode ser editado pois está em processo de checagem/reversão');
    btnEditarDetalhes.html('<i class="bx bx-lock me-1"></i>Bloqueado para Edição');
  } else {
    // Caso contrário, habilita o botão
    btnEditarDetalhes.prop('disabled', false);
    btnEditarDetalhes.removeClass('btn-outline-secondary').addClass('btn-outline-primary');
    btnEditarDetalhes.attr('title', 'Editar detalhes');
    btnEditarDetalhes.html('<i class="bx bx-edit me-1"></i>Editar Agendamento');
  }
}

// Função para controlar o estado do botão "Dados de Negociação"
function controlarBotaoDadosNegociacao(statusTabulacao) {
  const btnDadosNegociacao = $('#btn-dados-negociacao');
  
  if (!btnDadosNegociacao.length) {
    return; // Botão não existe na página
  }
  
  // Se o status for REVERSAO ou CHECAGEM, desabilita o botão
  if (statusTabulacao === 'REVERSAO' || statusTabulacao === 'CHECAGEM') {
    btnDadosNegociacao.prop('disabled', true);
    btnDadosNegociacao.removeClass('btn-outline-warning').addClass('btn-outline-secondary');
    btnDadosNegociacao.attr('title', 'Dados de negociação não podem ser acessados pois está em processo de checagem/reversão');
    btnDadosNegociacao.html('<i class="bx bx-lock me-1"></i>Bloqueado');
  } else {
    // Caso contrário, habilita o botão
    btnDadosNegociacao.prop('disabled', false);
    btnDadosNegociacao.removeClass('btn-outline-secondary').addClass('btn-outline-warning');
    btnDadosNegociacao.attr('title', 'Dados de negociação');
    btnDadosNegociacao.html('<i class="bx bx-clipboard-data me-1"></i>Dados Negociação');
  }
}

// ===== FUNÇÃO DE SALVAR TABULAÇÃO (ADAPTADA) =====
function salvarTabulacao(cpf, agendamentoId) {
  const novoStatus = $('#tabulacao-select').val();
  const observacoes = $('#tabulacao-observacoes').val();

  // Se agendamentoId não foi passado, tenta obter do DOM
  if (!agendamentoId) {
    agendamentoId = $('#agendamento_id_edicao').val();
  }

  // Se status for CHECAGEM ou REVERSAO, verifica se o subcard de agendamento está visível e coleta os dados
  if ((novoStatus === 'CHECAGEM' || novoStatus === 'REVERSAO') && $('#subcard-agendamento-checagem').is(':visible')) {
    const coordenadorId = $('#coordenador-select').val();
    const dataChecagem = $('#data-checagem').val();
    const horaChecagem = $('#horario-checagem').val();
    const observacaoChecagem = $('#observacao-checagem').val();
    // Validações mínimas
    if (!coordenadorId || !dataChecagem || !horaChecagem) {
      mostrarNotificacao('Preencha todos os campos do agendamento de checagem/reversão.', 'error');
      return Promise.reject('Campos obrigatórios do agendamento de checagem não preenchidos.');
    }
    // Monta o payload
    const dados = {
      cpf: cpf,
      agendamento_id: agendamentoId,
      status: novoStatus,
      observacoes: observacoes,
      coordenador_id: coordenadorId,
      data_checagem: dataChecagem,
      hora_checagem: horaChecagem,
      observacao_checagem: observacaoChecagem
    };
    console.log('[POST] Salvando tabulação com checagem:', dados);
    return fetch('/siape/api/post/atualizar-tabulacao/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(dados)
    });
  }

  // Caso contrário, fluxo normal
  const dados = {
    cpf: cpf,
    agendamento_id: agendamentoId,
    status: novoStatus,
    observacoes: observacoes
  };
  console.log('[POST] Salvando tabulação normal:', dados);
  return fetch('/siape/api/post/atualizar-tabulacao/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken')
    },
    body: JSON.stringify(dados)
  });
}

// ===== FUNÇÕES PARA DADOS DE NEGOCIAÇÃO =====
function verificarEMostrarModalNegociacao(cpf, agendamentoId, status, observacoes) {
  return new Promise((resolve, reject) => {
    // Primeiro, salva a tabulação normalmente
    const dados = {
      cpf: cpf,
      agendamento_id: agendamentoId,
      status: status,
      observacoes: observacoes
    };
    
    console.log('[POST] Salvando tabulação para modal negociação:', dados);
    fetch('/siape/api/post/atualizar-tabulacao/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(dados)
    })
    .then(response => {
      console.log('[POST] Resposta verificarEMostrarModalNegociacao:', response.status, response.statusText);
      return response.json();
    })
    .then(data => {
      console.log('[POST] Dados recebidos verificarEMostrarModalNegociacao:', data);
      if (data.result) {
        // Se salvou com sucesso, mostra o modal de dados de negociação
        mostrarModalDadosNegociacao(agendamentoId);
        resolve({ok: true, json: () => Promise.resolve(data)});
      } else {
        reject(data.message || 'Erro ao salvar tabulação');
      }
    })
    .catch(error => {
      console.error('[POST] Erro em verificarEMostrarModalNegociacao:', error);
      reject(error);
    });
  });
}

// Função para abrir modal de dados de negociação
window.abrirModalDadosNegociacao = function(agendamentoId) {
  console.log('abrirModalDadosNegociacao chamada com ID:', agendamentoId);
  
  // Define o ID do agendamento no modal
  $('#negociacao_agendamento_id').val(agendamentoId);
  
  // Limpa o modal primeiro
  limparModalDadosNegociacao();
  
  // Atualiza o título do modal
  $('#modalDadosNegociacaoLabel').html('<i class="bx bx-loader-alt bx-spin me-2"></i>Carregando dados de negociação...');
  
  // Abre o modal - versão simplificada
  const modalElement = document.getElementById('modalDadosNegociacao');
  modalElement.style.display = 'block';
  modalElement.classList.add('show');
  document.body.classList.add('modal-open');
  
  // Carrega dados existentes se houver
  const urlDados = `/siape/api/get/dados-negociacao/?agendamento_id=${agendamentoId}`;
  console.log('[GET] Carregando dados de negociação:', urlDados);
  
  fetch(urlDados)
    .then(response => {
      console.log('[GET] Resposta dados negociação:', response.status, response.statusText);
      return response.json();
    })
    .then(data => {
      console.log('[GET] Dados recebidos negociação:', data);
      if (data.result && data.data.existe_dados) {
        $('#modalDadosNegociacaoLabel').html('<i class="bx bx-edit me-2"></i>Editar Dados de Negociação');
        preencherModalDadosNegociacao(data.data);
        mostrarNotificacao('Dados carregados para edição.', 'info');
      } else {
        $('#modalDadosNegociacaoLabel').html('<i class="bx bx-clipboard-data me-2"></i>Dados de Negociação');
      }
    })
    .catch(error => {
      console.error('[GET] Erro ao carregar dados de negociação:', error);
      $('#modalDadosNegociacaoLabel').html('<i class="bx bx-clipboard-data me-2"></i>Dados de Negociação');
    });
};

// Função para fechar o modal de dados de negociação
window.fecharModalDadosNegociacao = function() {
  const modalElement = document.getElementById('modalDadosNegociacao');
  modalElement.style.display = 'none';
  modalElement.classList.remove('show');
  document.body.classList.remove('modal-open');
  
  // Remove qualquer backdrop
  const backdrops = document.querySelectorAll('.modal-backdrop');
  backdrops.forEach(backdrop => backdrop.remove());
};

function preencherModalDadosNegociacao(data) {
  const dados = data.dados_negociacao || {};
  const arquivos = data.arquivos || [];
  
  console.log('Preenchendo modal com dados:', dados);
  
  // Preenche os campos do formulário
  $('#negociacao_banco_nome').val(dados.banco_nome || '');
  $('#negociacao_valor_liberado').val(dados.valor_liberado || '');
  $('#negociacao_saldo_devedor').val(dados.saldo_devedor || '');
  $('#negociacao_parcela_atual').val(dados.parcela_atual || '');
  $('#negociacao_parcela_nova').val(dados.parcela_nova || '');
  $('#negociacao_tc').val(dados.tc || '');
  $('#negociacao_troco').val(dados.troco || '');
  $('#negociacao_prazo_atual').val(dados.prazo_atual || '');
  $('#negociacao_prazo_acordado').val(dados.prazo_acordado || '');
  $('#negociacao_descricao').val(dados.descricao || '');
  
  // Atualiza a lista de arquivos salvos
  atualizarListaArquivosSalvos(arquivos);
  
  // Adiciona indicação visual de que há dados salvos
  if (dados.id) {
    $('#formDadosNegociacao').prepend(
      '<div class="alert alert-info alert-dismissible fade show dados-existentes-alert" role="alert">' +
      '<i class="bx bx-info-circle me-2"></i>' +
      '<strong>Editando dados existentes:</strong> Criado em ' + (dados.data_criacao || 'data não disponível') + 
      (dados.data_ultima_modificacao !== dados.data_criacao ? 
        ', última modificação em ' + dados.data_ultima_modificacao : '') +
      '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
      '</div>'
    );
  }
}

function limparModalDadosNegociacao() {
  // Remove alertas de dados existentes
  $('.dados-existentes-alert').remove();
  
  // Limpa todos os campos do formulário
  $('#formDadosNegociacao')[0].reset();
  $('#lista-arquivos-selecionados').empty();
  $('#arquivos-salvos-container').html('<p class="text-muted">Nenhum arquivo anexado.</p>');
  
  // Remove classes de validação
  $('#formDadosNegociacao .is-invalid').removeClass('is-invalid');
  $('#formDadosNegociacao .invalid-feedback').remove();
  
  // Limpa o array de arquivos selecionados
  arquivosNegociacaoSelecionados = [];
}

// Função para atualizar a lista visual de arquivos selecionados
function atualizarListaArquivosSelecionados() {
  const listaContainer = $('#lista-arquivos-selecionados');
  
  if (arquivosNegociacaoSelecionados.length === 0) {
    listaContainer.empty();
    return;
  }
  
  let html = '<h6 class="mb-2"><i class="bx bx-file me-2"></i>Arquivos Selecionados:</h6>';
  
  arquivosNegociacaoSelecionados.forEach((arquivo, index) => {
    const tamanho = (arquivo.size / 1024 / 1024).toFixed(2); // Tamanho em MB
    const iconeArquivo = getIconeArquivo(arquivo.name);
    
    html += `
      <div class="arquivo-item" data-arquivo-id="${arquivo.id}">
        <div class="arquivo-info">
          <i class="${iconeArquivo}"></i>
          <div>
            <div class="arquivo-nome">${arquivo.name}</div>
            <div class="arquivo-tamanho">${tamanho} MB</div>
          </div>
        </div>
        <div class="arquivo-acoes">
          <button type="button" class="btn-remover-arquivo" onclick="removerArquivoSelecionado('${arquivo.id}')" title="Remover arquivo">
            <i class="bx bx-trash"></i>
          </button>
        </div>
      </div>
    `;
  });
  
  listaContainer.html(html);
}

// Função para obter ícone baseado no tipo de arquivo
function getIconeArquivo(nomeArquivo) {
  const extensao = nomeArquivo.split('.').pop().toLowerCase();
  
  const icones = {
    'pdf': 'bx bx-file-pdf text-danger',
    'doc': 'bx bx-file-doc text-primary',
    'docx': 'bx bx-file-doc text-primary',
    'xls': 'bx bx-file-doc text-success',
    'xlsx': 'bx bx-file-doc text-success',
    'jpg': 'bx bx-image text-warning',
    'jpeg': 'bx bx-image text-warning',
    'png': 'bx bx-image text-warning',
    'gif': 'bx bx-image text-warning',
    'txt': 'bx bx-file-blank text-secondary'
  };
  
  return icones[extensao] || 'bx bx-file text-info';
}

// Função para remover arquivo da lista
function removerArquivoSelecionado(arquivoId) {
  // Remove do array
  arquivosNegociacaoSelecionados = arquivosNegociacaoSelecionados.filter(
    arquivo => arquivo.id !== arquivoId
  );
  
  // Atualiza a visualização
  atualizarListaArquivosSelecionados();
  
  // Mostra notificação
  mostrarNotificacao('Arquivo removido da lista.', 'info');
}

function atualizarListaArquivosSalvos(arquivos) {
  const container = $('#arquivos-salvos-container');
  
  if (arquivos.length > 0) {
    const htmlArquivos = arquivos.map(arquivo => `
      <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-2">
        <div>
          <strong>${arquivo.titulo_arquivo}</strong>
          <small class="text-muted d-block">${arquivo.data_criacao}</small>
        </div>
        <a href="${arquivo.arquivo_url}" target="_blank" class="btn btn-sm btn-outline-primary">
          <i class="bx bx-download"></i> Baixar
        </a>
      </div>
    `).join('');
    container.html(htmlArquivos);
  } else {
    container.html('<p class="text-muted">Nenhum arquivo anexado.</p>');
  }
}

function salvarDadosNegociacao() {
  const agendamentoId = $('#negociacao_agendamento_id').val();
  
  const dados = {
    agendamento_id: agendamentoId,
    banco_nome: $('#negociacao_banco_nome').val().trim(),
    valor_liberado: $('#negociacao_valor_liberado').val().trim(),
    saldo_devedor: $('#negociacao_saldo_devedor').val().trim(),
    parcela_atual: $('#negociacao_parcela_atual').val().trim(),
    parcela_nova: $('#negociacao_parcela_nova').val().trim(),
    tc: $('#negociacao_tc').val().trim(),
    troco: $('#negociacao_troco').val().trim(),
    prazo_atual: $('#negociacao_prazo_atual').val().trim(),
    prazo_acordado: $('#negociacao_prazo_acordado').val().trim(),
    descricao: $('#negociacao_descricao').val().trim()
  };
  
  console.log('[POST] Salvando dados de negociação:', dados);
  
  const btnSalvar = $('#btn-salvar-negociacao');
  const textoOriginal = btnSalvar.html();
  btnSalvar.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i>Salvando...');
  
  fetch('/siape/api/post/salvar-dados-negociacao/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken')
    },
    body: JSON.stringify(dados)
  })
  .then(response => {
    console.log('[POST] Resposta salvarDadosNegociacao:', response.status, response.statusText);
    return response.json();
  })
  .then(data => {
    console.log('[POST] Dados recebidos salvarDadosNegociacao:', data);
    if (data.result) {
      mostrarNotificacao('Dados de negociação salvos com sucesso!', 'success');
      fecharModalDadosNegociacao();
    } else {
      mostrarNotificacao('Erro ao salvar: ' + data.message, 'error');
    }
  })
  .catch(error => {
    console.error('[POST] Erro em salvarDadosNegociacao:', error);
    mostrarNotificacao('Erro ao salvar dados de negociação', 'error');
  })
  .finally(() => {
    btnSalvar.prop('disabled', false).html(textoOriginal);
  });
}

function uploadArquivoNegociacao() {
  const agendamentoId = $('#negociacao_agendamento_id').val();
  const arquivos = $('#negociacao_arquivos')[0].files;
  
  if (!arquivos || arquivos.length === 0) {
    mostrarNotificacao('Por favor, selecione pelo menos um arquivo', 'error');
    return;
  }
  
  // Primeiro salva os dados de negociação se ainda não foram salvos
  salvarDadosNegociacaoEArquivos();
}

function salvarDadosNegociacaoEArquivos() {
  const agendamentoId = $('#negociacao_agendamento_id').val();
  
  // Primeiro salva os dados básicos
  const dados = {
    agendamento_id: agendamentoId,
    banco_nome: $('#negociacao_banco_nome').val().trim(),
    valor_liberado: $('#negociacao_valor_liberado').val().trim(),
    saldo_devedor: $('#negociacao_saldo_devedor').val().trim(),
    parcela_atual: $('#negociacao_parcela_atual').val().trim(),
    parcela_nova: $('#negociacao_parcela_nova').val().trim(),
    tc: $('#negociacao_tc').val().trim(),
    troco: $('#negociacao_troco').val().trim(),
    prazo_atual: $('#negociacao_prazo_atual').val().trim(),
    prazo_acordado: $('#negociacao_prazo_acordado').val().trim(),
    descricao: $('#negociacao_descricao').val().trim()
  };
  
  // Validações antes de enviar
  const erros = [];
  
  // Validação: parcela_nova deve ser diferente de parcela_atual se ambas estiverem preenchidas
  if (dados.parcela_atual && dados.parcela_nova && dados.parcela_atual === dados.parcela_nova) {
    erros.push('A parcela nova deve ser diferente da parcela atual');
  }
  
  // Validação: prazo_acordado deve ser diferente de prazo_atual se ambos estiverem preenchidos
  if (dados.prazo_atual && dados.prazo_acordado && dados.prazo_atual === dados.prazo_acordado) {
    erros.push('O prazo acordado deve ser diferente do prazo atual');
  }
  
  // Se há erros, mostra para o usuário e não prossegue
  if (erros.length > 0) {
    mostrarNotificacao(`Erro de validação: ${erros.join('. ')}`, 'error');
    return;
  }
  
  console.log('Dados enviados para salvar negociação:', dados);
  
  const btnSalvar = $('#btn-salvar-negociacao');
  const textoOriginal = btnSalvar.html();
  btnSalvar.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i>Salvando...');
  
  console.log('[POST] Salvando dados negociação e arquivos:', dados);
  
  fetch('/siape/api/post/salvar-dados-negociacao/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dados)
  })
  .then(response => {
    console.log('[POST] Resposta salvarDadosNegociacaoEArquivos:', response.status, response.statusText);
    if (!response.ok) {
      return response.text().then(text => {
        console.error('[POST] Error response text:', text);
        throw new Error(`HTTP ${response.status}: ${text}`);
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('[POST] Dados recebidos salvarDadosNegociacaoEArquivos:', data);
    if (data.result) {
      // Se salvou os dados, agora faz upload dos arquivos selecionados
      if (arquivosNegociacaoSelecionados.length > 0) {
        uploadMultiplosArquivosSelecionados(data.dados_negociacao_id);
      } else {
        mostrarNotificacao('Dados de negociação salvos com sucesso!', 'success');
        fecharModalDadosNegociacao();
      }
    } else {
      mostrarNotificacao('Erro ao salvar dados: ' + data.message, 'error');
      btnSalvar.prop('disabled', false).html(textoOriginal);
    }
  })
  .catch(error => {
    console.error('Erro:', error);
    
    // Tenta extrair a mensagem de erro do backend
    let mensagemErro = 'Erro ao salvar dados de negociação';
    if (error.message && error.message.includes('HTTP 400:')) {
      try {
        const errorData = JSON.parse(error.message.split('HTTP 400: ')[1]);
        if (errorData.message) {
          mensagemErro = errorData.message;
        }
      } catch (e) {
        // Se não conseguir fazer parse, usa a mensagem padrão
      }
    }
    
    mostrarNotificacao(mensagemErro, 'error');
    btnSalvar.prop('disabled', false).html(textoOriginal);
  });
}

function uploadMultiplosArquivos(dadosNegociacaoId) {
  const arquivos = $('#negociacao_arquivos')[0].files;
  const promises = [];
  
  console.log('[POST] Iniciando upload de múltiplos arquivos:', arquivos.length, 'arquivos');
  
  for (let i = 0; i < arquivos.length; i++) {
    const formData = new FormData();
    formData.append('dados_negociacao_id', dadosNegociacaoId);
    formData.append('titulo_arquivo', arquivos[i].name);
    formData.append('arquivo', arquivos[i]);
    
    console.log('[POST] Preparando upload do arquivo:', arquivos[i].name);
    
    const uploadPromise = fetch('/siape/api/post/upload-arquivo-negociacao/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: formData
    })
    .then(response => {
      console.log('[POST] Resposta upload arquivo', arquivos[i].name, ':', response.status, response.statusText);
      return response.json();
    })
    .then(data => {
      console.log('[POST] Dados recebidos upload arquivo', arquivos[i].name, ':', data);
      return data;
    });
    
    promises.push(uploadPromise);
  }
  
  Promise.all(promises)
    .then(results => {
      const sucessos = results.filter(r => r.result).length;
      const erros = results.filter(r => !r.result).length;
      
      if (sucessos > 0) {
        mostrarNotificacao(`${sucessos} arquivo(s) enviado(s) com sucesso!${erros > 0 ? ` ${erros} erro(s).` : ''}`, 'success');
      }
      if (erros > 0 && sucessos === 0) {
        mostrarNotificacao('Erro ao enviar arquivos', 'error');
      }
      
      fecharModalDadosNegociacao();
    })
    .catch(error => {
      console.error('Erro:', error);
      mostrarNotificacao('Erro ao enviar arquivos', 'error');
    });
}

// Nova função para upload de arquivos selecionados do array
function uploadMultiplosArquivosSelecionados(dadosNegociacaoId) {
  const btnSalvar = $('#btn-salvar-negociacao');
  const promises = [];
  let arquivosProcessados = 0;
  const totalArquivos = arquivosNegociacaoSelecionados.length;
  
  console.log('[POST] Iniciando upload de arquivos selecionados:', totalArquivos, 'arquivos');
  
  // Atualiza o botão para mostrar progresso
  // Atualiza o botão para mostrar progresso
  btnSalvar.html(`<i class="bx bx-loader-alt bx-spin me-1"></i>Enviando arquivo 1 de ${totalArquivos}...`);
  
  arquivosNegociacaoSelecionados.forEach((arquivo, index) => {
    const formData = new FormData();
    formData.append('dados_negociacao_id', dadosNegociacaoId);
    formData.append('titulo_arquivo', arquivo.name);
    formData.append('arquivo', arquivo);
    
    const uploadPromise = fetch('/siape/api/post/upload-arquivo-negociacao/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: formData
    })
    .then(response => response.json())
    .then(result => {
      arquivosProcessados++;
      // Atualiza o progresso no botão
      if (arquivosProcessados < totalArquivos) {
        btnSalvar.html(`<i class="bx bx-loader-alt bx-spin me-1"></i>Enviando arquivo ${arquivosProcessados + 1} de ${totalArquivos}...`);
      }
      return result;
    });
    
    promises.push(uploadPromise);
  });
  
  Promise.all(promises)
    .then(results => {
      const sucessos = results.filter(r => r.result).length;
      const erros = results.filter(r => !r.result).length;
      
      if (sucessos > 0) {
        mostrarNotificacao(`${sucessos} arquivo(s) enviado(s) com sucesso!${erros > 0 ? ` ${erros} erro(s).` : ''}`, 'success');
      }
      if (erros > 0 && sucessos === 0) {
        mostrarNotificacao('Erro ao enviar arquivos', 'error');
      }
      
      // Limpa os arquivos selecionados após envio bem-sucedido
      if (sucessos > 0) {
        arquivosNegociacaoSelecionados = [];
        atualizarListaArquivosSelecionados();
      }
      
      fecharModalDadosNegociacao();
    })
    .catch(error => {
      console.error('Erro:', error);
      mostrarNotificacao('Erro ao enviar arquivos', 'error');
      
      // Restaura o botão em caso de erro
      btnSalvar.prop('disabled', false).html('Salvar Dados');
    });
}

// ===== FUNÇÕES PARA TELEFONES =====
// Função para adicionar telefone (movida do HTML)
function adicionarTelefone(cpf) {
  const numero = $('#novo-telefone-numero').val().trim();
  if (!numero) return Promise.resolve({ok: true}); // Não adiciona se vazio
  
  const dados = {
    cpf: cpf,
    numero: numero,
    tipo: $('#novo-telefone-tipo').val(),
    principal: $('#novo-telefone-principal').is(':checked'),
    observacoes: $('#novo-telefone-observacoes').val()
  };

  console.log('[POST] Adicionando telefone:', dados);

  return fetch('/siape/api/post/adicionar-telefone/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCookie('csrftoken')
    },
    body: JSON.stringify(dados)
  });
}

// Função para aplicar máscara de telefone (movida do HTML)
function aplicarMascaraTelefone(campo) {
  campo.on('input', function() {
    let valor = this.value.replace(/\D/g, '');
    if (valor.length <= 11) {
      if (valor.length <= 10) {
        // Telefone fixo: (XX) XXXX-XXXX
        valor = valor.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
      } else {
        // Celular: (XX) XXXXX-XXXX
        valor = valor.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      }
    }
    this.value = valor;
  });
}



// ===== FUNÇÕES PARA DETALHES DO AGENDAMENTO =====
// Função para inicializar detalhes do agendamento (movida do HTML)
function inicializarDetalhesAgendamento(agendamento, cpfCliente) {
  $('#agendamento_id_edicao').val(agendamento.id);
  $('#cliente_cpf_atual').val(cpfCliente);
  $('#detalhe_agendamento_data').text(agendamento.data);
  $('#detalhe_agendamento_hora').text(agendamento.hora);
  $('#detalhe_agendamento_observacao').text(agendamento.observacao || 'Sem observação');
  
  // Exibe o telefone de contato do agendamento
  const telefoneContato = agendamento.telefone_contato || 'Não informado';
  $('#detalhe_agendamento_telefone').text(telefoneContato);
  
  // Carrega tabulação específica do agendamento
  carregarTabulacaoCliente(cpfCliente, agendamento.id);
  

  
  // Mostra o card
  $('.observacao-agendamento-card').show();
}

// ===== FUNÇÕES UTILITÁRIAS =====
// Função para obter cookie CSRF (movida do HTML)
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// ===== DOCUMENT READY =====
$(document).ready(function () {
  // Verifica compatibilidade do Bootstrap
  setTimeout(function() {
    window.hasBootstrap5 = (typeof bootstrap !== 'undefined' && bootstrap.Modal);
    window.hasBootstrapJQuery = (typeof $ !== 'undefined' && typeof $.fn.modal !== 'undefined');
    
    console.log('Bootstrap 5 disponível:', window.hasBootstrap5);
    console.log('Bootstrap jQuery disponível:', window.hasBootstrapJQuery);
    
    if (!window.hasBootstrap5 && !window.hasBootstrapJQuery) {
      console.warn('Nenhuma biblioteca de modal detectada. Usando fallback manual.');
    }
  }, 100);
  
  // Garante que o subcard de negociação comece escondido
  $('#subcard-negociacao').hide();
  
  // Inicialmente, carrega os agendamentos do usuário
  buscarAgendamentos();
  
  // Certifique-se que o card de agendamento está oculto
  $('.agendamento-card').hide();

  // ===== EVENTOS ADICIONADOS DO HTML =====
  // Aplica máscara nos campos de telefone (movido do HTML)
  aplicarMascaraTelefone($('#novo-telefone-numero'));
  aplicarMascaraTelefone($('#telefone_contato_agendamento'));
  aplicarMascaraTelefone($('#modal_telefone_contato'));
  aplicarMascaraTelefone($('#modal_novo_telefone_numero'));
  
  // Botão Editar (removido - versão aprimorada adicionada no final do arquivo)



  // Botão Cancelar (movido do HTML)
  $('#btn-cancelar-edicao').on('click', function() {
    if (!modoEdicaoAtivo) return;
    
    modoEdicaoAtivo = false;
    
    // Esconde campos de edição
    $('#tabulacao-edit').hide();
    $('#telefone-edit').hide();
    $('#observacao-edit').hide();
    $('#botoes-edicao').hide();
    
    // Mostra visualização
    $('#tabulacao-view').show();
    $('#telefone-view').show();
    $('#observacao-view').show();
    $('#btn-editar-detalhes').show();
    
    // Limpa campos de telefone
    $('#novo-telefone-numero').val('');
    $('#novo-telefone-observacoes').val('');
    $('#novo-telefone-principal').prop('checked', false);
    
    // Esconde o subcard de negociação ao sair do modo de edição
    $('#subcard-negociacao').hide();
    
    // Restaura o estado de desabilitação dos campos conforme as regras de negócio
    // Sempre desabilita quando sai do modo de edição (volta ao modo visualização)
    $('#tabulacao-select').prop('disabled', true);
    $('#tabulacao-observacoes').prop('disabled', true);
  });

  // Botão Salvar Tudo (movido do HTML)
  $('#btn-salvar-detalhes').on('click', function() {
    if (!modoEdicaoAtivo) return;
    
    const cpf = $('#cliente_cpf_atual').val();
    const agendamentoId = $('#agendamento_id_edicao').val();
    const observacao = $('#observacao-textarea').val();
    
    if (!cpf) {
      alert('CPF do cliente não encontrado');
      return;
    }

    $(this).prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i>Salvando...');
    
    // Array de promises para execução paralela
    const promises = [];
    
    // 1. Salvar tabulação
    promises.push(salvarTabulacao(cpf, agendamentoId));
    
    // 2. Adicionar telefone (se preenchido)
    promises.push(adicionarTelefone(cpf));
    
    // 3. Salvar observação do agendamento
    if (agendamentoId && observacao !== $('#detalhe_agendamento_observacao').text()) {
      console.log('[POST] Editando observação do agendamento:', { agendamento_id: agendamentoId, observacao: observacao });
      promises.push(
        fetch('/siape/api/post/editar-observacao-agendamento/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
          },
          body: JSON.stringify({
            agendamento_id: agendamentoId,
            observacao: observacao
          })
        })
        .then(response => {
          console.log('[POST] Resposta editar observação:', response.status, response.statusText);
          return response;
        })
      );
    }
    
    // Executa todas as operações
    Promise.all(promises)
      .then(responses => {
        // Verifica se todas as respostas são OK
        return Promise.all(responses.map(r => r.json ? r.json() : {result: true}));
      })
      .then(results => {
        // Verifica se todas as operações foram bem-sucedidas
        const todosOk = results.every(result => result.result !== false);
        
        if (todosOk) {
          alert('Dados salvos com sucesso!');
          
          // Atualiza visualização
          $('#detalhe_agendamento_observacao').text(observacao);
          const agendamentoAtualId = $('#agendamento_id_edicao').val();
          carregarTabulacaoCliente(cpf, agendamentoAtualId);
          
          // Recarrega telefones se um novo foi adicionado
          const numeroTelefone = $('#novo-telefone-numero').val().trim();
          if (numeroTelefone) {
            carregarTelefonesDetalhes(cpf);
            // Também atualiza o card principal de telefones na coluna 2
            if (window.carregarTelefonesCliente) {
              // Faz nova busca dos telefones para o card principal
              const urlTelefones = `/siape/api/get/telefones-cliente/?cpf=${cpf}`;
              console.log('[GET] Recarregando telefones do cliente:', urlTelefones);
              
              fetch(urlTelefones)
                .then(response => {
                  console.log('[GET] Resposta telefones cliente:', response.status, response.statusText);
                  return response.json();
                })
                .then(data => {
                  console.log('[GET] Dados recebidos telefones cliente:', data);
                  if (data.result && data.telefones) {
                    window.carregarTelefonesCliente(data.telefones);
                  }
                })
                .catch(error => {
                  console.error('[GET] Erro ao recarregar telefones:', error);
                });
            }
          }
          
          // Sai do modo edição (que já vai restaurar o estado dos campos)
          $('#btn-cancelar-edicao').click();
        } else {
          alert('Ocorreu um erro ao salvar alguns dados. Verifique e tente novamente.');
        }
      })
      .catch(error => {
        console.error('Erro ao salvar:', error);
        alert('Erro ao salvar os dados. Tente novamente.');
      })
      .finally(() => {
        $('#btn-salvar-detalhes').prop('disabled', false).html('<i class="bx bx-save me-1"></i>Salvar Tudo');
      });
  });

  // Evento para limpar calculadora (movido do HTML)
  $('#limpar_calculadora').on('click', function() {
    // Limpa os campos de entrada
    $('#calc_parcela').val('');
    $('#calc_prazo').val('');
    
    // Reseta os valores exibidos
    $('#calc_saldo_total').text('0.00');
    $('#calc_percentual').text('0');
    $('#calc_desconto').text('0.00');
    $('#calc_saldo_final').text('0.00');
    
    // Esconde a seção de resultados
    $('.resultado-calculo').slideUp();
    
    // Foca no primeiro campo
    $('#calc_parcela').focus();
  });

  // ===== EVENTOS EXISTENTES (mantidos) =====
  // Tornar a calculadora colapsável quando clicar no header
  $('.calculadora-card .card-header').on('click', function() {
    const cardBody = $('#card-body-calculadora');
    const card = $(this).closest('.calculadora-card');
    // Alternar a classe collapsed para controlar o estado
    card.toggleClass('collapsed');
    // Se estiver fechando, limpar os campos da calculadora
    if (card.hasClass('collapsed')) {
      $('#calc_parcela').val('');
      $('#calc_prazo').val('');
      $('.resultado-calculo').hide();
    }
  });

  // Calculadora de coeficiente: torná-la colapsável ao clicar no header
  $('.calculadora-coeficiente-card .card-header').on('click', function() {
    $(this).closest('.calculadora-coeficiente-card').toggleClass('collapsed');
  });

  $('#consultaClienteForm').on('submit', function (e) {
    e.preventDefault();
    // Oculta o card de detalhes de agendamento se estiver visível
    if ($('.observacao-agendamento-card').is(':visible')) {
      $('.observacao-agendamento-card').slideUp();
    }

    // Captura e limpa o CPF
    const rawCpf = $('#cpf_cliente').val();
    const cpf = rawCpf.replace(/[^\d]/g, '');

    if (!cpf || cpf.length !== 11) {
      alert('Por favor, insira um CPF válido com 11 dígitos.');
      return;
    }

    // Requisição AJAX para buscar a ficha do cliente
    $.ajax({
      url: '/siape/api/get/ficha-cliente/',
      type: 'GET',
      data: { cpf: cpf },
      success: function (response) {
        const cliente = response.cliente;
        const debitos = response.debitos;

        // Exibe coluna 2 (Ficha) e o card de agendamento em coluna 3
        $('#col2').slideDown();
        $('.agendamento-card').slideDown();

        // Adiciona a classe para justificar o layout como space-around
        $('#three-col-layout').addClass('all-columns-visible');

        // Preenche o ID do cliente no formulário de agendamento
        if (cliente && cliente.id) {
          $('#agendamento_cliente_id').val(cliente.id);
        }

        // Preenche Informações Pessoais (Formatando Renda Bruta)
        $('#cliente_nome').text(cliente.nome || '-');
        $('#cliente_cpf').text(cliente.cpf || '-');
        $('#cliente_uf').text(cliente.uf || '-');
        $('#cliente_rjur').text(cliente.rjur || '-');
        $('#cliente_situacao').text(cliente.situacao_funcional || '-');
        $('#cliente_renda_bruta').text(formatCurrencyBR(cliente.renda_bruta)); // Formatado

        // Preenche o card "Margem 5%" (Formatado)
        $('#cliente_bruta_5').text(formatCurrencyBR(cliente.bruta_5));
        $('#cliente_utilizado_5').text(formatCurrencyBR(cliente.util_5));
        $('#cliente_saldo_5').text(formatCurrencyBR(cliente.saldo_5));

        // Preenche o card "Margem 5% Benefício" (Formatado)
        $('#cliente_brutaBeneficio_5').text(formatCurrencyBR(cliente.brutaBeneficio_5));
        $('#cliente_utilizadoBeneficio_5').text(formatCurrencyBR(cliente.utilBeneficio_5));
        $('#cliente_saldoBeneficio_5').text(formatCurrencyBR(cliente.saldoBeneficio_5));

        // Preenche o card "Margem 35%" (Formatado)
        $('#cliente_bruta_35').text(formatCurrencyBR(cliente.bruta_35));
        $('#cliente_utilizado_35').text(formatCurrencyBR(cliente.util_35));
        $('#cliente_saldo_35').text(formatCurrencyBR(cliente.saldo_35));

        // Preenche o card "Totais" (Formatado)
        $('#cliente_total_util').text(formatCurrencyBR(cliente.total_util));
        $('#cliente_total_saldo').text(formatCurrencyBR(cliente.total_saldo));

        // Preenche a tabela de Débitos (Formatando Parcela e Saldo Devedor)
        const tbody = $('#tabelaDebitosBody');
        tbody.empty();

        if (debitos.length > 0) {
          debitos.forEach(d => {
            const parcela = parseFloat(d.parcela) || 0;
            const prazo = parseInt(d.prazo_restante) || 0;
            
            console.log('Dados iniciais:', { parcela, prazo });
            
            // Calcula o saldo devedor com desconto baseado no prazo
            const devedor = parcela * prazo;
            let percentual = 0;
            
            console.log('Valor devedor calculado:', devedor);
            
            // Define o percentual de desconto baseado no prazo
            if (prazo <= 96 && prazo >= 84) {
              percentual = 0.40;
              console.log('Faixa 84-96: 40% de desconto');
            } else if (prazo <= 83 && prazo >= 72) {
              percentual = 0.35;
              console.log('Faixa 72-83: 35% de desconto');
            } else if (prazo <= 71 && prazo >= 60) {
              percentual = 0.30;
              console.log('Faixa 60-71: 30% de desconto');
            } else if (prazo <= 59 && prazo >= 40) {
              percentual = 0.25;
              console.log('Faixa 40-59: 25% de desconto');
            } else if (prazo <= 39 && prazo >= 1) {
              percentual = 0.15;
              console.log('Faixa 1-39: 15% de desconto');
            }
            
            console.log('Percentual de desconto aplicado:', percentual);
            
            const desconto = devedor * percentual;
            const saldoDevedor = devedor - desconto;
            
            console.log('Cálculos finais:', {
              desconto,
              saldoDevedor
            });

            tbody.append(`
              <tr>
                <td>${d.matricula || '-'}</td>
                <td>${d.banco || '-'}</td>
                <td>${d.orgao || '-'}</td>
                <td>${formatCurrencyBR(parcela)}</td> {# Formatado #}
                <td>${prazo}</td>
                <td>${d.tipo_contrato || '-'}</td>
                <td>${formatCurrencyBR(saldoDevedor)}</td> {# Formatado #}
              </tr>
            `);
          });
        } else {
          tbody.append(`
            <tr>
              <td colspan="7" class="text-center">Nenhum débito encontrado.</td>
            </tr>
          `);
        }

        // Carrega os telefones do cliente
        fetch(`/siape/api/get/telefones-cliente/?cpf=${cpf}`)
          .then(response => response.json())
          .then(data => {
            if (data.result && data.data && data.data.telefones) {
              carregarTelefonesCliente(data.data.telefones);
            } else if (data.telefones) {
              // Fallback caso a estrutura seja diferente
              carregarTelefonesCliente(data.telefones);
            } else {
              carregarTelefonesCliente([]);
            }
          })
          .catch(error => {
            console.error('Erro ao carregar telefones:', error);
            carregarTelefonesCliente([]);
          });

        // (Opcional) rolar até a ficha do cliente
        $('html, body').animate({
          scrollTop: $('#col2').offset().top - 20
        }, 400);
      },
      error: function (xhr) {
        let msg = 'Erro ao buscar informações do cliente.';
        if (xhr.responseJSON && xhr.responseJSON.erro) {
          msg = xhr.responseJSON.erro;
        }
        alert(msg);
        console.error('Erro na consulta:', xhr);
      }
    });
  });

  // --- Manipulador para o formulário de Agendamento --- //
  $('#appointment-form').on('submit', function(e) {
    e.preventDefault();

    const formData = $(this).serialize();
    const submitButton = $(this).find('button[type="submit"]');
    const buttonText = submitButton.html();

    console.log("Enviando dados do agendamento:", formData);

    submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Agendando...');
    $.ajax({
      url: '/siape/api/post/agendamento-cliente/',
      type: 'POST',
      data: formData,
      success: function(response) {
        console.log("Resposta do servidor (sucesso):", response);
        if (response.status === 'sucesso') {
          alert(response.mensagem || 'Agendamento realizado com sucesso!');
          $('#appointment-form')[0].reset();
          buscarAgendamentos();
        }
      },
      error: function(xhr) {
        console.error("Erro na requisição de agendamento:", xhr);
        let errorMsg = 'Erro ao tentar agendar.';
        if (xhr.responseJSON && xhr.responseJSON.mensagem) {
          errorMsg = xhr.responseJSON.mensagem;
        } else if (xhr.statusText) {
          errorMsg += ` (${xhr.statusText})`;
        }
        alert(errorMsg);
      },
      complete: function() {
        submitButton.prop('disabled', false).html(buttonText);
      }
    });
  });

  /**
   * Busca os agendamentos do usuário via API
   */
  function buscarAgendamentos() {
    $('#lista-agendamentos').html(`
      <div class="text-center text-muted py-3">
        <i class='bx bx-loader-alt bx-spin'></i> Carregando agendamentos...
      </div>
    `);

    $.ajax({
      url: '/siape/api/get/agendamentos-cliente/',
      type: 'GET',
      success: function(response) {
        if (response.status === 'sucesso' && response.agendamentos) {
          popularListaAgendamentos(response.agendamentos);
        } else {
          $('#lista-agendamentos').html(`
            <div class="text-center text-muted py-3">
              <i class='bx bx-error-circle'></i> Não foi possível carregar os agendamentos.
            </div>
          `);
        }
      },
      error: function(xhr) {
        console.error("Erro ao buscar agendamentos:", xhr);
        $('#lista-agendamentos').html(`
          <div class="text-center text-muted py-3">
            <i class='bx bx-error-circle'></i> Erro ao carregar agendamentos.
          </div>
        `);
      }
    });
  }

  /**
   * Popula a lista de agendamentos no HTML com os dados recebidos.
   * @param {Array<Object>} agendamentos - Um array de objetos de agendamento 
   */
  function popularListaAgendamentos(agendamentos) {
    const listaElement = $('#lista-agendamentos');
    
    // Limpa a lista atual
    listaElement.empty();

    if (!agendamentos || agendamentos.length === 0) {
      // Se não há agendamentos, mostra uma mensagem
      listaElement.html(`
        <div class="empty-message">
          <i class='bx bx-calendar-x'></i>
          <p>Nenhum agendamento encontrado</p>
        </div>
      `);
      return;
    }

    // Cria uma lista formatada com os agendamentos
    const listGroup = $('<ul>').addClass('list-group');
    
    agendamentos.forEach(agendamento => {
      // Cria o item da lista (<li>)
      const listItem = $('<li>').addClass('list-group-item d-flex justify-content-between align-items-center agendamento-item');
      
      // Telefone de contato (se disponível) com ícone HOT
      const telefoneInfo = agendamento.telefone_contato ? 
        `<small class="d-block text-info agendamento-telefone-hot">
          <i class='bx bx-phone'></i> ${agendamento.telefone_contato}
          <i class="bx bxs-flame telefone-hot-mini" title="Número HOT - Agendamento"></i>
        </small>` : 
        '';

      // Adicionamos o cliente_id e agendamento_id como atributos de dados para o nome do cliente
      listItem.html(`
        <div class="agendamento-info-cliente">
          <strong class="agendamento-nome" 
                  data-cliente-id="${agendamento.cliente_id || ''}" 
                  data-agendamento-id="${agendamento.id || ''}"
                  title="${agendamento.cliente_nome}">${agendamento.cliente_nome}</strong>
          <small class="d-block text-muted agendamento-cpf">${agendamento.cliente_cpf}</small>
          ${telefoneInfo}
        </div>
        <div class="agendamento-data-hora text-center">
          <span class="agendamento-data">${agendamento.data}</span>
          <strong class="agendamento-hora">${agendamento.hora}</strong>
        </div>
        <div class="agendamento-acoes">
          <button class="status-btn agendamento-confirmar" id="btn-confirmar-${agendamento.id}" title="Confirmar agendamento">
            <i class='bx bx-check-circle agendamento-icone'></i>
          </button>
        </div>
      `);
      
      // Adiciona o item à lista
      listGroup.append(listItem);
    });
    
    // Adiciona a lista ao contêiner
    listaElement.append(listGroup);

    // Adiciona o evento de clique ao nome do cliente para carregar sua ficha
    $('.agendamento-nome').on('click', function() {
      const clienteId = $(this).data('cliente-id');
      const agendamentoId = $(this).data('agendamento-id');
      
      if (clienteId && agendamentoId) {
        carregarFichaClienteComAgendamento(clienteId, agendamentoId);
      } else if (clienteId) {
        carregarFichaClientePorId(clienteId);
      } else {
        alert('ID do cliente não disponível para este agendamento.');
      }
    });

    // Remove o tooltip genérico já que cada nome já tem seu próprio title com o nome completo
    // $('.agendamento-nome').attr('title', 'Clique para ver ficha completa');
    
    // Adiciona funcionalidade para o botão de confirmação
    $('.status-btn').on('click', function() {
      const agendamentoId = $(this).attr('id').replace('btn-confirmar-', '');
      const btnElement = $(this);
      // Item pai da lista para remoção animada posteriormente
      const listItem = $(this).closest('li.agendamento-item');
      
      // Verifica se já está confirmado
      if (btnElement.hasClass('confirmed')) {
        return;
      }
      
      // Mostra indicador de carregamento no botão
      const iconOriginal = btnElement.find('i').attr('class');
      btnElement.find('i').attr('class', 'bx bx-loader-alt bx-spin');
      btnElement.prop('disabled', true);
      
      // Faz a chamada AJAX para confirmar o agendamento
      $.ajax({
        url: '/siape/api/post/confirm-agendamento/',
        type: 'POST',
        data: {
          agendamento_id: agendamentoId
        },
        success: function(response) {
          if (response.status === 'sucesso') {
            // Adiciona a classe para mudar a cor do ícone
            btnElement.addClass('confirmed');
            
            // Exibe mensagem de sucesso
            const toast = $(`<div class="toast-success">Agendamento confirmado</div>`);
            $('body').append(toast);
            setTimeout(() => toast.fadeOut(function() { $(this).remove(); }), 3000);
            
            // Anima a remoção do item da lista
            listItem.fadeOut(500, function() {
              // Após a animação, recarrega a lista completa
              buscarAgendamentos();
            });
          } else {
            alert('Erro ao confirmar agendamento: ' + response.mensagem);
            btnElement.find('i').attr('class', iconOriginal);
            btnElement.prop('disabled', false);
          }
        },
        error: function(xhr) {
          let mensagem = 'Erro ao confirmar agendamento.';
          if (xhr.responseJSON && xhr.responseJSON.mensagem) {
            mensagem = xhr.responseJSON.mensagem;
          }
          alert(mensagem);
          console.error('Erro ao confirmar agendamento:', xhr);
          
          // Restaura o ícone original em caso de erro
          btnElement.find('i').attr('class', iconOriginal);
          btnElement.prop('disabled', false);
        }
      });
    });
  }

  /**
   * Carrega a ficha do cliente e informações do agendamento selecionado
   * @param {number|string} clienteId - ID do cliente a ser consultado
   * @param {number|string} agendamentoId - ID do agendamento
   */
  function carregarFichaClienteComAgendamento(clienteId, agendamentoId) {
    // Mostra indicador de carregamento
    $('#col2').html(`
      <div class="text-center my-5">
        <i class='bx bx-loader-alt bx-spin' style="font-size: 3rem;"></i>
        <p class="mt-3">Carregando dados do cliente...</p>
      </div>
    `).slideDown();

    // Faz a requisição para a API com o ID do cliente e do agendamento
    $.ajax({
      url: '/siape/api/get/infocliente/',
      type: 'GET',
      data: { 
        cliente_id: clienteId,
        agendamento_id: agendamentoId 
      },
      success: function(response) {
        if (response.status === 'sucesso') {
          // Processa os dados do cliente e preenche a ficha
          const cliente = response.cliente;
          const debitos = response.debitos;

          // Restaura a estrutura HTML da coluna 2
          $('#col2').html(`
            <div class="header-title mb-3">
              <h1 class="titulo-pagina ficha-cliente-title">
                <i class='bx bx-folder-open me-2'></i>Ficha do Cliente
              </h1>
            </div>
            <div class="container-ficha_cliente">
              <!-- CARD: Informações Pessoais -->
              <div class="card mb-4" id="card-info-pessoal">
                <div class="card-header">
                  <i class='bx bx-user me-2'></i> Informações Pessoais
                </div>
                <div class="card-body">
                  <p><i class='bx bx-user me-2'></i><strong>Nome:</strong> <span id="cliente_nome"></span></p>
                  <p><i class='bx bx-id-card me-2'></i><strong>CPF:</strong> <span id="cliente_cpf"></span></p>
                  <p><i class='bx bx-map me-2'></i><strong>UF:</strong> <span id="cliente_uf"></span></p>
                  <p><i class='bx bx-building me-2'></i><strong>RJur:</strong> <span id="cliente_rjur"></span></p>
                  <p><i class='bx bx-user-check me-2'></i><strong>Situação Funcional:</strong> <span id="cliente_situacao"></span></p>
                  <p><i class='bx bx-money me-2'></i><strong>Renda Bruta:</strong> R$ <span id="cliente_renda_bruta"></span></p>
                </div>
              </div>

              <!-- CARDS: Margens 5% e 5% Benefício lado a lado -->
              <div class="flex-container margem5-container mb-4">
                <!-- Margem 5% -->
                <div class="card" id="card-margem5">
                  <div class="card-header">
                    <i class='bx bx-percentage me-2'></i> Margem 5%
                  </div>
                  <div class="card-body">
                    <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_bruta_5"></span></p>
                    <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizado_5"></span></p>
                    <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldo_5"></span></p>
                  </div>
                </div>
                <!-- Margem 5% Benefício -->
                <div class="card" id="card-margem5-beneficio">
                  <div class="card-header">
                    <i class='bx bx-money me-2'></i> Margem 5% Benefício
                  </div>
                  <div class="card-body">
                    <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_brutaBeneficio_5"></span></p>
                    <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizadoBeneficio_5"></span></p>
                    <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldoBeneficio_5"></span></p>
                  </div>
                </div>
              </div>

              <!-- CARD: Margem 35% -->
              <div class="card mb-4" id="card-margem35">
                <div class="card-header">
                  <i class='bx bx-percentage me-2'></i> Margem 35%
                </div>
                <div class="card-body">
                  <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_bruta_35"></span></p>
                  <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizado_35"></span></p>
                  <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldo_35"></span></p>
                </div>
              </div>

              <!-- CARD: Totais -->
              <div class="card mb-4" id="card-totais">
                <div class="card-header">
                  <i class='bx bx-calculator me-2'></i> Totais
                </div>
                <div class="card-body">
                  <p><i class='bx bx-money me-2'></i><strong>Total Utilizado:</strong> R$ <span id="cliente_total_util"></span></p>
                  <p><i class='bx bx-wallet me-2'></i><strong>Total Disponível:</strong> R$ <span id="cliente_total_saldo"></span></p>
                </div>
              </div>

              <!-- CARD: Débitos -->
              <div class="card mb-4" id="card-debitos">
                <div class="card-header">
                  <i class='bx bx-file me-2'></i> Débitos
                </div>
                <div class="card-body">
                  <table class="table table-bordered">
                    <thead>
                      <tr>
                        <th>Matrícula</th>
                        <th>Banco</th>
                        <th>Órgão</th>
                        <th>Parcela</th>
                        <th>Prazo</th>
                        <th>Tipo de Contrato</th>
                        <th>Saldo Devedor</th>
                      </tr>
                    </thead>
                    <tbody id="tabelaDebitosBody">
                      <!-- JS popula aqui -->
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- CARD: Telefones do Cliente -->
              <div class="card mb-4" id="card-telefones-cliente">
                <div class="card-header">
                  <i class='bx bx-phone me-2'></i> Telefones do Cliente
                </div>
                <div class="card-body">
                  <div id="lista-telefones" class="telefones-flex-container">
                    <!-- Será populado via jQuery -->
                    <div class="text-center text-muted w-100">
                      <i class='bx bx-loader-alt bx-spin'></i> Carregando telefones...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `);

          // Preenche o ID do cliente no formulário de agendamento
          $('#agendamento_cliente_id').val(cliente.id);
          
          // Exibe o card de agendamento
          $('.agendamento-card').slideDown();

          // Preenche Informações Pessoais
          $('#cliente_nome').text(cliente.nome || '-');
          $('#cliente_cpf').text(cliente.cpf || '-');
          $('#cliente_uf').text(cliente.uf || '-');
          $('#cliente_rjur').text(cliente.rjur || '-');
          $('#cliente_situacao').text(cliente.situacao_funcional || '-');
          $('#cliente_renda_bruta').text(formatCurrencyBR(cliente.renda_bruta)); // Formatado

          // Preenche o card "Margem 5%" (Formatado)
          $('#cliente_bruta_5').text(formatCurrencyBR(cliente.bruta_5));
          $('#cliente_utilizado_5').text(formatCurrencyBR(cliente.util_5));
          $('#cliente_saldo_5').text(formatCurrencyBR(cliente.saldo_5));

          // Preenche o card "Margem 5% Benefício" (Formatado)
          $('#cliente_brutaBeneficio_5').text(formatCurrencyBR(cliente.brutaBeneficio_5));
          $('#cliente_utilizadoBeneficio_5').text(formatCurrencyBR(cliente.utilBeneficio_5));
          $('#cliente_saldoBeneficio_5').text(formatCurrencyBR(cliente.saldoBeneficio_5));

          // Preenche o card "Margem 35%" (Formatado)
          $('#cliente_bruta_35').text(formatCurrencyBR(cliente.bruta_35));
          $('#cliente_utilizado_35').text(formatCurrencyBR(cliente.util_35));
          $('#cliente_saldo_35').text(formatCurrencyBR(cliente.saldo_35));

          // Preenche o card "Totais" (Formatado)
          $('#cliente_total_util').text(formatCurrencyBR(cliente.total_util));
          $('#cliente_total_saldo').text(formatCurrencyBR(cliente.total_saldo));

          // Carrega telefones do cliente via API específica para agendamento
          fetch(`/siape/api/get/telefones-cliente/?cpf=${cliente.cpf}`)
            .then(response => response.json())
            .then(data => {
              if (data.result && data.data && data.data.telefones) {
                carregarTelefonesCliente(data.data.telefones);
              } else if (data.telefones) {
                // Fallback caso a estrutura seja diferente
                carregarTelefonesCliente(data.telefones);
              } else {
                carregarTelefonesCliente([]);
              }
            })
            .catch(error => {
              console.error('Erro ao carregar telefones:', error);
              carregarTelefonesCliente([]);
            });

          // Preenche a tabela de Débitos
          const tbody = $('#tabelaDebitosBody');
          tbody.empty();

          if (debitos && debitos.length > 0) {
            debitos.forEach(d => {
              const parcela = parseFloat(d.parcela) || 0;
              const prazo = parseInt(d.prazo_restante) || 0;
              
              console.log('Dados iniciais:', { parcela, prazo });
              
              // Calcula o saldo devedor com desconto baseado no prazo
              const devedor = parcela * prazo;
              let percentual = 0;
              
              console.log('Valor devedor calculado:', devedor);
              
              // Define o percentual de desconto baseado no prazo
              if (prazo <= 96 && prazo >= 84) {
                percentual = 0.40;
                console.log('Faixa 84-96: 40% de desconto');
              } else if (prazo <= 83 && prazo >= 72) {
                percentual = 0.35;
                console.log('Faixa 72-83: 35% de desconto');
              } else if (prazo <= 71 && prazo >= 60) {
                percentual = 0.30;
                console.log('Faixa 60-71: 30% de desconto');
              } else if (prazo <= 59 && prazo >= 40) {
                percentual = 0.25;
                console.log('Faixa 40-59: 25% de desconto');
              } else if (prazo <= 39 && prazo >= 1) {
                percentual = 0.15;
                console.log('Faixa 1-39: 15% de desconto');
              }
              
              console.log('Percentual de desconto aplicado:', percentual);
              
              const desconto = devedor * percentual;
              const saldoDevedor = devedor - desconto;
              
              console.log('Cálculos finais:', {
                desconto,
                saldoDevedor
              });

              tbody.append(`
                <tr>
                  <td>${d.matricula || '-'}</td>
                  <td>${d.banco || '-'}</td>
                  <td>${d.orgao || '-'}</td>
                  <td>${formatCurrencyBR(parcela)}</td> {# Formatado #}
                  <td>${prazo}</td>
                  <td>${d.tipo_contrato || '-'}</td>
                  <td>${formatCurrencyBR(saldoDevedor)}</td> {# Formatado #}
                </tr>
              `);
            });
          } else {
            tbody.append(`
              <tr>
                <td colspan="7" class="text-center">Nenhum débito encontrado.</td>
              </tr>
            `);
          }

          // Se temos informações do agendamento, exibe o card na coluna 1
          if (response.agendamento) {
            console.log('Dados do agendamento recebidos:', response.agendamento);
            
            // Inicializa os detalhes do agendamento com as novas funcionalidades
            inicializarDetalhesAgendamento(response.agendamento, cliente.cpf);
          } else {
            // Se não temos informações de agendamento, esconde o card
            $('.observacao-agendamento-card').hide();
          }

          // Adiciona a classe para justificar o layout como space-around
          $('#three-col-layout').addClass('all-columns-visible');

          // Rola até a ficha do cliente
          $('html, body').animate({
            scrollTop: $('#col2').offset().top - 20
          }, 400);
        } else {
          $('#col2').html(`
            <div class="alert alert-warning my-4">
              <i class='bx bx-error-circle me-2'></i> Não foi possível carregar os dados do cliente.
            </div>
          `);
        }
      },
      error: function(xhr) {
        let mensagem = 'Erro ao buscar informações do cliente.';
        if (xhr.responseJSON && xhr.responseJSON.erro) {
          mensagem = xhr.responseJSON.erro;
        }
        
        $('#col2').html(`
          <div class="alert alert-danger my-4">
            <i class='bx bx-error-circle me-2'></i> ${mensagem}
          </div>
        `);
        
        console.error('Erro ao buscar cliente:', xhr);
      }
    });
  }

  /**
   * Carrega a ficha do cliente a partir do ID e exibe os dados
   * @param {number|string} clienteId - ID do cliente a ser consultado
   * @param {Object} agendamentoInfo - Informações do agendamento (opcional)
   */
  function carregarFichaClientePorId(clienteId, agendamentoInfo) {
    // Mostra indicador de carregamento
    $('#col2').html(`
      <div class="text-center my-5">
        <i class='bx bx-loader-alt bx-spin' style="font-size: 3rem;"></i>
        <p class="mt-3">Carregando dados do cliente...</p>
      </div>
    `).slideDown();

    // Se temos informações de agendamento, exibe o card de observação
    if (agendamentoInfo) {
      console.log('Dados do agendamento para exibir card:', agendamentoInfo);
      // Será preenchido quando inicializarDetalhesAgendamento for chamado
    } else {
      // Se não temos informações de agendamento, esconde o card
      $('.observacao-agendamento-card').hide();
    }

    // Faz a requisição para a API
    $.ajax({
      url: '/siape/api/get/infocliente/',
      type: 'GET',
      data: { cliente_id: clienteId },
      success: function(response) {
        if (response.status === 'sucesso') {
          const cliente = response.cliente;
          const info_pessoal = response.info_pessoal;
          const debitos = response.debitos;

          // Restaura a estrutura HTML da coluna 2
          $('#col2').html(`
            <div class="header-title mb-3">
              <h1 class="titulo-pagina ficha-cliente-title">
                <i class='bx bx-folder-open me-2'></i>Ficha do Cliente
              </h1>
            </div>
            <div class="container-ficha_cliente">
              <!-- CARD: Informações Pessoais -->
              <div class="card mb-4" id="card-info-pessoal">
                <div class="card-header">
                  <i class='bx bx-user me-2'></i> Informações Pessoais
                </div>
                <div class="card-body">
                  <p><i class='bx bx-user me-2'></i><strong>Nome:</strong> <span id="cliente_nome"></span></p>
                  <p><i class='bx bx-id-card me-2'></i><strong>CPF:</strong> <span id="cliente_cpf"></span></p>
                  <p><i class='bx bx-map me-2'></i><strong>UF:</strong> <span id="cliente_uf"></span></p>
                  <p><i class='bx bx-building me-2'></i><strong>RJur:</strong> <span id="cliente_rjur"></span></p>
                  <p><i class='bx bx-user-check me-2'></i><strong>Situação Funcional:</strong> <span id="cliente_situacao"></span></p>
                  <p><i class='bx bx-money me-2'></i><strong>Renda Bruta:</strong> R$ <span id="cliente_renda_bruta"></span></p>
                </div>
              </div>

              <!-- CARDS: Margens 5% e 5% Benefício lado a lado -->
              <div class="flex-container margem5-container mb-4">
                <!-- Margem 5% -->
                <div class="card" id="card-margem5">
                  <div class="card-header">
                    <i class='bx bx-percentage me-2'></i> Margem 5%
                  </div>
                  <div class="card-body">
                    <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_bruta_5"></span></p>
                    <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizado_5"></span></p>
                    <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldo_5"></span></p>
                  </div>
                </div>
                <!-- Margem 5% Benefício -->
                <div class="card" id="card-margem5-beneficio">
                  <div class="card-header">
                    <i class='bx bx-money me-2'></i> Margem 5% Benefício
                  </div>
                  <div class="card-body">
                    <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_brutaBeneficio_5"></span></p>
                    <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizadoBeneficio_5"></span></p>
                    <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldoBeneficio_5"></span></p>
                  </div>
                </div>
              </div>

              <!-- CARD: Margem 35% -->
              <div class="card mb-4" id="card-margem35">
                <div class="card-header">
                  <i class='bx bx-percentage me-2'></i> Margem 35%
                </div>
                <div class="card-body">
                  <p><i class='bx bx-coin me-2'></i><strong>Bruta:</strong> R$ <span id="cliente_bruta_35"></span></p>
                  <p><i class='bx bx-money me-2'></i><strong>Utilizado:</strong> R$ <span id="cliente_utilizado_35"></span></p>
                  <p><i class='bx bx-wallet me-2'></i><strong>Saldo:</strong> R$ <span id="cliente_saldo_35"></span></p>
                </div>
              </div>

              <!-- CARD: Totais -->
              <div class="card mb-4" id="card-totais">
                <div class="card-header">
                  <i class='bx bx-calculator me-2'></i> Totais
                </div>
                <div class="card-body">
                  <p><i class='bx bx-money me-2'></i><strong>Total Utilizado:</strong> R$ <span id="cliente_total_util"></span></p>
                  <p><i class='bx bx-wallet me-2'></i><strong>Total Disponível:</strong> R$ <span id="cliente_total_saldo"></span></p>
                </div>
              </div>

              <!-- CARD: Débitos -->
              <div class="card mb-4" id="card-debitos">
                <div class="card-header">
                  <i class='bx bx-file me-2'></i> Débitos
                </div>
                <div class="card-body">
                  <table class="table table-bordered">
                    <thead>
                      <tr>
                        <th>Matrícula</th>
                        <th>Banco</th>
                        <th>Órgão</th>
                        <th>Parcela</th>
                        <th>Prazo</th>
                        <th>Tipo de Contrato</th>
                        <th>Saldo Devedor</th>
                      </tr>
                    </thead>
                    <tbody id="tabelaDebitosBody">
                      <!-- JS popula aqui -->
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- CARD: Telefones do Cliente -->
              <div class="card mb-4" id="card-telefones-cliente">
                <div class="card-header">
                  <i class='bx bx-phone me-2'></i> Telefones do Cliente
                </div>
                <div class="card-body">
                  <div id="lista-telefones" class="telefones-flex-container">
                    <!-- Será populado via jQuery -->
                    <div class="text-center text-muted w-100">
                      <i class='bx bx-loader-alt bx-spin'></i> Carregando telefones...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `);

          // Preenche o ID do cliente no formulário de agendamento
          $('#agendamento_cliente_id').val(cliente.id);
          
          // Exibe o card de agendamento
          $('.agendamento-card').slideDown();

          // Preenche Informações Pessoais
          $('#cliente_nome').text(cliente.nome || '-');
          $('#cliente_cpf').text(cliente.cpf || '-');
          $('#cliente_uf').text(cliente.uf || '-');
          $('#cliente_rjur').text(cliente.rjur || '-');
          $('#cliente_situacao').text(cliente.situacao_funcional || '-');
          $('#cliente_renda_bruta').text(formatCurrencyBR(cliente.renda_bruta)); // Formatado

          // Preenche o card "Margem 5%" (Formatado)
          $('#cliente_bruta_5').text(formatCurrencyBR(cliente.bruta_5));
          $('#cliente_utilizado_5').text(formatCurrencyBR(cliente.util_5));
          $('#cliente_saldo_5').text(formatCurrencyBR(cliente.saldo_5));

          // Preenche o card "Margem 5% Benefício" (Formatado)
          $('#cliente_brutaBeneficio_5').text(formatCurrencyBR(cliente.brutaBeneficio_5));
          $('#cliente_utilizadoBeneficio_5').text(formatCurrencyBR(cliente.utilBeneficio_5));
          $('#cliente_saldoBeneficio_5').text(formatCurrencyBR(cliente.saldoBeneficio_5));

          // Preenche o card "Margem 35%" (Formatado)
          $('#cliente_bruta_35').text(formatCurrencyBR(cliente.bruta_35));
          $('#cliente_utilizado_35').text(formatCurrencyBR(cliente.util_35));
          $('#cliente_saldo_35').text(formatCurrencyBR(cliente.saldo_35));

          // Preenche o card "Totais" (Formatado)
          $('#cliente_total_util').text(formatCurrencyBR(cliente.total_util));
          $('#cliente_total_saldo').text(formatCurrencyBR(cliente.total_saldo));

          // Preenche a lista de telefones usando a resposta da API
          if (response.telefones) {
            carregarTelefonesCliente(response.telefones);
          } else {
            carregarTelefonesCliente([]);
          }

          // Preenche a tabela de Débitos
          const tbody = $('#tabelaDebitosBody');
          tbody.empty();

          if (debitos && debitos.length > 0) {
            debitos.forEach(d => {
              const parcela = parseFloat(d.parcela) || 0;
              const prazo = parseInt(d.prazo_restante) || 0;
              
              console.log('Dados iniciais:', { parcela, prazo });
              
              // Calcula o saldo devedor com desconto baseado no prazo
              const devedor = parcela * prazo;
              let percentual = 0;
              
              console.log('Valor devedor calculado:', devedor);
              
              // Define o percentual de desconto baseado no prazo
              if (prazo <= 96 && prazo >= 84) {
                percentual = 0.40;
                console.log('Faixa 84-96: 40% de desconto');
              } else if (prazo <= 83 && prazo >= 72) {
                percentual = 0.35;
                console.log('Faixa 72-83: 35% de desconto');
              } else if (prazo <= 71 && prazo >= 60) {
                percentual = 0.30;
                console.log('Faixa 60-71: 30% de desconto');
              } else if (prazo <= 59 && prazo >= 40) {
                percentual = 0.25;
                console.log('Faixa 40-59: 25% de desconto');
              } else if (prazo <= 39 && prazo >= 1) {
                percentual = 0.15;
                console.log('Faixa 1-39: 15% de desconto');
              }
              
              console.log('Percentual de desconto aplicado:', percentual);
              
              const desconto = devedor * percentual;
              const saldoDevedor = devedor - desconto;
              
              console.log('Cálculos finais:', {
                desconto,
                saldoDevedor
              });

              tbody.append(`
                <tr>
                  <td>${d.matricula || '-'}</td>
                  <td>${d.banco || '-'}</td>
                  <td>${d.orgao || '-'}</td>
                  <td>${formatCurrencyBR(parcela)}</td> {# Formatado #}
                  <td>${prazo}</td>
                  <td>${d.tipo_contrato || '-'}</td>
                  <td>${formatCurrencyBR(saldoDevedor)}</td> {# Formatado #}
                </tr>
              `);
            });
          } else {
            tbody.append(`
              <tr>
                <td colspan="7" class="text-center">Nenhum débito encontrado.</td>
              </tr>
            `);
          }

          // Adiciona a classe para justificar o layout como space-around
          $('#three-col-layout').addClass('all-columns-visible');

          // Se há informações de agendamento, inicializa o card de detalhes
          if (agendamentoInfo) {
            // Inicializa os detalhes do agendamento com as novas funcionalidades
            inicializarDetalhesAgendamento(agendamentoInfo, cliente.cpf);
          }

          // Rola até a ficha do cliente
          $('html, body').animate({
            scrollTop: $('#col2').offset().top - 20
          }, 400);
        } else {
          $('#col2').html(`
            <div class="alert alert-warning my-4">
              <i class='bx bx-error-circle me-2'></i> Não foi possível carregar os dados do cliente.
            </div>
          `);
        }
      },
      error: function(xhr) {
        let mensagem = 'Erro ao buscar informações do cliente.';
        if (xhr.responseJSON && xhr.responseJSON.erro) {
          mensagem = xhr.responseJSON.erro;
        }
        
        $('#col2').html(`
          <div class="alert alert-danger my-4">
            <i class='bx bx-error-circle me-2'></i> ${mensagem}
          </div>
        `);
        
        console.error('Erro ao buscar cliente:', xhr);
      }
    });
  }

  // ===== FUNÇÕES PARA EDIÇÃO DE OBSERVAÇÃO =====
  
  /**
   * Configura os eventos para edição da observação do agendamento
   */
  function configurarEdicaoObservacao() {
    console.log('Configurando eventos de edição de observação...');
    
    // Remove eventos anteriores para evitar duplicação
    $(document).off('click', '#btn-editar-observacao');
    $(document).off('click', '#btn-salvar-observacao');
    $(document).off('click', '#btn-cancelar-edicao');
    
    // Evento para entrar no modo de edição
    $(document).on('click', '#btn-editar-observacao', function() {
      console.log('Botão editar clicado!');
      entrarModoEdicao();
    });
    
    // Evento para salvar a observação
    $(document).on('click', '#btn-salvar-observacao', function() {
      console.log('Botão salvar clicado!');
      salvarObservacao();
    });
    
    // Evento para cancelar a edição
    $(document).on('click', '#btn-cancelar-edicao', function() {
      console.log('Botão cancelar clicado!');
      cancelarEdicao();
    });
    
    // Evento para salvar com Enter (Ctrl+Enter no textarea)
    $(document).on('keydown', '#observacao-textarea', function(e) {
      if (e.ctrlKey && e.which === 13) { // Ctrl + Enter
        salvarObservacao();
      }
    });
    
    // Verifica se o botão existe na DOM
    setTimeout(function() {
      const btnExists = $('#btn-editar-observacao').length > 0;
      console.log('Botão de editar existe na DOM:', btnExists);
      if (btnExists) {
        console.log('Botão encontrado:', $('#btn-editar-observacao')[0]);
        // Teste manual do evento
        $('#btn-editar-observacao').click(function() {
          console.log('Evento click funcionando!');
          entrarModoEdicao();
        });
      } else {
        console.log('Botão não encontrado, tentando novamente em 500ms...');
        setTimeout(function() {
          const btnExists2 = $('#btn-editar-observacao').length > 0;
          console.log('Segunda tentativa - Botão existe:', btnExists2);
          if (btnExists2) {
            $('#btn-editar-observacao').click(function() {
              console.log('Evento click funcionando na segunda tentativa!');
              entrarModoEdicao();
            });
          }
        }, 500);
      }
    }, 100);
  }
  
  /**
   * Entra no modo de edição da observação
   */
  function entrarModoEdicao() {
    console.log('Entrando no modo de edição...');
    const observacaoAtual = $('#detalhe_agendamento_observacao').text();
    console.log('Observação atual:', observacaoAtual);
    
    // Preenche o textarea com a observação atual
    $('#observacao-textarea').val(observacaoAtual === 'Nenhuma observação registrada' ? '' : observacaoAtual);
    
    // Esconde o modo de visualização e o botão de editar, mostra o modo de edição
    $('#observacao-view').hide();
    $('#btn-editar-observacao').hide();
    $('#observacao-edit').show();
    
    console.log('Modo de edição ativado - view escondido, edit mostrado');
    
    // Foca no textarea
    $('#observacao-textarea').focus();
  }
  
  /**
   * Cancela a edição e volta ao modo de visualização
   */
  function cancelarEdicao() {
    // Mostra o modo de visualização e o botão de editar, esconde o modo de edição
    $('#observacao-view').show();
    $('#btn-editar-observacao').show();
    $('#observacao-edit').hide();
    
    // Limpa o textarea
    $('#observacao-textarea').val('');
  }
  
  /**
   * Salva a observação editada
   */
  function salvarObservacao() {
    const agendamentoId = $('#agendamento_id_edicao').val();
    const novaObservacao = $('#observacao-textarea').val().trim();
    
    if (!agendamentoId) {
      alert('ID do agendamento não encontrado.');
      return;
    }
    
    // Mostra indicador de carregamento no botão
    const btnSalvar = $('#btn-salvar-observacao');
    const textoOriginal = btnSalvar.html();
    btnSalvar.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i>Salvando...');
    
    // Faz a requisição AJAX
    $.ajax({
      url: '/siape/api/post/editar-observacao-agendamento/',
      type: 'POST',
             data: {
         agendamento_id: agendamentoId,
         observacao: novaObservacao,
         csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').first().val()
       },
      success: function(response) {
        if (response.status === 'sucesso') {
          // Atualiza a observação exibida
          const observacaoParaExibir = response.observacao || 'Nenhuma observação registrada';
          $('#detalhe_agendamento_observacao').text(observacaoParaExibir);
          
          // Volta ao modo de visualização
          cancelarEdicao();
          
          // Mostra mensagem de sucesso
          mostrarNotificacao('Observação atualizada com sucesso!', 'success');
          
          // Atualiza a lista de agendamentos para refletir a mudança
          buscarAgendamentos();
          
        } else {
          alert('Erro ao salvar observação: ' + response.mensagem);
        }
      },
      error: function(xhr) {
        let mensagem = 'Erro ao salvar observação.';
        if (xhr.responseJSON && xhr.responseJSON.mensagem) {
          mensagem = xhr.responseJSON.mensagem;
        }
        alert(mensagem);
        console.error('Erro ao salvar observação:', xhr);
      },
      complete: function() {
        // Restaura o botão
        btnSalvar.prop('disabled', false).html(textoOriginal);
      }
    });
  }
  

  
  // ===== FIM FUNÇÕES DE EDIÇÃO =====

  // ===== CONFIGURAÇÃO INICIAL DOS EVENTOS DE EDIÇÃO =====
  configurarEdicaoObservacao();
  
  // Eventos para a calculadora de saldo devedor
  $('#calcular_saldo').on('click', function() {
    calcularSaldoDevedor();
  });
  
  // Também calcular quando o usuário pressionar Enter em qualquer dos campos
  $('#calc_parcela, #calc_prazo').on('keypress', function(e) {
    if (e.which === 13) { // Código da tecla Enter
      calcularSaldoDevedor();
    }
  });
  
  // Função para calcular o saldo devedor
  function calcularSaldoDevedor() {
    // Obter valores dos campos
    const parcela = parseFloat($('#calc_parcela').val()) || 0;
    const prazo = parseInt($('#calc_prazo').val()) || 0;
    
    if (parcela <= 0 || prazo <= 0) {
      alert('Por favor, informe valores válidos para parcela e prazo.');
      return;
    }
    
    // Calcular saldo total
    const saldoTotal = parcela * prazo;
    console.log('Saldo total calculado:', saldoTotal);
    
    // Determinar o percentual de desconto baseado no prazo
    let percentual = 0;
    
    if (prazo <= 96 && prazo >= 84) {
      percentual = 0.40; // 40%
      console.log('Faixa 84-96: 40% de desconto');
    } else if (prazo <= 83 && prazo >= 72) {
      percentual = 0.35; // 35%
      console.log('Faixa 72-83: 35% de desconto');
    } else if (prazo <= 71 && prazo >= 60) {
      percentual = 0.30; // 30%
      console.log('Faixa 60-71: 30% de desconto');
    } else if (prazo <= 59 && prazo >= 40) {
      percentual = 0.25; // 25%
      console.log('Faixa 40-59: 25% de desconto');
    } else if (prazo <= 39 && prazo >= 1) {
      percentual = 0.15; // 15%
      console.log('Faixa 1-39: 15% de desconto');
    }
    
    // Calcular desconto e saldo final
    const desconto = saldoTotal * percentual;
    const saldoFinal = saldoTotal - desconto;
    
    console.log('Cálculos finais:', {
      percentual,
      desconto,
      saldoFinal
    });
    
    // Exibir resultados formatados
    $('#calc_saldo_total').text(formatCurrencyBR(saldoTotal));
    $('#calc_percentual').text((percentual * 100).toFixed(0)); // Percentual não precisa de formato BR
    $('#calc_desconto').text(formatCurrencyBR(desconto));
    $('#calc_saldo_final').text(formatCurrencyBR(saldoFinal));
    
    // Mostrar a seção de resultados
    $('.resultado-calculo').slideDown();
  }

  // Eventos para calcular o saldo liberado (coeficiente)
  $('#calcular_coeficiente').on('click', function() {
    calcularSaldoLiberado();
  });
  $('#coef_parcela, #coef_coeficiente').on('keypress', function(e) {
    if (e.which === 13) {  // Enter
      calcularSaldoLiberado();
    }
  });

  // Evento para limpar campos da calculadora de coeficiente
  $('#limpar_coeficiente').on('click', function() {
    // Limpa os campos de entrada
    $('#coef_parcela').val('');
    $('#coef_coeficiente').val('');
    // Limpa o resultado e esconde a seção
    $('#resultado_coeficiente').text('');
    $('.resultado-coeficiente').slideUp();
    // Foca no primeiro campo
    $('#coef_parcela').focus();
  });

  // Função para calcular o saldo liberado (parcela / coeficiente)
  function calcularSaldoLiberado() {
    const parcela = parseFloat($('#coef_parcela').val()) || 0;
    const coef = parseFloat($('#coef_coeficiente').val()) || 0;

    if (parcela <= 0 || coef <= 0) {
      alert('Por favor, informe valores válidos para parcela e coeficiente.');
      return;
    }

    const saldoLiberado = parcela / coef;
    console.log('Saldo liberado calculado:', saldoLiberado);

    // Exibe o resultado formatado
    $('#resultado_coeficiente').text(formatCurrencyBR(saldoLiberado));
    $('.resultado-coeficiente').slideDown();
  }

  // Toggle collapse no card de Consulta de Cliente
  $('.consulta-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.consulta-card').find('.card-body').slideToggle();
  });

  // Toggle collapse no card de Detalhes do Agendamento
  $('.observacao-agendamento-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.observacao-agendamento-card').find('.card-body').slideToggle();
  });

  // Toggle collapse no card de Agendamento
  $('.agendamento-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.agendamento-card').find('.card-body').slideToggle();
  });

  // Toggle collapse no card de Meus Agendamentos
  $('.agendamentos-list-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.agendamentos-list-card').find('.card-body').slideToggle();
  });

  // Toggle collapse no card de Cartão Benefício
  $('.calculadora-beneficio-card .card-header').css('cursor', 'pointer').on('click', function() {
    $(this).closest('.calculadora-beneficio-card').toggleClass('collapsed');
  });

  // Eventos para calcular Cartão Benefício
  $('#calcular_beneficio').on('click', function() {
    calcularBeneficio();
  });
  $('#beneficio_margemLiq').on('keypress', function(e) {
    if (e.which === 13) { // Enter
      calcularBeneficio();
    }
  });

  // Função para calcular os valores do Cartão Benefício
  function calcularBeneficio() {
    const margemLiq = parseFloat($('#beneficio_margemLiq').val()) || 0;
    if (margemLiq <= 0) {
      alert('Por favor, insira valor válido para Margem Líquida.');
      return;
    }
    const parcela = margemLiq * 0.90;
    const limite = parcela * 23;
    const saque = limite * 0.70;

    // Exibe resultados formatados
    $('#beneficio_parcela').text(formatCurrencyBR(parcela));
    $('#beneficio_limite').text(formatCurrencyBR(limite));
    $('#beneficio_saque').text(formatCurrencyBR(saque));
    $('.resultado-beneficio').slideDown();
  }

  // Evento para limpar campos da Calculadora de Cartão Benefício
  $('#limpar_beneficio').on('click', function() {
    $('#beneficio_margemLiq').val('');
    $('#beneficio_parcela').text('');
    $('#beneficio_limite').text('');
    $('#beneficio_saque').text('');
    $('.resultado-beneficio').slideUp();
    $('#beneficio_margemLiq').focus();
  });

  /**
   * Função para carregar e exibir telefones do cliente
   * @param {Array} telefones - Lista de telefones do cliente
   */
  function carregarTelefonesCliente(telefones) {
    const listaTelefones = $('#lista-telefones');
    
    if (!telefones || telefones.length === 0) {
      listaTelefones.html(`
        <div class="telefones-empty-message">
          <i class='bx bx-phone-off'></i> Nenhum telefone cadastrado
        </div>
      `);
      return;
    }

    let html = '';
    
    telefones.forEach(tel => {
      // Define classes baseado na origem
      const origemBadgeClass = tel.origem === 'AGENDAMENTO' ? 'telefone-origem-agendamento' : 'telefone-origem-outros';
      
      // Badge principal se aplicável
      const principalBadge = tel.principal ? 
        '<span class="telefone-principal-badge">Principal</span>' : '';
      
      // Link para agendamento se disponível
      const agendamentoLink = tel.agendamento_origem_id ? 
        `<a href="#" class="telefone-agendamento-link"><i class='bx bx-link-external'></i> Agendamento #${tel.agendamento_origem_id}</a>` : '';

      // Ícone de fogo para números de agendamento (HOT)
      const iconeHot = tel.origem === 'AGENDAMENTO' ? 
        '<i class="bx bxs-flame telefone-hot-icon" title="Número HOT - Adicionado pelo Agendamento"></i>' : '';
      
      html += `
        <div class="telefone-card ${tel.origem === 'AGENDAMENTO' ? 'telefone-card-hot' : ''}">
          <div class="telefone-numero">
            📞 ${tel.numero}
            ${iconeHot}
            ${principalBadge}
          </div>
          <div class="telefone-tipo-badge ${origemBadgeClass}">
            ${tel.tipo_display}
          </div>
          <div class="telefone-info">
            <i class='bx bx-user me-1'></i>Por: ${tel.usuario_cadastro}
            <br>
            <i class='bx bx-time me-1'></i>${tel.data_cadastro}
            <br>
            <span class="telefone-origem-badge ${origemBadgeClass}">${tel.origem_display}</span>
          </div>
          ${agendamentoLink}
          ${tel.observacoes ? `<div class="telefone-observacoes"><i class='bx bx-comment'></i> ${tel.observacoes}</div>` : ''}
        </div>
      `;
    });
    
    listaTelefones.html(html);
  }

  // ===== EVENTOS DE EDIÇÃO DE DETALHES DO AGENDAMENTO =====
  
  // Evento para aplicar máscara nos campos de telefone que estavam no HTML
  aplicarMascaraTelefone($('#novo-telefone-numero'));
  aplicarMascaraTelefone($('#telefone_contato_agendamento'));
  
  // Event listeners duplicados removidos - já existem na seção anterior

  // Evento para limpar calculadora de saldo devedor (estava no final do HTML)
  $('#limpar_calculadora').on('click', function() {
    // Limpa os campos de entrada
    $('#calc_parcela').val('');
    $('#calc_prazo').val('');
    
    // Reseta os valores exibidos
    $('#calc_saldo_total').text('0.00');
    $('#calc_percentual').text('0');
    $('#calc_desconto').text('0.00');
    $('#calc_saldo_final').text('0.00');
    
    // Esconde a seção de resultados
    $('.resultado-calculo').slideUp();
    
    // Foca no primeiro campo
    $('#calc_parcela').focus();
  });

  // ===== EVENTOS DO MODAL DE DADOS DE NEGOCIAÇÃO =====
  
  // Evento para detectar mudança no select de tabulação
  $('#tabulacao-select').on('change', function() {
    const statusSelecionado = $(this).val();
    // Chama a função que controla a exibição do subcard de negociação
    verificarExibirBotaoNegociacao(statusSelecionado);
  });
  
  // Evento para o botão "Adicionar Informações Negociação"
  $('#btn-adicionar-negociacao').on('click', function() {
    const agendamentoId = $('#agendamento_id_edicao').val();
    
    if (!agendamentoId) {
      mostrarNotificacao('Erro: ID do agendamento não encontrado.', 'error');
      return;
    }
    
    // Chama a função do modal
    window.abrirModalDadosNegociacao(agendamentoId);
  });
  
  // Evento para o botão salvar do modal
  $('#btn-salvar-negociacao').on('click', function() {
    salvarDadosNegociacaoEArquivos();
  });
  
  // Evento para adicionar arquivos selecionados à lista
  $('#negociacao_arquivos').on('change', function() {
    const novosArquivos = Array.from(this.files);
    
    if (novosArquivos.length === 0) {
      return;
    }
    
    // Adiciona os novos arquivos ao array global
    novosArquivos.forEach(arquivo => {
      // Verifica se arquivo já não foi adicionado (por nome e tamanho)
      const jaExiste = arquivosNegociacaoSelecionados.some(a => 
        a.name === arquivo.name && a.size === arquivo.size
      );
      
      if (!jaExiste) {
        // Adiciona um ID único para cada arquivo
        arquivo.id = Date.now() + Math.random();
        arquivosNegociacaoSelecionados.push(arquivo);
      }
    });
    
    // Atualiza a visualização da lista
    atualizarListaArquivosSelecionados();
    
    // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
    this.value = '';
  });
  
  // Evento para limpar o modal quando fechado
  const modalElement = document.getElementById('modalDadosNegociacao');
  
  if (modalElement) {
    // Event listener para Bootstrap (tanto 4 quanto 5)
    modalElement.addEventListener('hidden.bs.modal', function() {
      limparModalDadosNegociacao();
    });
    
    // Fallback para jQuery se disponível
    if (window.hasBootstrapJQuery) {
      $(modalElement).on('hidden.bs.modal', function() {
        limparModalDadosNegociacao();
      });
    }
    
    // Event listener para botões de fechar
    const closeButtons = modalElement.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
    closeButtons.forEach(button => {
      button.addEventListener('click', function() {
        window.fecharModalDadosNegociacao();
      });
    });
  }
  
  // ===== VALIDAÇÃO EM TEMPO REAL DOS CAMPOS DE NEGOCIAÇÃO =====
  
  // Função para validar parcelas
  function validarParcelas() {
    const parcelaAtual = $('#negociacao_parcela_atual').val().trim();
    const parcelaNova = $('#negociacao_parcela_nova').val().trim();
    
    // Remove classes de erro anteriores
    $('#negociacao_parcela_atual, #negociacao_parcela_nova').removeClass('is-invalid');
    $('.parcela-erro').remove();
    
    if (parcelaAtual && parcelaNova && parcelaAtual === parcelaNova) {
      $('#negociacao_parcela_atual, #negociacao_parcela_nova').addClass('is-invalid');
      $('#negociacao_parcela_nova').after('<div class="invalid-feedback parcela-erro">A parcela nova deve ser diferente da parcela atual</div>');
      return false;
    }
    return true;
  }
  
  // Função para validar prazos
  function validarPrazos() {
    const prazoAtual = $('#negociacao_prazo_atual').val().trim();
    const prazoAcordado = $('#negociacao_prazo_acordado').val().trim();
    
    // Remove classes de erro anteriores
    $('#negociacao_prazo_atual, #negociacao_prazo_acordado').removeClass('is-invalid');
    $('.prazo-erro').remove();
    
    if (prazoAtual && prazoAcordado && prazoAtual === prazoAcordado) {
      $('#negociacao_prazo_atual, #negociacao_prazo_acordado').addClass('is-invalid');
      $('#negociacao_prazo_acordado').after('<div class="invalid-feedback prazo-erro">O prazo acordado deve ser diferente do prazo atual</div>');
      return false;
    }
    return true;
  }
  
  // Eventos para validação em tempo real
  $('#negociacao_parcela_atual, #negociacao_parcela_nova').on('input blur', function() {
    setTimeout(validarParcelas, 100); // Pequeno delay para permitir que o valor seja atualizado
  });
  
  $('#negociacao_prazo_atual, #negociacao_prazo_acordado').on('input blur', function() {
    setTimeout(validarPrazos, 100); // Pequeno delay para permitir que o valor seja atualizado
  });

  // ===== FUNÇÕES PARA AGENDAMENTO DE CHECAGEM =====
  
  // Função para carregar coordenadores disponíveis
  function carregarCoordenadoresDisponiveis() {
    return fetch('/siape/api/get/coordenadores-horarios-disponiveis/')
      .then(response => response.json())
      .then(data => {
        const select = $('#coordenador-select');
        select.empty();
        
        if (data.success && data.coordenadores && data.coordenadores.length > 0) {
          select.append('<option value="">Selecione um coordenador...</option>');
          
          data.coordenadores.forEach(coord => {
            const opcao = `<option value="${coord.user_id}">${coord.nome} - ${coord.hierarquia_nome}</option>`;
            select.append(opcao);
          });
          
          return true;
        } else {
          select.append('<option value="">Nenhum coordenador disponível</option>');
          mostrarNotificacao('Nenhum coordenador disponível no momento.', 'error');
          return false;
        }
      })
      .catch(error => {
        console.error('Erro ao carregar coordenadores:', error);
        $('#coordenador-select').html('<option value="">Erro ao carregar coordenadores</option>');
        mostrarNotificacao('Erro ao carregar lista de coordenadores.', 'error');
        return false;
      });
  }
  
  // Função para carregar horários disponíveis para um coordenador em uma data
  function carregarHorariosDisponiveis(coordenadorId, data) {
    const select = $('#horario-checagem');
    select.prop('disabled', true).html('<option value="">Carregando horários...</option>');
    
    const params = new URLSearchParams({
      coordenador_id: coordenadorId,
      data: data
    });
    
    return fetch(`/siape/api/get/horarios-disponiveis-coordenador/?${params}`)
      .then(response => response.json())
      .then(data => {
        select.empty();
        
        if (data.success) {
          if (data.todos_ocupados) {
            select.append('<option value="">Todos os horários estão ocupados nesta data</option>');
            mostrarNotificacao('Todos os horários estão ocupados para este coordenador nesta data.', 'error');
            
            // Marca a data em vermelho se todos estão ocupados
            $('#data-checagem').addClass('is-invalid');
          } else {
            select.append('<option value="">Selecione um horário...</option>');
            
            data.horarios_disponiveis.forEach(horario => {
              select.append(`<option value="${horario.valor}">${horario.texto}</option>`);
            });
            
            select.prop('disabled', false);
            $('#data-checagem').removeClass('is-invalid').addClass('is-valid');
            
            mostrarNotificacao(`${data.disponiveis} horários disponíveis encontrados.`, 'success');
          }
          
          return !data.todos_ocupados;
        } else {
          select.append('<option value="">Erro ao carregar horários</option>');
          mostrarNotificacao(data.message || 'Erro ao carregar horários disponíveis.', 'error');
          return false;
        }
      })
      .catch(error => {
        console.error('Erro ao carregar horários:', error);
        select.html('<option value="">Erro ao carregar horários</option>');
        mostrarNotificacao('Erro de conexão ao carregar horários.', 'error');
        return false;
      });
  }
  
  // Função para mostrar/ocultar subcard de agendamento de checagem
  function verificarExibirBotaoAgendamentoChecagem(status) {
    const subcardAgendamento = $('#subcard-agendamento-checagem');
    
    // Só funciona se estiver em modo de edição
    if (!$('#tabulacao-edit').is(':visible')) {
      subcardAgendamento.hide();
      return;
    }
    
    // Verifica se o status é CHECAGEM ou REVERSAO
    if (status === 'CHECAGEM' || status === 'REVERSAO') {
      subcardAgendamento.slideDown(300).css('display', 'block');
    } else {
      subcardAgendamento.slideUp(300);
    }
  }
  
  // Função para configurar data mínima (não pode ser no passado)
  function configurarDataMinima() {
    const hoje = new Date();
    const dataFormatada = hoje.toISOString().split('T')[0];
    $('#data-checagem').attr('min', dataFormatada);
  }
  
  // ===== EVENTOS DO AGENDAMENTO DE CHECAGEM =====
  
  // Evento para o botão "Agendar Horário de Checagem"
  $(document).on('click', '#btn-agendar-checagem', function() {
    // Mostra o formulário e esconde a visualização
    $('#checagem-view').hide();
    $('#checagem-form').show();
    $('#checagem-agendado').hide();
    
    // Configura data mínima
    configurarDataMinima();
    
    // Carrega coordenadores disponíveis
    carregarCoordenadoresDisponiveis();
  });
  
  // Evento para mudança no coordenador
  $(document).on('change', '#coordenador-select', function() {
    const coordenadorId = $(this).val();
    const data = $('#data-checagem').val();
    $('#horario-checagem').prop('disabled', true).html('<option value="Primeiro selecione uma data</option>');
    if (coordenadorId && data) {
      carregarHorariosDisponiveis(coordenadorId, formatarDataParaBR(data));
    }
  });
  
  // Evento para mudança na data
  $(document).on('change', '#data-checagem', function() {
    const data = $(this).val();
    const coordenadorId = $('#coordenador-select').val();
    $('#horario-checagem').prop('disabled', true).html('<option value="Carregando...</option>');
    if (coordenadorId && data) {
      carregarHorariosDisponiveis(coordenadorId, formatarDataParaBR(data));
    } else {
      $('#horario-checagem').html('<option value="Primeiro selecione um coordenador</option>');
    }
  });
  
  // Evento para cancelar agendamento
  $(document).on('click', '#btn-cancelar-agendamento', function() {
    // Volta para a visualização inicial
    $('#checagem-form').hide();
    $('#checagem-view').show();
    
    // Limpa o formulário
    $('#coordenador-select').val('');
    $('#data-checagem').val('').removeClass('is-invalid is-valid');
    $('#horario-checagem').prop('disabled', true).html('<option value="Primeiro selecione um coordenador e uma data</option>');
    $('#observacao-checagem').val('');
  });
  
  // Evento para confirmar agendamento
  $(document).on('click', '#btn-confirmar-agendamento', function() {
    const coordenadorId = $('#coordenador-select').val();
    const data = $('#data-checagem').val();
    const horario = $('#horario-checagem').val();
    const observacao = $('#observacao-checagem').val();
    const agendamentoId = $('#agendamento_id_edicao').val();
    const cpf = $('#cliente_cpf_atual').val();

    // Validações
    if (!coordenadorId) {
      mostrarNotificacao('Selecione um coordenador.', 'error');
      return;
    }
    if (!data) {
      mostrarNotificacao('Selecione uma data.', 'error');
      return;
    }
    if (!horario) {
      mostrarNotificacao('Selecione um horário.', 'error');
      return;
    }
    if (!agendamentoId) {
      mostrarNotificacao('Erro: Agendamento não identificado.', 'error');
      return;
    }
    // O status deve ser CHECAGEM ou REVERSAO
    const status = $('#tabulacao-select').val();
    if (!(status === 'CHECAGEM' || status === 'REVERSAO')) {
      mostrarNotificacao('O status da tabulação deve ser CHECAGEM ou REVERSAO para agendar checagem.', 'error');
      return;
    }
    // Observação da tabulação
    const observacoesTabulacao = $('#tabulacao-observacoes').val();

    // Monta o payload para o backend
    const dados = {
      cpf: cpf,
      agendamento_id: agendamentoId,
      status: status,
      observacoes: observacoesTabulacao,
      // Dados do agendamento de checagem
      coordenador_id: coordenadorId,
      data_checagem: data,
      hora_checagem: horario,
      observacao_checagem: observacao
    };

    // Envia para o backend
    fetch('/siape/api/post/atualizar-tabulacao/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(dados)
    })
    .then(response => response.json())
    .then(data => {
      if (data.result) {
        mostrarNotificacao('Agendamento de checagem/reversão criado com sucesso!', 'success');
        // Atualiza a visualização do agendamento criado
        $('#agendamento-coordenador').text($('#coordenador-select option:selected').text());
        $('#agendamento-data').text(new Date(dados.data_checagem).toLocaleDateString('pt-BR'));
        $('#agendamento-horario').text(dados.hora_checagem);
        $('#agendamento-status').text('Em Espera').removeClass().addClass('badge bg-warning');
        $('#agendamento-observacao').text(dados.observacao_checagem || 'Nenhuma observação');
        // Mostra a visualização do agendamento criado
        $('#checagem-form').hide();
        $('#checagem-agendado').show();
      } else {
        mostrarNotificacao(data.message || 'Erro ao criar agendamento de checagem.', 'error');
      }
    })
    .catch(error => {
      mostrarNotificacao('Erro ao criar agendamento de checagem.', 'error');
      console.error(error);
    });
  });
  
  // ===== EVENTO PARA EXIBIR SUBCARD DE CHECAGEM =====
  
  // Evento para exibir subcard de agendamento quando tabulação é CHECAGEM ou REVERSAO
  $(document).on('change', '#tabulacao-select', function() {
    const status = $(this).val();
    verificarExibirBotaoNegociacao(status);
    verificarExibirBotaoAgendamentoChecagem(status);
  });
  
  // Esconder subcard de checagem ao cancelar edição
  $(document).on('click', '#btn-cancelar-edicao', function() {
    $('#subcard-negociacao').hide();
    $('#subcard-agendamento-checagem').hide();
  });

  // Botão Salvar Alterações do Modal (removido - versão aprimorada adicionada no final do arquivo)

  // Eventos para o modal de editar agendamento
  $(document).on('change', '#modal_data_supervisao', function() {
    const data = $(this).val();
    const coordenadorId = $('#modal_coordenador_select').val();
    $('#modal_horario_supervisao').prop('disabled', true).html('<option value="">Carregando...</option>');
    if (coordenadorId && data) {
      carregarHorariosDisponiveis(coordenadorId, formatarDataParaBR(data));
    } else {
      $('#modal_horario_supervisao').html('<option value="">Primeiro selecione um coordenador</option>');
    }
  });

  $(document).on('change', '#modal_coordenador_select', function() {
    const coordenadorId = $(this).val();
    const data = $('#modal_data_supervisao').val();
    $('#modal_horario_supervisao').prop('disabled', true).html('<option value="">Carregando...</option>');
    if (coordenadorId && data) {
      carregarHorariosDisponiveis(coordenadorId, formatarDataParaBR(data));
    } else {
      $('#modal_horario_supervisao').html('<option value="">Primeiro selecione uma data</option>');
    }
  });

  // Eventos para horário de checagem no modal
  $(document).on('change', '#modal_tabulacao_select', function() {
    const statusSelecionado = $(this).val();
    const statusAtual = $('#modal_tabulacao_atual_text').text().trim();
    const secaoChecagem = $('#modal_secao_horario_checagem');
    
    console.log('[MODAL] Verificando exibição de seção de checagem:', {
      statusSelecionado,
      statusAtual
    });
    
    // ATUALIZAÇÃO: Agora sempre mostra a seção se CHECAGEM ou REVERSAO for selecionado
    // Isso garante que os campos obrigatórios estejam sempre visíveis e acessíveis
    const deveExibirSecaoChecagem = (statusSelecionado === 'CHECAGEM' || statusSelecionado === 'REVERSAO');
    const deveExibirSecaoDadosNegociacao = (statusSelecionado === 'CHECAGEM' || statusSelecionado === 'REVERSAO');
    
    console.log('[MODAL] Deve exibir seção de checagem:', deveExibirSecaoChecagem);
    console.log('[MODAL] Deve exibir seção de dados negociação:', deveExibirSecaoDadosNegociacao);
    
    // Controla seção de agendamento de checagem/reversão
    if (deveExibirSecaoChecagem) {
      secaoChecagem.slideDown(300);
      
      // Carrega coordenadores se ainda não foram carregados
      const selectCoordenador = $('#modal_coordenador_checagem_select');
      if (selectCoordenador.find('option').length <= 1) {
        carregarCoordenadoresModalChecagemGlobal();
      }
      
      // Configura data mínima
      const hoje = new Date().toISOString().split('T')[0];
      $('#modal_data_checagem').attr('min', hoje);
      
      // Se o status atual já é CHECAGEM/REVERSAO, mostra uma mensagem informativa mas permite edição
      if (statusAtual.includes('Checagem') || statusAtual.includes('Reversão')) {
        console.log('[MODAL] Status já foi tabulado como checagem/reversão anteriormente, mas permitindo reagendamento');
        mostrarNotificacao('Este agendamento já possui checagem/reversão agendada. Você pode reagendar se necessário.', 'info');
      }
    } else {
      secaoChecagem.slideUp(300);
      // Limpa os campos e remove validações
      $('#modal_coordenador_checagem_select').val('').removeClass('is-invalid is-valid');
      $('#modal_data_checagem').val('').removeClass('is-invalid is-valid');
      $('#modal_horario_checagem').prop('disabled', true).html('<option value="">Primeiro selecione um coordenador e uma data</option>').removeClass('is-invalid is-valid');
      $('#modal_observacao_checagem').val('');
    }

    // Controla seção de dados de negociação
    const secaoDadosNegociacao = $('#modal_secao_dados_negociacao');
    const dadosChecagem = $('#modal_dados_negociacao_checagem');
    const dadosReversao = $('#modal_dados_negociacao_reversao');
    
    if (deveExibirSecaoDadosNegociacao) {
      secaoDadosNegociacao.slideDown(300);
      
      if (statusSelecionado === 'CHECAGEM') {
        // Para CHECAGEM: mostra campos completos (valor, prazo, observações + arquivos)
        dadosChecagem.show();
        dadosReversao.hide();
        console.log('[MODAL] Exibindo campos de dados de negociação para CHECAGEM');
      } else if (statusSelecionado === 'REVERSAO') {
        // Para REVERSAO: mostra apenas observações + arquivos
        dadosChecagem.hide();
        dadosReversao.show();
        console.log('[MODAL] Exibindo campos de dados de negociação para REVERSAO');
      }
    } else {
      secaoDadosNegociacao.slideUp(300);
      dadosChecagem.hide();
      dadosReversao.hide();
      
      // Limpa os campos de dados de negociação (mas NÃO os arquivos)
      $('#modal_banco_nome').val('').removeClass('is-invalid is-valid');
      $('#modal_valor_liberado').val('').removeClass('is-invalid is-valid');
      $('#modal_saldo_devedor').val('').removeClass('is-invalid is-valid');
      $('#modal_tc').val('').removeClass('is-invalid is-valid');
      $('#modal_parcela_atual').val('').removeClass('is-invalid is-valid');
      $('#modal_parcela_nova').val('').removeClass('is-invalid is-valid');
      $('#modal_troco').val('').removeClass('is-invalid is-valid');
      $('#modal_prazo_atual').val('').removeClass('is-invalid is-valid');
      $('#modal_prazo_acordado').val('').removeClass('is-invalid is-valid');
      $('#modal_descricao_negociacao').val('').removeClass('is-invalid is-valid');
      $('#modal_observacoes_reversao').val('').removeClass('is-invalid is-valid');
      
      // NÃO limpa arquivos aqui para preservar seleção do usuário
      // Os arquivos só são limpos quando o modal é fechado ou resetado completamente
      $('#modal_lista_arquivos_container').hide();
    }
  });

  $(document).on('change', '#modal_coordenador_checagem_select', function() {
    const coordenadorId = $(this).val();
    const data = $('#modal_data_checagem').val();
    const selectHorario = $('#modal_horario_checagem');
    
    // Remove classe de erro quando o usuário seleciona um coordenador
    if (coordenadorId) {
      $(this).removeClass('is-invalid').addClass('is-valid');
    } else {
      $(this).removeClass('is-valid');
    }
    
    selectHorario.prop('disabled', true).html('<option value="">Carregando...</option>');
    
    if (coordenadorId && data) {
      carregarHorariosModalChecagemGlobal(coordenadorId, data);
    } else {
      selectHorario.html('<option value="">Primeiro selecione uma data</option>');
    }
  });

  $(document).on('change', '#modal_data_checagem', function() {
    const data = $(this).val();
    const coordenadorId = $('#modal_coordenador_checagem_select').val();
    const selectHorario = $('#modal_horario_checagem');
    
    // Remove classe de erro quando o usuário seleciona uma data
    if (data) {
      $(this).removeClass('is-invalid').addClass('is-valid');
    } else {
      $(this).removeClass('is-valid');
    }
    
    selectHorario.prop('disabled', true).html('<option value="">Carregando...</option>');
    
    if (coordenadorId && data) {
      carregarHorariosModalChecagemGlobal(coordenadorId, data);
    } else {
      selectHorario.html('<option value="">Primeiro selecione um coordenador</option>');
    }
  });

  // Evento para seleção de arquivos de negociação
  $(document).on('change', '#modal_arquivos_negociacao', function() {
    const arquivos = this.files;
    const container = $('#modal_lista_arquivos_container');
    const lista = $('#modal_lista_arquivos_selecionados');
    
    if (arquivos.length > 0) {
      // Remove classe de erro e mostra container
      $(this).removeClass('is-invalid').addClass('is-valid');
      container.show();
      lista.empty();
      
      // Lista os arquivos selecionados
      Array.from(arquivos).forEach((arquivo, index) => {
        const tamanho = (arquivo.size / 1024 / 1024).toFixed(2);
        const icone = getIconeArquivo(arquivo.name);
        
        const itemHtml = `
          <div class="d-flex align-items-center justify-content-between p-2 border-bottom" data-arquivo-index="${index}">
            <div class="d-flex align-items-center">
              <i class="${icone} me-2"></i>
              <div>
                <div class="fw-bold">${arquivo.name}</div>
                <small class="text-muted">${tamanho} MB</small>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="removerArquivoNegociacao(${index})">
              <i class="bx bx-trash"></i>
            </button>
          </div>
        `;
        lista.append(itemHtml);
      });
    } else {
      $(this).removeClass('is-valid');
      container.hide();
      lista.empty();
    }
  });

  // Eventos para validação dos campos de dados de negociação
  
  // Validação do banco nome
  $(document).on('blur', '#modal_banco_nome', function() {
    const nome = $(this).val().trim();
    if (nome.length > 0) {
      $(this).removeClass('is-invalid').addClass('is-valid');
    } else {
      $(this).removeClass('is-valid');
    }
  });

  // Validação de valores monetários
  $(document).on('blur', '#modal_valor_liberado, #modal_saldo_devedor, #modal_parcela_atual, #modal_parcela_nova', function() {
    const valor = parseFloat($(this).val());
    if (valor && valor > 0) {
      $(this).removeClass('is-invalid').addClass('is-valid');
    } else {
      $(this).removeClass('is-valid');
    }
  });

  // Validação de valores opcionais (TC e troco)
  $(document).on('blur', '#modal_tc, #modal_troco', function() {
    const valor = parseFloat($(this).val());
    if (valor >= 0 || $(this).val() === '') {
      $(this).removeClass('is-invalid').addClass('is-valid');
    } else {
      $(this).removeClass('is-valid');
    }
  });

  // Validação de prazos
  $(document).on('blur', '#modal_prazo_atual', function() {
    const prazo = parseInt($(this).val());
    if (prazo >= 1 && prazo <= 96 || $(this).val() === '') {
      $(this).removeClass('is-invalid').addClass('is-valid');
    } else {
      $(this).removeClass('is-valid');
    }
  });

  $(document).on('blur', '#modal_prazo_acordado', function() {
    const prazo = parseInt($(this).val());
    if (prazo && prazo >= 1 && prazo <= 96) {
      $(this).removeClass('is-invalid').addClass('is-valid');
    } else {
      $(this).removeClass('is-valid');
    }
  });

  // Validação de textos descritivos
  $(document).on('blur', '#modal_descricao_negociacao, #modal_observacoes_reversao', function() {
    const texto = $(this).val().trim();
    if (texto.length >= 10) {
      $(this).removeClass('is-invalid').addClass('is-valid');
    } else {
      $(this).removeClass('is-valid');
    }
  });

  // Evento para validação quando horário de checagem é selecionado
  $(document).on('change', '#modal_horario_checagem', function() {
    const horario = $(this).val();
    
    // Remove classe de erro quando o usuário seleciona um horário
    if (horario) {
      $(this).removeClass('is-invalid').addClass('is-valid');
    } else {
      $(this).removeClass('is-valid');
    }
  });


  
  // Função para carregar coordenadores no modal de checagem
  function carregarCoordenadoresModalChecagem() {
    return fetch('/siape/api/get/coordenadores-horarios-disponiveis/')
      .then(response => response.json())
      .then(data => {
        const select = $('#modal_coordenador_checagem_select');
        select.empty();
        
        if (data.success && data.coordenadores && data.coordenadores.length > 0) {
          select.append('<option value="">Selecione um coordenador...</option>');
          
          data.coordenadores.forEach(coord => {
            const opcao = `<option value="${coord.user_id}">${coord.nome} - ${coord.hierarquia_nome}</option>`;
            select.append(opcao);
          });
          
          return true;
        } else {
          select.append('<option value="">Nenhum coordenador disponível</option>');
          mostrarNotificacao('Nenhum coordenador disponível no momento.', 'error');
          return false;
        }
      })
      .catch(error => {
        console.error('Erro ao carregar coordenadores:', error);
        $('#modal_coordenador_checagem_select').html('<option value="">Erro ao carregar coordenadores</option>');
        mostrarNotificacao('Erro ao carregar lista de coordenadores.', 'error');
        return false;
      });
  }

  // Função para carregar horários disponíveis no modal de checagem
  function carregarHorariosModalChecagem(coordenadorId, data) {
    const select = $('#modal_horario_checagem');
    select.prop('disabled', true).html('<option value="">Carregando horários...</option>');
    
    const params = new URLSearchParams({
      coordenador_id: coordenadorId,
      data: data
    });
    
    return fetch(`/siape/api/get/horarios-disponiveis-coordenador/?${params}`)
      .then(response => response.json())
      .then(data => {
        select.empty();
        
        if (data.success) {
          if (data.todos_ocupados) {
            select.append('<option value="">Todos os horários estão ocupados nesta data</option>');
            mostrarNotificacao('Todos os horários estão ocupados para este coordenador nesta data.', 'error');
            
            // Marca a data em vermelho se todos estão ocupados
            $('#modal_data_checagem').addClass('is-invalid');
          } else {
            select.append('<option value="">Selecione um horário...</option>');
            
            data.horarios_disponiveis.forEach(horario => {
              select.append(`<option value="${horario.valor}">${horario.texto}</option>`);
            });
            
            select.prop('disabled', false);
            $('#modal_data_checagem').removeClass('is-invalid').addClass('is-valid');
            
            mostrarNotificacao(`${data.disponiveis} horários disponíveis encontrados.`, 'success');
          }
          
          return !data.todos_ocupados;
        } else {
          select.append('<option value="">Erro ao carregar horários</option>');
          mostrarNotificacao(data.message || 'Erro ao carregar horários disponíveis.', 'error');
          return false;
        }
      })
      .catch(error => {
        console.error('Erro ao carregar horários:', error);
        select.html('<option value="">Erro ao carregar horários</option>');
        mostrarNotificacao('Erro de conexão ao carregar horários.', 'error');
        return false;
      });
  }

  // Configurar data mínima para campos de data no modal
  function configurarDataMinimaModal() {
    const hoje = new Date().toISOString().split('T')[0];
    $('#modal_data_agendamento').attr('min', hoje);
    $('#modal_data_supervisao').attr('min', hoje);
    $('#modal_data_checagem').attr('min', hoje);
  }
  
  // Evento para quando o modal é aberto
  $(document).on('shown.bs.modal', '#modalEditarAgendamento', function() {
    configurarDataMinimaModalGlobal();
    // Garante que o modal tenha display flex quando mostrado
    $(this).css('display', 'flex');
  });
  
  // Evento para quando o modal é fechado
  $(document).on('hidden.bs.modal', '#modalEditarAgendamento', function() {
    // Limpa os campos quando o modal é fechado
    $('#formEditarAgendamento')[0].reset();
    $('#modal_tabulacao_atual_text').text('Sem tabulação');
    $('#modal_horario_supervisao').prop('disabled', true).html('<option value="">Primeiro selecione um coordenador e uma data</option>');
    
    // Limpa campos de checagem
    $('#modal_secao_horario_checagem').hide();
    $('#modal_coordenador_checagem_select').val('').html('<option value="">Carregando coordenadores...</option>');
    $('#modal_data_checagem').val('').removeClass('is-invalid is-valid');
    $('#modal_horario_checagem').prop('disabled', true).html('<option value="">Primeiro selecione um coordenador e uma data</option>');
    $('#modal_observacao_checagem').val('');
    
    // Limpa campos de dados de negociação
    $('#modal_secao_dados_negociacao').hide();
    $('#modal_dados_negociacao_checagem').hide();
    $('#modal_dados_negociacao_reversao').hide();
    
    // Limpa todos os campos de checagem
    $('#modal_banco_nome').val('').removeClass('is-invalid is-valid');
    $('#modal_valor_liberado').val('').removeClass('is-invalid is-valid');
    $('#modal_saldo_devedor').val('').removeClass('is-invalid is-valid');
    $('#modal_tc').val('').removeClass('is-invalid is-valid');
    $('#modal_parcela_atual').val('').removeClass('is-invalid is-valid');
    $('#modal_parcela_nova').val('').removeClass('is-invalid is-valid');
    $('#modal_troco').val('').removeClass('is-invalid is-valid');
    $('#modal_prazo_atual').val('').removeClass('is-invalid is-valid');
    $('#modal_prazo_acordado').val('').removeClass('is-invalid is-valid');
    $('#modal_descricao_negociacao').val('').removeClass('is-invalid is-valid');
    
    // Limpa campos de reversão
    $('#modal_observacoes_reversao').val('').removeClass('is-invalid is-valid');
    
    // Limpa campos de arquivos
    $('#modal_arquivos_negociacao').val('').removeClass('is-invalid is-valid');
    $('#modal_lista_arquivos_container').hide();
    $('#modal_lista_arquivos_selecionados').empty();
    
    // Volta para display none quando fechado
    $(this).css('display', 'none');
  });
  
  // Evento para quando o modal de negociação é aberto
  $(document).on('shown.bs.modal', '#modalDadosNegociacao', function() {
    // Garante que o modal tenha display flex quando mostrado
    $(this).css('display', 'flex');
  });
  
  // Evento para quando o modal de negociação é fechado
  $(document).on('hidden.bs.modal', '#modalDadosNegociacao', function() {
    // Volta para display none quando fechado
    $(this).css('display', 'none');
  });

  // Função para fechar modal manualmente
  function fecharModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      // Tenta usar Bootstrap se disponível
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        } else {
          const newModal = new bootstrap.Modal(modalElement);
          newModal.hide();
        }
      } else {
        // Fallback: esconde o modal manualmente
        modalElement.style.display = 'none';
        modalElement.classList.remove('show');
        // Remove backdrop se existir
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
          backdrop.remove();
        }
      }
    }
  }
  
  // Eventos para fechar modais
  $(document).on('click', '[data-bs-dismiss="modal"]', function() {
    const modalId = $(this).closest('.modal').attr('id');
    if (modalId) {
      fecharModal(modalId);
    }
  });
  
  // Evento para fechar modal ao clicar no backdrop
  $(document).on('click', '.modal', function(e) {
    if (e.target === this) {
      const modalId = $(this).attr('id');
      if (modalId) {
        fecharModal(modalId);
      }
    }
  });

}); // Fim do $(document).ready

// Função utilitária para converter data YYYY-MM-DD para DD/MM/YYYY
function formatarDataParaBR(dataISO) {
  if (!dataISO) return '';
  const partes = dataISO.split('-');
  if (partes.length !== 3) return dataISO;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Função global para remover arquivo de negociação
function removerArquivoNegociacao(index) {
  const inputArquivos = document.getElementById('modal_arquivos_negociacao');
  const dt = new DataTransfer();
  
  // Adiciona todos os arquivos exceto o que será removido
  Array.from(inputArquivos.files).forEach((arquivo, i) => {
    if (i !== index) {
      dt.items.add(arquivo);
    }
  });
  
  // Atualiza o input
  inputArquivos.files = dt.files;
  
  // Dispara o evento change para atualizar a lista
  $(inputArquivos).trigger('change');
  
  console.log(`[MODAL] Arquivo ${index} removido. Arquivos restantes:`, inputArquivos.files.length);
  
  // Mostra notificação
  mostrarNotificacao('Arquivo removido da lista.', 'info');
}

// ===== FUNÇÕES APRIMORADAS PARA MODAL DE EDIÇÃO DE AGENDAMENTO =====

// Função para carregar coordenadores no modal de checagem (versão global)
function carregarCoordenadoresModalChecagemGlobal() {
  return fetch('/siape/api/get/coordenadores-horarios-disponiveis/')
    .then(response => response.json())
    .then(data => {
      const select = $('#modal_coordenador_checagem_select');
      select.empty();
      
      if (data.success && data.coordenadores && data.coordenadores.length > 0) {
        select.append('<option value="">Selecione um coordenador...</option>');
        
        data.coordenadores.forEach(coord => {
          const opcao = `<option value="${coord.user_id}">${coord.nome} - ${coord.hierarquia_nome}</option>`;
          select.append(opcao);
        });
        
        return true;
      } else {
        select.append('<option value="">Nenhum coordenador disponível</option>');
        mostrarNotificacao('Nenhum coordenador disponível no momento.', 'error');
        return false;
      }
    })
    .catch(error => {
      console.error('Erro ao carregar coordenadores:', error);
      $('#modal_coordenador_checagem_select').html('<option value="">Erro ao carregar coordenadores</option>');
      mostrarNotificacao('Erro ao carregar lista de coordenadores.', 'error');
      return false;
    });
}

// Função para carregar horários disponíveis no modal de checagem (versão global)
function carregarHorariosModalChecagemGlobal(coordenadorId, data) {
  const select = $('#modal_horario_checagem');
  select.prop('disabled', true).html('<option value="">Carregando horários...</option>');
  
  const params = new URLSearchParams({
    coordenador_id: coordenadorId,
    data: data
  });
  
  return fetch(`/siape/api/get/horarios-disponiveis-coordenador/?${params}`)
    .then(response => response.json())
    .then(data => {
      select.empty();
      
      if (data.success) {
        if (data.todos_ocupados) {
          select.append('<option value="">Todos os horários estão ocupados nesta data</option>');
          mostrarNotificacao('Todos os horários estão ocupados para este coordenador nesta data.', 'error');
          
          // Marca a data em vermelho se todos estão ocupados
          $('#modal_data_checagem').addClass('is-invalid');
        } else {
          select.append('<option value="">Selecione um horário...</option>');
          
          data.horarios_disponiveis.forEach(horario => {
            select.append(`<option value="${horario.valor}">${horario.texto}</option>`);
          });
          
          select.prop('disabled', false);
          $('#modal_data_checagem').removeClass('is-invalid').addClass('is-valid');
          
          mostrarNotificacao(`${data.disponiveis} horários disponíveis encontrados.`, 'success');
        }
        
        return !data.todos_ocupados;
      } else {
        select.append('<option value="">Erro ao carregar horários</option>');
        mostrarNotificacao(data.message || 'Erro ao carregar horários disponíveis.', 'error');
        return false;
      }
    })
    .catch(error => {
      console.error('Erro ao carregar horários:', error);
      select.html('<option value="">Erro ao carregar horários</option>');
      mostrarNotificacao('Erro de conexão ao carregar horários.', 'error');
      return false;
    });
}

// Função para configurar data mínima nos campos do modal (versão global)
function configurarDataMinimaModalGlobal() {
  const hoje = new Date().toISOString().split('T')[0];
  $('#modal_data_agendamento').attr('min', hoje);
  $('#modal_data_supervisao').attr('min', hoje);
  $('#modal_data_checagem').attr('min', hoje);
  return Promise.resolve();
}

// Função para fechar modal manualmente (versão global)
function fecharModalGlobal(modalId) {
  const modalElement = document.getElementById(modalId);
  if (modalElement) {
    // Tenta usar Bootstrap se disponível
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      } else {
        const newModal = new bootstrap.Modal(modalElement);
        newModal.hide();
      }
    } else {
      // Fallback: esconde o modal manualmente
      modalElement.style.display = 'none';
      modalElement.classList.remove('show');
      // Remove backdrop se existir
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }
    }
  }
}

// Função para carregar e preencher dados do agendamento no modal
function carregarDadosAgendamentoModal(agendamentoId) {
  return new Promise((resolve, reject) => {
    const urlDetalhes = `/siape/api/get/detalhes-agendamento/?agendamento_id=${agendamentoId}`;
    console.log('[GET] Carregando detalhes do agendamento para modal:', urlDetalhes);
    
    fetch(urlDetalhes)
      .then(response => {
        console.log('[GET] Resposta detalhes agendamento modal:', response.status, response.statusText);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('[GET] Dados recebidos detalhes agendamento modal:', data);
        
        if (data.result && data.agendamento) {
          const agendamento = data.agendamento;
          
          // Limpar todos os campos primeiro
          limparCamposModal();
          
          // Preencher dados básicos do agendamento
          preencherDadosBasicosModal(agendamento);
          
          // Preencher dados de tabulação se existirem
          preencherDadosTabulacaoModal(agendamento.tabulacao);
          
          // Preencher dados de checagem/negociação se existirem
          if (agendamento.dados_negociacao) {
            preencherDadosNegociacaoModal(agendamento.dados_negociacao);
          }
          
          // Carregar dados auxiliares (coordenadores, etc.)
          Promise.all([
            carregarCoordenadoresModalChecagemGlobal(),
            configurarDataMinimaModalGlobal()
          ]).then(() => {
            console.log('[MODAL] Todos os dados carregados com sucesso');
            resolve(agendamento);
          }).catch(error => {
            console.warn('[MODAL] Erro ao carregar dados auxiliares, mas continuando:', error);
            resolve(agendamento);
          });
          
        } else {
          reject(new Error(data.message || 'Dados do agendamento não encontrados'));
        }
      })
      .catch(error => {
        console.error('[GET] Erro ao carregar dados do agendamento:', error);
        reject(error);
      });
  });
}

// Função para limpar todos os campos do modal
function limparCamposModal() {
  console.log('[MODAL] Limpando todos os campos');
  
  // Campos básicos
  $('#modal_agendamento_id').val('');
  $('#modal_data_agendamento').val('');
  $('#modal_hora_agendamento').val('');
  $('#modal_telefone_contato').val('');
  $('#modal_observacao_agendamento').val('');
  
  // Campos de tabulação
  $('#modal_tabulacao_atual_text').text('Sem tabulação');
  $('#modal_tabulacao_select').val('EM_NEGOCIACAO');
  $('#modal_tabulacao_observacoes').val('');
  
  // Campos de checagem
  $('#modal_coordenador_checagem_select').val('').html('<option value="">Carregando coordenadores...</option>');
  $('#modal_data_checagem').val('');
  $('#modal_horario_checagem').prop('disabled', true).html('<option value="">Primeiro selecione um coordenador e uma data</option>');
  $('#modal_observacao_checagem').val('');
  
  // Campos de dados de negociação
  $('#modal_banco_nome').val('');
  $('#modal_valor_liberado').val('');
  $('#modal_saldo_devedor').val('');
  $('#modal_tc').val('');
  $('#modal_parcela_atual').val('');
  $('#modal_parcela_nova').val('');
  $('#modal_troco').val('');
  $('#modal_prazo_atual').val('');
  $('#modal_prazo_acordado').val('');
  $('#modal_descricao_negociacao').val('');
  $('#modal_observacoes_reversao').val('');
  $('#modal_arquivos_negociacao').val('');
  
  // Ocultar seções específicas
  $('#modal_secao_horario_checagem').hide();
  $('#modal_secao_dados_negociacao').hide();
  $('#modal_dados_negociacao_checagem').hide();
  $('#modal_dados_negociacao_reversao').hide();
  $('#modal_lista_arquivos_container').hide();
  $('#modal_lista_arquivos_selecionados').empty();
  
  // Remover classes de validação
  $('.modal input, .modal select, .modal textarea').removeClass('is-valid is-invalid');
}

// Função para preencher dados básicos do agendamento
function preencherDadosBasicosModal(agendamento) {
  console.log('[MODAL] Preenchendo dados básicos:', agendamento);
  
  $('#modal_agendamento_id').val(agendamento.id);
  
  // Converter data brasileira (DD/MM/YYYY) para formato ISO (YYYY-MM-DD)
  let dataFormatadaISO = agendamento.data;
  if (agendamento.data && agendamento.data.includes('/')) {
    const partes = agendamento.data.split('/');
    if (partes.length === 3) {
      dataFormatadaISO = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
    }
  }
  
  $('#modal_data_agendamento').val(dataFormatadaISO);
  $('#modal_hora_agendamento').val(agendamento.hora || '');
  $('#modal_telefone_contato').val(agendamento.telefone_contato || '');
  $('#modal_observacao_agendamento').val(agendamento.observacao || '');
}

// Função para preencher dados de tabulação
function preencherDadosTabulacaoModal(tabulacao) {
  console.log('[MODAL] Preenchendo dados de tabulação:', tabulacao);
  
  if (tabulacao) {
    const statusAtual = tabulacao.status;
    const statusTexto = getStatusText(statusAtual);
    
    $('#modal_tabulacao_atual_text').text(statusTexto);
    $('#modal_tabulacao_select').val(statusAtual);
    $('#modal_tabulacao_observacoes').val(tabulacao.observacoes || '');
    
    // Se já existe checagem/reversão agendada, mostrar informação
    if (tabulacao.agendamento_checagem) {
      console.log('[MODAL] Agendamento de checagem existente:', tabulacao.agendamento_checagem);
      // Preencher campos de checagem com dados existentes se necessário
      const checagem = tabulacao.agendamento_checagem;
      if (checagem.coordenador_id) {
        setTimeout(() => {
          $('#modal_coordenador_checagem_select').val(checagem.coordenador_id);
        }, 500);
      }
      if (checagem.data) {
        $('#modal_data_checagem').val(checagem.data);
      }
      if (checagem.hora) {
        setTimeout(() => {
          $('#modal_horario_checagem').val(checagem.hora);
        }, 1000);
      }
      if (checagem.observacao) {
        $('#modal_observacao_checagem').val(checagem.observacao);
      }
    }
  } else {
    $('#modal_tabulacao_atual_text').text('Sem tabulação');
    $('#modal_tabulacao_select').val('EM_NEGOCIACAO');
    $('#modal_tabulacao_observacoes').val('');
  }
}

// Função para preencher dados de negociação existentes
function preencherDadosNegociacaoModal(dadosNegociacao) {
  console.log('[MODAL] Preenchendo dados de negociação:', dadosNegociacao);
  
  if (dadosNegociacao) {
    $('#modal_banco_nome').val(dadosNegociacao.banco_nome || '');
    $('#modal_valor_liberado').val(dadosNegociacao.valor_liberado || '');
    $('#modal_saldo_devedor').val(dadosNegociacao.saldo_devedor || '');
    $('#modal_tc').val(dadosNegociacao.tc || '');
    $('#modal_parcela_atual').val(dadosNegociacao.parcela_atual || '');
    $('#modal_parcela_nova').val(dadosNegociacao.parcela_nova || '');
    $('#modal_troco').val(dadosNegociacao.troco || '');
    $('#modal_prazo_atual').val(dadosNegociacao.prazo_atual || '');
    $('#modal_prazo_acordado').val(dadosNegociacao.prazo_acordado || '');
    $('#modal_descricao_negociacao').val(dadosNegociacao.descricao || '');
    $('#modal_observacoes_reversao').val(dadosNegociacao.observacoes_reversao || '');
    
    // Se existem arquivos salvos, mostrar informação
    if (dadosNegociacao.arquivos && dadosNegociacao.arquivos.length > 0) {
      console.log('[MODAL] Arquivos existentes encontrados:', dadosNegociacao.arquivos.length);
      // Aqui você pode implementar exibição de arquivos já salvos se necessário
    }
  }
}

// Função para validar dados antes do envio
function validarDadosModal() {
  console.log('[MODAL] Iniciando validação completa dos dados');
  
  const erros = [];
  
  // Validações básicas obrigatórias
  const data = $('#modal_data_agendamento').val();
  const hora = $('#modal_hora_agendamento').val();
  const statusTabulacao = $('#modal_tabulacao_select').val();
  
  if (!data) {
    erros.push('Data do agendamento é obrigatória');
    $('#modal_data_agendamento').addClass('is-invalid');
  }
  
  if (!hora) {
    erros.push('Hora do agendamento é obrigatória');
    $('#modal_hora_agendamento').addClass('is-invalid');
  }
  
  // Validar telefone se preenchido
  const telefone = $('#modal_telefone_contato').val().trim();
  if (telefone && !/^\(\d{2}\) \d{4,5}-\d{4}$/.test(telefone)) {
    erros.push('Formato de telefone inválido. Use (XX) XXXXX-XXXX');
    $('#modal_telefone_contato').addClass('is-invalid');
  }
  
  // Validações específicas para CHECAGEM e REVERSAO
  if (statusTabulacao === 'CHECAGEM' || statusTabulacao === 'REVERSAO') {
    const coordenadorId = $('#modal_coordenador_checagem_select').val();
    const dataChecagem = $('#modal_data_checagem').val();
    const horarioChecagem = $('#modal_horario_checagem').val();
    const arquivos = $('#modal_arquivos_negociacao')[0].files;
    
    // Campos obrigatórios para checagem/reversão
    if (!coordenadorId) {
      erros.push('Coordenador é obrigatório para checagem/reversão');
      $('#modal_coordenador_checagem_select').addClass('is-invalid');
    }
    
    if (!dataChecagem) {
      erros.push('Data da checagem/reversão é obrigatória');
      $('#modal_data_checagem').addClass('is-invalid');
    }
    
    if (!horarioChecagem) {
      erros.push('Horário da checagem/reversão é obrigatório');
      $('#modal_horario_checagem').addClass('is-invalid');
    }
    
    // Validar data da checagem não pode ser no passado
    if (dataChecagem) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const dataChecagemObj = new Date(dataChecagem + 'T00:00:00'); // Força interpretação em timezone local
      dataChecagemObj.setHours(0, 0, 0, 0);
      
      console.log('[VALIDACAO] Data hoje:', hoje);
      console.log('[VALIDACAO] Data checagem string:', dataChecagem);
      console.log('[VALIDACAO] Data checagem obj:', dataChecagemObj);
      console.log('[VALIDACAO] Comparacao:', dataChecagemObj < hoje);
      
      if (dataChecagemObj < hoje) {
        erros.push('Data da checagem/reversão não pode ser no passado');
        $('#modal_data_checagem').addClass('is-invalid');
      }
    }
    
    // Arquivos são obrigatórios
    if (!arquivos || arquivos.length === 0) {
      erros.push('Pelo menos um arquivo é obrigatório para dados de negociação');
      $('#modal_arquivos_negociacao').addClass('is-invalid');
    }
    
    // Validações específicas por tipo
    if (statusTabulacao === 'CHECAGEM') {
      const camposObrigatorios = [
        { campo: '#modal_banco_nome', nome: 'Nome do banco' },
        { campo: '#modal_valor_liberado', nome: 'Valor liberado', tipo: 'numero' },
        { campo: '#modal_saldo_devedor', nome: 'Saldo devedor', tipo: 'numero' },
        { campo: '#modal_parcela_atual', nome: 'Parcela atual', tipo: 'numero' },
        { campo: '#modal_parcela_nova', nome: 'Nova parcela', tipo: 'numero' },
        { campo: '#modal_tc', nome: 'TC', tipo: 'numero', min: 0 },
        { campo: '#modal_prazo_acordado', nome: 'Prazo acordado', tipo: 'numero', min: 1, max: 96 },
        { campo: '#modal_descricao_negociacao', nome: 'Descrição da negociação', minLength: 10 }
      ];
      
      camposObrigatorios.forEach(config => {
        const valor = $(config.campo).val().trim();
        
        if (!valor) {
          erros.push(`${config.nome} é obrigatório`);
          $(config.campo).addClass('is-invalid');
        } else if (config.tipo === 'numero') {
          const numero = parseFloat(valor);
          if (isNaN(numero) || numero <= 0) {
            erros.push(`${config.nome} deve ser um valor válido maior que zero`);
            $(config.campo).addClass('is-invalid');
          }
          if (config.min && numero < config.min) {
            erros.push(`${config.nome} deve ser maior ou igual a ${config.min}`);
            $(config.campo).addClass('is-invalid');
          }
          if (config.max && numero > config.max) {
            erros.push(`${config.nome} deve ser menor ou igual a ${config.max}`);
            $(config.campo).addClass('is-invalid');
          }
        } else if (config.minLength && valor.length < config.minLength) {
          erros.push(`${config.nome} deve ter pelo menos ${config.minLength} caracteres`);
          $(config.campo).addClass('is-invalid');
        }
      });
      
    } else if (statusTabulacao === 'REVERSAO') {
      const observacoesReversao = $('#modal_observacoes_reversao').val().trim();
      
      if (!observacoesReversao || observacoesReversao.length < 10) {
        erros.push('Motivo da reversão deve ter pelo menos 10 caracteres');
        $('#modal_observacoes_reversao').addClass('is-invalid');
      }
    }
  }
  
  return erros;
}

// Função para coletar todos os dados do modal
function coletarDadosModal() {
  console.log('[MODAL] Coletando todos os dados do formulário');
  
  const dados = {
    agendamento_id: $('#modal_agendamento_id').val(),
    data: $('#modal_data_agendamento').val(),
    hora: $('#modal_hora_agendamento').val(),
    telefone_contato: $('#modal_telefone_contato').val().trim() || null,
    observacao: $('#modal_observacao_agendamento').val().trim() || null,
    tabulacao_status: $('#modal_tabulacao_select').val(),
    tabulacao_observacoes: $('#modal_tabulacao_observacoes').val().trim() || null
  };
  
  const statusTabulacao = dados.tabulacao_status;
  
  // Adicionar dados específicos de checagem/reversão se necessário
  if (statusTabulacao === 'CHECAGEM' || statusTabulacao === 'REVERSAO') {
    dados.coordenador_id = $('#modal_coordenador_checagem_select').val();
    dados.data_checagem = $('#modal_data_checagem').val();
    dados.hora_checagem = $('#modal_horario_checagem').val();
    dados.observacao_checagem = $('#modal_observacao_checagem').val().trim() || null;
    
    // Marcar que existem arquivos para upload
    const arquivos = $('#modal_arquivos_negociacao')[0].files;
    dados.tem_arquivos_negociacao = arquivos && arquivos.length > 0;
    dados.quantidade_arquivos = arquivos ? arquivos.length : 0;
    
    if (statusTabulacao === 'CHECAGEM') {
      // Dados específicos de checagem
      dados.banco_nome = $('#modal_banco_nome').val().trim();
      dados.valor_liberado = parseFloat($('#modal_valor_liberado').val());
      dados.saldo_devedor = parseFloat($('#modal_saldo_devedor').val());
      dados.tc = parseFloat($('#modal_tc').val()) || 0;
      dados.parcela_atual = parseFloat($('#modal_parcela_atual').val());
      dados.parcela_nova = parseFloat($('#modal_parcela_nova').val());
      dados.troco = parseFloat($('#modal_troco').val()) || 0;
      dados.prazo_atual = parseInt($('#modal_prazo_atual').val()) || 0;
      dados.prazo_acordado = parseInt($('#modal_prazo_acordado').val());
      dados.descricao_negociacao = $('#modal_descricao_negociacao').val().trim();
      
    } else if (statusTabulacao === 'REVERSAO') {
      // Dados específicos de reversão
      dados.observacoes_reversao = $('#modal_observacoes_reversao').val().trim();
    }
  }
  
  console.log('[MODAL] Dados coletados:', dados);
  return dados;
}

// Função para enviar dados do agendamento via POST
function enviarDadosAgendamento(dados) {
  return new Promise((resolve, reject) => {
    console.log('[POST] Enviando dados do agendamento:', dados);
    
    fetch('/siape/api/post/editar-agendamento/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: JSON.stringify(dados)
    })
    .then(response => {
      console.log('[POST] Resposta editar agendamento:', response.status, response.statusText);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('[POST] Dados recebidos editar agendamento:', data);
      if (data.result) {
        resolve(data);
      } else {
        reject(new Error(data.message || 'Erro desconhecido ao salvar agendamento'));
      }
    })
    .catch(error => {
      console.error('[POST] Erro ao enviar dados do agendamento:', error);
      reject(error);
    });
  });
}

// Função para fazer upload dos arquivos de negociação
function uploadArquivosNegociacao(agendamentoId) {
  return new Promise((resolve, reject) => {
    const arquivos = $('#modal_arquivos_negociacao')[0].files;
    
    if (!arquivos || arquivos.length === 0) {
      console.log('[UPLOAD] Nenhum arquivo para fazer upload');
      resolve({ message: 'Nenhum arquivo para upload', result: true });
      return;
    }
    
    console.log('[UPLOAD] Iniciando upload de', arquivos.length, 'arquivo(s)');
    console.log('[UPLOAD] Agendamento ID:', agendamentoId);
    
    const formData = new FormData();
    formData.append('agendamento_id', agendamentoId);
    
    // Adicionar todos os arquivos
    for (let i = 0; i < arquivos.length; i++) {
      formData.append('arquivos', arquivos[i]);
      console.log('[UPLOAD] Adicionando arquivo:', arquivos[i].name);
    }
    
    fetch('/siape/api/post/upload-arquivo-negociacao/', {
      method: 'POST',
      headers: {
        'X-CSRFToken': getCookie('csrftoken')
      },
      body: formData
    })
    .then(response => {
      console.log('[UPLOAD] Resposta upload arquivos:', response.status, response.statusText);
      return response.text().then(text => {
        console.log('[UPLOAD] Resposta completa:', text);
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error('[UPLOAD] Erro ao parsear JSON:', e);
          throw new Error(`Resposta inválida do servidor: ${text.substring(0, 200)}`);
        }
      });
    })
    .then(data => {
      console.log('[UPLOAD] Resultado upload arquivos:', data);
      if (data.result) {
        resolve(data);
      } else {
        reject(new Error(data.message || 'Erro ao fazer upload dos arquivos'));
      }
    })
    .catch(error => {
      console.error('[UPLOAD] Erro no upload dos arquivos:', error);
      reject(error);
    });
  });
}

// Função principal para salvar agendamento com validação completa
async function salvarAgendamentoCompleto() {
  console.log('[MODAL] Iniciando processo de salvamento completo');
  
  try {
    // 1. Validar todos os dados
    const erros = validarDadosModal();
    if (erros.length > 0) {
      const mensagemErro = erros.join('<br>• ');
      mostrarNotificacao(`Corrija os seguintes erros:<br>• ${mensagemErro}`, 'error');
      return false;
    }
    
    // 2. Coletar dados validados
    const dados = coletarDadosModal();
    
    // 3. Enviar dados principais
    const resultadoAgendamento = await enviarDadosAgendamento(dados);
    console.log('[MODAL] Agendamento salvo com sucesso:', resultadoAgendamento);
    
    // 4. Upload de arquivos se necessário
    if (dados.tem_arquivos_negociacao) {
      console.log('[MODAL] Fazendo upload dos arquivos...');
      const resultadoUpload = await uploadArquivosNegociacao(dados.agendamento_id);
      console.log('[MODAL] Upload concluído:', resultadoUpload);
    }
    
    // 5. Atualizar interface
    await atualizarInterfaceAposSalvamento(dados);
    
    // 6. Fechar modal
    fecharModalGlobal('modalEditarAgendamento');
    
    mostrarNotificacao('Agendamento atualizado com sucesso!', 'success');
    return true;
    
  } catch (error) {
    console.error('[MODAL] Erro no processo de salvamento:', error);
    mostrarNotificacao(`Erro ao salvar agendamento: ${error.message}`, 'error');
    return false;
  }
}

// Função para atualizar interface após salvamento
function atualizarInterfaceAposSalvamento(dados) {
  return new Promise((resolve) => {
    console.log('[UI] Atualizando interface após salvamento');
    
    // Atualizar dados na tela principal
    if (dados.data) {
      $('#detalhe_agendamento_data').text(formatarDataParaBR(dados.data));
    }
    if (dados.hora) {
      $('#detalhe_agendamento_hora').text(dados.hora);
    }
    if (dados.telefone_contato) {
      $('#detalhe_agendamento_telefone').text(dados.telefone_contato);
    } else {
      $('#detalhe_agendamento_telefone').text('Não informado');
    }
    if (dados.observacao) {
      $('#detalhe_agendamento_observacao').text(dados.observacao);
    } else {
      $('#detalhe_agendamento_observacao').text('Sem observação');
    }
    
    // Recarregar tabulação específica
    const cpfCliente = $('#cliente_cpf_atual').val();
    const agendamentoId = dados.agendamento_id;
    
    if (cpfCliente && agendamentoId) {
      carregarTabulacaoCliente(cpfCliente, agendamentoId);
    }
    
    // Recarregar lista de agendamentos se a função existir
    if (typeof buscarAgendamentos === 'function') {
      buscarAgendamentos();
    }
    
    resolve();
  });
}

// ===== EVENTOS APRIMORADOS =====

// Evento do botão Editar Agendamento (versão aprimorada)
$(document).off('click', '#btn-editar-detalhes').on('click', '#btn-editar-detalhes', async function() {
  // Verificar se o botão está desabilitado
  if ($(this).prop('disabled')) {
    mostrarNotificacao('Este agendamento não pode ser editado pois está em processo de checagem/reversão.', 'error');
    return;
  }
  
  const agendamentoId = $('#agendamento_id_edicao').val();
  
  if (!agendamentoId) {
    mostrarNotificacao('Erro: Agendamento não identificado.', 'error');
    return;
  }
  
  // Mostrar loading
  $(this).prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-2"></i>Carregando...');
  
  try {
    // Carregar dados do agendamento
    await carregarDadosAgendamentoModal(agendamentoId);
    
    // Abrir modal
    const modalElement = document.getElementById('modalEditarAgendamento');
    if (modalElement) {
      if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
      } else {
        modalElement.style.display = 'flex';
        modalElement.classList.add('show');
        if (!document.querySelector('.modal-backdrop')) {
          const backdrop = document.createElement('div');
          backdrop.className = 'modal-backdrop fade show';
          document.body.appendChild(backdrop);
        }
      }
    }
    
    $('#modalEditarAgendamento').css('display', 'flex');
    
  } catch (error) {
    console.error('[MODAL] Erro ao carregar dados:', error);
    mostrarNotificacao(`Erro ao carregar dados do agendamento: ${error.message}`, 'error');
  } finally {
    // Reabilitar botão
    $(this).prop('disabled', false).html('<i class="bx bx-edit me-1"></i>Editar Agendamento');
  }
});

// Evento do botão Salvar Alterações (versão aprimorada)
$(document).off('click', '#btn-salvar-edicao-agendamento').on('click', '#btn-salvar-edicao-agendamento', async function() {
  console.log('[MODAL] Botão Salvar Alterações clicado - versão aprimorada');
  
  // Desabilitar botão durante salvamento
  const $btnSalvar = $(this);
  $btnSalvar.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-2"></i>Salvando...');
  
  try {
    const sucesso = await salvarAgendamentoCompleto();
    
    if (sucesso) {
      console.log('[MODAL] Salvamento concluído com sucesso');
    } else {
      console.log('[MODAL] Salvamento cancelado devido a validação');
    }
    
  } catch (error) {
    console.error('[MODAL] Erro inesperado no salvamento:', error);
    mostrarNotificacao('Erro inesperado ao salvar. Tente novamente.', 'error');
  } finally {
    // Reabilitar botão
    $btnSalvar.prop('disabled', false).html('<i class="bx bx-save me-2"></i>Salvar Alterações');
  }
});
