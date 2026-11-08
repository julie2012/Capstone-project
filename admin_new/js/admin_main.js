// js/admin_main.js
let masterUsersList = [];
let currentActiveSection = 'STEM';

// --- INITIALIZATION DELAY PREVENT RACE CONDITIONS ---
document.addEventListener('DOMContentLoaded', function() {
    // Bigyan ng 350ms delay para siguradong selyado na ang window.db connection channel
    setTimeout(() => {
        if (window.db) {
            window.loadDashboardData();
        } else {
            console.error("Critical Runtime Error: Global window.db connection link is missing.");
        }
    }, 350);

    // UI ELEMENTS SELECTORS & ACTION TRIGGERS
    const profileTrigger = document.getElementById('profileTrigger');
    const profileDropdown = document.getElementById('profileDropdown');
    const btnDash = document.getElementById('btn-dash');
    const brandHomeBtn = document.getElementById('brandHomeBtn');
    const navVerificationShortcut = document.getElementById('navVerificationShortcut');
    const subItems = document.querySelectorAll('.sub-item');

    if(profileTrigger && profileDropdown) {
        profileTrigger.addEventListener('click', function(e) {
            e.stopPropagation();
            profileTrigger.classList.toggle('active');
            profileDropdown.classList.toggle('show');
        });
        document.addEventListener('click', function() {
            profileTrigger.classList.remove('active');
            profileDropdown.classList.remove('show');
        });
    }

    document.getElementById('signOutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        if(confirm("Confirm logging out of admin session parameters?")) {
            window.location.href = "../index.html"; 
        }
    });

    window.showDashboard = function() {
        document.getElementById('view-dashboard').hidden = false;
        document.getElementById('view-verification').hidden = true;
        btnDash.classList.add('active');
    };

    window.showVerification = function(title) {
        document.getElementById('view-dashboard').hidden = true;
        document.getElementById('view-verification').hidden = false;
        btnDash.classList.remove('active');
        
        const gradeSpan = document.getElementById('target-grade');
        if(['STEM', 'ICT', 'EIM', 'SMAW'].includes(title)) {
            gradeSpan.innerText = "GRADE 11";
        } else {
            gradeSpan.innerText = "GRADE 7";
        }
        document.getElementById('target-title').innerText = title;
        
        window.fetchApplicantsData(title);
    };

    if(btnDash) btnDash.addEventListener('click', window.showDashboard);
    if(brandHomeBtn) brandHomeBtn.addEventListener('click', window.showDashboard);
    if(navVerificationShortcut) navVerificationShortcut.addEventListener('click', () => window.showVerification('STEM'));

    subItems.forEach(item => {
        item.addEventListener('click', function() {
            const chosenSection = this.getAttribute('data-section');
            window.showVerification(chosenSection);
        });
    });
});

// --- ENGINE PIPELINE A: LIVE COUNTERS & HOME CHARTS (GLOBAL VALUE CAPTURE) ---
window.loadDashboardData = function() {
    const database = window.db;

    // Realtime mapping loop sa students node
    database.ref('students').on('value', (snapshot) => {
        let g7Data = [0, 0, 0, 0];   
        let steData = [0, 0];         
        let g7Count = 0, steCount = 0, g11Count = 0;

        if (snapshot.exists()) {
            const students = snapshot.val();
            Object.values(students).forEach(student => {
                const grade = student.grade_level;
                const program = student.program || "";
                const section = student.section || "";

                if (grade === 'Grade 7') {
                    g7Count++;
                    if (program === 'STE') {
                        steCount++;
                        g7Data[0]++; 
                        if (student.exam_status === 'completed' || student.exam_status === 'Completed') {
                            steData[0]++;
                        } else {
                            steData[1]++;
                        }
                    } else {
                        if (section === 'Section A') g7Data[1]++;
                        else if (section === 'Section B') g7Data[2]++;
                        else if (section === 'Section C') g7Data[3]++;
                    }
                } else if (grade === 'Grade 11') {
                    g11Count++; 
                }
            });
        }

        // Direct DOM update sa mga stats cards mo boss
        document.getElementById('counter-g7').innerText = g7Count;
        document.getElementById('counter-ste').innerText = steCount;
        document.getElementById('counter-g11').innerText = g11Count;

        renderDoughnutChart('g7Chart', ['STE', 'Sec A', 'Sec B', 'Sec C'], g7Data, ['#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd'], false);
        renderDoughnutChart('steChart', ['Qualified', 'Waiting'], steData, ['#10b981', '#e2e8f0'], true);
    });

    // Realtime mapping loop sa all_applicants node
    database.ref('all_applicants').on('value', (snapshot) => {
        let g11Data = [0, 0, 0, 0];  
        if (snapshot.exists()) {
            const tracks = snapshot.val();
            if (tracks.STEM) g11Data[0] = Object.keys(tracks.STEM).length;
            if (tracks.ICT)  g11Data[1] = Object.keys(tracks.ICT).length;
            if (tracks.EIM)  g11Data[2] = Object.keys(tracks.EIM).length;
            if (tracks.SMAW) g11Data[3] = Object.keys(tracks.SMAW).length;
        }
        renderDoughnutChart('g11Chart', ['STEM', 'ICT', 'EIM', 'SMAW'], g11Data, ['#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd'], false);
    });
};

