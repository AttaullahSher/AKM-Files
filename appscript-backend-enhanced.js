const DOMAIN = '@akm-music.com';

function jsonSuccess(obj) {
  return ContentService.createTextOutput(JSON.stringify({status: 'success', ...obj}))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(msg) {
  return ContentService.createTextOutput(JSON.stringify({status: 'error', message: msg}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Add CORS headers to response - enhanced for Google Apps Script
function addCorsHeaders(response) {
  return response
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    .setHeader('Access-Control-Allow-Credentials', 'true')
    .setHeader('Access-Control-Max-Age', '3600');
}

function doPost(e) {
  return ContentService.createTextOutput(JSON.stringify({status: "ok"}))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST")
    .setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function doGet(e) {
  // Handle OPTIONS request for CORS preflight
  if (e && e.parameter && e.parameter.requestMethod === 'OPTIONS') {
    return addCorsHeaders(ContentService.createTextOutput(''));
  }

  var userEmail = Session.getActiveUser().getEmail();
  if (userEmail === '' || !userEmail.endsWith(DOMAIN)) {
    return addCorsHeaders(jsonError('Unauthorized access'));
  }

  try {
    var params = e.parameter;
    var action = params.action;

    if (action === 'getCustomers') {
      var customerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
      var data = customerSheet.getDataRange().getValues();
      var customers = [];

      for (var i = 1; i < data.length; i++) {
        customers.push({
          customerId: data[i][0],
          name: data[i][1],
          mobile: data[i][2],
          trn: data[i][3],
          address: data[i][4],
          notes: data[i][5]
        });
      }

      return addCorsHeaders(jsonSuccess({
        message: 'Customers retrieved',
        customers: customers
      }));
    } else if (action === 'validateAuth') {
      return addCorsHeaders(jsonSuccess({
        message: 'Authentication valid',
        email: userEmail
      }));
    } else {
      return addCorsHeaders(jsonSuccess({message: 'GET request received, no action specified'}));
    }
  } catch (error) {
    return addCorsHeaders(jsonError(error.toString()));
  }
}

function findOrCreateCustomer(name, mobile, address, trn) {
  var customerSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
  var data = customerSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][1] == name && data[i][2] == mobile) {
      return data[i][0];
    }
  }

  var newCustomerId = "CUST-" + new Date().getTime();
  customerSheet.appendRow([newCustomerId, name, mobile, trn, address, '']);
  return newCustomerId;
}
