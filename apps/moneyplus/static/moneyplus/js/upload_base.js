$(document).ready(function(){
    $("#form-importar-base").submit(function(e){
      e.preventDefault();
      
      var produto       = $("#select-produto").val();
      var campanha      = $("#select-campanha").val();
      var arquivoInput  = $("#input-arquivo-import")[0];
  
      if (!campanha) {
        alert("Por favor, selecione uma campanha.");
        return;
      }
      if (!produto) {
        alert("Por favor, selecione um produto.");
        return;
      }
      if (arquivoInput.files.length === 0) {
        alert("Por favor, selecione um arquivo.");
        return;
      }
      
      var arquivo = arquivoInput.files[0];
      
      // Valida o arquivo antes do upload
      validateCsvFile(arquivo, produto)
        .then(() => {
          // Se a validação passar, continua com o upload
          var formData = new FormData();
          formData.append("produto", produto);
          formData.append("campanha_id", campanha);
          formData.append("arquivo", arquivo);
          
          // Adiciona feedback de progresso
          var $btn = $("#btn-importar-base");
          var $progress = $("<div class='progress mt-3'><div class='progress-bar' role='progressbar' style='width: 0%'></div></div>");
          $btn.after($progress);
          
          console.log("Enviando CSV:", { produto, campanha_id: campanha, arquivo: arquivo.name });
          
          $.ajax({
            url: "/moneyplus/api/post/csv-clientes/",
            method: "POST",
            data: formData,
            processData: false,
            contentType: false,
            timeout: 300000, // 5 minutos de timeout
            xhr: function() {
              var xhr = new window.XMLHttpRequest();
              xhr.upload.addEventListener("progress", function(evt) {
                if (evt.lengthComputable) {
                  var percentComplete = evt.loaded / evt.total;
                  percentComplete = parseInt(percentComplete * 100);
                  $progress.find('.progress-bar').css('width', percentComplete + '%');
                  $progress.find('.progress-bar').text(percentComplete + '%');
                }
              }, false);
              return xhr;
            },
            success: function(response){
              $progress.remove();
              $btn.prop('disabled', false);
              alert(
                "Upload processado com sucesso.\n" +
                "Clientes importados: " + response.clientes_importados + "\n" +
                "Débitos importados: " + response.debitos_importados
              );
              $("#form-importar-base")[0].reset();
              populateSelectorsFromAPI();
            },
            error: function(xhr, status, error){
              $progress.remove();
              $btn.prop('disabled', false);
              console.error("Erro no upload:", xhr.responseText);
              let msg = "Erro no upload.";
              try {
                let json = JSON.parse(xhr.responseText);
                msg += "\n" + (json.error || xhr.responseText);
              } catch(e) {
                msg += "\n" + xhr.responseText;
              }
              alert(msg);
            }
          });
          
          // Desabilita o botão durante o upload
          $btn.prop('disabled', true);
        })
        .catch(error => {
          alert("Erro na validação do arquivo: " + error);
        });
    });

    // Função para validar o arquivo CSV
    function validateCsvFile(file, produto) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
          const text = e.target.result;
          const lines = text.split('\n');
          const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
          
          // Apenas nome_completo e cpf são obrigatórios para todos os produtos
          const requiredFields = ['nome_completo', 'cpf'];
          
          const missingFields = requiredFields.filter(field => !headers.includes(field));
          if (missingFields.length > 0) {
            reject(`Campos obrigatórios faltando: ${missingFields.join(', ')}`);
          } else {
            resolve();
          }
        };
        reader.onerror = () => reject('Erro ao ler o arquivo');
        reader.readAsText(file);
      });
    }
  });
  