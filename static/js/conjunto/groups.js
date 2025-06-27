$(document).ready(function () {
    // Função para atualizar os checkboxes dos grupos
    function updateGroups() {
        const userId = document.getElementById('user-select').value;
        console.log("Usuário selecionado:", userId);

        // Verifica se o userId é válido e se há grupos para o usuário
        if (userId && userGroups[userId]) {
            const userGroupsList = userGroups[userId];
            console.log("Grupos do usuário:", userGroupsList);

            // Desmarca todos os checkboxes antes de marcar os novos
            document.querySelectorAll('.group-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });

            // Marca os checkboxes correspondentes aos grupos do usuário selecionado
            userGroupsList.forEach(groupId => {
                const checkbox = document.getElementById('group-' + groupId);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        } else {
            // Caso o usuário não tenha grupos, desmarcar todos os checkboxes
            document.querySelectorAll('.group-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
    }

    // Atualiza os grupos quando o usuário seleciona um novo usuário
    const userSelect = document.getElementById('user-select');
    userSelect.addEventListener('change', updateGroups);

    // Inicializa os grupos ao carregar a página
    updateGroups();
});
