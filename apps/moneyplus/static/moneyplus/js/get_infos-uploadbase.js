/**
 * Função que busca os dados da API de uploadbase e atualiza os selects/checkboxes.
 * 
 * A API retorna um JSON com as chaves:
 *   - "users": array de usuários (cada objeto tem "id" e "username")
 *   - "equipes": array de equipes (cada objeto possui "pk" e "fields.nome")
 *   - "campanhas": array de campanhas (cada objeto possui "pk" e "fields.nome")
 * 
 * Atualiza os seguintes elementos:
 *   - Usuários:
 *       * #checkbox-participantes (para criação de equipe)
 *       * #select-participantes-edit (para editar equipe)
 *   - Equipes:
 *       * #select-equipe-editar
 *       * #select-equipes-campanha
 *       * #select-equipes-campanha-edit
 *   - Campanhas:
 *       * #select-campanha
 *       * #select-campanha-edit
 */
function populateUploadBaseSelectors() {
    console.log(">>> Iniciando a requisição para obter dados da API de uploadbase...");
    $.ajax({
      url: '/moneyplus/api/uploadbase/',
      method: 'GET',
      dataType: 'json',
      success: function(response) {
        console.log(">>> Dados recebidos da API:", response);
  
        // Atualiza os checkboxes de usuários
        console.log(">>> Limpando container de usuários...");
        $("#checkbox-participantes").empty();
        $("#select-participantes-edit").empty();
  
        if (response.users && response.users.length > 0) {
          console.log(">>> Atualizando os checkboxes e select de usuários...");
          var usersCheckboxes = "";
          var usersOptions = "";
          $.each(response.users, function(index, user) {
            console.log(">>>> Processando usuário:", user);
            usersCheckboxes += "<div class='form-check'>";
            usersCheckboxes += "<input type='checkbox' class='form-check-input' id='user-" + user.id + "' value='" + user.id + "'>";
            usersCheckboxes += "<label class='form-check-label' for='user-" + user.id + "'>" + user.username + "</label>";
            usersCheckboxes += "</div>";
            
            usersOptions += "<option value='" + user.id + "'>" + user.username + "</option>";
          });
          $("#checkbox-participantes").html(usersCheckboxes);
          $("#select-participantes-edit").html(usersOptions);
          console.log(">>> Checkboxes de usuários atualizados:", usersCheckboxes);
          console.log(">>> Select de usuários (edição) atualizado:", usersOptions);
        } else {
          console.log(">>> Nenhum usuário encontrado na API.");
          $("#checkbox-participantes").html("Nenhum usuário encontrado");
          $("#select-participantes-edit").html("<option value=''>Nenhum usuário encontrado</option>");
        }
    
        // Atualiza os selects de equipes
        console.log(">>> Limpando selects de equipes...");
        $("#select-equipe-editar, #select-equipes-campanha, #select-equipes-campanha-edit").empty();
        if (response.equipes && response.equipes.length > 0) {
          console.log(">>> Atualizando os selects de equipes...");
          var equipesOptions = "";
          $.each(response.equipes, function(index, equipe) {
            console.log(">>>> Processando equipe:", equipe);
            equipesOptions += "<option value='" + equipe.pk + "'>" + equipe.fields.nome + "</option>";
          });
          $("#select-equipe-editar, #select-equipes-campanha, #select-equipes-campanha-edit").html(equipesOptions);
          console.log(">>> Selects de equipes atualizados:", equipesOptions);
        } else {
          console.log(">>> Nenhuma equipe encontrada na API.");
          $("#select-equipe-editar, #select-equipes-campanha, #select-equipes-campanha-edit").html("<option value=''>Nenhuma equipe encontrada</option>");
        }
    
        // Atualiza os selects de campanhas
        console.log(">>> Limpando selects de campanhas...");
        $("#select-campanha, #select-campanha-edit").empty();
        if (response.campanhas && response.campanhas.length > 0) {
          console.log(">>> Atualizando os selects de campanhas...");
          var campanhasOptions = "";
          $.each(response.campanhas, function(index, campanha) {
            console.log(">>>> Processando campanha:", campanha);
            campanhasOptions += "<option value='" + campanha.pk + "'>" + campanha.fields.nome + "</option>";
          });
          $("#select-campanha, #select-campanha-edit").html(campanhasOptions);
          console.log(">>> Selects de campanhas atualizados:", campanhasOptions);
        } else {
          console.log(">>> Nenhuma campanha encontrada na API.");
          $("#select-campanha, #select-campanha-edit").html("<option value=''>Nenhuma campanha encontrada</option>");
        }
        console.log(">>> Seletores de uploadbase atualizados com sucesso.");
      },
      error: function(xhr, status, error) {
        console.error(">>> Erro ao carregar dados de uploadbase:", error);
      }
    });
  }
  
  $(document).ready(function(){
    console.log(">>> Documento pronto. Chamando populateUploadBaseSelectors()...");
    populateUploadBaseSelectors();
  });
  