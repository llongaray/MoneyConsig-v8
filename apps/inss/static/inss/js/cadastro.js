document.querySelectorAll('.tab').forEach(button => {
    button.addEventListener('click', function() {
        const target = document.getElementById(this.getAttribute('data-target'));
        document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
        target.style.display = 'flex';
    });
});

// Particles.js initialization
particlesJS('particles-js', {
    "particles": {
        "number": { "value": 80, "density": { "enable": true, "value_area": 800 }},
        "color": { "value": "#ffffff" },
        "shape": { "type": "circle", "stroke": { "width": 0, "color": "#000000" }},
        "opacity": { "value": 0.5, "anim": { "enable": false }},
        "size": { "value": 3, "random": true, "anim": { "enable": false }},
        "line_linked": { "enable": true, "distance": 150, "color": "#ffffff", "opacity": 0.4, "width": 1 },
        "move": { "enable": true, "speed": 6, "direction": "none", "random": false }
    },
    "interactivity": {
        "events": {
            "onhover": { "enable": true, "mode": "repulse" },
            "onclick": { "enable": true, "mode": "push" }
        }
    },
    "retina_detect": true
});

// CEP validation and form population
$(document).ready(function () {
    function limpa_formulario_cep() {
        $("#endereco, #bairro, #cidade, #estado").val("");
    }

    $("#cep").blur(function () {
        var cep = $(this).val().replace(/\D/g, '');
        if (cep !== "") {
            var validacep = /^[0-9]{8}$/;
            if (validacep.test(cep)) {
                $("#endereco, #bairro, #cidade, #estado").val("...");
                $.getJSON("https://viacep.com.br/ws/" + cep + "/json/?callback=?", function (dados) {
                    if (!("erro" in dados)) {
                        $("#endereco").val(dados.logradouro);
                        $("#bairro").val(dados.bairro);
                        $("#cidade").val(dados.localidade);
                        $("#estado").val(dados.uf);
                    } else {
                        limpa_formulario_cep();
                        alert("CEP não encontrado.");
                    }
                });
            } else {
                limpa_formulario_cep();
                alert("Formato de CEP inválido.");
            }
        } else {
            limpa_formulario_cep();
        }
    });
});

// Formatting functions
function formatNome(input) {
    input.value = input.value.toUpperCase();
}

function formatCPF(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = value;
}

function formatRG(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.slice(0, 9);
    value = value.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)$/, '$1-$2');
    input.value = value;
}

function formatPIS(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d{0,5})/, '$1.$2').replace(/(\d{5})(\d{0,2})/, '$1.$2');
    input.value = value;
}

$(document).ready(function () {
    $('form').on('submit', function (event) {
        event.preventDefault();  // Previne o envio padrão do formulário

        var formDataDict = {};  // Dicionário para armazenar os valores dos campos

        var funcionarioData = {};
        var usuarioData = {};

        // Função para verificar se o campo é obrigatório e está vazio
        function isFieldEmpty(field, fieldName) {
            if (!field.value.trim()) {
                if ($(field).prop('required')) {
                    alert('O campo ' + fieldName + ' é obrigatório e está vazio.');
                    return true;
                }
                return false;  // Se o campo não for obrigatório e estiver vazio, não faz nada
            }
            return false;
        }

        // Função para preencher campos vazios com valores padrão
        function preencherValorPadrao(campo, tipo) {
            switch(tipo) {
                case 'text':
                    return campo ? campo : 'Sem texto';
                case 'number':
                    return campo ? campo : '0000000000';  // 10 zeros como exemplo
                case 'date':
                    return campo ? campo : '01/01/2020';
                default:
                    return campo;
            }
        }

        // Percorrendo todos os campos do formulário
        $(this).find('input, select').each(function () {
            var fieldName = $(this).attr('name');
            var fieldLabel = $('label[for=' + $(this).attr('id') + ']').text();
            var fieldType = $(this).attr('type');
            var fieldValue = this.value.trim();

            // Verificar se o campo é obrigatório e se está vazio
            if (isFieldEmpty(this, fieldLabel)) {
                return false;  // Para o loop caso o campo obrigatório esteja vazio
            }

            // Preencher campos vazios com valores padrão
            fieldValue = preencherValorPadrao(fieldValue, fieldType);

            // Adicionar ao dicionário apenas os campos que não estão vazios
            if (fieldValue) {
                // Separar os dados de Funcionário e Usuário
                if (fieldName === 'nome') {
                    funcionarioData['nome'] = fieldValue;
                } else if (fieldName === 'sobrenome') {
                    funcionarioData['sobrenome'] = fieldValue || " ";  // Se não houver sobrenome, usar espaço
                } else if (fieldName === 'email') {
                    usuarioData['username'] = fieldValue;  // Para usuário, username será o email
                    usuarioData['email'] = fieldValue;
                } else if (fieldName === 'senha') {
                    usuarioData['password'] = fieldValue;
                } else {
                    formDataDict[fieldName] = fieldValue;  // Para outros campos
                }
            }
        });

        // Combinar os dados de funcionário e usuário no formDataDict
        formDataDict['funcionario'] = funcionarioData;
        formDataDict['usuario'] = usuarioData;

        // Enviar os dados ao servidor usando AJAX
        $.ajax({
            url: $(this).attr('action'),  // URL do action do form
            type: 'POST',
            data: JSON.stringify(formDataDict),  // Enviando o dicionário como JSON
            contentType: 'application/json',  // Tipo de conteúdo JSON
            success: function (response) {
                // Redirecionar após sucesso no Django
                if (response.redirect_url) {
                    window.location.href = response.redirect_url;  // Assumindo que o Django retorna a URL de redirecionamento
                } else {
                    alert('Sucesso! Sem URL de redirecionamento fornecida.');
                }
            },
            error: function (error) {
                alert('Erro ao enviar o formulário. Verifique os campos e tente novamente.');
            }
        });
    });
});
