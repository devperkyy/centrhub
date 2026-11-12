document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');

form.addEventListener('submit', function (e) {
  e.preventDefault();
  status.textContent = 'Thanks! This demo form doesn\'t send anywhere yet, but it works.';
  form.reset();
});
