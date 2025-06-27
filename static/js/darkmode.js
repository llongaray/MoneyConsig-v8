// darkmode.js - Arquivo principal para gerenciar o dark mode
document.addEventListener('DOMContentLoaded', function() {
    const checkbox = document.getElementById('checkbox');
    const containers = document.querySelectorAll('.container, .box, div, section');
    const mainElement = document.querySelector('main');
    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');

    // Função para aplicar o tema
    function applyTheme(isDark) {
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.classList.add('dark-mode');
            containers.forEach(container => container.classList.add('darkmode'));
            mainElement?.classList.add('darkmode');
            if (toggleSwitch) toggleSwitch.checked = true;
            if (checkbox) checkbox.checked = true;
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            document.body.classList.remove('dark-mode');
            containers.forEach(container => container.classList.remove('darkmode'));
            mainElement?.classList.remove('darkmode');
            if (toggleSwitch) toggleSwitch.checked = false;
            if (checkbox) checkbox.checked = false;
        }
    }

    // Função para alternar o tema
    function switchTheme(e) {
        const isDark = e.target.checked;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyTheme(isDark);
    }

    // Verifica preferência salva
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
        applyTheme(currentTheme === 'dark');
    }

    // Listeners para mudança do tema
    if (toggleSwitch) {
        toggleSwitch.addEventListener('change', switchTheme);
    }

    if (checkbox) {
        checkbox.addEventListener('change', function() {
            document.body.classList.add('transition');
            containers.forEach(container => container.classList.add('transition'));

            switchTheme({ target: { checked: this.checked } });

            // Remove a classe de transição após a animação
            setTimeout(() => {
                document.body.classList.remove('transition');
                containers.forEach(container => container.classList.remove('transition'));
            }, 300);
        });
    }

    // Listener para mudanças no localStorage de outras abas
    window.addEventListener('storage', function(e) {
        if (e.key === 'theme') {
            applyTheme(e.newValue === 'dark');
        }
    });
});
