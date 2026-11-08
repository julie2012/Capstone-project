import { db, ref, get, child } from './firebase_config.js';

/**
 * Modernized Verification Engine compiled directly from your legacy logic parameters
 * Coupled into your unified horizontal layout architecture
 */
window.fetchApplicantsData = async function(filterSection) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align:center; padding: 30px; color: #94a3b8;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px; color: #17971d; margin-bottom: 6px;"></i>
                <p style="font-size:11px;">Syncing applicants and scores matrix...</p>
            </td>
        </tr>
    `;

    try {
        // Sabay na hatakin ang dalawang magkaibang master data clusters mula sa database mo boss
        const appSnapshot = await get(child(ref(db), 'all_applicants'));
        const scoreSnapshot = await get(child(ref(db), 'student_scores'));

        const appData = appSnapshot.val();
        const scoreData = scoreSnapshot.val() || {};

        if (appData && appData[filterSection]) {
            const trackData = appData[filterSection];
            let recordsHtml = '';
            let matchCount = 0;

            // I-loop ang mga rehistradong LRN sa piniling kategorya
            Object.keys(trackData).forEach(lrn => {
                matchCount++;
                const user = trackData[lrn];
                const userScores = scoreData[lrn] || {};

                // dynamic summation ng mga subject test scores base sa luma mong parameter
                const math = userScores.math?.score || 0;
                const science = userScores.science?.score || 0;
                const english = userScores.english?.score || 0;
                const filipino = userScores.filipino?.score || 0;
                const totalScore = math + science + english + filipino;

                const name = user.name || 'N/A';
                const contact = user.contact || 'N/A';
                const gradeLevel = ['STE', 'Section A', 'Section B', 'Section C'].includes(filterSection) ? 'Grade 7' : 'Grade 11';
                const gwaDisplay = user.gwa || '0.00';
                const overallRating = user.overallRating || '0.00';

                // Bundle the complete package row array values locally inside a data object structure
                const studentPack = JSON.stringify({
                    id: lrn,
                    fullName: name,
                    lrn: lrn,
                    gradeLevel: gradeLevel,
                    phone: contact,
                    assignedStrand: filterSection,
                    gwa: gwaDisplay,
                    mathScore: math,
                    scienceScore: science,
                    englishScore: english,
                    filipinoScore: filipino,
                    score: totalScore,
                    overallRating: overallRating
                }).replace(/"/g, '&quot;');

                recordsHtml += `
                    <tr>
                        <td>${name}</td>
                        <td style="font-weight: 700; color: #475569;">${lrn}</td>
                        <td>${gradeLevel}</td>
                        <td>${contact}</td>
                        <td style="font-weight: 700;">${totalScore} pts</td>
                        <td><span class="gwa-pill">${gwaDisplay}</span></td>
                        <td style="font-weight: 700; color: #224db4;">${overallRating}%</td>
                        <td style="font-weight: 800; color: #1e293b;">${filterSection.toUpperCase()}</td>
                        <td>
                            <div class="action-btn-group">
                                <button class="action-btn view" onclick="viewExamResults('${studentPack}')" title="View Results"><i class="fa-regular fa-eye"></i></button>
                                <button class="action-btn edit" onclick="editGWA('${studentPack}')" title="Input GWA"><i class="fa-regular fa-pen-to-square"></i></button>
                                <button class="action-btn send" onclick="sendSMS('${studentPack}')" title="Send SMS Notification"><i class="fa-regular fa-paper-plane"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            tableBody.innerHTML = matchCount === 0 ? `<tr><td colspan="9" style="text-align:center; padding: 30px; color:#94a3b8;">No registered records found under "${filterSection}".</td></tr>` : recordsHtml;
        } else {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 30px; color:#94a3b8;">No active applicants database mapped under "${filterSection}".</td></tr>`;
        }
    } catch (error) {
        console.error("Verification processing matrix failed: ", error);
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 30px; color:#ef4444;">System error fetching nested payload sequences.</td></tr>`;
    }
};

// --- ACTION METHODS INTEGRATED DIRECTLY FROM YOUR LEGACY FUNCTIONS ---

window.viewExamResults = function(studentJson) {
    const user = JSON.parse(studentJson);
    Swal.fire({
        title: 'Exam Results Breakdown',
        html: `
            <div style="font-size: 14px; color: #0f172a; margin-bottom: 15px; text-align: left; padding: 0 10px;">
                <strong>Applicant:</strong> ${user.fullName} <br>
                <strong>LRN:</strong> ${user.lrn}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead>
                    <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
                        <th style="padding: 8px;">Subject Area</th>
                        <th style="padding: 8px;">Score Obtained</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px;">Mathematics</td><td style="padding: 8px; font-weight:700;">${user.mathScore}</td></tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px;">Science</td><td style="padding: 8px; font-weight:700;">${user.scienceScore}</td></tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px;">English</td><td style="padding: 8px; font-weight:700;">${user.englishScore}</td></tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px;">Filipino</td><td style="padding: 8px; font-weight:700;">${user.filipinoScore}</td></tr>
                    <tr style="border-bottom: 2px solid #e2e8f0; font-weight: 800; background: #f8fafc;"><td style="padding: 8px;">Total Exam Score</td><td style="padding: 8px;">${user.score} pts</td></tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px;">GWA (Report Card)</td><td style="padding: 8px; font-weight:700;">${user.gwa}%</td></tr>
                    <tr style="font-weight: 800; background-color: #eff6ff; color: #1e3a8a;"><td style="padding: 8px;">Final System Rating</td><td style="padding: 8px;">${user.overallRating}%</td></tr>
                </tbody>
            </table>
        `,
        icon: 'info',
        confirmButtonText: 'Close Panel',
        confirmButtonColor: '#1e3a8a',
        width: '450px'
    });
};

