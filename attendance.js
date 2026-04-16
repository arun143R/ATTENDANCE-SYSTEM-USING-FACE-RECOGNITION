const video = document.getElementById('video');
const statusPill = document.getElementById('video-status');
const resultBox = document.getElementById('attendance-result');
const usernameInput = document.getElementById('attendance-username');
const historyList = document.getElementById('attendance-history');

const loadModels = async () => {
  const modelBase = 'https://justadudewhohacks.github.io/face-api.js/models';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(modelBase),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelBase),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelBase),
  ]);
};

const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    statusPill.textContent = 'Camera active';
    statusPill.classList.remove('status-pill--error');
  } catch (error) {
    statusPill.textContent = 'Camera unavailable';
    statusPill.classList.add('status-pill--error');
  }
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

const saveFaceDescriptor = async () => {
  const username = usernameInput.value.trim();
  if (!username) {
    resultBox.textContent = 'Please enter your username.';
    resultBox.className = 'status-box status-box--error';
    return;
  }

  try {
    resultBox.textContent = 'Capturing face...';
    const descriptor = await captureDescriptor();
    const response = await fetch('/api/save-face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, descriptor }),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error || 'Unable to save face.');
    }
    resultBox.textContent = 'Face registered successfully.';
    resultBox.className = 'status-box status-box--success';
    loadAttendanceHistory(username);
  } catch (error) {
    resultBox.textContent = error.message;
    resultBox.className = 'status-box status-box--error';
  }
};

const markAttendance = async () => {
  const username = usernameInput.value.trim();
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
    loadAttendanceHistory(username);
  } catch (error) {
    resultBox.textContent = error.message;
    resultBox.className = 'status-box status-box--error';
  }
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

document.getElementById('register-face').addEventListener('click', saveFaceDescriptor);
document.getElementById('mark-attendance').addEventListener('click', markAttendance);
usernameInput.addEventListener('input', () => loadAttendanceHistory(usernameInput.value.trim()));

(async () => {
  await loadModels();
  statusPill.textContent = 'Models loaded. Starting camera...';
  await startCamera();
})();
