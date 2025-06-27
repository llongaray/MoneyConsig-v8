$(document).ready(function() {
  // --- Configurações e URLs ---
  // As URLs são melhor passadas do template para o JS, veja o HTML.
  // Use atributos data-* no elemento <script> ou variáveis globais JS definidas no template.
  const API_GET_METAS_URL = $('#controle-metas-script').data('get-metas-url');
  const API_POST_NOVAMETA_URL = $('#controle-metas-script').data('post-novameta-url');

  // --- Elementos do DOM ---
  const $formNovaMeta = $('#form-nova-meta');
  const $selectCategoria = $('#meta_categoria');
  const $selectSetor = $('#meta_setor');
  const $selectEquipes = $('#meta_equipes');
  const $campoSetor = $('#campo-meta-setor');
  const $campoEquipes = $('#campo-meta-equipes');
  const $tabelaMetasBody = $('#tabela-metas-body');
  const $loadingIndicator = $('#loading-indicator');
  const $tabelaContainer = $('#tabela-container');
  const $noDataIndicator = $('#no-data-indicator');

  // --- Funções Auxiliares ---
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

  // Função para exibir mensagens (adaptada)
  function showMessage(type, message, duration = 5000) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        const iconClass = type === 'success' ? 'bxs-check-circle' : 'bxs-x-circle';

        const $alert = $(`
            <div class="alert ${alertClass} alert-dismissible fade" role="alert" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                <i class='bx ${iconClass}' style="font-size: 1.3rem;"></i>
                <div>${message}</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `);

        // Tenta usar um container fixo, senão um local
        let $messageContainer = $('#toast-container-fixed');
        if ($messageContainer.length === 0) {
             $messageContainer = $('#message-container');
             if ($messageContainer.length === 0) {
                 console.warn('Container de mensagens (#toast-container-fixed ou #message-container) não encontrado.');
                 // Poderia adicionar um fallback criando o container dinamicamente
                 $('#card-lista-metas .card-body').prepend('<div id="message-container" class="mb-3"></div>');
                 $messageContainer = $('#message-container');
             }
        }

        $messageContainer.append($alert);

        // Força reflow e mostra
        $alert.width();
        $alert.addClass('show');

        const timer = setTimeout(() => {
            $alert.removeClass('show');
             $alert.on('transitionend webkitTransitionEnd oTransitionEnd', function () { $(this).remove(); });
             setTimeout(() => $alert.remove(), 600);
        }, duration);

        $alert.find('.btn-close').on('click', function() {
            clearTimeout(timer);
             $(this).closest('.alert').removeClass('show');
             $(this).closest('.alert').on('transitionend webkitTransitionEnd oTransitionEnd', function () { $(this).remove(); });
             setTimeout(() => $(this).closest('.alert').remove(), 600);
        });
    }

  // Formata data ISO para dd/mm/yyyy HH:MM
  function formatarData(dataIso) {
    if (!dataIso) return '-';
    try {
      const data = new Date(dataIso);
      if (isNaN(data.getTime())) return '-';
      const dia = String(data.getDate()).padStart(2, '0');
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const ano = data.getFullYear();
      const hora = String(data.getHours()).padStart(2, '0');
      const minuto = String(data.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
    } catch (e) {
      console.error("Erro ao formatar data:", dataIso, e);
      return '-';
    }
  }

  // Atualiza visibilidade dos campos condicionais
  function atualizarCamposCondicionais() {
    const categoria = $selectCategoria.val();
    $campoSetor.removeClass('visivel');
    $campoEquipes.removeClass('visivel');

    $selectSetor.val('').prop('required', false);
    $selectEquipes.val([]).prop('required', false);

    if (categoria === 'SETOR') {
      $campoSetor.addClass('visivel');
      $selectSetor.prop('required', true);
    } else if (categoria === 'OUTROS') {
      $campoEquipes.addClass('visivel');
      $selectEquipes.prop('required', true);
    }
  }

  // --- Funções de API e População ---

  function popularTabelaMetas(metas) {
    $tabelaMetasBody.empty();
    if (metas.length === 0) {
      $tabelaContainer.hide();
      $noDataIndicator.show();
      return;
    }
    $noDataIndicator.hide();
    $tabelaContainer.show();

    metas.forEach(meta => {
      let detalheMeta = '-';
      if (meta.categoria === 'SETOR' && meta.setor_nome) {
        detalheMeta = `Setor: ${meta.setor_nome}`;
      } else if (meta.categoria === 'OUTROS' && meta.equipes_nomes && meta.equipes_nomes.length > 0) {
        detalheMeta = `Equipes: ${meta.equipes_nomes.join(', ')}`;
      }

      // Cria o formulário oculto com o ID da meta
      const formStatus = `
        <form class="form-status" method="post" style="display: inline;">
          <input type="hidden" name="meta_id" value="${meta.id}">
          <button type="button" class="btn-status btn btn-sm ${meta.status ? 'btn-success' : 'btn-secondary'}">
            ${meta.status ? 'Ativa' : 'Inativa'}
          </button>
        </form>
      `;

      const linha = `
        <tr>
          <td>${meta.titulo || '-'}</td>
          <td>${meta.valor ? parseFloat(meta.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
          <td>${meta.categoria_display || meta.categoria || '-'}</td>
          <td>${detalheMeta}</td>
          <td>${formatarData(meta.data_inicio)}</td>
          <td>${formatarData(meta.data_fim)}</td>
          <td>${formStatus}</td>
        </tr>
      `;
      $tabelaMetasBody.append(linha);
    });

    // Adiciona o evento de clique para os botões de status
    $('.btn-status').on('click', function() {
      const $form = $(this).closest('.form-status');
      const metaId = $form.find('input[name="meta_id"]').val();

      // Envia a requisição POST para atualizar o status
      $.ajax({
        url: "/api/metas/atualizar-status/",
        type: 'POST',
        data: $form.serialize(),
        headers: {
          'X-CSRFToken': getCsrfToken()
        },
        success: function(response) {
          if (response.success) {
            // Recarrega os dados da tabela após a atualização
            carregarDados();
          } else {
            showMessage('error', response.error || 'Erro ao atualizar o status da meta.');
          }
        },
        error: function(jqXHR, textStatus, errorThrown) {
          console.error("Erro ao atualizar status:", textStatus, errorThrown);
          showMessage('error', 'Erro ao atualizar o status da meta.');
        }
      });
    });
  }

  function popularSelectsFormulario(seletores) {
    $selectCategoria.find('option:not(:first)').remove();
    if (seletores.categorias && seletores.categorias.length > 0) {
      seletores.categorias.forEach(cat => {
        $selectCategoria.append(`<option value="${cat.value}">${cat.display}</option>`);
      });
      $selectCategoria.prop('disabled', false);
    } else {
        $selectCategoria.prop('disabled', true);
    }

    $selectSetor.find('option:not(:first)').remove();
    if (seletores.setores && seletores.setores.length > 0) {
      seletores.setores.forEach(setor => {
        $selectSetor.append(`<option value="${setor.id}">${setor.nome}</option>`);
      });
    }

    $selectEquipes.empty();
    if (seletores.equipes && seletores.equipes.length > 0) {
      seletores.equipes.forEach(equipe => {
        $selectEquipes.append(`<option value="${equipe.id}">${equipe.nome}</option>`);
      });
    }
  }

  function carregarDados() {
    console.log("Buscando dados das metas via", API_GET_METAS_URL);
    if (!API_GET_METAS_URL) {
        console.error("URL da API para GET não definida!");
        showMessage('error', 'Configuração inválida: URL de busca não encontrada.');
        $loadingIndicator.hide();
        $noDataIndicator.text('Erro de configuração.').show();
        return;
    }

    $loadingIndicator.show();
    $tabelaContainer.hide();
    $noDataIndicator.hide();

    $.getJSON(API_GET_METAS_URL)
      .done(function(data) {
        console.log("Dados recebidos:", data);
        popularTabelaMetas(data.metas || []);
        popularSelectsFormulario(data.seletores || {});
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        console.error("Erro ao buscar dados:", textStatus, errorThrown, jqXHR.responseText);
        showMessage('error', 'Falha ao carregar dados das metas. Tente recarregar a página.');
        $noDataIndicator.text('Erro ao carregar dados.').show();
      })
      .always(function() {
        $loadingIndicator.hide();
      });
  }

  // --- Submissão do Formulário ---
  $formNovaMeta.submit(function(e) {
    e.preventDefault();
    const $form = $(this);
    const $submitButton = $form.find('button[type="submit"]');
    const submitButtonText = $submitButton.html();

    if (!$form[0].checkValidity()) {
      $form[0].reportValidity();
      return;
    }

    const formData = {
      titulo: $('#meta_titulo').val(),
      valor: $('#meta_valor').val(),
      categoria: $('#meta_categoria').val(),
      setor_id: $('#meta_setor').val() || null,
      equipe_ids: $('#meta_equipes').val() || [],
      data_inicio: $('#meta_data_inicio').val(),
      data_fim: $('#meta_data_fim').val(),
      status: $('#meta_status').is(':checked'),
    };

    if (formData.data_inicio && formData.data_fim && formData.data_fim <= formData.data_inicio) {
         showMessage('error', 'A Data Fim deve ser posterior à Data Início.');
         $('#meta_data_fim').focus();
         return;
    }
    if (formData.categoria === 'SETOR' && !formData.setor_id) {
        showMessage('error', 'Por favor, selecione um Setor para a categoria SETOR.');
        $('#meta_setor').focus();
        return;
    }
     if (formData.categoria === 'OUTROS' && formData.equipe_ids.length === 0) {
        showMessage('error', 'Por favor, selecione pelo menos uma Equipe para a categoria OUTROS.');
        $('#meta_equipes').focus();
        return;
    }

    console.log("Enviando nova meta para", API_POST_NOVAMETA_URL, formData);
     if (!API_POST_NOVAMETA_URL) {
        console.error("URL da API para POST não definida!");
        showMessage('error', 'Configuração inválida: URL de criação não encontrada.');
        return;
    }

    $.ajax({
      url: API_POST_NOVAMETA_URL,
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(formData),
      headers: {
        'X-CSRFToken': getCsrfToken()
      },
      beforeSend: function() {
        $submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...');
      },
      success: function(response) {
        console.log("Sucesso ao criar meta:", response);
        showMessage('success', response.message || 'Meta criada com sucesso!');
        $form[0].reset();
        atualizarCamposCondicionais();
        carregarDados(); // Recarrega a lista
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.error("Erro ao criar meta:", textStatus, errorThrown, jqXHR.responseText);
        let errorMessage = 'Erro ao criar a meta.';
        if (jqXHR.responseJSON && jqXHR.responseJSON.error) {
          errorMessage = jqXHR.responseJSON.error;
          if (jqXHR.responseJSON.details) {
             errorMessage += ` (${jqXHR.responseJSON.details})`;
          }
        }
        showMessage('error', errorMessage);
      },
      complete: function() {
        $submitButton.prop('disabled', false).html(submitButtonText);
      }
    });
  });

  // --- Event Listeners ---
  $selectCategoria.change(atualizarCamposCondicionais);

  // --- Inicialização ---
  atualizarCamposCondicionais();
  carregarDados();

}); 