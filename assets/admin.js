// assets/admin.js - V6.0 Module Support (FAQ/Manual)
let currentMode = 'local';
let currentData = null;
let currentVarName = "FAQ_DATA_ZH";
let currentLang = "zh";

let activeNode = null;
let activeParent = null; 
let currentSubNode = null; 
let localHandle = null;

// ✨✨✨ 預設設定 (相容舊版) ✨✨✨
let config = {
    name: 'faq',
    dataPath: 'assets/data/', // 舊版路徑，新版應為 assets/faq/data/
    imgPath: 'assets/images/'
};

// 如果 HTML 有定義 ModuleConfig，就覆蓋設定
if (window.ModuleConfig) {
    config = window.ModuleConfig;
    console.log(`[Admin] Loaded Module: ${config.name}`);
}

// ... (以下程式碼需將寫死的路徑替換為 config.dataPath 和 config.imgPath) ...

// 例如 loadLocalFile:
async function loadLocalFile(lang) {
    if(!localHandle) return alert("請先連接資料夾");
    try {
        currentLang = lang;
        // 使用 config.name 作為路徑一部分
        const fileHandle = await localHandle.getDirectoryHandle('assets')
                                          .then(d => d.getDirectoryHandle(config.name)) // ✨ faq or manual
                                          .then(d => d.getDirectoryHandle('data'))
                                          .then(d => d.getFileHandle(`data.${lang}.js`));
        // ...
    } catch(e) { /*...*/ }
}

// 例如圖片上傳:
// const path = `${config.imgPath}${filename}`;

// ... (請將 admin.js 中所有 'assets/data/' 替換為 config.dataPath) ...
// ... (請將 admin.js 中所有 'assets/images/' 替換為 config.imgPath) ...
