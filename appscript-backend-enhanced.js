// Enhanced Google Apps Script Backend for AKM Docs
// This script provides full CRUD operations, export functionality, and authentication

// Global constants
const SHEET_NAMES = {
  INVOICES: 'Invoices',
  QUOTATIONS: 'Quotations', 
  DELIVERIES: 'Deliveries',
  CUSTOMERS: 'Customers'
};

const DOCUMENT_TYPES = {
  INVOICE: 'INV-',
  QUOTATION: 'QTN-',
  DELIVERY: 'DLV-'
};

const STATUS_VALUES = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PAID: 'Paid',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled'
};

// Main request handler
function doPost(e) {
  try {
    // Check authentication first
    if (!isAuthenticated()) {
      return createErrorResponse('Authentication required', 401);
    }
    
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'create';
    
    switch(action) {
      case 'create':
        return createDocument(data);
      case 'update':
        return updateDocument(data);
      case 'updateStatus':
        return updateDocumentStatus(data);
      default:
        return createDocument(data); // Default to create for backward compatibility
    }
  } catch (error) {
    return createErrorResponse(error.toString());
  }
}

// Enhanced GET handler for document retrieval and exports
function doGet(e) {
  try {
    // Check authentication
    if (!isAuthenticated()) {
      return createErrorResponse('Authentication required', 401);
    }
    
    var params = e.parameter;
    var action = params.action;
    
    switch(action) {
      case 'getDocument':
        return getDocumentById(params.docId, params.sheetName);
      case 'listDocuments':
        return listDocuments(params.sheetName, params.status, params.startDate, params.endDate);
      case 'export':
        return exportDocuments(params.sheetName, params.startDate, params.endDate, params.format);
      case 'getStatusCounts':
        return getStatusCounts(params.sheetName);
      default:
        return ContentService.createTextOutput("AKM Docs API - Use POST for document operations");
    }
  } catch (error) {
    return createErrorResponse(error.toString());
  }
}

// Google Workspace Authentication
function isAuthenticated() {
  try {
    // Get the active user email (only works in Google Workspace domain)
    var userEmail = Session.getActiveUser().getEmail();
    
    // Check if user is from your domain (replace with your actual domain)
    if (userEmail.endsWith('@akm-music.com')) {
      return true;
    }
    
    // For testing or if you want to allow specific users
    var allowedUsers = [
      'admin@akm-music.com',
      // Add other allowed emails here
    ];
    
    return allowedUsers.includes(userEmail);
  } catch (error) {
    // If we can't get user info, assume not authenticated
    return false;
  }
}

// Create new document (original functionality enhanced)
function createDocument(data) {
  var sheetName = data.sheetName;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    return createErrorResponse('Sheet not found: ' + sheetName);
  }
  
  // Get customer details
  var customerName = data.customerDetails.name;
  var customerMobile = data.customerDetails.mobile;
  var customerAddress = data.customerDetails.add;
  var customerTrn = data.customerDetails.trn;
  
  // Find or create customer
  var customerId = findOrCreateCustomer(customerName, customerMobile, customerAddress, customerTrn);
  
  // Prepare unique ID
  var docIdPrefix = '';
  if (sheetName === SHEET_NAMES.INVOICES) docIdPrefix = DOCUMENT_TYPES.INVOICE;
  else if (sheetName === SHEET_NAMES.QUOTATIONS) docIdPrefix = DOCUMENT_TYPES.QUOTATION;
  else if (sheetName === SHEET_NAMES.DELIVERIES) docIdPrefix = DOCUMENT_TYPES.DELIVERY;
  
  var uniqueId = docIdPrefix + data.docDetails.number;
  
  // Store items as JSON
  var itemsJson = JSON.stringify(data.items);
  
  var newRow;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  if (sheetName === SHEET_NAMES.INVOICES || sheetName === SHEET_NAMES.QUOTATIONS) {
    newRow = [
      uniqueId,
      customerId,
      customerName,
      customerMobile,
      data.docDetails.date,
      data.docDetails.ref,
      itemsJson,
      data.totals.subtotal,
      data.totals.vat,
      data.totals.total,
      STATUS_VALUES.DRAFT, // Default status
      data.notes || '',
      new Date().toISOString(), // Created timestamp
      Session.getActiveUser().getEmail(), // Created by
      new Date().toISOString(), // Updated timestamp
      Session.getActiveUser().getEmail()  // Updated by
    ];
  } else if (sheetName === SHEET_NAMES.DELIVERIES) {
    newRow = [
      uniqueId,
      customerId,
      customerName,
      customerMobile,
      data.docDetails.date,
      data.docDetails.ref,
      itemsJson,
      null, // Ordered Qty
      null, // Delivered Qty
      STATUS_VALUES.DRAFT,
      data.notes || '',
      new Date().toISOString(), // Created timestamp
      Session.getActiveUser().getEmail(), // Created by
      new Date().toISOString(), // Updated timestamp
      Session.getActiveUser().getEmail()  // Updated by
    ];
  }
  
  // Add the new row
  sheet.appendRow(newRow);
  
  return createSuccessResponse('Record saved successfully', { docId: uniqueId });
}

