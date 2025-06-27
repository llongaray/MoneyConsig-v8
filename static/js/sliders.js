$(document).ready(function() {
    // Configuração do Slick Carousel
    $('.customer-logos.slider').slick({
        slidesToShow: 3,
        slidesToScroll: 1,
        autoplay: false,
        autoplaySpeed: 1500,
        arrows: false,
        dots: false,
        pauseOnHover: false,
        responsive: [
            { breakpoint: 768, settings: { slidesToShow: 2 } },
            { breakpoint: 520, settings: { slidesToShow: 1 } }
        ]
    });

    // Script para abrir os modais ao clicar nos botões dentro dos cards
    var cards = document.querySelectorAll('.gallery-cell .button-modal'); // Selecionando corretamente os botões
    var modais = document.querySelectorAll('.modal');
    var closeBtns = document.querySelectorAll('.close-btn');

    cards.forEach(function(card) {
        card.addEventListener('click', function() {
            var modalId = card.parentElement.getAttribute('data-modal');
            var modal = document.getElementById(modalId);
            modal.style.display = 'flex';
        });
    });

    closeBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            modais.forEach(function(modal) {
                modal.style.display = 'none';
            });
        });
    });

    window.addEventListener('click', function(e) {
        modais.forEach(function(modal) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
});
