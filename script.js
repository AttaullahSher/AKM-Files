const WEB_APP_URL = 'https://script.google.com/a/macros/akm-music.com/s/AKfycbwZHuhkk8-llpul4ybaCnxvl_EdRcoeaHoxwrELZu53zBWV_wY2--YsPWCrENMKMC3kJg/exec';
const NUM_ROWS = 14;
let currentUser = null;
let authInitialized = false;
let customers = [];
let saveTimeout = null;

// --- INITIALIZATION ---
window.onload = function() {
    const docType = document.body.dataset.docType;
    if (!docType) return;

    fetchCustomers();
    generateTableRows(docType);
    initializePage(docType);
    document.querySelector('.print-btn').addEventListener('click', () => saveAndPrint(docType));

    // Add auto-save listeners
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => debounceSave(docType));
    });

    const customerNameInput = document.querySelector('[data-cell="name"]');
    customerNameInput.addEventListener('input', handleCustomerInput);
    customerNameInput.addEventListener('focus', showCustomerSuggestions);
};

// Debounce save to prevent excessive requests
function debounceSave(docType) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveDocument(docType, true), 2000);
}

// Fetch customers from backend with CORS handling
async function fetchCustomers() {
    try {
        const response = await fetch(`${WEB_APP_URL}?action=getCustomers`, {
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.status === 'success') {
            customers = data.customers;
        }
    } catch (error) {
        console.error('Error fetching customers:', error);
        // Fallback: Try to load from localStorage if available
        try {
            const savedCustomers = localStorage.getItem('akm_customers');
            if (savedCustomers) {
                customers = JSON.parse(savedCustomers);
                console.log('Loaded customers from localStorage fallback');
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
    }
}

// Handle customer input for autocomplete/suggestions
function handleCustomerInput(e) {
    const input = e.target.value.toLowerCase();
    const suggestions = customers.filter(cust => cust.name.toLowerCase().includes(input));
    showSuggestions(suggestions);
}

// Show customer suggestions dropdown
function showCustomerSuggestions() {
    showSuggestions(customers);
}

function showSuggestions(suggestions) {
    let dropdown = document.getElementById('customer-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('select');
        dropdown.id = 'customer-dropdown';
        dropdown.size = Math.min(suggestions.length, 5);
        dropdown.style.position = 'absolute';
        dropdown.style.zIndex = 1000;
        document.body.appendChild(dropdown);
        dropdown.addEventListener('change', selectCustomer);
    }

    dropdown.innerHTML = '<option value="">Select or search...</option>';
    suggestions.forEach(cust => {
        const option = document.createElement('option');
        option.value = cust.customerId;
        option.textContent = `${cust.name} (${cust.mobile})`;
        dropdown.appendChild(option);
    });

    const inputRect = document.querySelector('[data-cell="name"]').getBoundingClientRect();
    dropdown.style.left = `${inputRect.left}px`;
    dropdown.style.top = `${inputRect.bottom}px`;
    dropdown.style.width = `${inputRect.width}px`;
    dropdown.style.display = 'block';
}

// Select customer from dropdown
function selectCustomer(e) {
    const selectedId = e.target.value;
    if (!selectedId) return;

    const selectedCust = customers.find(cust => cust.customerId === selectedId);
    if (selectedCust) {
        document.querySelector('[data-cell="name"]').value = selectedCust.name;
        document.querySelector('[data-cell="mobile"]').value = selectedCust.mobile;
        document.querySelector('[data-cell="add"]').value = selectedCust.address;
        document.querySelector('[data-cell="trn"]').value = selectedCust.trn;
    }

    const dropdown = document.getElementById('customer-dropdown');
    dropdown.style.display = 'none';
}

function initializePage(docType) {
    document.getElementById(`${docType}-number`).value = generateNumber(docType);
    document.getElementById(`${docType}-date`).value = new Date().toISOString().split('T')[0];
}

function generateTableRows(docType) {
    const tableBody = document.getElementById('items-body');
    let rowsHtml = '';
    for (let i = 1; i <= NUM_ROWS; i++) {
        if (docType === 'delivery') {
            rowsHtml += `<tr><td>${i}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty-ordered"></td><td><input type="number" data-cell="qty-delivered"></td></tr>`;
        } else {
            rowsHtml += `<tr><td>${i}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty"></td><td><input type="number" data-cell="price"></td><td><span class="line-total"></span></td></tr>`;
        }
    }
    tableBody.innerHTML = rowsHtml;
    tableBody.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => updateTotals(docType));
    });
}

