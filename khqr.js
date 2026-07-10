// ==========================================
// KHQR MODULE (MANUAL UPLOAD ONLY) - BULLETPROOF V9
// ==========================================

let timerInterval;

window.startKHQRPayment = async (totalAmount, orderData) => {
    const amountEl = document.getElementById('khqr-total-amount');
    const qrContainer = document.getElementById('qrcode-container');
    const statusEl = document.getElementById('khqr-polling-status');
    const modalEl = document.getElementById('khqr-modal');
    const timerText = document.getElementById('khqr-timer-text');

    if(!amountEl || !qrContainer || !statusEl || !modalEl) return;

    let amountKHR = Math.round(totalAmount * 4100);
    
    amountEl.innerHTML = `
        <img src="favicon.png" style="width: 80px; filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));" alt="Bakong">
        <div style="width: 1px; height: 40px; background: rgba(255,68,68,0.3);"></div>
        <div style="display: flex; flex-direction: column; text-align: left;">
            <div class="khqr-amount" style="font-size: 26px;">$${totalAmount.toFixed(2)}</div>
            <div class="khqr-amount-khr" style="font-size: 14px;">${amountKHR.toLocaleString()} ៛</div>
        </div>
    `;
    
    qrContainer.innerHTML = "";
    qrContainer.style.opacity = "1";
    statusEl.innerHTML = `<div class="spinner"></div> <span style="color:var(--text-muted);">កំពុងរៀបចំ QR...</span>`;
    modalEl.classList.add('active');

    try {
        const tsKhqr = await import('https://cdn.jsdelivr.net/npm/ts-khqr@2.2.3/+esm');
        const { KHQR, CURRENCY, TAG, COUNTRY } = tsKhqr;

        let uniqueBillNumber = "ORD" + Math.floor(100000 + Math.random() * 900000).toString();

        const qrData = {
            tag: TAG.INDIVIDUAL,
            accountID: 'virakboth_vann@bkrt', // លេខគណនី
            merchantName: 'VIRAKBOTH VANN',   // ឈ្មោះ
            merchantCity: 'Phnom Penh',
            currency: CURRENCY.KHR, 
            amount: amountKHR, 
            countryCode: COUNTRY.KH,
            merchantCategoryCode: '5999',
            billNumber: uniqueBillNumber, 
            terminalId: "T001",
            storeId: "IDKSHOP",
            // 🔴 នេះជាបន្ទាត់ដែលខ្វះកាលពីមុន ដែលធ្វើឱ្យវាលោត Error ក្រហម 🔴
            expirationTimestamp: Date.now() + 5 * 60 * 1000        };

        const result = KHQR.generate(qrData);

        if (result.status.code !== 0) throw new Error(result.status.message);

        let dynamicKHQRString = result.data?.qrCode || result.data?.qr || result.data;
        if (!dynamicKHQRString) throw new Error("មិនអាចទាញយកកូដ QR បានទេ!");

        qrContainer.style.position = "relative";
        new QRCode(qrContainer, {
            text: dynamicKHQRString,
            width: 200, 
            height: 200,
            correctLevel: QRCode.CorrectLevel.M
        });
        
        const centerLogo = document.createElement('img');
        centerLogo.src = 'logobakong.png';
        centerLogo.style.position = 'absolute';
        centerLogo.style.top = '50%';
        centerLogo.style.left = '50%';
        centerLogo.style.transform = 'translate(-50%, -50%)';
        centerLogo.style.width = '45px';
        centerLogo.style.height = '45px';
        centerLogo.style.objectFit = 'contain';
        centerLogo.style.background = 'white';
        centerLogo.style.padding = '4px';
        centerLogo.style.borderRadius = '8px';
        
        setTimeout(() => { qrContainer.appendChild(centerLogo); }, 50);

// 🔴 ១. ទាញយកកូដ MD5 ពី QR ដែលទើបនឹងបង្កើត 🔴
        let qrMd5 = result.data?.md5;

        // បន្ថែមនៅបន្ទាត់បន្ទាប់ពី let qrMd5 = result.data?.md5;
sessionStorage.setItem('pending_payment_md5', qrMd5);
sessionStorage.setItem('pending_order_data', JSON.stringify(orderData));

        // 🔴 ២. ប្តូរផ្ទាំង UI ប្រាប់ភ្ញៀវថាមិនបាច់ Upload ទេ 🔴
        statusEl.innerHTML = `
            <div style="width: 100%; margin-top: 15px; background: #0a0a0a; padding: 15px; border-radius: 12px; border: 1px solid #222;">
                <div class="spinner" style="margin: 0 auto 10px auto;"></div>
                <p style="font-size: 13px; color: #4caf50; font-weight: bold; margin: 0;">ប្រព័ន្ធកំពុងរង់ចាំការទូទាត់ដោយស្វ័យប្រវត្តិ...</p>
            </div>
        `;

        // 🔴 ៣. បង្កើតមុខងារឆែកលុយ និងប្រព័ន្ធ Polling 🔴
        window.currentQrMd5 = qrMd5; // រក្សាទុកជាសកល
        window.currentOrderData = orderData; // រក្សាទុកជាសកល
        window.isPaymentProcessed = false; // ការពារកុំអោយវា Save ជាន់គ្នា ២ ដង

  window.isCheckingNow = false; // 🔴 សោរការពារកុំឲ្យការឆែករត់ជាន់គ្នាពេលទូរស័ព្ទគាំង

        window.forceCheckPayment = async () => {
            // បើទូទាត់រួចហើយ ឬអត់មានកូដ ឬកំពុងឆែក គឺមិនឲ្យកូដនេះដើរទេ
            if (window.isPaymentProcessed || !window.currentQrMd5 || window.isCheckingNow) return;
            
            window.isCheckingNow = true; // ចាក់សោរ

            try {
                const workerURL = "https://idk-backend.vannvirakboth372.workers.dev"; 
                const response = await fetch(workerURL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "check_payment", md5: window.currentQrMd5 })
                });
                
                const checkData = await response.json();
                
                // បើ Worker ឆែកឃើញថាជោគជ័យ
                if (checkData.success === true) {
                    window.isPaymentProcessed = true; // បិទកុំឱ្យកូដនេះដើរម្តងទៀត
                    
                    if(window.checkPaymentInterval) clearInterval(window.checkPaymentInterval); 
                    if(timerInterval) clearInterval(timerInterval); 
                    
                    window.currentOrderData.status = "Paid via KHQR (Auto)";
                    window.currentOrderData.transaction_id = checkData.data.hash; 
                    window.currentOrderData.receiptImage = null; 
                    
                    statusEl.innerHTML = `<span style="color:#4caf50; font-weight:bold;">✅ ទូទាត់ជោគជ័យ! កំពុងបញ្ជូន...</span>`;
                    
                    if(typeof window.saveOrderToFirebase === 'function') {
                        window.saveOrderToFirebase(window.currentOrderData);
                    }
                } else {
                    // បើមិនទាន់ជោគជ័យ ឲ្យវាត្រឡប់មកអក្សរធម្មតាវិញ (ក្នុងករណីវាប្តូរអក្សរពេលដាស់)
                    if (statusEl.innerHTML.includes("កំពុងផ្ទៀងផ្ទាត់ធនាគារ")) {
                        statusEl.innerHTML = `<div class="spinner"></div> <span style="color:var(--text-muted);">កំពុងរង់ចាំការទូទាត់...</span>`;
                    }
                }
            } catch (error) {
                console.log("Polling error:", error);
            } finally {
                window.isCheckingNow = false; // ដោះសោរវិញ
            }
        };

        // បញ្ជាឱ្យប្រព័ន្ធអូតូសួររៀងរាល់ ៣ វិនាទីម្តង (ប្រើប្រាស់មុខងារខាងលើ)
        window.checkPaymentInterval = setInterval(window.forceCheckPayment, 3000);

   // 🔴 ដូរពី 600 មក 300 (ព្រោះ 300 វិនាទី = ៥ នាទី) 🔴
        let timeLeft = 300; 
        if(timerInterval) clearInterval(timerInterval);
        
        // 🔴 ដូរពី 10:00 មក 05:00 🔴
        timerText.innerText = "05:00";
        
        timerInterval = setInterval(() => {
            timeLeft--;
            let m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            let s = (timeLeft % 60).toString().padStart(2, '0');
            timerText.innerText = `${m}:${s}`;
            
            // នៅពេលម៉ោងដើរដល់សូន្យ (០)
            if(timeLeft <= 0) {
                clearInterval(timerInterval); // បញ្ឈប់ម៉ោងដើរថយក្រោយ
                
                // 🔴 បញ្ឈប់ការលួចសួរ (Polling) ទៅកាន់ Cloudflare Worker 🔴
                if(window.checkPaymentInterval) clearInterval(window.checkPaymentInterval); 
                
                // ប្តូរអក្សរទៅជាពណ៌ក្រហម និងធ្វើឲ្យ QR ព្រិល (Opacity 0.2)
                statusEl.innerHTML = `❌ <span style="color:#ff4444;">ផុតកំណត់ម៉ោងទូទាត់! សូមបិទផ្ទាំងនេះរួចចុចទិញម្តងទៀត។</span>`;
                qrContainer.style.opacity = "0.2"; 
            }
        }, 1000);

    } catch (error) {
        console.error("Error Builder:", error);
        statusEl.innerHTML = `❌ <span style="color:#ff4444;">${error.message}</span>`;
    }
};

window.cancelKHQR = () => {
    if(timerInterval) clearInterval(timerInterval);
    if(window.checkPaymentInterval) clearInterval(window.checkPaymentInterval); // 🔴 បន្ថែមការបិទ Polling
    
    const modalEl = document.getElementById('khqr-modal');
    if(modalEl) modalEl.classList.remove('active');
};