// Get document by ID
function getDocumentById(docId, sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return createErrorResponse('Sheet not found');
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  // Find document by ID (assuming ID is in column A)
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === docId) {
      var documentData = {};
      
      // Map data to headers
      for (var j = 0; j < headers.length; j++) {
        documentData[headers[j]] = data[i][j];
      }
      
      // Parse items JSON if it exists
      if (documentData.items && typeof documentData.items === 'string') {
        try {
          documentData.items = JSON.parse(documentData.items);
        } catch (e) {
          documentData.items = [];
        }
      }
      
      return createSuccessResponse('Document retrieved', documentData);
    }
  }
  
  return createErrorResponse('Document not found', 404);
}

// List documents with filtering
function listDocuments(sheetName, status, startDate, endDate) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return createErrorResponse('Sheet not found');
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var documents = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var document = {};
    var include = true;
    
    // Map data to headers
    for (var j = 0; j < headers.length; j++) {
      document[headers[j]] = row[j];
    }
    
    // Apply filters
    if (status && document.status !== status) {
      include = false;
    }
    
    if (startDate && document.date < startDate) {
      include = false;
    }
    
    if (endDate && document.date > endDate) {
      include = false;
    }
    
    if (include) {
      // Parse items JSON if it exists
      if (document.items && typeof document.items === 'string') {
        try {
          document.items = JSON.parse(document.items);
        } catch (e) {
          document.items = [];
        }
      }
      documents.push(document);
    }
  }
  
  return createSuccessResponse('Documents retrieved', { documents: documents, total: documents.length });
}

// Update existing document
function updateDocument(data) {
  var sheetName = data.sheetName;
  var docId = data.docId;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    return createErrorResponse('Sheet not found');
  }
  
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var headers = values[0];
  
  // Find the document row
  var rowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === docId) {
      rowIndex = i;
      break;
    }
  }
  
  if (rowIndex === -1) {
    return createErrorResponse('Document not found', 404);
  }
  
  // Update fields
  var updateData = data.updateData || {};
  
  if (updateData.customerDetails) {
    var customerId = findOrCreateCustomer(
      updateData.customerDetails.name,
      updateData.customerDetails.mobile,
      updateData.customerDetails.add,
      updateData.customerDetails.trn
    );
    
    // Update customer ID and details
    values[rowIndex][1] = customerId; // Customer ID column
    values[rowIndex][2] = updateData.customerDetails.name; // Customer Name
    values[rowIndex][3] = updateData.customerDetails.mobile; // Customer Mobile
  }
  
  if (updateData.docDetails) {
    values[rowIndex][4] = updateData.docDetails.date; // Date
    values[rowIndex][5] = updateData.docDetails.ref; // Reference
  }
  
  if (updateData.items) {
    values[rowIndex][6] = JSON.stringify(updateData.items); // Items
  }
  
  if (updateData.totals) {
    values[rowIndex][7] = updateData.totals.subtotal; // Subtotal
    values[rowIndex][8] = updateData.totals.vat; // VAT
    values[rowIndex][9] = updateData.totals.total; // Total
  }
  
  if (updateData.notes !== undefined) {
    values[rowIndex][10] = updateData.notes; // Notes
  }
  
  // Update timestamps
  values[rowIndex][values[rowIndex].length - 2] = new Date().toISOString(); // Updated timestamp
  values[rowIndex][values[rowIndex].length - 1] = Session.getActiveUser().getEmail(); // Updated by
  
  // Write back to sheet
  dataRange.setValues(values);
  
  return createSuccessResponse('Document updated successfully', { docId: docId });
}

