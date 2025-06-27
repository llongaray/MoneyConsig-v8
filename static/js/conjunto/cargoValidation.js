// cargoValidation.js
$(document).ready(function () {
    const inputCargo = document.getElementById('nome_cargo');
    const inputNivel = document.getElementById('nivel_cargo');
    const feedback = document.getElementById('cargoFeedback');
    const btnCadastrar = document.getElementById('btnCadastrarCargo');

    function verificarCargo() {
        const nomeCargo = inputCargo.value.trim().toLowerCase();
        const nivelCargo = inputNivel.value.trim().toLowerCase();
        const cargos = Array.from(document.getElementById('listaCargos').getElementsByTagName('li'));

        const cargoExistente = cargos.some(cargo => {
            const cargoInfo = cargo.textContent.split('(');
            const cargoNome = cargoInfo[0].trim().toLowerCase();
            const cargoNivel = cargoInfo[1].replace(')', '').trim().toLowerCase();
            return cargoNome === nomeCargo && cargoNivel === nivelCargo;
        });

        if (cargoExistente) {
            feedback.textContent = 'Este cargo com este nível já existe.';
            btnCadastrar.disabled = true;
            btnCadastrar.classList.add('btn-danger');
            btnCadastrar.classList.remove('btn-primary');
        } else {
            feedback.textContent = '';
            btnCadastrar.disabled = false;
            btnCadastrar.classList.remove('btn-danger');
            btnCadastrar.classList.add('btn-primary');
        }
    }

    inputCargo.addEventListener('input', verificarCargo);
    inputNivel.addEventListener('input', verificarCargo);

    document.getElementById('formCargo').addEventListener('submit', function(e) {
        e.preventDefault();
        this.submit();
    });
});
