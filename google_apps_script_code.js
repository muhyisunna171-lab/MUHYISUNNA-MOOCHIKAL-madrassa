/**
 * =========================================================================
 * MUHYISSUNNA SECONDARY MADRASA - MOOCHIKKAL (SKIMVB Reg: 171/1957)
 * GOOGLE DRIVE CLOUD DATABASE & LIVE STORAGE BACKEND
 * =========================================================================
 * 
 * Google Drive Target Folder: "MADRASA WEB SITE"
 * Folder ID: 1NLxIHWHHQKt5VobieD24FEa1sl6zu9sX
 * Folder URL: https://drive.google.com/drive/folders/1NLxIHWHHQKt5VobieD24FEa1sl6zu9sX
 * 
 * ഈ കോഡ് Google Apps Script-ൽ (script.google.com) പേസ്റ്റ് ചെയ്ത് 
 * Web App ആയി ഡിപ്ലോയ് ചെയ്താൽ നിങ്ങളുടെ 'MADRASA WEB SITE' ഗൂഗിൾ ഡ്രൈവ് ഫോൾഡർ 
 * വെബ്സൈറ്റിൻ്റെ ശാശ്വതമായ ക്ലൗഡ് ഡാറ്റാബേസ് ആയി പ്രവർത്തിക്കും.
 */

// Your exact Google Drive Folder ID
const TARGET_FOLDER_ID = "1NLxIHWHHQKt5VobieD24FEa1sl6zu9sX";
const DB_FILE_NAME = "madrasa_site_data.json";

// ---------------- Helper: Get Target Folder ----------------
function getTargetFolder() {
  try {
    const folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return folder;
  } catch (e) {
    // Fallback search by name if ID changes
    const folders = DriveApp.getFoldersByName("MADRASA WEB SITE");
    if (folders.hasNext()) {
      const f = folders.next();
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return f;
    }
    return DriveApp.getRootFolder();
  }
}

// ---------------- Helper: Get or Create Database File in Target Folder ----------------
function getDatabaseFile() {
  const folder = getTargetFolder();
  const files = folder.getFilesByName(DB_FILE_NAME);
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

// ---------------- Helper: Write Database ----------------
function writeDatabase(data) {
  const file = getDatabaseFile();
  data.updatedAt = new Date().toISOString();
  file.setContent(JSON.stringify(data, null, 2));
}

// ---------------- Helper: Convert Base64 to Permanent Drive Image File ----------------
function saveBase64ImageToDrive(base64Data, filename) {
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return base64Data; // Already a URL or empty
  }
  try {
    const folder = getTargetFolder();
    const mimeMatch = base64Data.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const cleanBase64 = base64Data.split(',')[1] || base64Data;
    const decoded = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decoded, mimeType, filename);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Direct Google CDN photo link (loads universally without login)
    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (err) {
    Logger.log("Image save error: " + err);
    return base64Data; // Fallback to base64
  }
}

