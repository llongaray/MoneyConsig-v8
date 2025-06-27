// fav-links.js
document.addEventListener("DOMContentLoaded", function () {
    const btnOpen = document.querySelector(".btn-open");
    const btnClose = document.querySelector(".btn-close");
    const boxLinks = document.querySelector(".box-links");

    btnOpen.addEventListener("click", function (event) {
        event.preventDefault();
        boxLinks.style.display = "flex";
        btnOpen.style.display = "none";
        btnClose.style.display = "flex";
    });

    btnClose.addEventListener("click", function (event) {
        event.preventDefault();
        boxLinks.style.display = "none";
        btnClose.style.display = "none";
        btnOpen.style.display = "block";
    });
});