window.editGWA = async function(studentJson) {
    const user = JSON.parse(studentJson);
    const htmlContent = `
        <div style="display: flex; flex-direction: column; align-items: center; padding-top: 10px;">
            <div style="width: 64px; height: 64px; background: #eff6ff; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <i class="fa-regular fa-star" style="font-size: 28px; color: #3b82f6;"></i>
            </div>
            <h2 style="font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 4px;">INPUT STUDENT GWA</h2>
            <p style="font-size: 13px; color: #94a3b8; font-weight: 600; margin-bottom: 20px;">Verified GWA for <span style="color: #3b82f6; font-weight: 800;">${user.fullName}</span></p>

            <div style="width: 100%; text-align: left; margin-bottom: 20px;">
                <input type="number" id="swal-gwa-input" step="0.1" min="0" max="100" value="${user.gwa === '0.00' ? '' : user.gwa}" placeholder="0.0" style="width: 100%; padding: 12px; font-size: 28px; font-weight: 900; color: #0f172a; text-align: center; border: 2px solid #e2e8f0; border-radius: 14px; outline: none;">
            </div>

            <div style="width: 100%; background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 12px;">
                <p style="font-size: 10px; font-weight: 800; color: #059669; margin: 0; text-align: left; line-height: 1.4; text-transform: uppercase;">SYSTEM RECALCULATION: (60% GWA + 40% EXAM)</p>
            </div>
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
                Swal.showValidationMessage('Please enter a valid GWA between 0 and 100');
                return false;
            }
            return input;
        }
    });

    if (newGwa) {
        const gwaPoints = parseFloat(newGwa) * 0.6;
        const examPoints = parseFloat(user.score || 0) * 0.4;
        const finalRating = (gwaPoints + examPoints).toFixed(2);

        try {
            // I-save ang GWA at kinalkulang Rating diretso sa all_applicants node path
            const databaseLocation = `all_applicants/${user.assignedStrand}/${user.id}`;
            const updatePayload = { gwa: parseFloat(newGwa).toFixed(2), overallRating: finalRating };
            
            // Isabay din natin ang update sa main students node para synchronise ang data kahit saan basahin
            await db.ref(databaseLocation).update(updatePayload);
            await db.ref(`students/${user.id}`).update({ gwa: parseFloat(newGwa).toFixed(2), rating: finalRating });
            
            Swal.fire({
                icon: 'success',
                title: 'GWA Updated',
                text: `New Recalculated Rating: ${finalRating}%`,
                timer: 2000,
                showConfirmButton: false
            });
            
            // I-refresh agad ang table view para makita ang pagbabago nang walang log delay
            window.fetchApplicantsData(user.assignedStrand);
        } catch(e) {
            Swal.fire('Error', e.message, 'error');
        }
    }
};

window.sendSMS = async function(studentJson) {
    const user = JSON.parse(studentJson);
    const templateMsg = `Dear ${user.fullName},

Good day!

We are pleased to inform you that you have passed the ${user.assignedStrand} Academic Track. Score: ${user.score}/100 Percentage: ${user.overallRating}% Interview Date: May 15, 2026 Time: 10:30 AM Venue: Grade 12 ${user.assignedStrand} Room

Please arrive at least 15 minutes before your scheduled time and bring all required documents.

Congratulations on your achievement! We look forward to seeing you.

– Admissions Office`;

    const result = await Swal.fire({
        title: 'Send Notification',
        text: `Sending SMS to ${user.fullName} (${user.phone})`,
        input: 'textarea',
        inputValue: templateMsg,
        inputAttributes: { rows: 10, style: 'font-size: 13px; line-height: 1.5;' },
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-paper-plane"></i> Send SMS',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#17971d',
        cancelButtonColor: '#94a3b8',
        width: '550px'
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
            title: 'Sending SMS...',
            text: 'Please wait payload dispatcher.',
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
            console.log("Semaphore Delivery Status Log:", resText);

            Swal.fire({
                icon: 'success',
                title: 'SMS Sent Successfully!',
                text: `Message dispatched to ${user.phone}`,
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("SMS Dispatch Error:", error);
            Swal.fire('Error', 'Failed to route transmission through Semaphore proxy layer.', 'error');
        }
    }
};