const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const signupLink = document.getElementById('signup-link');
const loginLink = document.getElementById('login-link');

signupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
});

loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
});
