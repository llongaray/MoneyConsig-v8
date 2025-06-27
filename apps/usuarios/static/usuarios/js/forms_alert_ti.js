document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('alertForm');
    const tipoDestinatario = document.getElementById('tipo-destinatario');
    const containerCheckboxes = document.getElementById('container-checkboxes');
    const marcarTodos = document.getElementById('marcar-todos');
    const colunaEsquerda = document.getElementById('coluna-esquerda');
    const colunaDireita = document.getElementById('coluna-direita');
    const loadingSpinner = document.querySelector('.loading-spinner');
    const errorMessage = document.querySelector('.error-message');

    // Função para carregar destinatários
    async function carregarDestinatarios(tipo) {
        try {
            loadingSpinner.style.display = 'block';
            errorMessage.style.display = 'none';
            
            const response = await fetch(`/autenticacao/api/destinatarios/${tipo}/`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Limpa as colunas
            colunaEsquerda.innerHTML = '';
            colunaDireita.innerHTML = '';
            
            if (data.length === 0) {
                errorMessage.textContent = 'Nenhum destinatário encontrado.';
                errorMessage.style.display = 'block';
                return;
            }
            
            // Divide os itens em duas colunas
            const metade = Math.ceil(data.length / 2);
            data.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'form-check';
                div.innerHTML = `
                    <input class="form-check-input" type="checkbox" 
                           name="destinatarios[]" value="${item.id}" id="dest_${item.id}">
                    <label class="form-check-label" for="dest_${item.id}">
                        ${item.nome}
                    </label>
                `;
                
                if (index < metade) {
                    colunaEsquerda.appendChild(div);
                } else {
                    colunaDireita.appendChild(div);
                }
            });
            
        } catch (error) {
            console.error('Erro:', error);
            errorMessage.textContent = error.message || 'Erro ao carregar destinatários. Tente novamente.';
            errorMessage.style.display = 'block';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }

    // Evento de mudança do tipo de destinatário
    tipoDestinatario.addEventListener('change', function() {
        if (this.value) {
            carregarDestinatarios(this.value);
        }
    });

    // Evento de marcar/desmarcar todos
    marcarTodos.addEventListener('change', function() {
        const checkboxes = containerCheckboxes.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });

    // Envio do formulário
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            const response = await fetch('/autenticacao/api/alertas/novo/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                }
            });
            
            if (response.ok) {
                alert('Alerta enviado com sucesso!');
                form.reset();
                colunaEsquerda.innerHTML = '';
                colunaDireita.innerHTML = '';
            } else {
                alert('Erro ao enviar alerta. Tente novamente.');
            }
        } catch (error) {
            console.error('Erro:', error);
            alert('Erro ao enviar alerta. Tente novamente.');
        }
    });
});
