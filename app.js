const navLinks = document.querySelectorAll('.nav-link');
const sectionPanels = document.querySelectorAll('.section-panel');
const sectionButtons = document.querySelectorAll('[data-section]');

const signupToggleButtons = document.querySelectorAll('.signup-card__toggle button');
let signupRole = 'student';
const signupButton = document.getElementById('signup-button');
const signupUsername = document.getElementById('signup-username');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupBanner = document.getElementById('signup-banner');

const video = document.getElementById('video');
const statusPill = document.getElementById('video-status');
let cameraStream = null;
const resultBox = document.getElementById('attendance-result');
const attendanceUsername = document.getElementById('attendance-username');
const historyList = document.getElementById('attendance-history');
const registerFaceButton = document.getElementById('register-face');
const markAttendanceButton = document.getElementById('mark-attendance');

const adminLogin = document.getElementById('admin-login');
const adminDashboard = document.getElementById('admin-dashboard');
const adminLoginButton = document.getElementById('admin-login-button');
const adminLogoutButton = document.getElementById('admin-logout-button');
const adminError = document.getElementById('admin-login-error');
const adminUsername = document.getElementById('admin-username');
const adminPassword = document.getElementById('admin-password');
const statRegistered = document.getElementById('stat-registered');
const statPresent = document.getElementById('stat-present');
const statAvgCheckin = document.getElementById('stat-avgcheckin');
const statAbsent = document.getElementById('stat-absent');
const recentActivity = document.getElementById('recent-activity');

const dashboardLogin = document.getElementById('dashboard-login');
const userDashboard = document.getElementById('user-dashboard');
const dashboardLoginButton = document.getElementById('dashboard-login-button');
const dashboardLogoutButton = document.getElementById('dashboard-logout-button');
const dashboardError = document.getElementById('dashboard-login-error');
const dashboardUsername = document.getElementById('dashboard-username');
const dashboardPassword = document.getElementById('dashboard-password');

const studentView = document.getElementById('student-view');
const teacherView = document.getElementById('teacher-view');
const userDashboardTitle = document.getElementById('user-dashboard-title');
const userDashboardDescription = document.getElementById('user-dashboard-description');
const userRoleLabel = document.getElementById('user-role-label');

const statCheckins = document.getElementById('stat-checkins');
const statLastCheckin = document.getElementById('stat-last-checkin');
const studentAttendanceList = document.getElementById('student-attendance-list');

const statTotalStudents = document.getElementById('stat-total-students');
const statPresentToday = document.getElementById('stat-present-today');
const statAbsentToday = document.getElementById('stat-absent-today');
const statAvgTime = document.getElementById('stat-avg-time');
const teacherCheckinsList = document.getElementById('teacher-checkins-list');

const ADMIN_TOKEN_KEY = 'attendanceAdminToken';
const USER_TOKEN_KEY = 'attendanceUserToken';

const switchSection = (sectionId) => {
  sectionPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === sectionId);
  });
  navLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.section === sectionId);
  });

  if (sectionId === 'attendance') {
    startCamera();
  } else {
    stopCamera();
  }

  if (sectionId === 'admin' && getAdminToken()) {
    fetchAdminStats();
  }
  if (sectionId === 'dashboard' && getUserToken()) {
    fetchUserStats();
  }
};

navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    switchSection(link.dataset.section);
  });
});

sectionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetSection = button.dataset.section;
    if (targetSection) {
      switchSection(targetSection);
    }
  });
});

signupToggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    signupToggleButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    signupRole = button.textContent.trim().toLowerCase();
    signupButton.textContent = button.textContent.trim() === 'Teacher' ? 'Create Teacher Account' : 'Create Student Account';
  });
});

const showBanner = (element, message, isError = true) => {
  if (!element) return;
  element.textContent = message;
  element.style.display = 'block';
  element.style.background = isError ? '#fee2e2' : '#d1fae5';
  element.style.color = isError ? '#991b1b' : '#065f46';
  element.style.borderColor = isError ? '#fecaca' : '#a7f3d0';
};

const hideBanner = (element) => {
  if (!element) return;
  element.style.display = 'none';
};

const signup = async () => {
  hideBanner(signupBanner);
  const username = signupUsername.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value.trim();

  if (!username || !email || !password) {
    showBanner(signupBanner, 'Please fill in all fields.');
    return;
  }

  const response = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, role: signupRole }),
  });
  const body = await response.json();

  if (!response.ok) {
    showBanner(signupBanner, body.error || 'Signup failed.');
    return;
  }
  showBanner(signupBanner, 'Signup completed. You can now register your face.', false);
};

const loadModels = async () => {
  const modelBase = 'https://justadudewhohacks.github.io/face-api.js/models';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(modelBase),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelBase),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelBase),
  ]);
};

