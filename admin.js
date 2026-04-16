const loginPanel = document.getElementById('admin-login');
const dashboardPanel = document.getElementById('admin-dashboard');
const loginButton = document.getElementById('admin-login-button');
const logoutButton = document.getElementById('admin-logout-button');
const loginError = document.getElementById('admin-login-error');
const usernameField = document.getElementById('admin-username');
const passwordField = document.getElementById('admin-password');

const statRegistered = document.getElementById('stat-registered');
const statPresent = document.getElementById('stat-present');
const statAvgCheckin = document.getElementById('stat-avgcheckin');
const statAbsent = document.getElementById('stat-absent');
const recentActivity = document.getElementById('recent-activity');

const ADMIN_TOKEN_KEY = 'attendanceAdminToken';

const showError = (message) => {
  loginError.textContent = message;
  loginError.style.display = 'block';
};

const hideError = () => {
  loginError.style.display = 'none';
};

const saveToken = (token) => {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
};

const getToken = () => window.localStorage.getItem(ADMIN_TOKEN_KEY);

const clearToken = () => {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
};

const setDashboardVisible = (visible) => {
  loginPanel.style.display = visible ? 'none' : 'block';
  dashboardPanel.style.display = visible ? 'block' : 'none';
};

const fetchAdminStats = async () => {
  const token = getToken();
  if (!token) {
    setDashboardVisible(false);
    return;
  }

  const response = await fetch('/api/admin/stats', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    clearToken();
    setDashboardVisible(false);
    showError('Admin access denied. Please sign in again.');
    return;
  }

  const stats = await response.json();
  statRegistered.textContent = stats.totalUsers;
  statPresent.textContent = stats.presentToday;
  statAvgCheckin.textContent = stats.avgCheckin || '--:--';
  statAbsent.textContent = stats.absentToday;

  recentActivity.innerHTML = stats.recentActivity.length
    ? stats.recentActivity
        .map((item) => `<li><strong>${item.username}</strong> checked in at ${new Date(item.timestamp).toLocaleString()}</li>`)
        .join('')
    : '<li>No recent activity.</li>';
  setDashboardVisible(true);
};

loginButton.addEventListener('click', async () => {
  hideError();
  const username = usernameField.value.trim();
  const password = passwordField.value.trim();

  if (!username || !password) {
    showError('Enter both username and password.');
    return;
  }

  const response = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();

  if (!response.ok) {
    showError(body.error || 'Login failed.');
    return;
  }

  saveToken(body.token);
  await fetchAdminStats();
});

logoutButton.addEventListener('click', () => {
  clearToken();
  setDashboardVisible(false);
  hideError();
});

(async () => {
  const token = getToken();
  if (token) {
    await fetchAdminStats();
  }
})();
