// ==========================================
// KHQR MODULE (SMART HYBRID: AUTO + MANUAL UPLOAD FALLBACK) - UPDATED V6
// ==========================================

let pollingInterval;
let timerInterval;

// 🔴 អនុគមន៍ហៅទៅកាន់ Cloudflare Worker របស់អ្នក 🔴
async function checkTransactionStatus(md5Hash) {
    try {
        const targetUrl = `https://idk-backend.vannvirakboth372.workers.dev`;
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: "check_bakong", // ប្រាប់ Worker ថាយើងចង់ឆែកការទូទាត់
                md5Hash: md5Hash 
            })
        });
        
        if (!response.ok) return { isError: true, status: response.status }; 
        return await response.json();
    } catch (error) { 
        return { isError: true, status: 500 }; 
    }
}

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
        // 🔴 ប្រើប្រាស់ BakongKHQR ពី index.html ដោយផ្ទាល់ (លែង Error Module ទៀតហើយ) 🔴
        if (typeof BakongKHQR === 'undefined') {
            throw new Error("ប្រព័ន្ធមិនទាន់ស្គាល់ KHQR ទេ។ សូម Refresh វេបសាយម្តងទៀត!");
        }

        let uniqueBillNumber = "ORD" + Math.floor(100000 + Math.random() * 900000).toString();

        const qrData = {
            tag: "1", // 1 សម្រាប់ Account ធម្មតា, 2 សម្រាប់ Merchant
            accountID: 'virakboth_vann@bkrt', 
            merchantName: 'VIRAKBOTH VANN',
            merchantCity: 'Phnom Penh',
            currency: "KHM", // KHM ប្រើសម្រាប់ប្រាក់រៀល
            amount: amountKHR.toString(), 
            countryCode: "KH",
            merchantCategoryCode: '5999',
            billNumber: uniqueBillNumber, 
            terminalId: "T001",
            storeId: "IDKSHOP"
        };

        const result = BakongKHQR.generateMerchant(qrData);

        if (!result || !result.data) throw new Error("ការបង្កើតកូដ KHQR បរាជ័យ!");

        let dynamicKHQRString = result.data.qrCode || result.data;

        qrContainer.style.position = "relative";
        new QRCode(qrContainer, {
            text: dynamicKHQRString,
            width: 200, 
            height: 200,
            correctLevel: QRCode.CorrectLevel.M
        });
        
        // 🔴 ប្រើប្រាស់ DOM Method ដើម្បីការពារកុំឱ្យខូចផ្ទាំង Canvas របស់ QR Code 🔴
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
        
        // ទុកពេលឱ្យវាគូរ QR រួចរាល់សិន ទើបបន្ថែម Logo ពីលើ
        setTimeout(() => {
            qrContainer.appendChild(centerLogo);
        }, 50);

        const md5Hash = md5(dynamicKHQRString);
        
        // មុខងារសម្រាប់ឱ្យភ្ញៀវ Upload រូបភាពវិក្កយបត្រ (Plan B)
        window.handleReceiptUpload = (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 600; 
                        const scaleSize = MAX_WIDTH / img.width;
                        canvas.width = MAX_WIDTH;
                        canvas.height = img.height * scaleSize;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                        
                        // បង្ហាញរូបភាពតូចនៅខាងឆ្វេងប៊ូតុងភ្លាមៗ និងលាក់ប្រអប់ Upload ការពារដាច់អេក្រង់
                        document.getElementById('upload-label').style.display = 'none';
                        document.getElementById('receipt-action-area').style.display = 'flex';
                        document.getElementById('receipt-img').src = compressedBase64;
                        
                        orderData.receiptImage = compressedBase64; 
                        orderData.status = "Paid (Pending Verification)";
                    }
                    img.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
        };

        // មុខងារចុចសញ្ញា X ដើម្បីលុបរូបភាពចេញវិញ និងប្តូររូបថ្មី
        window.removeReceipt = () => {
            document.getElementById('upload-label').style.display = 'block';
            document.getElementById('receipt-action-area').style.display = 'none';
            document.getElementById('receipt-upload').value = '';
            orderData.receiptImage = null;
        };

        window.confirmManualPayment = () => {
            clearInterval(timerInterval);
            statusEl.innerHTML = `<span style="color:#4caf50; font-weight:bold;">កំពុងដំណើរការវិក្កយបត្រ...</span>`;
            if(typeof window.saveOrderToFirebase === 'function') window.saveOrderToFirebase(orderData); 
        };

        // រៀបចំម៉ោងរាប់ថយក្រោយ ១០ នាទី (600 វិនាទី)
        let timeLeft = 600; 
        if(timerInterval) clearInterval(timerInterval);
        if(pollingInterval) clearInterval(pollingInterval);
        
        timerText.innerText = "10:00";
        
        timerInterval = setInterval(() => {
            timeLeft--;
            let m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            let s = (timeLeft % 60).toString().padStart(2, '0');
            timerText.innerText = `${m}:${s}`;
            if(timeLeft <= 0) {
                clearInterval(timerInterval);
                clearInterval(pollingInterval);
                statusEl.innerHTML = `❌ <span style="color:#ff4444;">ផុតកំណត់ម៉ោងទូទាត់! សូមបិទផ្ទាំងនេះរួចចុចទិញម្តងទៀត។</span>`;
                qrContainer.style.opacity = "0.2"; 
            }
        }, 1000);

        // យន្តការឆែកស្ថានភាពស្វ័យប្រវត្តិ
        pollingInterval = setInterval(async () => {
            const apiResult = await checkTransactionStatus(md5Hash);
            
            if (apiResult && !apiResult.isError && apiResult.responseCode === 0) { 
                clearInterval(pollingInterval); 
                clearInterval(timerInterval);
                statusEl.innerHTML = `✅ <span style="color:#4caf50; font-weight:bold;">ការទូទាត់ទទួលបានជោគជ័យ!</span>`;
                orderData.status = "Paid via KHQR (Auto)";
                if(typeof window.saveOrderToFirebase === 'function') window.saveOrderToFirebase(orderData); 
            } 
            else if (apiResult && (apiResult.isError || apiResult.responseCode === 1)) {
                clearInterval(pollingInterval); // ឈប់ឆែកអូតូ លោតផ្ទាំង Manual ភ្លាម
                
                statusEl.innerHTML = `
                    <div style="width: 100%; margin-top: 5px; background: #0a0a0a; padding: 12px; border-radius: 12px; border: 1px solid #222;">
                        
                        <label id="upload-label" for="receipt-upload" style="background: #1a1a1a; border: 1px dashed #555; padding: 15px; border-radius: 8px; display: block; text-align: center; cursor: pointer; font-size: 13px; font-weight: bold; color: white; margin: 0;">
                            📸 ចុចទីនេះដើម្បី Upload វិក្កយបត្រ
                            <input type="file" id="receipt-upload" accept="image/*" style="display: none;" onchange="window.handleReceiptUpload(event)">
                        </label>
                        
                        <div id="receipt-action-area" style="display: none; align-items: center; gap: 12px; width: 100%;">
                            
                            <div style="position: relative; flex-shrink: 0;">
                                <img id="receipt-img" src="" style="width: 48px; height: 48px; border-radius: 6px; border: 1px solid #4caf50; object-fit: cover; display: block;">
                                <div onclick="window.removeReceipt()" style="position: absolute; top: -6px; right: -6px; background: #ff4444; color: white; width: 18px; height: 18px; border-radius: 50%; font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">✕</div>
                            </div>
                            
                            <button id="btn-manual-confirm" onclick="window.confirmManualPayment()" style="background: #4caf50; color: white; border: none; padding: 14px 10px; border-radius: 8px; font-size: 14px; font-weight: 900; flex-grow: 1; cursor: pointer; text-transform: uppercase; transition: 0.3s; box-shadow: 0 5px 15px rgba(76, 175, 80, 0.3);">
                                ✅ បញ្ជាក់ការទូទាត់
                            </button>
                        </div>
                    </div>
                `;
            } 
            else {
                statusEl.innerHTML = `<div class="spinner"></div> <span style="color:var(--text-muted);">កំពុងរង់ចាំការទូទាត់អូតូ...</span>`;
            }
        }, 5000); 

    } catch (error) {
        console.error("Error Builder:", error);
        statusEl.innerHTML = `❌ <span style="color:#ff4444;">${error.message}</span>`;
    }
};

window.cancelKHQR = () => {
    if(pollingInterval) clearInterval(pollingInterval);
    if(timerInterval) clearInterval(timerInterval);
    const modalEl = document.getElementById('khqr-modal');
    if(modalEl) modalEl.classList.remove('active');
};