const startCamera = async () => {
  if (cameraStream) {
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraStream = stream;
    video.srcObject = stream;
    await video.play();
    statusPill.textContent = 'Camera active';
    statusPill.classList.remove('status-pill--error');
  } catch (error) {
    statusPill.textContent = 'Camera unavailable';
    statusPill.classList.add('status-pill--error');
  }
};

const stopCamera = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  if (video.srcObject) {
    video.srcObject = null;
  }
  statusPill.textContent = 'Camera inactive';
  statusPill.classList.remove('status-pill--error');
};

const fetchDescriptor = async (username) => {
  const response = await fetch(`/api/descriptor?username=${encodeURIComponent(username)}`);
  if (!response.ok) {
    throw new Error('Descriptor not found');
  }
  const body = await response.json();
  return body.descriptor;
};

const captureDescriptor = async () => {
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) {
    throw new Error('No face detected. Please center your face in the camera.');
  }
  return Array.from(detection.descriptor);
};

const loadAttendanceHistory = async (username) => {
  if (!username) {
    historyList.innerHTML = '<li>Enter a username to view attendance history.</li>';
    return;
  }
  const response = await fetch(`/api/attendance?username=${encodeURIComponent(username)}`);
  if (!response.ok) {
    historyList.innerHTML = '<li>Unable to load history.</li>';
    return;
  }
  const body = await response.json();
  if (!body.attendance.length) {
    historyList.innerHTML = '<li>No attendance records yet.</li>';
    return;
  }
  historyList.innerHTML = body.attendance
    .map((item) => `<li>${new Date(item.timestamp).toLocaleString()}</li>`)
    .join('');
};

let faceDescriptor = null;
let pendingFaceReregistration = false;

const saveFaceDescriptor = async (force = false) => {
  const username = attendanceUsername.value.trim();
  if (!username) {
    resultBox.textContent = 'Please enter your username.';
    resultBox.className = 'status-box status-box--error';
    return;
  }
  try {
    resultBox.textContent = 'Capturing face...';
    const descriptor = await captureDescriptor();
    faceDescriptor = descriptor;

    const response = await fetch('/api/save-face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, descriptor, force }),
    });
    const body = await response.json();

    if (!response.ok) {
      if (body.alreadyRegistered && !force) {
        pendingFaceReregistration = true;
        resultBox.textContent = 'Face already registered. Click "Register Face" again to update it.';
        resultBox.className = 'status-box status-box--warning';
        registerFaceButton.textContent = 'Update Face';
      } else {
        throw new Error(body.error || 'Unable to save face.');
      }
      return;
    }

    resultBox.textContent = body.message || 'Face registered successfully.';
    resultBox.className = 'status-box status-box--success';
    registerFaceButton.textContent = 'Register Face';
    pendingFaceReregistration = false;
    await loadAttendanceHistory(username);
  } catch (error) {
    resultBox.textContent = error.message;
    resultBox.className = 'status-box status-box--error';
  }
};

const markAttendance = async () => {
  const username = attendanceUsername.value.trim();
  if (!username) {
    resultBox.textContent = 'Please enter your username.';
    resultBox.className = 'status-box status-box--error';
    return;
  }
  try {
    resultBox.textContent = 'Loading saved face data...';
    const savedDescriptor = await fetchDescriptor(username);
    const detectedDescriptor = await captureDescriptor();
    const labeledDescriptor = new faceapi.LabeledFaceDescriptors(username, [new Float32Array(savedDescriptor)]);
    const matcher = new faceapi.FaceMatcher(labeledDescriptor, 0.6);
    const bestMatch = matcher.findBestMatch(new Float32Array(detectedDescriptor));
    if (bestMatch.label !== username || bestMatch.distance > 0.6) {
      throw new Error('Face not recognized. Please register first or try again.');
    }
    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || 'Attendance log failed.');
    }
    resultBox.textContent = `Attendance marked at ${new Date(body.timestamp).toLocaleString()}`;
    resultBox.className = 'status-box status-box--success';
    await loadAttendanceHistory(username);
    const activeSection = document.querySelector('.section-panel.active')?.id;
    if (getUserToken() && activeSection === 'dashboard') {
      await fetchUserStats();
    }
    if (getAdminToken() && activeSection === 'admin') {
      await fetchAdminStats();
    }
  } catch (error) {
    resultBox.textContent = error.message;
    resultBox.className = 'status-box status-box--error';
  }
};

const saveAdminToken = (token) => window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
const getAdminToken = () => window.localStorage.getItem(ADMIN_TOKEN_KEY);
const clearAdminToken = () => window.localStorage.removeItem(ADMIN_TOKEN_KEY);

const showAdminError = (message) => {
  adminError.textContent = message;
  adminError.style.display = 'block';
};

const hideAdminError = () => {
  adminError.style.display = 'none';
};

const toggleAdminDashboard = (visible) => {
  adminLogin.style.display = visible ? 'none' : 'block';
  adminDashboard.style.display = visible ? 'block' : 'none';
};