function updateTotals(docType) {
    if (docType === 'delivery') {
        let orderedTotal = 0, deliveredTotal = 0;
        document.querySelectorAll('[data-cell="qty-ordered"]').forEach(i => orderedTotal += Number(i.value) || 0);
        document.querySelectorAll('[data-cell="qty-delivered"]').forEach(i => deliveredTotal += Number(i.value) || 0);
        document.getElementById('delivery-ordered-total').textContent = orderedTotal;
        document.getElementById('delivery-delivered-total').textContent = deliveredTotal;
    } else {
        let subtotal = 0;
        document.querySelectorAll('#items-body tr').forEach(row => {
            const qty = Number(row.querySelector('[data-cell="qty"]')?.value) || 0;
            const price = Number(row.querySelector('[data-cell="price"]')?.value) || 0;
            const total = qty * price;
            row.querySelector('.line-total').textContent = total > 0 ? total.toFixed(2) : '';
            subtotal += total;
        });
        const vat = subtotal * 0.05;
        const grandTotal = subtotal + vat;
        document.getElementById('subtotal-value').textContent = subtotal.toFixed(2);
        document.getElementById('vat-value').textContent = vat.toFixed(2);
        document.getElementById('total-value').textContent = grandTotal.toFixed(2);
        document.getElementById(`${docType}-words`).textContent = numberToWords(grandTotal);
    }
}

// --- DATA HANDLING AND SAVING ---
async function saveDocument(docType, isAutoSave = false) {
    try {
        const docElement = document.querySelector('.document.active');
        if (!docElement) {
            throw new Error('Document element not found');
        }

        const customerName = docElement.querySelector('[data-cell="name"]').value.trim();
        if (!customerName && !isAutoSave) {
            alert('Please enter customer name');
            return false;
        }

        const docData = {
            sheetName: docType.charAt(0).toUpperCase() + docType.slice(1) + 's',
            customerDetails: {
                name: customerName,
                mobile: docElement.querySelector('[data-cell="mobile"]').value.trim(),
                add: docElement.querySelector('[data-cell="add"]').value.trim(),
                trn: docElement.querySelector('[data-cell="trn"]').value.trim(),
            },
            docDetails: {
                number: docElement.querySelector(`#${docType}-number`).value,
                date: docElement.querySelector(`#${docType}-date`).value,
                ref: docElement.querySelector(`#${docType}-ref`) ? docElement.querySelector(`#${docType}-ref`).value.trim() : '',
            },
            items: [],
            totals: {
                subtotal: document.getElementById('subtotal-value')?.textContent || "0",
                vat: document.getElementById('vat-value')?.textContent || "0",
                total: document.getElementById('total-value')?.textContent || "0",
            },
            notes: docElement.querySelector('.notes-section textarea').value.trim()
        };

        let hasItems = false;
        document.querySelectorAll('#items-body tr').forEach(row => {
            const item = {};
            row.querySelectorAll('input[data-cell]').forEach(input => {
                item[input.dataset.cell] = input.value.trim();
            });
            if (Object.values(item).some(val => val)) {
                docData.items.push(item);
                hasItems = true;
            }
        });

        if (!hasItems && !isAutoSave) {
            alert('Please add at least one item');
            return false;
        }

        if (!hasItems || !customerName) {
            return false; // Skip auto-save if no valid data
        }

        const saveIndicator = document.createElement('div');
        saveIndicator.id = 'save-indicator';
        saveIndicator.style.position = 'fixed';
        saveIndicator.style.top = '10px';
        saveIndicator.style.right = '10px';
        saveIndicator.style.padding = '10px';
        saveIndicator.style.background = '#333';
        saveIndicator.style.color = 'white';
        saveIndicator.style.borderRadius = '5px';
        saveIndicator.textContent = 'Saving...';
        document.body.appendChild(saveIndicator);

        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            redirect: 'follow',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(docData)
        }).catch(error => {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('Network error: Cannot connect to server. Please check your internet connection and try again.');
            }
            throw error;
        });

        const data = await response.json();
        if (data.status === 'success') {
            saveIndicator.textContent = isAutoSave ? 'Auto-saved!' : 'Saved!';
            setTimeout(() => saveIndicator.remove(), 2000);
            return true;
        } else {
            throw new Error(data.message || 'Unknown error from server');
        }
    } catch (error) {
        console.error('Save error:', error);
        const saveIndicator = document.getElementById('save-indicator');
        if (saveIndicator) {
            saveIndicator.textContent = 'Save failed';
            saveIndicator.style.background = '#d32f2f';
            setTimeout(() => saveIndicator.remove(), 3000);
        }
        if (!isAutoSave) {
            alert(`❌ Error: ${error.message}`);
        }
        return false;
    }
}