// --- ENGINE PIPELINE B: VERIFICATION REAL-TIME DATA COMPILER ROWS ---
window.fetchApplicantsData = function(filterSection) {
    currentActiveSection = filterSection;
    const tableBody = document.getElementById('table-body');
    if(!tableBody) return;
    
    tableBody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align:center; padding: 30px; color: #94a3b8;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px; color: #17971d; margin-bottom: 6px;"></i>
                <p style="font-size:11px;">Syncing nested layout properties parameters...</p>
            </td>
        </tr>
    `;

    const database = window.db;

    // Realtime dual data linking loops mapping (all_applicants and student_scores)
    database.ref('all_applicants').on('value', (appSnapshot) => {
        database.ref('student_scores').on('value', (scoreSnapshot) => {
            const appData = appSnapshot.val();
            const scoreData = scoreSnapshot.val() || {};
            let tempUsers = [];
            let recordsHtml = '';

            if (appData && appData[currentActiveSection]) {
                const targetTrackNode = appData[currentActiveSection];
                
                Object.keys(targetTrackNode).forEach(lrn => {
                    const user = targetTrackNode[lrn];
                    const userScores = scoreData[lrn] || {};

                    const math = userScores.math?.score || 0;
                    const science = userScores.science?.score || 0;
                    const english = userScores.english?.score || 0;
                    const filipino = userScores.filipino?.score || 0;
                    const totalScore = math + science + english + filipino;

                    const gradeLvl = ['STE', 'Section A', 'Section B', 'Section C'].includes(currentActiveSection) ? 'Grade 7' : 'Grade 11';
                    const overallRating = user.overallRating || '0.00';

                    const userPack = {
                        id: lrn,
                        fullName: user.name || 'N/A',
                        lrn: user.lrn || lrn,
                        gradeLevel: gradeLvl,
                        phone: user.contact || 'N/A',
                        assignedStrand: currentActiveSection,
                        gwa: user.gwa || '0.00',
                        status: user.status || 'Started',
                        mathScore: math,
                        scienceScore: science,
                        englishScore: english,
                        filipinoScore: filipino,
                        score: totalScore,
                        overallRating: overallRating
                    };

                    tempUsers.push(userPack);

                    recordsHtml += `
                        <tr>
                            <td>${userPack.fullName}</td>
                            <td style="font-weight: 700; color: #475569;">${userPack.lrn}</td>
                            <td>${userPack.gradeLevel}</td>
                            <td>${userPack.phone}</td>
                            <td style="font-weight: 700;">${userPack.score} pts</td>
                            <td><span class="gwa-pill">${userPack.gwa}%</span></td>
                            <td style="font-weight: 700; color: #224db4;">${userPack.overallRating}%</td>
                            <td style="font-weight: 800; color: #1e293b;">${currentActiveSection.toUpperCase()}</td>
                            <td>
                                <div class="action-btn-group">
                                    <button class="action-btn view" onclick="viewExamResults('${userPack.id}')" title="View Breakdowns"><i class="fa-regular fa-eye"></i></button>
                                    <button class="action-btn edit" onclick="editGWA('${userPack.id}')" title="Input GWA"><i class="fa-regular fa-pen-to-square"></i></button>
                                    <button class="action-btn send" onclick="sendSMS('${userPack.id}')" title="Approve & Send SMS"><i class="fa-regular fa-paper-plane"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });

                masterUsersList = tempUsers;
                tableBody.innerHTML = tempUsers.length === 0 ? `<tr><td colspan="9" style="text-align:center; padding: 30px; color:#94a3b8;">No registered records found.</td></tr>` : recordsHtml;
            } else {
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 30px; color:#94a3b8;">No records found matching "${currentActiveSection}".</td></tr>`;
            }
        });
    });
};