// Update document status
function updateDocumentStatus(data) {
  var sheetName = data.sheetName;
  var docId = data.docId;
  var newStatus = data.status;
  var notes = data.notes || '';
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return createErrorResponse('Sheet not found');
  }
  
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  
  // Find the document row (ID in column A, status in column K for invoices/quotations)
  var statusColumn = sheetName === SHEET_NAMES.DELIVERIES ? 9 : 10;
  var notesColumn = sheetName === SHEET_NAMES.DELIVERIES ? 10 : 11;
  
  var rowIndex = -1;
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === docId) {
      rowIndex = i;
      break;
    }
  }
  
  if (rowIndex === -1) {
    return createErrorResponse('Document not found', 404);
  }
  
  // Update status and notes
  values[rowIndex][statusColumn] = newStatus;
  
  // Append new notes to existing notes
  var currentNotes = values[rowIndex][notesColumn] || '';
  if (currentNotes && notes) {
    values[rowIndex][notesColumn] = currentNotes + '\n--- Status Update ---\n' + 
                                   new Date().toISOString() + ' - ' + 
                                   Session.getActiveUser().getEmail() + ':\n' + 
                                   'Status changed to: ' + newStatus + '\n' +
                                   'Notes: ' + notes;
  } else if (notes) {
    values[rowIndex][notesColumn] = '--- Status Update ---\n' + 
                                   new Date().toISOString() + ' - ' + 
                                   Session.getActiveUser().getEmail() + ':\n' + 
                                   'Status changed to: ' + newStatus + '\n' +
                                   'Notes: ' + notes;
  }
  
  // Update timestamps
  values[rowIndex][values[rowIndex].length - 2] = new Date().toISOString(); // Updated timestamp
  values[rowIndex][values[rowIndex].length - 1] = Session.getActiveUser().getEmail(); // Updated by
  
  // Write back to sheet
  dataRange.setValues(values);
  
  return createSuccessResponse('Status updated successfully', { 
    docId: docId, 
    status: newStatus,
    updatedBy: Session.getActiveUser().getEmail(),
    updatedAt: new Date().toISOString()
  });
}

// Export documents
function exportDocuments(sheetName, startDate, endDate, format) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return createErrorResponse('Sheet not found');
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  // Filter data by date range if provided
  var filteredData = [headers];
  var dateColumn = 4; // Assuming date is in column E (index 4)
  
  for (var i = 1; i < data.length; i++) {
    var include = true;
    var rowDate = data[i][dateColumn];
    
    if (startDate && rowDate < startDate) {
      include = false;
    }
    
    if (endDate && rowDate > endDate) {
      include = false;
    }
    
    if (include) {
      filteredData.push(data[i]);
    }
  }
  
  format = format || 'csv';
  
  if (format === 'csv') {
    var csvContent = '';
    for (var j = 0; j < filteredData.length; j++) {
      csvContent += filteredData[j].map(field => {
        // Escape fields that contain commas or quotes
        if (typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
          return '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
      }).join(',') + '\n';
    }
    
    return ContentService
      .createTextOutput(csvContent)
      .setMimeType(ContentService.MimeType.CSV)
      .setDownloadFileName(sheetName + '_Export_' + new Date().toISOString().split('T')[0] + '.csv');
  } else {
    // For other formats, return as JSON
    return createSuccessResponse('Export completed', {
      format: format,
      data: filteredData,
      total: filteredData.length - 1
    });
  }
}

// Get status counts for dashboard
function getStatusCounts(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return createErrorResponse('Sheet not found');
  }
  
  var data = sheet.getDataRange().getValues();
  var statusColumn = sheetName === SHEET_NAMES.DELIVERIES ? 9 : 10;
  
  var counts = {
    'Draft': 0,
    'Issued': 0,
    'Paid': 0,
    'Delivered': 0,
    'Cancelled': 0,
    'Total': data.length - 1
  };
  
  for (var i = 1; i < data.length; i++) {
    var status = data[i][statusColumn] || 'Draft';
    if (counts[status] !== undefined) {
      counts[status]++;
    } else {
      counts[status] = 1;
    }
  }
  
  return createSuccessResponse('Status counts retrieved', counts);
}

// Helper function to find or create customer (unchanged from original)
function findOrCreateCustomer(name, mobile, address, trn) {
  var customerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
  var data = customerSheet.getDataRange().getValues();

  // Look for existing customer
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] == name && data[i][2] == mobile) {
      return data[i][0]; // Return existing CustomerID
    }
  }

  // Create new customer
  var newCustomerId = "CUST-" + new Date().getTime();
  customerSheet.appendRow([newCustomerId, name, mobile, trn, address, '', new Date().toISOString()]);
  return newCustomerId;
}

// Utility functions
function createSuccessResponse(message, data) {
  var response = {
    status: 'success',
    message: message
  };
  
  if (data) {
    response.data = data;
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message, statusCode) {
  var response = {
    status: 'error',
    message: message
  };
  
  var output = ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
  
  if (statusCode) {
    output.setStatusCode(statusCode);
  }
  
  return output;
}

// Test function for development
function testBackend() {
  Logger.log('Backend functions loaded successfully');
  Logger.log('Available functions:');
  Logger.log('- doPost: Create/update documents');
  Logger.log('- doGet: Retrieve/export documents');
  Logger.log('- isAuthenticated: Google Workspace auth');
  Logger.log('- Various CRUD operations');
}
