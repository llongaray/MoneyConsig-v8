$(document).ready(function(){
    // Handler para o envio do formulário de criação de equipe
    $("#form-criar-equipe").submit(function(event){
      event.preventDefault(); // Impede o envio padrão do formulário
  
      // Coleta os dados do formulário
      var nomeEquipe = $("#input-nome-equipe").val().trim();
      var participantes = [];
      $("#checkbox-participantes input:checkbox:checked").each(function() {
        participantes.push($(this).val());
      });
      var status = $("#checkbox-status-equipe").is(":checked");
  
      // Validação simples
      if (nomeEquipe === "") {
        alert("Por favor, informe o nome da equipe.");
        return;
      }
  
      // Cria o objeto de dados para envio
      var dataToSend = {
        nome: nomeEquipe,
        participantes: participantes,
        status: status
      };
  
      console.log("Enviando dados para criar equipe:", dataToSend);
  
      // Envia a requisição POST para criar a equipe
      $.ajax({
        url: "/moneyplus/api/create-equipe/",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify(dataToSend),
        dataType: "json",
        headers: {
          'X-CSRFToken': $('input[name="csrfmiddlewaretoken"]').val()
        },
        success: function(response) {
          alert("Equipe criada com sucesso! ID: " + response.equipe_id);
          // Opcional: Limpa o formulário
          $("#form-criar-equipe")[0].reset();
          console.log("Formulário de criação de equipe resetado.");
          // Atualiza os seletores de uploadbase (equipe, campanha, usuários, etc.)
          console.log("Chamando populateUploadBaseSelectors() para atualizar os selects/checkboxes.");
        },
        error: function(xhr) {
            alert("Erro ao criar equipe: " + xhr.responseJSON.error);
        }
    });
    populateUploadBaseSelectors();
    });
  });
  