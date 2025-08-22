const WEB_APP_URL = 'https://script.google.com/a/macros/akm-music.com/s/AKfycbwZHuhkk8-llpul4ybaCnxvl_EdRcoeaHoxwrELZu53zBWV_wY2--YsPWCrENMKMC3kJg/exec';
const NUM_ROWS = 14;
let currentUser = null;
let authInitialized = false;

// --- INITIALIZATION ---
window.onload = function() {
    // Find out what kind of page this is from the <body> tag
    const docType = document.body.dataset.docType;
    if (!docType) return; // Stop if it's not a document page (like index.html)

    generateTableRows(docType);
    initializePage(docType);
    document.querySelector('.print-btn').addEventListener('click', () => saveAndPrint(docType));
};

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
    // Add event listeners to the new input fields
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
function saveAndPrint(docType) {
    try {
        const docElement = document.querySelector('.document.active');
        if (!docElement) {
            throw new Error('Document element not found');
        }

        // Validate required fields
        const customerName = docElement.querySelector('[data-cell="name"]').value.trim();
        if (!customerName) {
            alert('Please enter customer name');
            return;
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

        // Validate and collect items
        let hasItems = false;
        document.querySelectorAll('#items-body tr').forEach(row => {
            const item = {};
            row.querySelectorAll('input[data-cell]').forEach(input => {
                item[input.dataset.cell] = input.value.trim();
            });
            
            // Check if item has any data
            if (Object.values(item).some(val => val)) {
                docData.items.push(item);
                hasItems = true;
            }
        });

        if (!hasItems) {
            alert('Please add at least one item');
            return;
        }

        const printButton = document.querySelector('.print-btn');
        const originalHtml = printButton.innerHTML;
        printButton.disabled = true;
        printButton.innerHTML = '<span style="font-size: 12px">Saving...</span>';

        // Show loading state
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.3)';
        overlay.style.zIndex = '999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.innerHTML = '<div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">Saving document...</div>';
        document.body.appendChild(overlay);

        fetch(WEB_APP_URL, {
            method: 'POST', 
            mode: 'cors', 
            cache: 'no-cache', 
            redirect: 'follow', 
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(docData)
        })
        .then(async res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            if (data.status === 'success') {
                // Remove overlay and show success
                document.body.removeChild(overlay);
                alert(`✅ ${data.message}`);
                setTimeout(() => window.print(), 500); // Small delay for better UX
            } else {
                throw new Error(data.message || 'Unknown error from server');
            }
        })
        .catch(err => {
            console.error('Save error:', err);
            document.body.removeChild(overlay);
            
            // More specific error messages
            if (err.message.includes('Failed to fetch')) {
                alert('❌ Network error: Unable to connect to server. Please check your internet connection.');
            } else if (err.message.includes('HTTP error')) {
                alert('❌ Server error: Please try again later or contact support.');
            } else {
                alert(`❌ Error: ${err.message}`);
            }
        })
        .finally(() => {
            printButton.disabled = false;
            printButton.innerHTML = originalHtml;
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        alert('❌ An unexpected error occurred. Please try again.');
        const printButton = document.querySelector('.print-btn');
        if (printButton) {
            printButton.disabled = false;
            printButton.innerHTML = `<img src="Assets/printer-icon.avif" alt="Print" style="width: 20px; height: 20px;">`;
        }
    }
}

function generateNumber(docType) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const typeDigits = { 'invoice': '1', 'quotation': '4', 'delivery': '8' };
    const typeDigit = typeDigits[docType];
    
    // Get current sequence with fallback mechanisms
    let sequence;
    try {
        const storedSequence = localStorage.getItem(`${docType}-sequence`);
        if (storedSequence) {
            sequence = parseInt(storedSequence, 10) + 1;
        } else {
            // Check if we have a backup in sessionStorage or initialize
            const sessionSequence = sessionStorage.getItem(`${docType}-sequence`);
            sequence = sessionSequence ? parseInt(sessionSequence, 10) + 1 : 1;
        }
    } catch (error) {
        console.warn('localStorage access failed, using sessionStorage:', error);
        const sessionSequence = sessionStorage.getItem(`${docType}-sequence`) || '0';
        sequence = parseInt(sessionSequence, 10) + 1;
    }
    
    // Store in both localStorage and sessionStorage for redundancy
    try {
        localStorage.setItem(`${docType}-sequence`, sequence);
    } catch (error) {
        console.warn('localStorage set failed, using sessionStorage:', error);
        sessionStorage.setItem(`${docType}-sequence`, sequence);
    }
    
    sessionStorage.setItem(`${docType}-sequence`, sequence); // Always backup in sessionStorage
    
    const sequenceStr = String(sequence).padStart(3, '0');
    return `${year}${month}${day}${typeDigit}${sequenceStr}`;
}
function numberToWords(num) {
  if (num === 0 || !num) return '';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  let words = ''; let integer = Math.floor(num); let decimal = Math.round((num - integer) * 100);
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
            if(chunkCount > 0) chunkWords += ' ' + (['', 'Thousand', 'Million'][chunkCount] || '');
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

// --- ENHANCED FEATURES ---

// Google Authentication
function initGoogleAuth() {
  if (authInitialized) return;
  
  // Check if user is already logged in (from session)
  const savedUser = sessionStorage.getItem('akm_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    updateAuthUI();
  }
  
  authInitialized = true;
}

function handleGoogleSignIn() {
  // This would integrate with Google Sign-In API
  // For now, we'll simulate authentication for testing
  const userEmail = prompt('Enter your Google Workspace email (@akm-music.com):');
  
  if (userEmail && userEmail.endsWith('@akm-music.com')) {
    currentUser = {
      email: userEmail,
      name: userEmail.split('@')[0],
      picture: null
    };
    
    sessionStorage.setItem('akm_user', JSON.stringify(currentUser));
    updateAuthUI();
    alert('Successfully signed in as ' + userEmail);
  } else {
    alert('Please use your @akm-music.com email address');
  }
}

function handleSignOut() {
  currentUser = null;
  sessionStorage.removeItem('akm_user');
  updateAuthUI();
  alert('Signed out successfully');
}

function updateAuthUI() {
  const authBtn = document.getElementById('auth-button');
  const userInfo = document.getElementById('user-info');
  
  if (authBtn && userInfo) {
    if (currentUser) {
      authBtn.style.display = 'none';
      userInfo.style.display = 'flex';
      userInfo.querySelector('.user-email').textContent = currentUser.email;
    } else {
      authBtn.style.display = 'block';
      userInfo.style.display = 'none';
    }
  }
}

// Document Retrieval and Editing
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
  // Populate customer details
  const docElement = document.querySelector('.document.active');
  if (!docElement) return;
  
  docElement.querySelector('[data-cell="name"]').value = documentData['Customer Name'] || '';
  docElement.querySelector('[data-cell="mobile"]').value = documentData['Customer Mobile'] || '';
  docElement.querySelector('[data-cell="add"]').value = documentData['Customer Address'] || '';
  docElement.querySelector('[data-cell="trn"]').value = documentData['Customer TRN'] || '';
  
  // Populate document details
  document.getElementById(`${docType}-number`).value = documentData['Document ID'] || '';
  document.getElementById(`${docType}-date`).value = documentData['Date'] || '';
  if (document.getElementById(`${docType}-ref`)) {
    document.getElementById(`${docType}-ref`).value = documentData['Reference'] || '';
  }
  
  // Populate items
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
    
    // Add empty rows if needed
    const remainingRows = NUM_ROWS - documentData.items.length;
    for (let i = 0; i < remainingRows; i++) {
      const index = documentData.items.length + i + 1;
      if (docType === 'delivery') {
        tableBody.innerHTML += `<tr><td>${index}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty-ordered"></td><td><input type="number" data-cell="qty-delivered"></td></tr>`;
      } else {
        tableBody.innerHTML += `<tr><td>${index}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty"></td><td><input type="number" data-cell="price"></td><td><span class="line-total"></span></td></tr>`;
      }
    }
    
    // Add event listeners
    tableBody.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => updateTotals(docType));
    });
  }
  
  // Populate notes
  if (docElement.querySelector('.notes-section textarea')) {
    docElement.querySelector('.notes-section textarea').value = documentData['Notes'] || '';
  }
  
  // Update totals
  updateTotals(docType);
}

