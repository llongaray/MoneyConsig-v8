$(document).ready(function(){
    $("#form-criar-campanha").submit(function(e){
      e.preventDefault();
      
      // Coleta os valores do formulário
      var nome = $("#input-nome-campanha").val().trim();
      var descricao = $("#textarea-descricao-campanha").val().trim();
      var status = $("#checkbox-status-campanha").is(":checked");
      var equipes = $("#select-equipes-campanha").val(); // Array de IDs
    
      // Validação simples: o campo nome é obrigatório
      if (!nome) {
        alert("O campo 'Nome da Campanha' é obrigatório.");
        console.log(">>> Erro: Nome da campanha não informado.");
        return;
      }
      
      // Cria o objeto de dados para envio
      var dataToSend = {
        nome: nome,
        descricao: descricao,
        status: status,
        equipes: equipes
      };
      
      console.log(">>> Enviando dados para criar campanha:", dataToSend);
    
      // Envia o POST para a API de criação de campanha
      $.ajax({
        url: '/moneyplus/api/campaign-create/',
        method: 'POST',
        data: JSON.stringify(dataToSend),
        contentType: 'application/json',
        headers: {
          'X-CSRFToken': $('input[name="csrfmiddlewaretoken"]').val()
        },
        success: function(response) {
          console.log(">>> Resposta da API de criação de campanha:", response);
          alert("Campanha criada com sucesso!");
          // Atualiza os seletores chamando a função populateUploadBaseSelectors()
          console.log(">>> Chamando populateUploadBaseSelectors() para atualizar os selects/checkboxes.");
          // Reseta o formulário
          $("#form-criar-campanha")[0].reset();
          console.log(">>> Formulário de criação de campanha resetado.");
        },
        error: function(xhr) {
            console.error(">>> Erro ao criar campanha:", xhr.responseJSON.error);
            alert("Erro ao criar campanha: " + xhr.responseJSON.error);
        }
    });
    populateUploadBaseSelectors();
    });
  });
  