const signupButton = document.querySelector('.primary-button');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorBanner = document.querySelector('.error-banner');

const clearBanner = () => {
  if (errorBanner) {
    errorBanner.style.display = 'none';
  }
};

const showBanner = (message, isError = true) => {
  if (!errorBanner) return;
  errorBanner.textContent = message;
  errorBanner.style.display = 'block';
  errorBanner.style.background = isError ? '#fee2e2' : '#d1fae5';
  errorBanner.style.color = isError ? '#991b1b' : '#065f46';
  errorBanner.style.borderColor = isError ? '#fecaca' : '#a7f3d0';
};

signupButton.addEventListener('click', async () => {
  clearBanner();
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!username || !email || !password) {
    showBanner('Please fill in all fields.');
    return;
  }

  const response = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  const body = await response.json();

  if (!response.ok) {
    showBanner(body.error || 'Signup failed.');
    return;
  }

  showBanner('Signup completed. You can now register your face on the attendance page.', false);
});
