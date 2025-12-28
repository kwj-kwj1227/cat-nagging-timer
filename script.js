// --- CONFIG ---
const IMAGES = ['02.png', '39.png', '32.png', '08.png'];
const TOTAL_SECONDS = 30 * 60; // 30 minutes

const DEFAULT_CLEANING = [
    "地上那坨是什麼？",
    "你的書桌要生螞蟻了！",
    "把垃圾拿去丟！",
    "衣服折好了沒？"
];
const DEFAULT_RUSH = [
    "動作快一點！",
    "還在摸魚？",
    "時間在走，你在夢遊嗎？",
    "再不出門要遲到了！"
];

// --- STATE ---
let currentMode = 'cleaning'; // or 'rush'
let remainingTime = TOTAL_SECONDS;
let countdownInterval = null;
let nagTimeout = null;
let wakeLock = null;

// Settings (Load from LocalStorage)
let customCleaning = JSON.parse(localStorage.getItem('custom_cleaning') || '[]');
let customRush = JSON.parse(localStorage.getItem('custom_rush') || '[]');

// --- DOM ELEMENTS ---
const viewHome = document.getElementById('view-home');
const viewTimer = document.getElementById('view-timer');
const viewSettings = document.getElementById('view-settings');
const backBtn = document.getElementById('back-btn');
const settingsBtn = document.getElementById('settings-btn');
const pageTitle = document.getElementById('page-title');

// --- NAVIGATION ---
function showView(viewId) {
    // Hide all
    [viewHome, viewTimer, viewSettings].forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden'); // Ensure hidden class is applied
        setTimeout(() => el.classList.remove('hidden'), 10); // Hack to allow display:flex then opacity anim
    });

    const target = document.getElementById(viewId);
    target.classList.remove('hidden');
    target.classList.add('active');

    // Update Header
    if (viewId === 'view-home') {
        backBtn.classList.add('hidden');
        settingsBtn.classList.remove('hidden');
        pageTitle.innerText = "30-Minute Nagging Timer";
    } else if (viewId === 'view-timer') {
        backBtn.classList.remove('hidden');
        settingsBtn.classList.add('hidden');
        pageTitle.innerText = currentMode === 'cleaning' ? "房間收拾模式" : "衝刺模式";
    } else if (viewId === 'view-settings') {
        backBtn.classList.remove('hidden');
        settingsBtn.classList.add('hidden');
        pageTitle.innerText = "Settings";
    }
}

// Reset 
backBtn.addEventListener('click', () => {
    stopSession();
    showView('view-home');
});

settingsBtn.addEventListener('click', () => {
    renderSettings();
    showView('view-settings');
});

// --- TIMER LOGIC ---
function startSession(mode) {
    currentMode = mode;
    remainingTime = TOTAL_SECONDS;
    updateTimerDisplay();

    // Initial Nag State
    document.getElementById('nag-image').src = IMAGES[0];
    document.getElementById('nag-text').innerText = "開始計時！加油！";
    speak("開始計時！加油！");

    requestWakeLock();
    showView('view-timer');

    // Start Countdown
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        remainingTime--;
        updateTimerDisplay();
        if (remainingTime <= 0) {
            finishSession();
        }
    }, 1000);

    // Start Nag Loop
    scheduleNextNag();
}

function stopSession() {
    clearInterval(countdownInterval);
    clearTimeout(nagTimeout);
    if (wakeLock) wakeLock.release();
    wakeLock = null;
    window.speechSynthesis.cancel();
}

function finishSession() {
    stopSession();
    speak("時間到！全體集合！");
    showDialog("時間到", "30分鐘結束了！");
}

function updateTimerDisplay() {
    const m = Math.floor(remainingTime / 60).toString().padStart(2, '0');
    const s = (remainingTime % 60).toString().padStart(2, '0');
    document.getElementById('timer-val').innerText = `${m}:${s}`;
}

// --- NAG LOGIC ---
function scheduleNextNag() {
    // Random 45 to 90 seconds
    const delay = Math.floor(Math.random() * (90 - 45 + 1) + 45) * 1000;

    nagTimeout = setTimeout(() => {
        triggerNag();
        if (remainingTime > 0) scheduleNextNag();
    }, delay);
}

function triggerNag() {
    // 1. Change Image
    const randomImg = IMAGES[Math.floor(Math.random() * IMAGES.length)];
    document.getElementById('nag-image').src = randomImg;

    // 2. Get Text
    const text = getRandomText();
    document.getElementById('nag-text').innerText = text;

    // 3. Speak
    speak(text);
}

function getRandomText() {
    let pool = [];
    if (currentMode === 'cleaning') {
        pool = [...DEFAULT_CLEANING, ...customCleaning];
    } else {
        pool = [...DEFAULT_RUSH, ...customRush];
    }

    if (pool.length === 0) return "加油！";
    return pool[Math.floor(Math.random() * pool.length)];
}

// --- TTS ---
function speak(text) {
    window.speechSynthesis.cancel(); // Stop previous
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

// --- WAKE LOCK ---
async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
        console.log(`${err.name}, ${err.message}`);
    }
}

// --- SETTINGS LOGIC ---
let settingsTab = 'cleaning';

function switchTab(mode) {
    settingsTab = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // Simple way to find the button without IDs
    const index = mode === 'cleaning' ? 0 : 1;
    document.querySelectorAll('.tab-btn')[index].classList.add('active');

    renderSettingsList();
}

function renderSettings() {
    switchTab('cleaning'); // Default
}

function renderSettingsList() {
    const listEl = document.getElementById('nag-list');
    listEl.innerHTML = '';

    const currentList = settingsTab === 'cleaning' ? customCleaning : customRush;

    // Show latest first (reverse order)
    currentList.slice().reverse().forEach((text, i) => {
        // Original index
        const index = currentList.length - 1 - i;

        const li = document.createElement('li');
        li.className = 'nag-item';
        li.innerHTML = `
            <span>${text}</span>
            <button class="delete-btn" onclick="deleteNag(${index})">
                <span class="material-icons">delete</span>
            </button>
        `;
        listEl.appendChild(li);
    });
}

function addCustomNag() {
    const input = document.getElementById('new-nag-input');
    const val = input.value.trim();
    if (!val) return;

    // Split by newline and filter empty strings
    const lines = val.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    if (lines.length === 0) return;

    if (settingsTab === 'cleaning') {
        customCleaning.push(...lines);
        localStorage.setItem('custom_cleaning', JSON.stringify(customCleaning));
    } else {
        customRush.push(...lines);
        localStorage.setItem('custom_rush', JSON.stringify(customRush));
    }

    input.value = '';
    renderSettingsList();
    showToast(`Added ${lines.length} sentences!`);
}

function deleteNag(index) {
    if (settingsTab === 'cleaning') {
        customCleaning.splice(index, 1);
        localStorage.setItem('custom_cleaning', JSON.stringify(customCleaning));
    } else {
        customRush.splice(index, 1);
        localStorage.setItem('custom_rush', JSON.stringify(customRush));
    }
    renderSettingsList();
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

// --- DIALOG ---
function showDialog(title, msg) {
    document.getElementById('dialog-title').innerText = title;
    document.getElementById('dialog-msg').innerText = msg;
    document.getElementById('dialog-overlay').classList.remove('hidden');
}

function closeDialog() {
    document.getElementById('dialog-overlay').classList.add('hidden');
    // Also go home
    stopSession();
    showView('view-home');
}
