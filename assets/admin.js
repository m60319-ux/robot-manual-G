// assets/admin.js - V7.1 Smart Add Node & All-Level Content
let currentMode = 'local';
let currentData = null;
let currentVarName = "FAQ_DATA_ZH";
let currentLang = "zh";

let activeNode = null;
let activeParent = null; 
let currentSubNode = null; 
let localHandle = null;

let config = {
    name: 'faq',
    dataPath: 'assets/faq/data/',
    imgPath: 'assets/faq/images/'
};

if (window.ModuleConfig) {
    config = { ...config, ...window.ModuleConfig };
    console.log(`[Admin] Loaded Module Config: ${config.name}`);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("[Admin] DOM Loaded.");
    loadGhConfig();
    document.addEventListener('paste', handleGlobalPaste);
    injectDownloadButton();

    const panel = document.getElementById('editor-panel');
    if (panel) {
        panel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('row-input')) {
                e.preventDefault();
                addListRow(e.target.closest('.list-editor-container'));
            }
            else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.target.classList.contains('row-input')) {
                e.preventDefault(); 
                applyEdit(false);
            }
        });
    }
});

function injectDownloadButton() {
    const exportBtns = document.querySelectorAll('button[onclick*="exportToCSV"]');
    exportBtns.forEach(btn => {
        if (btn.parentNode.querySelector('.btn-auto-inject-dl')) return;
        const newBtn = document.createElement('button');
        newBtn.innerText = '📥 下載 CSV (本機)';
        newBtn.className = btn.className + ' btn-auto-inject-dl'; 
        newBtn.style.marginLeft = '10px';
        newBtn.style.backgroundColor = '#17a2b8';
        newBtn.style.color = '#fff';
        newBtn.onclick = downloadLocalCSV;
        btn.parentNode.insertBefore(newBtn, btn.nextSibling);
    });
}

function parseAndRender(text) {
    console.log("[Admin] Parsing...");
    try {
        const { varName, jsonText } = extractJsonPayload(text);
        if (varName) currentVarName = varName;
        currentData = JSON.parse(jsonText);
        activeNode = null;
        currentSubNode = null;
        renderTree();
        renderQuestionList();
        
        document.getElementById('editor-panel').style.display = 'none';
        const msg = document.getElementById('empty-editor-msg');
        if(msg) msg.style.display = 'block';

    } catch(e) {
        console.error(e);
        alert(`資料格式錯誤:\n${e.message}`);
    }
}