function saveAndPrint(docType) {
    saveDocument(docType, false).then(success => {
        if (success) {
            const printButton = document.querySelector('.print-btn');
            const originalHtml = printButton.innerHTML;
            printButton.disabled = true;
            printButton.innerHTML = '<span style="font-size: 12px">Saving...</span>';

            setTimeout(() => {
                window.print();
                printButton.disabled = false;
                printButton.innerHTML = originalHtml;
            }, 500);
        }
    });
}

function generateNumber(docType) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const typeDigits = { 'invoice': '1', 'quotation': '4', 'delivery': '8' };
    const typeDigit = typeDigits[docType];
    
    let sequence;
    try {
        const storedSequence = localStorage.getItem(`${docType}-sequence`);
        if (storedSequence) {
            sequence = parseInt(storedSequence, 10) + 1;
        } else {
            const sessionSequence = sessionStorage.getItem(`${docType}-sequence`);
            sequence = sessionSequence ? parseInt(sessionSequence, 10) + 1 : 1;
        }
    } catch (error) {
        console.warn('localStorage access failed, using sessionStorage:', error);
        const sessionSequence = sessionStorage.getItem(`${docType}-sequence`) || '0';
        sequence = parseInt(sessionSequence, 10) + 1;
    }
    
    try {
        localStorage.setItem(`${docType}-sequence`, sequence);
    } catch (error) {
        console.warn('localStorage set failed, using sessionStorage:', error);
        sessionStorage.setItem(`${docType}-sequence`, sequence);
    }
    
    sessionStorage.setItem(`${docType}-sequence`, sequence);
    
    const sequenceStr = String(sequence).padStart(3, '0');
    return `${year}${month}${day}${typeDigit}${sequenceStr}`;
}

function numberToWords(num) {
    if (num === 0 || !num) return '';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    let words = '';
    let integer = Math.floor(num);
    let decimal = Math.round((num - integer) * 100);
    function convertChunk(n) {
        let str = '';
        if (n >= 100) { str += ones[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n > 0) str += ' and '; }
        if (n >= 20) { str += tens[Math.floor(n / 10)]; n %= 10; if (n > 0) str += ' ' + ones[n]; } 
        else if (n >= 10) { str += teens[n - 10]; } 
        else if (n > 0) { str += ones[n]; }
        return str;
    }
    if (integer === 0) { words = 'Zero'; }
    else {
        let tempInt = integer;
        let chunkCount = 0;
        while (tempInt > 0) {
            const chunk = tempInt % 1000;
            if (chunk > 0) {
                let chunkWords = convertChunk(chunk);
                if (chunkCount > 0) chunkWords += ' ' + (['', 'Thousand', 'Million'][chunkCount] || '');
                words = chunkWords + ' ' + words;
            }
            tempInt = Math.floor(tempInt / 1000);
            chunkCount++;
        }
    }
    let result = words.trim() + ' Dirhams';
    if (decimal > 0) { result += ' and ' + convertChunk(decimal) + ' Fils'; }
    return result.trim() + ' only.';
}

// --- GOOGLE AUTHENTICATION ---
let googleTokenClient;

function initGoogleAuth() {
    if (authInitialized) return;
    
    // Check if Google Identity Services is already loaded
    if (typeof google !== 'undefined' && google.accounts) {
        initializeGoogleAuth();
    } else {
        // Load Google Identity Services
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initializeGoogleAuth;
        script.onerror = () => {
            console.error('Failed to load Google Identity Services');
            showAuthError('Failed to load authentication service. Please check your internet connection.');
        };
        document.head.appendChild(script);
    }
    
    authInitialized = true;
}

function initializeGoogleAuth() {
    try {
        googleTokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '668706603480-6lp9l2p8mjtnhde466diflq75d0fui8q.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/userinfo.email',
            callback: handleCredentialResponse,
        });
        
        // Check if user is already authenticated
        const savedUser = sessionStorage.getItem('akm_user');
        const savedToken = sessionStorage.getItem('akm_token');
        
        if (savedUser && savedToken) {
            currentUser = JSON.parse(savedUser);
            updateAuthUI();
            validateTokenWithBackend(savedToken);
        }
    } catch (error) {
        console.error('Failed to initialize Google auth:', error);
        showAuthError('Authentication service initialization failed.');
    }
}

