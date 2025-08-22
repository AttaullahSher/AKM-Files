// This is your live Web App URL.
const WEB_APP_URL = 'https://script.google.com/a/macros/akm-music.com/s/AKfycbwZHuhkk8-llpul4ybaCnxvl_EdRcoeaHoxwrELZu53zBWV_wY2--YsPWCrENMKMC3kJg/exec';

let currentDoc = 'invoice';
const NUM_ROWS = 14;

// --- INITIALIZATION ---
window.onload = function() {
  // Figure out which document to show from the URL (e.g., ?doc=quotation)
  const urlParams = new URLSearchParams(window.location.search);
  const docToShow = urlParams.get('doc') || 'invoice'; // Default to invoice

  generateTableRows();
  showDocument(docToShow);
  addEventListeners();
};

function addEventListeners() {
  document.querySelector('.print-btn').addEventListener('click', saveAndPrint);
  document.querySelectorAll('.doc-tab').forEach(tab => {
    tab.addEventListener('click', (e) => showDocument(e.target.id.replace('tab-', '')));
  });
}

function generateTableRows() {
    const invoiceBody = document.getElementById('invoice-items');
    const quotationBody = document.getElementById('quotation-items');
    const deliveryBody = document.getElementById('delivery-items');

    for (let i = 1; i <= NUM_ROWS; i++) {
        invoiceBody.innerHTML += `<tr><td>${i}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty" class="qty" oninput="updateLineTotal(this, 'invoice')"></td><td><input type="number" data-cell="price" class="price" oninput="updateLineTotal(this, 'invoice')"></td><td><span class="line-total"></span></td></tr>`;
        quotationBody.innerHTML += `<tr><td>${i}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty" class="qty" oninput="updateLineTotal(this, 'quotation')"></td><td><input type="number" data-cell="price" class="price" oninput="updateLineTotal(this, 'quotation')"></td><td><span class="line-total"></span></td></tr>`;
        deliveryBody.innerHTML += `<tr><td>${i}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty-ordered" class="qty-ordered" oninput="updateDeliveryTotals()"></td><td><input type="number" data-cell="qty-delivered" class="qty-delivered" oninput="updateDeliveryTotals()"></td></tr>`;
    }
}


// --- DOCUMENT DISPLAY & LOGIC ---
function showDocument(doc) {
  currentDoc = doc;
  document.querySelectorAll('.document').forEach(d => d.style.display = 'none');
  document.getElementById(doc).style.display = 'block';
  document.querySelectorAll('.doc-tab').forEach(t => t.classList.remove('active-tab'));
  document.getElementById(`tab-${doc}`).classList.add('active-tab');

  const numberInput = document.getElementById(`${doc}-number`);
  if (!numberInput.value) {
    numberInput.value = generateNumber(doc);
  }
  const dateInput = document.getElementById(`${doc}-date`);
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  document.getElementById('create-invoice-btn').style.display = doc === 'quotation' ? 'block' : 'none';
  document.getElementById('create-delivery-btn').style.display = doc === 'invoice' ? 'block' : 'none';
  updateTotals(doc);
}

function generateNumber(docType) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const typeDigits = { 'invoice': '1', 'quotation': '4', 'delivery': '8' };
    const typeDigit = typeDigits[docType];

    let sequence = parseInt(localStorage.getItem(`${docType}-sequence`) || '0', 10) + 1;
    localStorage.setItem(`${docType}-sequence`, sequence);
    const sequenceStr = String(sequence).padStart(3, '0');

    return `${year}${month}${day}${typeDigit}${sequenceStr}`;
}


// --- DATA HANDLING AND SAVING ---
function saveAndPrint() {
  const docElement = document.getElementById(currentDoc);
  let grandTotal = 0;
  if (currentDoc !== 'delivery') {
      grandTotal = parseFloat(docElement.querySelector(`#${currentDoc}-total-value`).textContent) || 0;
  }
  if (grandTotal <= 0 && currentDoc !== 'delivery') {
      if (!confirm('Totals are empty. Save and Print anyway?')) { return; }
  }
  
  const docData = {
      sheetName: currentDoc.charAt(0).toUpperCase() + currentDoc.slice(1) + 's',
      customerDetails: {
          name: docElement.querySelector('input[data-cell="name"]').value,
          mobile: docElement.querySelector('input[data-cell="mobile"]').value,
          add: docElement.querySelector('input[data-cell="add"]').value,
          trn: docElement.querySelector('input[data-cell="trn"]').value
      },
      docDetails: {
          number: docElement.querySelector(`#${currentDoc}-number`).value,
          date: docElement.querySelector(`#${currentDoc}-date`).value,
          ref: docElement.querySelector(`#${currentDoc}-ref`) ? docElement.querySelector(`#${currentDoc}-ref`).value : ''
      },
      items: [],
      totals: {
          subtotal: docElement.querySelector(`#${currentDoc}-subtotal-value`) ? docElement.querySelector(`#${currentDoc}-subtotal