// -----------------------------------------------------------
// 核心：新增節點 (智慧判斷層級)
// -----------------------------------------------------------
function addNode(type) {
    if(!currentData) return alert("請先載入檔案");
    const ts = Date.now().toString().slice(-4);
    const emptyContent = { symptoms:[], rootCauses:[], solutionSteps:[], keywords:[], notes:"" };

    if (type === 'cat') {
        // 新增第一層 (主章節)
        const newCat = { 
            id:`CAT-${ts}`, 
            title:"New Chapter", 
            content: JSON.parse(JSON.stringify(emptyContent)), 
            subcategories:[] 
        };
        currentData.categories.push(newCat);
        renderTree();
        loadEditor(newCat, 'cat', currentData.categories, currentData.categories.length-1);
    }
    else if (type === 'sub') {
        // 新增第二層 (子章節)
        // 自動尋找父節點：
        // 1. 如果目前選中的是主章節，加到它下面
        // 2. 如果選中的是子章節或頁面，加到它們所屬的主章節下面
        let targetCat = null;
        if (activeNode && activeNode.subcategories) {
            targetCat = activeNode; 
        } else if (activeNode) {
            // 反查父主章節
            targetCat = currentData.categories.find(c => 
                c.subcategories && (c.subcategories.includes(activeNode) || 
                c.subcategories.some(s => s.questions && s.questions.includes(activeNode)))
            );
        }
        
        // 如果都沒選，預設加到最後一個主章節 (如果有的話)
        if (!targetCat && currentData.categories.length > 0) {
            targetCat = currentData.categories[currentData.categories.length - 1];
        }

        if (targetCat) {
            const newSub = { 
                id:`SUB-${ts}`, 
                title:"New Section", 
                content: JSON.parse(JSON.stringify(emptyContent)), 
                questions:[] 
            };
            targetCat.subcategories.push(newSub);
            renderTree();
            // 自動選中
            currentSubNode = newSub;
            loadEditor(newSub, 'sub', targetCat.subcategories, targetCat.subcategories.length-1);
            renderQuestionList(newSub);
        } else {
            alert("請先新增主章節 (Category)");
        }
    }
    else if (type === 'q') {
        // 新增第三層 (頁面)
        // 自動尋找父節點：
        let targetSub = currentSubNode;

        if (!targetSub && activeNode) {
            if (activeNode.questions) {
                // 如果正選中某個子章節
                targetSub = activeNode;
            } else if (activeNode.subcategories) {
                // 如果正選中某個主章節 -> 加到該主章節的最後一個子章節
                if (activeNode.subcategories.length === 0) {
                    // 如果沒有子章節，幫忙建一個
                    const newSub = { id:`SUB-${ts}-Auto`, title:"General", content:JSON.parse(JSON.stringify(emptyContent)), questions:[] };
                    activeNode.subcategories.push(newSub);
                }
                targetSub = activeNode.subcategories[activeNode.subcategories.length - 1];
            } else {
                // 如果正選中某個頁面 -> 加到同一個子章節
                targetSub = findParentSubByArray(activeParent.array);
            }
        }

        // 如果都沒選，預設加到最後一個主章節的最後一個子章節
        if (!targetSub && currentData.categories.length > 0) {
             const lastCat = currentData.categories[currentData.categories.length - 1];
             if (lastCat.subcategories.length > 0) {
                 targetSub = lastCat.subcategories[lastCat.subcategories.length - 1];
             }
        }

        if (targetSub) {
            const newQ = { 
                id:`PAGE-${ts}`, 
                title:"New Page", 
                content: JSON.parse(JSON.stringify(emptyContent)) 
            };
            if(!targetSub.questions) targetSub.questions = [];
            targetSub.questions.push(newQ);
            
            // 更新 UI
            currentSubNode = targetSub; 
            renderTree(); 
            renderQuestionList(targetSub);
            loadEditor(newQ, 'q', targetSub.questions, targetSub.questions.length - 1);
        } else {
            alert("無法新增頁面：請先建立子章節 (Subcategory)");
        }
    }
}

// -----------------------------------------------------------
// 渲染與編輯
// -----------------------------------------------------------

function loadEditor(item, type, arr, idx) {
    if (activeNode && document.getElementById('editor-panel').style.display !== 'none') {
        applyEdit(true, false); 
    }

    activeNode = item;
    activeParent = { array: arr, index: idx };

    const panel = document.getElementById('editor-panel');
    const msg = document.getElementById('empty-editor-msg');
    
    panel.style.display = 'block';
    if(msg) msg.style.display = 'none';
    
    document.getElementById('node-type').textContent = type.toUpperCase();
    document.getElementById('inp-id').value = item.id || '';
    document.getElementById('inp-title').value = item.title || '';
    
    // 移動分類選單 (僅針對第三層 q 顯示)
    const moveDiv = document.getElementById('div-move-group');
    const moveSelect = document.getElementById('inp-parent-sub');
    
    if (type === 'q') {
        moveDiv.style.display = 'block';
        const parentSub = findParentSubByArray(arr);
        let opts = '';
        currentData.categories.forEach(cat => {
            if(cat.subcategories && cat.subcategories.length > 0) {
                opts += `<optgroup label="${cat.title} (${cat.id})">`;
                cat.subcategories.forEach(sub => {
                    const selected = parentSub && sub === parentSub ? 'selected' : '';
                    opts += `<option value="${sub.id}" ${selected}>${sub.title} (${sub.id})</option>`;
                });
                opts += `</optgroup>`;
            }
        });
        moveSelect.innerHTML = opts;
    } else {
        moveDiv.style.display = 'none';
    }

    // 所有層級都顯示內容編輯區
    const qDiv = document.getElementById('q-fields');
    qDiv.style.display = 'block'; 
    
    const c = item.content || {}; 
    
    renderListEditor('container-symptoms', c.symptoms);
    renderListEditor('container-causes', c.rootCauses);
    renderListEditor('container-steps', c.solutionSteps);
    
    const join = (a) => Array.isArray(a) ? a.join('\n') : (a || "");
    document.getElementById('inp-keywords').value = join(c.keywords);
    document.getElementById('inp-notes').value = c.notes || "";
}