function handleGoogleSignIn() {
    if (!googleTokenClient) {
        showAuthError('Authentication service not ready. Please try again.');
        return;
    }
    
    try {
        googleTokenClient.requestAccessToken();
    } catch (error) {
        console.error('Google sign-in error:', error);
        showAuthError('Failed to start authentication. Please try again.');
    }
}

function handleCredentialResponse(tokenResponse) {
    if (tokenResponse && tokenResponse.access_token) {
        // Verify the token and get user info
        verifyGoogleToken(tokenResponse.access_token);
    } else {
        console.error('Invalid token response:', tokenResponse);
        showAuthError('Authentication failed. Please try again.');
    }
}

async function verifyGoogleToken(accessToken) {
    try {
        // First, get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!userInfoResponse.ok) {
            throw new Error('Failed to get user info from Google');
        }
        
        const userInfo = await userInfoResponse.json();
        
        // Check if user is from @akm-music.com domain
        if (!userInfo.email.endsWith('@akm-music.com')) {
            showAuthError('Access denied. Please use your @akm-music.com email address.');
            handleSignOut();
            return;
        }
        
        // Validate with our backend
        const backendValidation = await validateWithBackend(accessToken, userInfo.email);
        
        if (backendValidation) {
            currentUser = {
                email: userInfo.email,
                name: userInfo.name || userInfo.email.split('@')[0],
                picture: userInfo.picture,
                accessToken: accessToken
            };
            
            sessionStorage.setItem('akm_user', JSON.stringify(currentUser));
            sessionStorage.setItem('akm_token', accessToken);
            updateAuthUI();
            
            showAuthSuccess('Successfully signed in as ' + userInfo.email);
        } else {
            throw new Error('Backend validation failed');
        }
    } catch (error) {
        console.error('Authentication error:', error);
        showAuthError('Authentication failed: ' + error.message);
        handleSignOut();
    }
}

async function validateWithBackend(token, email) {
    try {
        // Simple validation - we'll just check if we can access a protected endpoint
        const response = await fetch(`${WEB_APP_URL}?action=getCustomers&validateAuth=true`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
        }
        
        return true;
    } catch (error) {
        console.error('Backend validation failed:', error);
        return false;
    }
}