// =========================================================================
// GET Request Handler: Fetches latest site data for any visitor
// =========================================================================
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getData';
    const callback = e && e.parameter && e.parameter.callback;
    
    let result = {};
    if (action === 'getData' || action === 'getSiteData') {
      result = {
        status: 'success',
        folderId: TARGET_FOLDER_ID,
        data: readDatabase()
      };
    } else {
      result = {
        status: 'success',
        message: 'Muhyissunna Madrasa Cloud API is online',
        targetFolder: 'MADRASA WEB SITE (1NLxIHWHHQKt5VobieD24FEa1sl6zu9sX)',
        time: new Date().toISOString()
      };
    }

    const output = JSON.stringify(result);
    if (callback) {
      // JSONP support as universal fallback
      return ContentService.createTextOutput(callback + '(' + output + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService.createTextOutput(output)
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    const errOut = JSON.stringify({ status: 'error', message: error.toString() });
    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + '(' + errOut + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(errOut).setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// POST Request Handler: Handles updates from Admin & Contact Form uploads
// =========================================================================
function doPost(e) {
  try {
    let rawData = "";
    if (e && e.postData && e.postData.contents) {
      rawData = e.postData.contents;
    } else if (e && e.parameter && e.parameter.data) {
      rawData = e.parameter.data;
    }

    if (!rawData) {
      throw new Error("No data received in POST request");
    }

    const payload = JSON.parse(rawData);
    const action = payload.action;

    // 1. Full Synchronization (Push All)
    if (action === 'syncAll' || action === 'saveAll') {
      const db = readDatabase();
      if (payload.data) {
        // Process Logo
        if (payload.data.logo !== undefined) {
          db.logo = saveBase64ImageToDrive(payload.data.logo, "madrasa_logo.jpg");
        }
        // Process Gallery
        if (payload.data.customGallery !== undefined) {
          db.customGallery = payload.data.customGallery.map((item, idx) => {
            if (item.image && item.image.startsWith('data:image')) {
              item.image = saveBase64ImageToDrive(item.image, "gallery_" + (item.id || idx) + ".jpg");
            }
            return item;
          });
        }
        if (payload.data.deletedDefaultPhotos !== undefined) {
          db.deletedDefaultPhotos = payload.data.deletedDefaultPhotos;
        }
        // Process Management Members
        if (payload.data.management !== undefined) {
          db.management = payload.data.management.map((m, idx) => {
            if (m.photo && m.photo.startsWith('data:image')) {
              m.photo = saveBase64ImageToDrive(m.photo, "mgmt_" + (idx + 1) + "_" + (m.role || 'member').replace(/\s+/g, '_') + ".jpg");
            }
            return m;
          });
        }
        // Process Faculty Teachers
        if (payload.data.faculty !== undefined) {
          db.faculty = payload.data.faculty.map((f, idx) => {
            if (f.photo && f.photo.startsWith('data:image')) {
              f.photo = saveBase64ImageToDrive(f.photo, "faculty_" + (idx + 1) + "_" + (idx === 0 ? 'headmaster' : 'teacher') + ".jpg");
            }
            return f;
          });
        }
        writeDatabase(db);
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'All site data and photos saved to Google Drive folder: MADRASA WEB SITE',
        data: db
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Save Management Committee
    if (action === 'saveManagement') {
      const db = readDatabase();
      if (Array.isArray(payload.management)) {
        db.management = payload.management.map((m, idx) => {
          if (m.photo && m.photo.startsWith('data:image')) {
            m.photo = saveBase64ImageToDrive(m.photo, "mgmt_" + (idx + 1) + "_" + (m.role || 'member').replace(/\s+/g, '_') + ".jpg");
          }
          return m;
        });
      } else {
        db.management = payload.management;
      }
      writeDatabase(db);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Management saved to Google Drive',
        management: db.management
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Save Faculty (6 Muallims)
    if (action === 'saveFaculty') {
      const db = readDatabase();
      if (Array.isArray(payload.faculty)) {
        db.faculty = payload.faculty.map((f, idx) => {
          if (f.photo && f.photo.startsWith('data:image')) {
            f.photo = saveBase64ImageToDrive(f.photo, "faculty_" + (idx + 1) + "_" + (idx === 0 ? 'headmaster' : 'teacher') + ".jpg");
          }
          return f;
        });
      } else {
        db.faculty = payload.faculty;
      }
      writeDatabase(db);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Faculty saved to Google Drive',
        faculty: db.faculty
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Save Logo
    if (action === 'saveLogo') {
      const db = readDatabase();
      db.logo = saveBase64ImageToDrive(payload.logo, "madrasa_logo.jpg");
      writeDatabase(db);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Logo saved to Google Drive',
        logo: db.logo
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Save Gallery
    if (action === 'saveGallery') {
      const db = readDatabase();
      if (payload.customGallery !== undefined) {
        db.customGallery = payload.customGallery.map((item, idx) => {
          if (item.image && item.image.startsWith('data:image')) {
            item.image = saveBase64ImageToDrive(item.image, "gallery_" + (item.id || idx) + ".jpg");
          }
          return item;
        });
      }
      if (payload.deletedDefaultPhotos !== undefined) {
        db.deletedDefaultPhotos = payload.deletedDefaultPhotos;
      }
      writeDatabase(db);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Gallery saved to Google Drive'
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

    // 7. Contact Form Attachment Upload
    if (payload.file && payload.filename) {
      const folder = getTargetFolder();
      const contentType = payload.mimeType || 'application/octet-stream';
      const base64Data = payload.file.split(',')[1] || payload.file;
      const decodedBytes = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedBytes, contentType, payload.filename);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        fileUrl: file.getUrl(),
        downloadUrl: "https://lh3.googleusercontent.com/d/" + file.getId(),
        message: 'File saved directly into MADRASA WEB SITE folder in Google Drive'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Unknown action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