const fetchAdminStats = async () => {
  const token = getAdminToken();
  if (!token) {
    toggleAdminDashboard(false);
    return;
  }
  const response = await fetch('/api/admin/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    clearAdminToken();
    toggleAdminDashboard(false);
    showAdminError('Admin access denied. Please log in again.');
    return;
  }
  const stats = await response.json();
  statRegistered.textContent = stats.totalUsers;
  statPresent.textContent = stats.presentToday;
  statAvgCheckin.textContent = stats.avgCheckin || '--:--';
  statAbsent.textContent = stats.absentToday;
  recentActivity.innerHTML = stats.recentActivity.length
    ? stats.recentActivity
        .map(
          (item) => `<li><strong>${item.username}</strong> (${item.role || 'user'}) checked in at ${new Date(item.timestamp).toLocaleString()}</li>`
        )
        .join('')
    : '<li>No recent activity.</li>';
  toggleAdminDashboard(true);
};

const loginAdmin = async () => {
  hideAdminError();
  const username = adminUsername.value.trim();
  const password = adminPassword.value.trim();
  if (!username || !password) {
    showAdminError('Enter both username and password.');
    return;
  }
  const response = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();
  if (!response.ok) {
    showAdminError(body.error || 'Login failed.');
    return;
  }
  saveAdminToken(body.token);
  await fetchAdminStats();
};

const saveUserToken = (token) => window.localStorage.setItem(USER_TOKEN_KEY, token);
const getUserToken = () => window.localStorage.getItem(USER_TOKEN_KEY);
const clearUserToken = () => window.localStorage.removeItem(USER_TOKEN_KEY);

const showDashboardError = (message) => {
  dashboardError.textContent = message;
  dashboardError.style.display = 'block';
};

const hideDashboardError = () => {
  dashboardError.style.display = 'none';
};

const toggleUserDashboard = (visible) => {
  dashboardLogin.style.display = visible ? 'none' : 'block';
  userDashboard.style.display = visible ? 'block' : 'none';
};

const fetchUserStats = async () => {
  const token = getUserToken();
  if (!token) {
    toggleUserDashboard(false);
    return;
  }
  const response = await fetch('/api/user/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    clearUserToken();
    toggleUserDashboard(false);
    showDashboardError('Session expired. Please log in again.');
    return;
  }
  const stats = await response.json();

  if (stats.role === 'student') {
    clearUserToken();
    toggleUserDashboard(false);
    showDashboardError('Only teacher accounts can access the Teacher Attendance dashboard.');
    return;
  }

  studentView.style.display = 'none';
  teacherView.style.display = 'block';
  userRoleLabel.textContent = 'TEACHER';
  userDashboardTitle.textContent = 'Teacher Dashboard';
  userDashboardDescription.textContent = 'Class-wide attendance overview.';

  statTotalStudents.textContent = stats.totalStudents || 0;
  statPresentToday.textContent = stats.presentToday || 0;
  statAbsentToday.textContent = stats.absentToday || 0;
  statAvgTime.textContent = stats.avgCheckin || '--:--';
  teacherCheckinsList.innerHTML = stats.todayCheckins.length
    ? stats.todayCheckins
        .map(
          (item) => `<li><strong>${item.username}</strong> at ${new Date(item.timestamp).toLocaleString()}</li>`
        )
        .join('')
    : '<li>No check-ins today.</li>';
  toggleUserDashboard(true);
};

const loginDashboard = async () => {
  hideDashboardError();
  const username = dashboardUsername.value.trim();
  const password = dashboardPassword.value.trim();
  if (!username || !password) {
    showDashboardError('Enter both username and password.');
    return;
  }
  const response = await fetch('/api/user-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();
  if (!response.ok) {
    showDashboardError(body.error || 'Login failed.');
    return;
  }
  if (body.role !== 'teacher') {
    showDashboardError('Teacher dashboard is for teacher accounts only.');
    return;
  }
  saveUserToken(body.token);
  await fetchUserStats();
};

signupButton.addEventListener('click', signup);
registerFaceButton.addEventListener('click', () => {
  const force = pendingFaceReregistration;
  saveFaceDescriptor(force);
});
markAttendanceButton.addEventListener('click', markAttendance);
attendanceUsername.addEventListener('input', () => loadAttendanceHistory(attendanceUsername.value.trim()));
adminLoginButton.addEventListener('click', loginAdmin);
adminLogoutButton.addEventListener('click', () => {
  clearAdminToken();
  toggleAdminDashboard(false);
  hideAdminError();
});
dashboardLoginButton.addEventListener('click', loginDashboard);
dashboardLogoutButton.addEventListener('click', () => {
  clearUserToken();
  toggleUserDashboard(false);
  hideDashboardError();
});

(async () => {
  try {
    await loadModels();
    stopCamera();
  } catch (error) {
    statusPill.textContent = 'Face model load failed';
    statusPill.classList.add('status-pill--error');
  }
  if (getAdminToken()) {
    await fetchAdminStats();
  }
})();