// Export functionality
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

// Status Management
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

// Utility Functions
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

// Initialize enhanced features when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initGoogleAuth();
  
  // Add modals to the page
  const modals = `
    <div id="modal-overlay" class="overlay" style="display: none;"></div>
    
    <!-- Edit Document Modal -->
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
    
    <!-- Export Modal -->
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
    
    <!-- Status Update Modal -->
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
      <textarea id="status-notes" placeholder="Notes (optional)" rows="3"></textarea>
      <button onclick="updateStatus()">Update Status</button>
      <button onclick="closeModal('status-modal')">Cancel</button>
    </div>
    
    <!-- Loading Overlay -->
    <div id="loading-overlay" style="display: none;"></div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modals);
  
  // Add overlay click handler
  document.getElementById('modal-overlay').addEventListener('click', function() {
    closeModal('edit-modal');
    closeModal('export-modal');
    closeModal('status-modal');
  });
});

// Global functions for modal actions
async function loadDocument() {
  const docType = document.getElementById('edit-doc-type').value;
  const docId = document.getElementById('edit-doc-id').value.trim();
  
  if (!docId) {
    alert('Please enter a Document ID');
    return;
  }
  
  const documentData = await loadDocumentForEditing(docId, docType);
  if (documentData) {
    // Redirect to the appropriate page and populate data
    const pageType = docType.toLowerCase().replace('s', '');
    window.location.href = `${pageType}.html?edit=${docId}`;
  }
}

async function executeExport() {
  const docType = document.getElementById('export-doc-type').value;
  const startDate = document.getElementById('export-start-date').value;
  const endDate = document.getElementById('export-end-date').value;
  const format = document.getElementById('export-format').value;
  
  await exportRecords(docType, startDate, endDate, format);
  closeModal('export-modal');
}

async function updateStatus() {
  const docType = document.getElementById('status-doc-type').value;
  const docId = document.getElementById('status-doc-id').value.trim();
  const newStatus = document.getElementById('new-status').value;
  const notes = document.getElementById('status-notes').value.trim();
  
  if (!docId) {
    alert('Please enter a Document ID');
    return;
  }
  
  const result = await updateDocumentStatus(docId, docType, newStatus, notes);
  if (result) {
    closeModal('status-modal');
  }
}
