$(document).ready(function() {
  $('.tabulacao-form').on('submit', function(e) {
    e.preventDefault();

    const status       = $('#statusTabulacao').val();
    const clienteId    = $('#cliente_id_tabulacao').val();
    const campanhaId   = $('#campanha_id_tabulacao').val();
    const produto      = $('#produto_tabulacao').val();
    const csrfToken    = $('input[name="csrfmiddlewaretoken"]').val();

    if (!status || !clienteId || !campanhaId || !produto) {
      alert('❌ Todos os campos são obrigatórios!');
      return;
    }

    $.ajax({
      url: '/moneyplus/api/post/tabulacao/',
      type: 'POST',
      data: {
        status: status,
        cliente_id: clienteId,
        campanha_id: campanhaId,
        produto: produto,
        csrfmiddlewaretoken: csrfToken
      },
      success: function(resp) {
        alert('✅ Tabulação salva com sucesso!');
        location.reload();
      },
      error: function(xhr) {
        const err = xhr.responseJSON?.error || 'Erro desconhecido';
        alert('❌ Falha ao salvar: ' + err);
      }
    });
  });
});
