const WEB_APP_URL = 'https://script.google.com/a/macros/akm-music.com/s/AKfycbwZHuhkk8-llpul4ybaCnxvl_EdRcoeaHoxwrELZu53zBWV_wY2--YsPWCrENMKMC3kJg/exec';
const NUM_ROWS = 14;

window.onload = function() {
    const docType = document.body.dataset.docType;
    if (!docType) return; // Don't run on index.html

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
            rowsHtml += `<tr><td>${i}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty-ordered" class="qty-ordered"></td><td><input type="number" data-cell="qty-delivered" class="qty-delivered"></td></tr>`;
        } else {
            rowsHtml += `<tr><td>${i}</td><td><input type="text" data-cell="model"></td><td><input type="text" data-cell="description"></td><td><input type="number" data-cell="qty" class="qty"></td><td><input type="number" data-cell="price" class="price"></td><td><span class="line-total"></span></td></tr>`;
        }
    }
    tableBody.innerHTML = rowsHtml;

    // Add event listeners after rows are created
    tableBody.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => updateTotals(docType));
    });
}

function updateTotals(docType) {
    if (docType === 'delivery') {
        let orderedTotal = 0, deliveredTotal = 0;
        document.querySelectorAll('.qty-ordered').forEach(input => orderedTotal += Number(input.value) || 0);
        document.querySelectorAll('.qty-delivered').forEach(input => deliveredTotal += Number(input.value) || 0);
        document.getElementById('delivery-ordered-total').textContent = orderedTotal;
        document.getElementById('delivery-delivered-total').textContent = deliveredTotal;
    } else {
        let subtotal = 0;
        document.querySelectorAll('#items-body tr').forEach(row => {
            const qty = Number(row.querySelector('.qty')?.value) || 0;
            const price = Number(row.querySelector('.price')?.value) || 0;
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

function saveAndPrint(docType) {
    const docElement = document.querySelector('.document.active');
    const docData = {
        sheetName: docType.charAt(0).toUpperCase() + docType.slice(1) + 's',
        customerDetails: {
            name: docElement.querySelector('[data-cell="name"]').value,
            mobile: docElement.querySelector('[data-cell="mobile"]').value,
            add: docElement.querySelector('[data-cell="add"]').value,
            trn: docElement.querySelector('[data-cell="trn"]').value,
        },
        docDetails: {
            number: docElement.querySelector(`#${docType}-number`).value,
            date: docElement.querySelector(`#${docType}-date`).value,
            ref: docElement.querySelector(`#${docType}-ref`) ? docElement.querySelector(`#${docType}-ref`).value : '',
        },
        items: [],
        totals: {
            subtotal: document.getElementById('subtotal-value')?.textContent || "0",
            vat: document.getElementById('vat-value')?.textContent || "0",
            total: document.getElementById('total-value')?.textContent || "0",
        },
        notes: docElement.querySelector('.notes-section textarea').value
    };
    
    document.querySelectorAll('#items-body tr').forEach(row => {
        const item = {};
        row.querySelectorAll('input').forEach(input => {
            if (input.dataset.cell) item[input.dataset.cell] = input.value;
        });
        if (Object.values(item).some(val => val)) docData.items.push(item);
    });

    const printButton = document.querySelector('.print-btn');
    printButton.disabled = true;
    printButton.innerHTML = '...';

    fetch(WEB_APP_URL, {
        method: 'POST', mode: 'cors', cache: 'no-cache', redirect: 'follow', body: JSON.stringify(docData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            alert(data.message);
            window.print();
        } else {
            alert('Error: ' + data.message);
        }
    })
    .catch(err => {
        console.error(err);
        alert('A critical error occurred.');
    })
    .finally(() => {
        printButton.disabled = false;
        printButton.innerHTML = `<img src="Assets/printer-icon.avif" alt="Print" style="width: 20px; height: 20px;"/>`;
    });
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
    words = convertChunk(integer);
  }
  let result = words.trim() + ' Dirhams';
  if (decimal > 0) { result += ' and ' + (convertChunk(decimal) || '') + ' Fils'; }
  return result.trim() + ' only.';
}