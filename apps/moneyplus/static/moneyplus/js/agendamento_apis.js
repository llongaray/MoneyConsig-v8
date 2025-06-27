// agendamento_apis.js

$(document).ready(function(){

  // 1) Função para buscar e renderizar a lista de agendamentos
  function fetchAgendamentos() {
    $.ajax({
      url: '/moneyplus/api/get/agendamentos/',
      method: 'GET',
      dataType: 'json',
      success: function(data) {
        const container = $('.agendamentos-list').empty();
        if (data.agendamentos && data.agendamentos.length) {
          $.each(data.agendamentos, function(_, ag) {
            const item =
              '<div class="agendamento-item">' +
                '<span class="agendamento-icon"><i class="bx bx-calendar"></i></span>' +
                '<p class="agendamento-text">' +
                  '<a href="#" class="agendamento-link" ' +
                     'data-cliente-id="' + ag.cliente_id + '" ' +
                     'data-cliente-produto="' + ag.produto + '">' +
                    ag.cliente_nome +
                  '</a>' +
                  ' - ' + ag.data + ' ' + ag.hora +
                '</p>' +
                '<span class="agendamento-confirmation" data-agendamento-id="' + ag.id + '">' +
                  '<i class="bx bx-check-circle"></i>' +
                '</span>' +
              '</div>';
            container.append(item);
          });
        } else {
          container.append('<p class="text-muted">Nenhum agendamento encontrado.</p>');
        }
      },
      error: function(xhr) {
        console.error('❌ Erro ao buscar agendamentos:', xhr);
      }
    });
  }

  // 2) Função para buscar e popular a ficha de um cliente específico
  function fetchClienteById(clienteId, produto) {
    $.ajax({
      url: '/moneyplus/api/get/cliente/',
      method: 'GET',
      data: { cliente_id: clienteId, produto: produto },
      dataType: 'json',
      success: function(data) {
        const cliente    = data.cliente;
        const debitos    = data.debitos;
        const campanhaId = data.campanha_id;

        $('#ficha-cliente-produto').text(cliente.produto);

        if (cliente.produto === 'SIAPE') {
          updateSiapeData(cliente, debitos);
          $('#inss-version, #fgts-version').hide();
          $('#siape-version').show();
        } else if (cliente.produto === 'INSS') {
          updateInssInfoData(cliente);
          updateInssDebitosData(debitos);
          $('#siape-version, #fgts-version').hide();
          $('#inss-version').show();
        } else if (cliente.produto === 'FGTS') {
          updateFgtsData(cliente);
          $('#siape-version, #inss-version').hide();
          $('#fgts-version').show();
        }

        ocultarCamposVazios();
        ocultarColunasVazias('.table-beneficios');
        ocultarColunasVazias('#table-emprestimos');
        ocultarCardsVazios();
        atualizarVisibilidadeColunas('.table-beneficios');
        atualizarVisibilidadeColunas('#table-emprestimos');

        $('#cpf_cliente_tabulacao').val(cliente.cpf);
        $('#id_cliente_tabulacao').val(cliente.id);
        $('#campanha_id_agendamentos').val(campanhaId);
        $('#cliente_id_agendamentos').val(cliente.id);
        $('#produto_cliente_agendamentos').val(cliente.produto);
      },
      error: function(xhr) {
        console.error('❌ Erro ao buscar dados do cliente:', xhr);
      }
    });
  }

  // 3) Handler: clicar no nome do cliente agendado
  $('.agendamentos-list').on('click', '.agendamento-link', function(e) {
    e.preventDefault();
    const clienteId = $(this).data('cliente-id');
    const produto   = $(this).data('cliente-produto');
    if (!clienteId) {
      alert('❌ ID de cliente não encontrado.');
      return;
    }
    fetchClienteById(clienteId, produto);
  });

  // 4) Handler: confirmar agendamento (check)
  $('.agendamentos-list').on('click', '.agendamento-confirmation', function() {
    const agendamentoId = $(this).data('agendamento-id');
    const csrf = $('input[name="csrfmiddlewaretoken"]').val();
    if (!agendamentoId) {
      alert('❌ ID de agendamento não encontrado.');
      return;
    }
    $.ajax({
      url: '/moneyplus/api/post/confirm_agendamento/',
      method: 'POST',
      data: {
        agendamento_id: agendamentoId,
        csrfmiddlewaretoken: csrf
      },
      success: function(resp) {
        alert('✅ Agendamento marcado como realizado!');
        fetchAgendamentos();
      },
      error: function(xhr) {
        const err = xhr.responseJSON?.error || 'Erro desconhecido';
        alert('❌ Falha ao confirmar agendamento: ' + err);
      }
    });
  });

  // 5) Handler: submit do form de agendamento
  $('.agendamento-form').on('submit', function(e) {
    e.preventDefault();
    const clienteId      = $('#cliente_id_agendamentos').val();
    const campanhaId     = $('#campanha_id_agendamentos').val();
    let produto          = $('#produto_cliente_agendamentos').val();
    if (!produto) produto = $('#ficha-cliente-produto').text().trim();
    const diaAgendamento = $('#dataAgendamento').val();
    const hora           = $('#horaAgendamento').val();
    const responsavel    = $('#responsavel').val();
    const csrf           = $(this).find('input[name="csrfmiddlewaretoken"]').val();
    if (!clienteId || !campanhaId || !diaAgendamento || !hora || !responsavel || !produto) {
      alert('❌ Todos os campos são obrigatórios!');
      return;
    }
    $.ajax({
      url: '/moneyplus/api/post/agendamento/',
      method: 'POST',
      data: {
        cliente_id:      clienteId,
        campanha_id:     campanhaId,
        produto:         produto,
        data:            diaAgendamento,
        hora:            hora,
        responsavel:     responsavel,
        csrfmiddlewaretoken: csrf
      },
      success: function(resp) {
        alert('✅ Agendamento salvo com sucesso!');
        $('.agendamento-form')[0].reset();
        fetchAgendamentos();
      },
      error: function(xhr) {
        const err = xhr.responseJSON?.error || 'Erro desconhecido';
        alert('❌ Falha ao salvar agendamento: ' + err);
      }
    });
  });

  // inicia
  fetchAgendamentos();
});
