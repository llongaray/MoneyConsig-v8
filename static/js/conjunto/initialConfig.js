document.addEventListener('DOMContentLoaded', function() {
    console.log("Iniciando configuração inicial...");
    
    // Configurar altura máxima dos modais
    const windowHeight = window.innerHeight;
    const modalMaxHeight = Math.round(windowHeight * 0.8);
    console.log(`Altura máxima do modal: ${modalMaxHeight}`);
    
    document.querySelectorAll('.modal-body').forEach(modalBody => {
        modalBody.style.maxHeight = `${modalMaxHeight}px`;
    });

    // Restaurar estado do modal ativo (se houver)
    //restoreActiveModalState();
    
    // Adicionar listeners para fechar modais
    document.querySelectorAll('[data-dismiss="modal"]').forEach(button => {
        button.addEventListener('click', function() {
            const modalId = this.closest('.modal').id;
            fecharModal(modalId);
        });
    });
});