// --- DIALOG POINTER ACTIONS METHOD PROTOCOLS MAP ---

window.viewExamResults = function(studentId) {
    const user = masterUsersList.find(u => u.id === studentId);
    if(!user) return;

    Swal.fire({
        title: 'Exam Results Breakdown',
        html: `
            <div style="font-size: 13px; color: #334155; margin-bottom: 16px; text-align: left; background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
                <strong>Applicant Name:</strong> ${user.fullName} <br>
                <strong>LRN Key Structure:</strong> ${user.lrn}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; font-weight:600;">
                <thead>
                    <tr style="border-bottom: 2px solid #e2e8f0; color: #94a3b8; font-weight:800; font-size:11px; text-transform:uppercase;">
                        <th style="padding: 10px 6px;">Subject Area Block</th>
                        <th style="padding: 10px 6px; text-align:right;">Obtained Points</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 10px 6px; color:#475569;">Mathematics</td><td style="padding: 10px 6px; text-align:right; font-weight:700;">${user.mathScore}</td></tr>
                    <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 10px 6px; color:#475569;">Science</td><td style="padding: 10px 6px; text-align:right; font-weight:700;">${user.scienceScore}</td></tr>
                    <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 10px 6px; color:#475569;">English</td><td style="padding: 10px 6px; text-align:right; font-weight:700;">${user.englishScore}</td></tr>
                    <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 10px 6px; color:#475569;">Filipino</td><td style="padding: 10px 6px; text-align:right; font-weight:700;">${user.filipinoScore}</td></tr>
                    <tr style="border-bottom: 2px solid #cbd5e1; font-weight: 800; background: #f8fafc; color:#0f172a;"><td style="padding: 10px 6px;">Total Exam Score</td><td style="padding: 10px 6px; text-align:right;">${user.score} pts</td></tr>
                    <tr style="border-bottom: 1px solid #edf2f7;"><td style="padding: 10px 6px; color:#475569;">GWA Value Display</td><td style="padding: 10px 6px; text-align:right; font-weight:700;">${user.gwa}%</td></tr>
                    <tr style="font-weight: 800; background-color: #f0fdf4; color: #166534;"><td style="padding: 10px 6px;">Final System Rating</td><td style="padding: 10px 6px; text-align:right; font-size:14px;">${user.overallRating}%</td></tr>
                </tbody>
            </table>
        `,
        icon: 'info',
        confirmButtonText: 'Close Panel Layout',
        confirmButtonColor: '#17971d',
        width: '450px'
    });
};

