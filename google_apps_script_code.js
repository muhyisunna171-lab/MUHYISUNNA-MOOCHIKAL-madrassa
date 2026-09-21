/**
 * =========================================================================
 * MUHYISSUNNA SECONDARY MADRASAA - MOOCHIKKAL (SKIMVB Reg: 171/1957)
 * Google Apps Script Cloud Database & Storage Backend
 * =========================================================================
 * 
 * ഈ കോഡ് Google Apps Script-ൽ (script.google.com) പേസ്റ്റ് ചെയ്ത് 
 * Web App ആയി ഡിപ്ലോയ് ചെയ്താൽ ഗൂഗിൾ ഡ്രൈവ് വെബ്സൈറ്റിൻ്റെ ക്ലൗഡ് ഡാറ്റാബേസ് ആയി പ്രവർത്തിക്കും.
 * 
 * Features:
 * 1. Stores Management, Faculty, Gallery, and Logo in 'madrasa_site_data.json' in Google Drive.
 * 2. Uploads photos directly to 'Muhyissunna_Madrasa_Uploads' folder in Google Drive.
 * 3. Handles Contact Form inquiries & document uploads.
 * 4. Responds to both GET (for reading) and POST (for writing/uploading) requests.
 */

const DB_FILE_NAME = "madrasa_site_data.json";
const UPLOAD_FOLDER_NAME = "Muhyissunna_Madrasa_Uploads";

// ---------------- Helper: Get or Create Google Drive Folder ----------------
function getOrCreateFolder() {
  const folders = DriveApp.getFoldersByName(UPLOAD_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    const folder = DriveApp.createFolder(UPLOAD_FOLDER_NAME);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return folder;
  }
}

// ---------------- Helper: Get or Create Database JSON File in Drive ----------------
function getDatabaseFile() {
  const files = DriveApp.getFilesByName(DB_FILE_NAME);
  if (files.hasNext()) {
    return files.next();
  } else {
    const initialData = {
      updatedAt: new Date().toISOString(),
      logo: null,
      customGallery: [],
      deletedDefaultPhotos: [],
      management: null,
      faculty: null
    };
    const folder = getOrCreateFolder();
    const file = folder.createFile(DB_FILE_NAME, JSON.stringify(initialData, null, 2), MimeType.PLAIN_TEXT);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file;
  }
}

// ---------------- Helper: Read Database ----------------
function readDatabase() {
  try {
    const file = getDatabaseFile();
    const content = file.getBlob().getDataAsString();
    return JSON.parse(content);
  } catch (e) {
    return {
      updatedAt: new Date().toISOString(),
      logo: null,
      customGallery: [],
      deletedDefaultPhotos: [],
      management: null,
      faculty: null
    };
  }
}

// ---------------- Helper: Save Database ----------------
function writeDatabase(data) {
  const file = getDatabaseFile();
  data.updatedAt = new Date().toISOString();
  file.setContent(JSON.stringify(data, null, 2));
}

// =========================================================================
// GET Request Handler: Fetches latest site data for any visitor
// =========================================================================
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getData';
    
    if (action === 'getData' || action === 'getSiteData') {
      const data = readDatabase();
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        data: data
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Muhyissunna Madrasa API is online',
      time: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// POST Request Handler: Handles updates from Admin & Contact Form uploads
// =========================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No data received");
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // 1. Save All Data / Full Sync
    if (action === 'syncAll' || action === 'saveAll') {
      const db = readDatabase();
      if (payload.data) {
        if (payload.data.logo !== undefined) db.logo = payload.data.logo;
        if (payload.data.customGallery !== undefined) db.customGallery = payload.data.customGallery;
        if (payload.data.deletedDefaultPhotos !== undefined) db.deletedDefaultPhotos = payload.data.deletedDefaultPhotos;
        if (payload.data.management !== undefined) db.management = payload.data.management;
        if (payload.data.faculty !== undefined) db.faculty = payload.data.faculty;
        writeDatabase(db);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'All site data synchronized with Google Drive cloud database'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Save Management Committee
    if (action === 'saveManagement') {
      const db = readDatabase();
      db.management = payload.management;
      writeDatabase(db);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Management Committee saved to Google Drive'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Save Faculty (Teachers)
    if (action === 'saveFaculty') {
      const db = readDatabase();
      db.faculty = payload.faculty;
      writeDatabase(db);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Faculty members saved to Google Drive'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Save Custom Logo
    if (action === 'saveLogo') {
      const db = readDatabase();
      db.logo = payload.logo;
      writeDatabase(db);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Logo saved to Google Drive'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Save Gallery Photos (Add or Update)
    if (action === 'saveGallery') {
      const db = readDatabase();
      if (payload.customGallery !== undefined) db.customGallery = payload.customGallery;
      if (payload.deletedDefaultPhotos !== undefined) db.deletedDefaultPhotos = payload.deletedDefaultPhotos;
      writeDatabase(db);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Gallery state saved to Google Drive'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 6. Reset Category
    if (action === 'resetCategory') {
      const db = readDatabase();
      const cat = payload.category;
      if (cat === 'management') db.management = null;
      if (cat === 'faculty') db.faculty = null;
      if (cat === 'logo') db.logo = null;
      if (cat === 'gallery') {
        db.customGallery = [];
        db.deletedDefaultPhotos = [];
      }
      writeDatabase(db);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: cat + ' reset to defaults in Google Drive'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 7. Contact Form Attachment Upload (Original Functionality)
    if (payload.file && payload.filename) {
      const folder = getOrCreateFolder();
      const contentType = payload.mimeType || 'application/octet-stream';
      const base64Data = payload.file.split(',')[1] || payload.file;
      const decodedBytes = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedBytes, contentType, payload.filename);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        fileUrl: file.getUrl(),
        downloadUrl: file.getDownloadUrl(),
        message: 'File uploaded to Google Drive successfully'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action specified'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