function applyEdit(silent = false, checkMove = true) {
    if(!activeNode) return;
    
    if(document.getElementById('inp-id')) activeNode.id = document.getElementById('inp-id').value;
    if(document.getElementById('inp-title')) activeNode.title = document.getElementById('inp-title').value;
    
    if(!activeNode.content) activeNode.content = {};
    
    activeNode.content.symptoms = collectListData('container-symptoms');
    activeNode.content.rootCauses = collectListData('container-causes');
    activeNode.content.solutionSteps = collectListData('container-steps');
    
    const split = (id) => {
        const el = document.getElementById(id);
        if (!el) return [];
        let val = el.value;
        if (id === 'inp-keywords') val = val.replace(/[\u3000\+,\/\\、]/g, '\n');
        return val.split('\n').map(x => x.trim()).filter(x => x !== "");
    };
    activeNode.content.keywords = split('inp-keywords');
    
    const notesEl = document.getElementById('inp-notes');
    activeNode.content.notes = notesEl ? notesEl.value : "";

    // 移動檢查
    if (checkMove && document.getElementById('div-move-group').style.display !== 'none') {
        const newParentId = document.getElementById('inp-parent-sub').value;
        const currentSub = findParentSubByArray(activeParent.array);
        if (currentSub && newParentId && currentSub.id !== newParentId) {
            moveQuestionToSub(activeNode, currentSub, newParentId);
            return;
        }
    }

    renderTree(); 
    if (currentSubNode) renderQuestionList(currentSubNode); 
    
    if (!silent) alert("修改已暫存");
}

function renderTree() {
    const root = document.getElementById('tree-root');
    if(!root) return;
    root.innerHTML = '';
    
    if(!currentData.categories) currentData.categories = [];

    currentData.categories.forEach((cat, i) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'tree-item';
        if(activeNode === cat) catDiv.classList.add('active');
        catDiv.textContent = `📁 [${cat.id}] ${cat.title}`;
        
        catDiv.onclick = (e) => {
            loadEditor(cat, 'cat', currentData.categories, i);
            currentSubNode = null; 
            renderQuestionList(); 
            renderTree(); 
        };
        root.appendChild(catDiv);

        if(cat.subcategories) {
            cat.subcategories.forEach((sub, j) => {
                const subDiv = document.createElement('div');
                subDiv.className = 'tree-item sub-node';
                if(activeNode === sub || currentSubNode === sub) {
                    subDiv.classList.add('active');
                }
                subDiv.textContent = `📂 [${sub.id}] ${sub.title}`;
                
                subDiv.onclick = (e) => {
                    e.stopPropagation();
                    currentSubNode = sub;
                    loadEditor(sub, 'sub', cat.subcategories, j);
                    renderQuestionList(sub); 
                    renderTree(); 
                };
                root.appendChild(subDiv);
            });
        }
    });
}