async function validateTokenWithBackend(token) {
    try {
        const response = await fetch(`${WEB_APP_URL}?action=validateAuth`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Token validation failed: ${response.status}`);
        }
        
        return true;
    } catch (error) {
        console.error('Token validation failed:', error);
        handleSignOut();
        return false;
    }
}

function handleSignOut() {
    try {
        if (currentUser && currentUser.accessToken) {
            // Revoke Google token
            google.accounts.oauth2.revoke(currentUser.accessToken, () => {
                console.log('Token revoked');
            });
        }
    } catch (error) {
        console.error('Error revoking token:', error);
    }
    
    currentUser = null;
    sessionStorage.removeItem('akm_user');
    sessionStorage.removeItem('akm_token');
    updateAuthUI();
    
    // Check if we're on a document page and redirect to home if not authenticated
    if (document.body.dataset.docType) {
        window.location.href = 'index.html';
    }
}

function updateAuthUI() {
    const authBtn = document.getElementById('auth-button');
    const userInfo = document.getElementById('user-info');
    
    if (authBtn && userInfo) {
        if (currentUser) {
            authBtn.style.display = 'none';
            userInfo.style.display = 'flex';
            userInfo.querySelector('.user-email').textContent = currentUser.email;
            
            // Enable document functionality
            enableDocumentFeatures();
        } else {
            authBtn.style.display = 'block';
            userInfo.style.display = 'none';
            
            // Disable document functionality
            disableDocumentFeatures();
        }
    }
}

function enableDocumentFeatures() {
    // Enable all buttons and inputs on document pages
    const buttons = document.querySelectorAll('button:not(.auth-button)');
    const inputs = document.querySelectorAll('input, textarea, select');
    
    buttons.forEach(btn => btn.disabled = false);
    inputs.forEach(input => input.disabled = false);
}

function disableDocumentFeatures() {
    // Disable all buttons and inputs on document pages
    const buttons = document.querySelectorAll('button:not(.auth-button)');
    const inputs = document.querySelectorAll('input, textarea, select');
    
    buttons.forEach(btn => btn.disabled = true);
    inputs.forEach(input => input.disabled = true);
}

function checkAuthentication() {
    if (!currentUser && document.body.dataset.docType) {
        // Redirect to home page if not authenticated on document page
        window.location.href = 'index.html';
        return false;
    }
    return !!currentUser;
}

// Helper functions for auth messages
function showAuthError(message) {
    const authBtn = document.getElementById('auth-button');
    if (authBtn) {
        const originalText = authBtn.textContent;
        authBtn.textContent = message;
        authBtn.style.background = '#d32f2f';
        setTimeout(() => {
            authBtn.textContent = originalText;
            authBtn.style.background = '';
        }, 3000);
    } else {
        alert(message);
    }
}

function showAuthSuccess(message) {
    const authBtn = document.getElementById('auth-button');
    if (authBtn) {
        const originalText = authBtn.textContent;
        authBtn.textContent = message;
        authBtn.style.background = '#2e7d32';
        setTimeout(() => {
            authBtn.textContent = originalText;
            authBtn.style.background = '';
        }, 3000);
    } else {
        alert(message);
    }
}

async function loadDocumentForEditing(docId, sheetName) {
    try {
        showLoading('Loading document...');
        const url = `${WEB_APP_URL}?action=getDocument&docId=${encodeURIComponent(docId)}&sheetName=${encodeURIComponent(sheetName)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch document');
        }
        const data = await response.json();
        if (data.status === 'success') {
            return data.data;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error loading document:', error);
        alert('Error loading document: ' + error.message);
        return null;
    } finally {
        hideLoading();
    }
}

function populateDocumentForm(documentData, docType) {
    const docElement = document.querySelector('.document.active');
    if (!docElement) return;
    docElement.querySelector('[data-cell="name"]').value = documentData['Customer Name'] || '';
    docElement.querySelector('[data-cell="mobile"]').value = documentData['Customer Mobile'] || '';
    docElement.querySelector('[data-cell="add"]').value = documentData['Customer Address'] || '';
    docElement.querySelector('[data-cell="trn"]').value = documentData['Customer TRN'] || '';
    document.getElementById(`${docType}-number`).value = documentData['Document ID'] || '';
    document.getElementById(`${docType}-date`).value = documentData['Date'] || '';
    if (document.getElementById(`${docType}-ref`)) {
        document.getElementById(`${docType}-ref`).value = documentData['Reference'] || '';
    }
    if (documentData.items && Array.isArray(documentData.items)) {
        const tableBody = document.getElementById('items-body');
        tableBody.innerHTML = '';
        documentData.items.forEach((item, index) => {
            let rowHtml = '';
            if (docType === 'delivery') {
                rowHtml = `<tr>
                    <td>${index + 1}</td>
                    <td><input type="text" data-cell="model" value="${item.model || ''}"></td>
                    <td><input type="text" data-cell="description" value="${item.description || ''}"></td>
                    <td><input type="number" data-cell="qty-ordered" value="${item['qty-ordered'] || ''}"></td>
                    <td><input type="number" data-cell="qty-delivered" value="${item['qty-delivered'] || ''}"></td>
                </tr>`;
            } else {
                rowHtml = `<tr>
                    <td>${index + 1}</td>
                    <td><input type="text" data-cell="model" value="${item.model || ''}"></td>
                    <td><input type="text" data-cell="description" value="${item.description || ''}"></td>
                    <td><input type="number" data-cell="qty" value="${item.qty || ''}"></td>
                    <td><input type="number" data-cell="price" value="${item.price || ''}"></td>
                    <td><span class="line-total">${(item.qty * item.price || 0).toFixed(2)}</span></td>
                </tr>`;
            }
            tableBody.innerHTML += rowHtml;
        });
        const remainingRows = NUM_ROWS - documentData.items.length;
        for (let i = 0; i < remainingRows; i++) {
            const index = documentData.items.length + i + 1;
            if (docType === 'delivery') {
                tableBody.innerHTML += `<tr><td>${index}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty-ordered"></td><td><input type="number" data-cell="qty-delivered"></td></tr>`;
            } else {
                tableBody.innerHTML += `<tr><td>${index}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty"></td><td><input type="number" data-cell="price"></td><td><span class="line-total"></span></td></tr>`;
            }
        }
        tableBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => updateTotals(docType));
        });
    }
    if (docElement.querySelector('.notes-section textarea')) {
        docElement.querySelector('.notes-section textarea').value = documentData['Notes'] || '';
    }
    updateTotals(docType);
}

