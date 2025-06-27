document.addEventListener('DOMContentLoaded', function() {
    var messageDiv = document.getElementById('messageDiv');
    if (messageDiv && messageDiv.textContent.trim() !== '') {
        messageDiv.style.display = 'block';
        setTimeout(function() {
            messageDiv.style.display = 'none';
        }, 5000);
    }
});