window.editGWA = async function(studentId) {
    const user = masterUsersList.find(u => u.id === studentId);
    if(!user) return;

    const htmlContent = `
        <div style="display: flex; flex-direction: column; align-items: center; padding-top: 5px;">
            <div style="width: 54px; height: 54px; background: #eff4fb; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px;">
                <i class="fa-regular fa-star" style="font-size: 24px; color: #224db4;"></i>
            </div>
            <h3 style="font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 2px;">Input Student GWA</h3>
            <p style="font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 16px;">Verified GWA score index for <span style="color: #224db4; font-weight: 800;">${user.fullName}</span></p>

            <div style="width: 100%; text-align: left; margin-bottom: 15px;">
                <input type="number" id="swal-gwa-input" step="0.1" min="0" max="100" value="${user.gwa === '0.00' ? '' : user.gwa}" placeholder="0.0" style="width: 100%; padding: 12px; font-size: 26px; font-weight: 900; color: #0f172a; text-align: center; border: 2px solid #e2e8f0; border-radius: 12px; outline: none;">
            </div>
            <p style="font-size: 10px; font-weight: 800; color: #059669; margin: 0; text-transform: uppercase; letter-spacing:0.3px;">System Matrix Formula: (60% GWA + 40% Exam Score Ratio)</p>
        </div>
    `;

    const { value: newGwa } = await Swal.fire({
        html: htmlContent,
        showCancelButton: true,
        confirmButtonText: 'SAVE & FINALIZE',
        cancelButtonText: 'CANCEL',
        confirmButtonColor: '#17971d',
        cancelButtonColor: '#94a3b8',
        preConfirm: () => {
            const input = document.getElementById('swal-gwa-input').value;
            if (!input || input < 0 || input > 100) {
                Swal.showValidationMessage('Please specify an official grade entry parameter between 0 and 100');
                return false;
            }
            return input;
        }
    });

    if (newGwa) {
        const gwaPoints = parseFloat(newGwa) * 0.6;
        const examPoints = parseFloat(user.score || 0) * 0.4;
        const finalRating = (gwaPoints + examPoints).toFixed(2);

        const database = window.db;

        try {
            // Realtime dynamic synchronised update triggers across double paths loops node reference
            await database.ref(`all_applicants/${user.assignedStrand}/${user.id}`).update({
                gwa: parseFloat(newGwa).toFixed(2),
                overallRating: finalRating
            });
            
            await database.ref(`students/${user.id}`).update({
                gwa: parseFloat(newGwa).toFixed(2),
                rating: finalRating
            });

            Swal.fire({
                icon: 'success',
                title: 'GWA Score Synchronized!',
                text: `Recalculated System Rating Metrics: ${finalRating}%`,
                timer: 1800,
                showConfirmButton: false
            });
        } catch(e) {
            Swal.fire('Error Connection Trace', e.message, 'error');
        }
    }
};

window.sendSMS = async function(studentId) {
    const user = masterUsersList.find(u => u.id === studentId);
    if(!user) return;

    const templateMsg = `Dear ${user.fullName},

Good day!

We are pleased to inform you that you have passed the ${user.assignedStrand} Academic Track. Score: ${user.score}/100 Percentage: ${user.overallRating}% Interview Date: May 15, 2026 Time: 10:30 AM Venue: Grade 12 ${user.assignedStrand} Room

Please arrive at least 15 minutes before your scheduled time and bring all required documents.

Congratulations on your achievement! We look forward to seeing you.

– Admissions Office`;

    const result = await Swal.fire({
        title: 'Send Notification payload',
        text: `Routing message block queue to ${user.fullName} (${user.phone})`,
        input: 'textarea',
        inputValue: templateMsg,
        inputAttributes: { rows: 9, style: 'font-size: 12.5px; line-height: 1.5; color:#334155;' },
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-paper-plane"></i> Send Out SMS',
        cancelButtonText: 'Cancel Operation',
        confirmButtonColor: '#17971d',
        cancelButtonColor: '#94a3b8',
        width: '560px'
    });

    if (result.isConfirmed) {
        const finalMessage = result.value;
        const apiKey = "94c57cba20b569de57a9580275a1a847";
        
        const targetUrl = encodeURIComponent('https://api.semaphore.co/api/v4/messages');
        const proxyUrl = `https://corsproxy.io/?${targetUrl}`;

        const formData = new URLSearchParams();
        formData.append('apikey', apiKey);
        formData.append('number', user.phone);
        formData.append('message', finalMessage);

        Swal.fire({
            title: 'Routing outbound text...',
            text: 'Connecting to Semaphore servers. Please wait.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });
            
            const resText = await response.text();
            console.log("Semaphore response parameters track log payload: ", resText);

            Swal.fire({
                icon: 'success',
                title: 'SMS Sent Successfully!',
                text: `Message broadcast successfully route index target to ${user.phone}`,
                timer: 2200,
                showConfirmButton: false
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Transmission Error', 'Outbound proxy parameters trace error connection failure.', 'error');
        }
    }
};

// --- CHART GENERATION CONTROLLER ---
function renderDoughnutChart(canvasId, labels, data, colors, isSTE) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const chartInstance = Chart.getChart(canvas);
    if (chartInstance) chartInstance.destroy(); 

    const zeroSum = data.reduce((a, b) => a + b, 0) === 0;
    const finalData = zeroSum ? (isSTE ? [0, 1] : [1, 0, 0, 0]) : data;

    new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: finalData, backgroundColor: colors }]
        },
        options: {
            responsive: true,
            cutout: '74%',
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 10, weight: '600' } } } }
        }
    });
}