function renderQuestionList(subNode = null) {
    const listRoot = document.getElementById('list-root');
    listRoot.innerHTML = '';

    if (!subNode) {
        listRoot.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;">請點選左側<br>📂 子章節</div>';
        return;
    }

    if (!subNode.questions || subNode.questions.length === 0) {
        listRoot.innerHTML = '<div style="padding:20px; text-align:center;">(無頁面)</div>';
        return;
    }

    subNode.questions.forEach((q, k) => {
        const qItem = document.createElement('div');
        qItem.className = 'q-item';
        if(activeNode === q) qItem.classList.add('active');
        
        qItem.innerHTML = `
            <span class="q-title">${q.title || '(未命名)'}</span>
            <span class="q-id">${q.id}</span>
        `;
        
        qItem.onclick = () => {
            loadEditor(q, 'q', subNode.questions, k);
            renderQuestionList(subNode); 
        };
        listRoot.appendChild(qItem);
    });
}

// ... 保持其他輔助函式不變 (copy from previous version) ...
function deleteNode() { if(!activeNode || !activeParent) return alert("請先選擇項目"); if(confirm("確定刪除此項目？")) { activeParent.array.splice(activeParent.index, 1); if (activeNode === currentSubNode) { currentSubNode = null; renderQuestionList(); } activeNode = null; document.getElementById('editor-panel').style.display = 'none'; renderTree(); if (currentSubNode) renderQuestionList(currentSubNode); const msg = document.getElementById('empty-editor-msg'); if(msg) msg.style.display = 'block'; } }
function findParentSubByArray(arr) { if (!currentData) return null; for (const cat of currentData.categories) { if (cat.subcategories) { for (const sub of cat.subcategories) { if (sub.questions === arr) return sub; } } } return null; }
function moveQuestionToSub(questionNode, oldSub, newSubId) { let targetSub = null; for (const cat of currentData.categories) { if (cat.subcategories) { const found = cat.subcategories.find(s => s.id === newSubId); if (found) { targetSub = found; break; } } } if (!targetSub) { alert("錯誤：找不到目標子分類！"); return; } if (confirm(`確定將問題 [${questionNode.id}] 移動到 [${targetSub.title}] 嗎？`)) { const idx = oldSub.questions.indexOf(questionNode); if (idx > -1) oldSub.questions.splice(idx, 1); if (!targetSub.questions) targetSub.questions = []; targetSub.questions.push(questionNode); activeParent.array = targetSub.questions; activeParent.index = targetSub.questions.length - 1; currentSubNode = targetSub; renderTree(); renderQuestionList(targetSub); alert(`已移動至 ${targetSub.title}`); } }
function renderListEditor(containerId, dataArray) { const container = document.getElementById(containerId); if (!container) return; container.innerHTML = ''; if (!dataArray) dataArray = []; dataArray.forEach(item => { const row = createListRow(item); container.appendChild(row); }); const addBtn = document.createElement('div'); addBtn.className = 'btn-add-row'; addBtn.innerText = '+ 新增一行'; addBtn.onclick = () => addListRow(container, addBtn); container.appendChild(addBtn); }
function createListRow(content) { const row = document.createElement('div'); row.className = 'list-row'; const hasImg = content.includes('{{img:'); const contentDiv = document.createElement('div'); contentDiv.className = 'row-content'; contentDiv.style.flexWrap = 'wrap'; contentDiv.style.gap = '5px'; const hiddenInput = document.createElement('input'); hiddenInput.type = 'hidden'; hiddenInput.className = 'row-value'; hiddenInput.value = content; if (hasImg) { const regex = /{{img:(.*?)}}/g; let match; const editInput = document.createElement('input'); editInput.type = 'text'; editInput.className = 'row-input'; editInput.value = content; editInput.style.marginBottom = '5px'; editInput.style.fontSize = '12px'; editInput.style.color = '#666'; editInput.style.width = '100%'; editInput.placeholder = '圖片原始碼...'; editInput.oninput = (e) => { hiddenInput.value = e.target.value; }; editInput.classList.add('row-value'); contentDiv.appendChild(editInput); const previewDiv = document.createElement('div'); previewDiv.style.display = 'flex'; previewDiv.style.gap = '5px'; previewDiv.style.flexWrap = 'wrap'; while ((match = regex.exec(content)) !== null) { const src = match[1]; const imgContainer = document.createElement('div'); imgContainer.style.position = 'relative'; const img = document.createElement('img'); img.src = src; img.className = 'row-img-preview'; img.title = src; img.style.cursor = 'pointer'; img.onclick = () => window.open(src, '_blank'); imgContainer.appendChild(img); previewDiv.appendChild(imgContainer); } contentDiv.appendChild(previewDiv); } else { const input = document.createElement('input'); input.type = 'text'; input.className = 'row-input row-value'; input.value = content; input.placeholder = '輸入文字或貼上圖片...'; contentDiv.appendChild(input); } const btnGroup = document.createElement('div'); btnGroup.style.display = 'flex'; btnGroup.style.gap = '2px'; const galleryBtn = document.createElement('button'); galleryBtn.className = 'btn-gray'; galleryBtn.innerHTML = '🖼️'; galleryBtn.title = '從圖庫選擇'; galleryBtn.style.padding = '2px 6px'; galleryBtn.onclick = () => openImageGallery(row); const delBtn = document.createElement('button'); delBtn.className = 'btn-del-row'; delBtn.innerHTML = '&times;'; delBtn.title = '刪除此行'; delBtn.onclick = () => row.remove(); btnGroup.appendChild(galleryBtn); btnGroup.appendChild(delBtn); row.appendChild(contentDiv); row.appendChild(btnGroup); return row; }
function addListRow(container, btnElement) { const newRow = createListRow(''); if (!btnElement) btnElement = container.querySelector('.btn-add-row'); container.insertBefore(newRow, btnElement); const input = newRow.querySelector('input[type="text"]'); if (input) input.focus(); }
function collectListData(containerId) { const container = document.getElementById(containerId); if (!container) return []; const values = []; container.querySelectorAll('.row-value').forEach(el => { if (el.value.trim() !== '') { values.push(el.value); } }); return values; }
async function openImageGallery(targetRow) { let modal = document.getElementById('gallery-modal'); if (!modal) { modal = document.createElement('div'); modal.id = 'gallery-modal'; modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; justify-content: center; align-items: center;`; modal.innerHTML = `<div style="background: white; padding: 20px; border-radius: 8px; width: 80%; max-height: 80%; overflow-y: auto; position: relative;"><h3 style="margin-top:0;">📂 選擇圖片 (${config.name})</h3><button onclick="document.getElementById('gallery-modal').style.display='none'" style="position: absolute; top: 10px; right: 10px; border:none; background:none; font-size:20px; cursor:pointer;">&times;</button><div id="gallery-content" style="display: flex; flex-wrap: wrap; gap: 10px;">Loading...</div></div>`; document.body.appendChild(modal); } modal.style.display = 'flex'; const contentDiv = document.getElementById('gallery-content'); contentDiv.innerHTML = '正在讀取圖片清單...'; let images = []; try { if (currentMode === 'local' && localHandle) { try { const imgDir = await localHandle.getDirectoryHandle('assets').then(d => d.getDirectoryHandle(config.name)).then(d => d.getDirectoryHandle('images')); for await (const entry of imgDir.values()) { if (entry.kind === 'file' && /\.(png|jpg|jpeg|gif|webp)$/i.test(entry.name)) { const file = await entry.getFile(); const blobUrl = URL.createObjectURL(file); images.push({ name: entry.name, url: `${config.imgPath}${entry.name}`, previewUrl: blobUrl }); } } } catch (err) { contentDiv.innerHTML = `<p style="color:red">無法讀取資料夾 (assets/${config.name}/images): ${err.message}</p>`; return; } } else if (currentMode === 'github') { const t = document.getElementById('gh_token').value.trim(); const u = document.getElementById('gh_user').value.trim(); const r = document.getElementById('gh_repo').value.trim(); if(!t) throw new Error("請先設定 GitHub Token"); const apiPath = config.imgPath.replace(/\/$/, ''); const apiUrl = `https://api.github.com/repos/${u}/${r}/contents/${apiPath}`; const res = await fetch(apiUrl, { headers: { 'Authorization': `token ${t}` } }); if(!res.ok) throw new Error(`GitHub API Error: ${res.status}`); const data = await res.json(); images = data.filter(f => f.type === 'file' && /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)).map(f => ({ name: f.name, url: f.path, previewUrl: f.download_url })); } else { contentDiv.innerHTML = `<p>⚠️ 請先連接本機資料夾或設定 GitHub，才能讀取圖庫。</p>`; return; } } catch (e) { contentDiv.innerHTML = `<p style="color:red">讀取失敗: ${e.message}</p>`; return; } contentDiv.innerHTML = ''; if(images.length === 0) { contentDiv.innerHTML = '<p>沒有找到圖片。</p>'; return; } images.forEach(img => { const item = document.createElement('div'); item.style.cssText = 'width: 120px; cursor: pointer; border: 1px solid #ddd; padding: 5px; border-radius: 4px; text-align: center;'; item.innerHTML = `<div style="height: 80px; display: flex; align-items: center; justify-content: center; overflow: hidden;"><img src="${img.previewUrl || img.url}" style="max-width: 100%; max-height: 100%;"></div><div style="font-size: 12px; margin-top: 5px; word-break: break-all;">${img.name}</div>`; item.onclick = () => { insertImageToRow(targetRow, img.url); document.getElementById('gallery-modal').style.display = 'none'; }; contentDiv.appendChild(item); }); }
function insertImageToRow(row, imgPath) { const imgTag = `{{img:${imgPath}}}`; const input = row.querySelector('.row-input'); if (input) { input.value = input.value.trim() === '' ? imgTag : input.value + ' ' + imgTag; const newRow = createListRow(input.value); row.parentNode.replaceChild(newRow, row); } }
async function handleGlobalPaste(e) { const target = e.target; const isRowInput = target.classList.contains('row-input'); const isTextArea = target.tagName === 'TEXTAREA' && target.classList.contains('paste-area'); if (!isRowInput && !isTextArea) return; const items = (e.clipboardData || e.originalEvent.clipboardData).items; let blob = null; for (let i=0; i<items.length; i++) { if (items[i].type.indexOf("image")===0) { blob = items[i].getAsFile(); break; } } if(!blob) return; e.preventDefault(); if(!confirm("偵測到圖片，確定上傳？")) return; const filename = `img_${Date.now()}.png`; const path = `${config.imgPath}${filename}`; const imgTag = `{{img:${path}}}`; try { if(currentMode==='local' && localHandle) { const dir = await localHandle.getDirectoryHandle('assets').then(d => d.getDirectoryHandle(config.name)).then(d => d.getDirectoryHandle('images')); const fh = await dir.getFileHandle(filename, {create:true}); const w = await fh.createWritable(); await w.write(blob); await w.close(); } else { const reader = new FileReader(); reader.readAsDataURL(blob); reader.onloadend = async () => { const base64 = reader.result.split(',')[1]; await uploadImageToGithub(filename, base64); }; } } catch(err) { alert("圖片存檔失敗: " + err.message); return; } if (isRowInput) { const currentRow = target.closest('.list-row'); const container = currentRow.parentElement; const imgRow = createListRow(imgTag); container.insertBefore(imgRow, currentRow.nextSibling); alert("圖片已插入！"); } else { insertText(target, imgTag); } }
function filterQuestionList(val) { const items = document.querySelectorAll('#list-root .q-item'); val = val.toLowerCase(); items.forEach(item => { const text = item.innerText.toLowerCase(); item.style.display = text.includes(val) ? 'block' : 'none'; }); }
function b64ToUtf8(b64) { try { const clean = (b64 || "").replace(/\s/g, ""); const bytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0)); return new TextDecoder("utf-8").decode(bytes); } catch (e) { return decodeURIComponent(escape(atob(b64))); } }
function extractJsonPayload(text) { const t = text.replace(/^\uFEFF/, "").trim(); if (t.startsWith("{") || t.startsWith("[")) return { varName: null, jsonText: t }; let m = t.match(/(?:window\.|const\s+|var\s+|let\s+)(\w+)\s*=\s*(\{[\s\S]*\})\s*;?\s*$/); if (m) return { varName: m[1], jsonText: m[2] }; const fb = t.indexOf('{'), lb = t.lastIndexOf('}'); if (fb !== -1 && lb !== -1) return { varName: "FAQ_DATA_UNKNOWN", jsonText: t.substring(fb, lb + 1) }; throw new Error("無法識別檔案格式"); }
function switchMode(mode) { currentMode = mode; document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active')); const idx = mode === 'local' ? 0 : 1; document.querySelectorAll('.tab-btn')[idx].classList.add('active'); document.getElementById(`panel-${mode}`).classList.add('active'); }
function loadGhConfig() { try { const conf = JSON.parse(localStorage.getItem('gh_config')); if(conf) { document.getElementById('gh_token').value = conf.token || ''; document.getElementById('gh_user').value = conf.user || ''; document.getElementById('gh_repo').value = conf.repo || ''; } } catch(e) {} }
function saveGhConfig() { const t = document.getElementById('gh_token').value.trim(), u = document.getElementById('gh_user').value.trim(), r = document.getElementById('gh_repo').value.trim(); localStorage.setItem('gh_config', JSON.stringify({token: t, user: u, repo: r})); alert("設定已儲存"); }
async function connectLocalFolder() { if (!('showDirectoryPicker' in window)) return alert("瀏覽器不支援"); try { localHandle = await window.showDirectoryPicker(); await localHandle.getDirectoryHandle('assets'); document.getElementById('local-status').innerText = "✅ 已連接"; document.getElementById('local-status').className = "status-tag status-ok"; document.getElementById('local-status').style.display = "inline-block"; } catch(e) { if(e.name!=='AbortError') alert("連接失敗: "+e.message); } }
async function loadLocalFile(lang) { if(!localHandle) return alert("請先連接資料夾"); try { currentLang = lang; const fh = await localHandle.getDirectoryHandle('assets').then(d => d.getDirectoryHandle(config.name)).then(d => d.getDirectoryHandle('data')).then(d => d.getFileHandle(`data.${lang}.js`)); const f = await fh.getFile(); const t = await f.text(); parseAndRender(t); alert(`已載入 ${config.name}/data.${lang}.js`); } catch(e) { alert("讀取失敗 (請確認資料夾結構)"); } }
async function loadGithubFile(lang) { const t = document.getElementById('gh_token').value.trim(), u = document.getElementById('gh_user').value.trim(), r = document.getElementById('gh_repo').value.trim(); if (!t) return alert("請設定 GitHub"); currentLang = lang; try { const url = `https://api.github.com/repos/${u}/${r}/contents/${config.dataPath}data.${lang}.js`; const res = await fetch(url, { headers: { 'Authorization': `token ${t}` } }); if(!res.ok) throw new Error(res.status); const data = await res.json(); parseAndRender(b64ToUtf8(data.content)); alert(`GitHub: 載入成功 (${lang})`); } catch(e) { alert("GitHub 讀取失敗: "+e.message); } }
async function saveData() { if(!currentData) return alert("無資料"); const content = `window.${currentVarName} = ${JSON.stringify(currentData, null, 4)};`; if(currentMode === 'local') { if(!localHandle) return alert("請連接資料夾"); const fh = await localHandle.getDirectoryHandle('assets').then(d => d.getDirectoryHandle(config.name)).then(d => d.getDirectoryHandle('data')).then(d => d.getFileHandle(`data.${currentLang}.js`, {create:true})); const w = await fh.createWritable(); await w.write(content); await w.close(); alert("✅ 本機儲存成功"); } else { const t = document.getElementById('gh_token').value, u = document.getElementById('gh_user').value, r = document.getElementById('gh_repo').value; const url = `https://api.github.com/repos/${u}/${r}/contents/${config.dataPath}data.${currentLang}.js`; const gr = await fetch(url, { headers: { 'Authorization': `token ${t}` } }); let sha = null; if(gr.ok) sha = (await gr.json()).sha; const res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `token ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Update via Admin', content: btoa(unescape(encodeURIComponent(content))), sha: sha }) }); if(res.ok) alert("🎉 GitHub 更新成功"); else alert("GitHub 更新失敗"); } }
async function uploadImageToGithub(filename, base64) { const t = document.getElementById('gh_token').value, u = document.getElementById('gh_user').value, r = document.getElementById('gh_repo').value; const url = `https://api.github.com/repos/${u}/${r}/contents/${config.imgPath}${filename}`; await fetch(url, { method: 'PUT', headers: { 'Authorization': `token ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Upload ${filename}`, content: base64 }) }); }
function insertText(el, text) { const s = el.selectionStart, e = el.selectionEnd; el.value = el.value.substring(0, s) + text + el.value.substring(e); }
function downloadLocalCSV() { const c = generateCSVContent(); if(!c) return alert("無資料"); const b = new Blob([c], { type: 'text/csv;charset=utf-8;' }); const u = URL.createObjectURL(b); const l = document.createElement("a"); l.href = u; l.download = `export_${currentLang}.csv`; document.body.appendChild(l); l.click(); document.body.removeChild(l); }
function exportToCSV() { if(currentMode === 'local') downloadLocalCSV(); else alert("GitHub 模式請使用「下載 CSV (本機)」按鈕"); }
function importFromCSV(i) { const f = i.files[0]; if(!f) return; Papa.parse(f, { header: true, skipEmptyLines: true, complete: function(r) { parseCsvRows(r.data); i.value = ""; } }); }
function generateCSVContent() { if (!currentData || !currentData.categories) return null; const rows = [["category_id", "category_title", "sub_id", "sub_title", "question_id", "question_title", "symptoms", "root_causes", "solution_steps", "keywords", "notes"]]; currentData.categories.forEach(cat => { cat.subcategories.forEach(sub => { sub.questions.forEach(q => { const c = q.content || {}; const join = (arr) => Array.isArray(arr) ? arr.join('|') : ""; rows.push([ cat.id, cat.title, sub.id, sub.title, q.id, q.title, join(c.symptoms), join(c.rootCauses), join(c.solutionSteps), join(c.keywords), c.notes || "" ]); }); }); }); return '\uFEFF' + Papa.unparse(rows); }
function parseCsvRows(rows) { const nCats = []; const cMap = {}; const sMap = {}; rows.forEach(r => { if (!r.category_id) return; let c = cMap[r.category_id]; if (!c) { c = { id: r.category_id, title: r.category_title, subcategories: [] }; cMap[r.category_id] = c; nCats.push(c); } const sKey = r.category_id + "_" + r.sub_id; let s = sMap[sKey]; if (!s) { s = { id: r.sub_id, title: r.sub_title, questions: [] }; sMap[sKey] = s; c.subcategories.push(s); } if(r.question_id) { const split = (str) => str ? str.split('|') : []; s.questions.push({ id: r.question_id, title: r.question_title, content: { symptoms: split(r.symptoms), rootCauses: split(r.root_causes), solutionSteps: split(r.solution_steps), keywords: split(r.keywords), notes: r.notes || "" } }); } }); currentData.categories = nCats; renderTree(); alert("CSV 匯入完成 (請記得儲存)"); }
async function loadCsvFromGithub() { alert("請先實作 GitHub CSV 下載邏輯 (參照 loadGithubFile)"); }