async function exportRecords(sheetName, startDate, endDate, format = 'csv') {
    try {
        showLoading('Exporting records...');
        const params = new URLSearchParams({
            action: 'export',
            sheetName: sheetName,
            format: format
        });
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const url = `${WEB_APP_URL}?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to export records');
        }
        if (format === 'csv') {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${sheetName}_Export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } else {
            const data = await response.json();
            console.log('Export data:', data);
            alert(`Exported ${data.data.total} records successfully`);
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting records: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function updateDocumentStatus(docId, sheetName, newStatus, notes = '') {
    try {
        showLoading('Updating status...');
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateStatus',
                docId: docId,
                sheetName: sheetName,
                status: newStatus,
                notes: notes
            })
        });
        if (!response.ok) {
            throw new Error('Failed to update status');
        }
        const data = await response.json();
        if (data.status === 'success') {
            alert('Status updated successfully!');
            return data.data;
        } else {
           throw new Error(data.message);
        }
    } catch (error) {
        console.error('Status update error:', error);
        alert('Error updating status: ' + error.message);
        return null;
    } finally {
        hideLoading();
    }
}

async function listDocuments(sheetName, filters = {}) {
    try {
        showLoading('Loading documents...');
        const params = new URLSearchParams({
            action: 'listDocuments',
            sheetName: sheetName
        });
        if (filters.status) params.append('status', filters.status);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        const url = `${WEB_APP_URL}?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch documents');
        }
        const data = await response.json();
        if (data.status === 'success') {
            return data.data.documents;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error listing documents:', error);
        alert('Error loading documents: ' + error.message);
        return [];
    } finally {
        hideLoading();
    }
}

function showLoading(message = 'Loading...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.7)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.color = 'white';
        overlay.style.fontSize = '18px';
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div style="background: white; color: #333; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="margin-bottom: 10px;">${message}</div>
        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
    </div>`;
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    if (modal && overlay) {
        modal.style.display = 'block';
        overlay.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modal-overlay');
    if (modal && overlay) {
        modal.style.display = 'none';
        overlay.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initGoogleAuth();
    const modals = `
        <div id="modal-overlay" class="overlay" style="display: none;"></div>
        <div id="edit-modal" class="modal" style="display: none;">
            <h3>Edit Previous Document</h3>
            <select id="edit-doc-type">
                <option value="Invoices">Invoice</option>
                <option value="Quotations">Quotation</option>
                <option value="Deliveries">Delivery Note</option>
            </select>
            <input type="text" id="edit-doc-id" placeholder="Document ID (e.g., INV-2401011001)">
            <button onclick="loadDocument()">Load Document</button>
            <button onclick="closeModal('edit-modal')">Cancel</button>
        </div>
        <div id="export-modal" class="modal" style="display: none;">
            <h3>Export Records</h3>
            <select id="export-doc-type">
                <option value="Invoices">Invoices</option>
                <option value="Quotations">Quotations</option>
                <option value="Deliveries">Delivery Notes</option>
            </select>
            <input type="date" id="export-start-date" placeholder="Start Date">
            <input type="date" id="export-end-date" placeholder="End Date">
            <select id="export-format">
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
            </select>
            <button onclick="executeExport()">Export</button>
            <button onclick="closeModal('export-modal')">Cancel</button>
        </div>
        <div id="status-modal" class="modal" style="display: none;">
            <h3>Update Document Status</h3>
            <select id="status-doc-type">
                <option value="Invoices">Invoice</option>
                <option value="Quotations">Quotation</option>
                <option value="Deliveries">Delivery Note</option>
            </select>
            <input type="text" id="status-doc-id" placeholder="Document ID">
            <select id="new-status">
                <option value="Draft">Draft</option>
                <option value="Issued">Issued</option>
                <option value="Paid">Paid</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
            </select>
            <textarea id="status-notes" placeholder="Notes (optional)"></textarea>
            <button onclick="updateStatus()">Update Status</button>
            <button onclick="closeModal('status-modal')">Cancel</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modals);
});

// Add CSS for loading animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        z-index: 10000;
        min-width: 300px;
    }
    
    .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
    }
`;
