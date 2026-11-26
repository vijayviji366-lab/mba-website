/* =========================================================
   SAVEETHA MBA — LIVE EDITOR
   =========================================================
   How it works:
   - Visit yoursite.com/index.html?edit=1 (or ?edit=1 on any page);
     common.js loads this file only when ?edit=1 is in the address
   - Enter the editor password (see ADMIN-GUIDE.md; only its SHA-256 hash is kept here)
   - A green toolbar appears at the top of the page
   - Click any orange-dashed text to edit, click any image to replace
   - Click "Save All" to keep your changes IN THIS BROWSER ONLY
   - Click "Exit" to leave edit mode
   - Saved edits are NOT published: visitors still see the page as it is in the
     HTML files. Use "Export" and copy the text into the HTML to make it public.
   ========================================================= */

(function(){
  'use strict';

  // ============ CONFIG ============
  // SHA-256 of the editor password. To change it, run in the browser console:
  //   crypto.subtle.digest('SHA-256', new TextEncoder().encode('NEW-PASSWORD'))
  //     .then(h => console.log([...new Uint8Array(h)].map(b => b.toString(16).padStart(2,'0')).join('')))
  const ADMIN_HASH = '9e994d5dcfd6549003c999de03481769732aa426ac03b1e7a8c37add611c0930';
  async function sha256hex(str){
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join('');
  }
  const STORAGE_KEY = 'saveetha_mba_edits_v1';
  const IMAGE_KEY = 'saveetha_mba_images_v1';

  // ============ STATE ============
  const params = new URLSearchParams(location.search);
  const isEditMode = params.get('edit') === '1';
  const pageKey = location.pathname.split('/').pop().replace('.html', '') || 'home';

  // ============ LOAD SAVED EDITS (always, even in view mode) ============
  function getEdits(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch(e){ return {}; }
  }
  function getImages(){
    try { return JSON.parse(localStorage.getItem(IMAGE_KEY) || '{}'); }
    catch(e){ return {}; }
  }
  function setEdits(edits){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  }
  function setImages(imgs){
    localStorage.setItem(IMAGE_KEY, JSON.stringify(imgs));
  }

  // Apply saved edits on page load
  function applyEdits(){
    const edits = getEdits()[pageKey] || {};
    const images = getImages()[pageKey] || {};

    // Text edits
    Object.entries(edits).forEach(([id, html]) => {
      const el = document.querySelector(`[data-edit-id="${id}"]`);
      if(el) el.innerHTML = html;
    });

    // Image edits
    Object.entries(images).forEach(([id, dataUrl]) => {
      const el = document.querySelector(`[data-edit-img="${id}"]`);
      if(!el) return;
      if(el.tagName === 'IMG'){
        el.src = dataUrl;
      } else {
        // Background image
        el.style.backgroundImage = `url("${dataUrl}")`;
      }
    });
  }

  // ============ EDIT MODE UI ============
  async function initEditMode(){
    // Password gate (checks a hash; the password itself is not in this file)
    if(sessionStorage.getItem('saveetha_auth') !== ADMIN_HASH){
      if(!(window.crypto && crypto.subtle)){
        alert('Edit mode needs a secure address (https:// or localhost).');
        location.href = location.pathname;
        return;
      }
      const pw = prompt('Enter editor password:');
      if(pw === null || await sha256hex(pw) !== ADMIN_HASH){
        alert('Incorrect password. Redirecting to view mode.');
        location.href = location.pathname;
        return;
      }
      sessionStorage.setItem('saveetha_auth', ADMIN_HASH);
    }

    // Build toolbar
    const toolbar = document.createElement('div');
    toolbar.id = 'edit-toolbar';
    toolbar.innerHTML = `
      <style>
        body{padding-top:56px !important}
        #edit-toolbar{
          position:fixed;top:0;left:0;right:0;z-index:9999;
          background:linear-gradient(90deg,#16a34a,#22c55e);color:#fff;
          display:flex;align-items:center;gap:12px;padding:10px 20px;
          font-family:'Inter',sans-serif;font-size:.9rem;
          box-shadow:0 4px 16px rgba(0,0,0,.2);
        }
        #edit-toolbar .et-title{font-weight:700;margin-right:auto;display:flex;align-items:center;gap:8px}
        #edit-toolbar .et-title::before{content:"●";color:#fff;animation:etpulse 1.5s ease-in-out infinite}
        @keyframes etpulse{0%,100%{opacity:1}50%{opacity:.4}}
        #edit-toolbar button{
          padding:8px 16px;border-radius:8px;border:0;cursor:pointer;font-weight:600;
          background:rgba(255,255,255,.2);color:#fff;font-size:.85rem;transition:.2s;
        }
        #edit-toolbar button:hover{background:rgba(255,255,255,.35)}
        #edit-toolbar button.primary{background:#fff;color:#16a34a}
        #edit-toolbar button.primary:hover{background:#f0fdf4}
        #edit-toolbar button.danger{background:rgba(220,38,38,.85)}
        #edit-toolbar .et-status{font-size:.8rem;opacity:.9}
        [data-edit-id]{
          outline:1.5px dashed rgba(242,101,34,.55);
          outline-offset:3px;cursor:text;transition:outline-color .2s,background .2s;
        }
        [data-edit-id]:hover{outline-color:#F26522;background:rgba(242,101,34,.05)}
        [data-edit-id]:focus{outline:2px solid #F26522;background:rgba(242,101,34,.08)}
        [data-edit-img]{
          position:relative;cursor:pointer;outline:2px dashed rgba(46,49,146,.5);outline-offset:3px;
        }
        [data-edit-img]:hover{outline-color:#2E3192}
        [data-edit-img]::after{
          content:"📷 Click to replace";position:absolute;top:10px;left:10px;z-index:2;
          background:rgba(46,49,146,.92);color:#fff;padding:6px 12px;border-radius:8px;
          font-size:.75rem;font-weight:600;pointer-events:none;opacity:0;transition:.2s;
        }
        [data-edit-img]:hover::after{opacity:1}
        .edit-help{
          position:fixed;bottom:20px;left:20px;z-index:9998;
          background:#0B1437;color:#fff;padding:14px 18px;border-radius:12px;
          font-family:'Inter';font-size:.8rem;max-width:280px;box-shadow:0 8px 24px rgba(0,0,0,.3);
          line-height:1.5;
        }
        .edit-help b{color:#F7873E}
        .edit-help .close{
          position:absolute;top:6px;right:8px;cursor:pointer;background:none;border:0;color:#fff;
          font-size:1.1rem;opacity:.7;
        }
      </style>
      <div class="et-title">✏️ Edit Mode Active</div>
      <span class="et-status" id="etStatus">Click any orange-dashed text to edit</span>
      <button class="primary" id="etSave">💾 Save All</button>
      <button id="etExport">📥 Export</button>
      <button id="etImport">📤 Import</button>
      <button id="etReset">↺ Reset</button>
      <button class="danger" id="etExit">✕ Exit</button>
    `;
    document.body.insertBefore(toolbar, document.body.firstChild);

    // Help tip
    const help = document.createElement('div');
    help.className = 'edit-help';
    help.innerHTML = `
      <button class="close" onclick="this.parentElement.remove()">×</button>
      <b>How to edit:</b><br>
      • Click any <b>orange-dashed text</b> to type<br>
      • Click any <b>blue-dashed image</b> to upload new<br>
      • Hit <b>Save All</b> when done (saved in this browser only)<br>
      • Add <b>?edit=1</b> to any page URL to edit it
    `;
    document.body.appendChild(help);

    // Make all edit-id elements contenteditable
    document.querySelectorAll('[data-edit-id]').forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
    });

    // Make all edit-img elements clickable
    document.querySelectorAll('[data-edit-img]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files[0];
          if(!file) return;
          if(file.size > 2 * 1024 * 1024){
            alert('Image is larger than 2MB. Please compress it first (try tinypng.com).');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const id = el.getAttribute('data-edit-img');
            if(el.tagName === 'IMG'){
              el.src = reader.result;
            } else {
              el.style.backgroundImage = `url("${reader.result}")`;
            }
            // Mark as pending save
            el.dataset.pending = '1';
            updateStatus('Image changed — click Save All to persist');
          };
          reader.readAsDataURL(file);
        };
        input.click();
      });
    });

    // Save handler
    document.getElementById('etSave').addEventListener('click', () => {
      const edits = getEdits();
      const images = getImages();
      edits[pageKey] = edits[pageKey] || {};
      images[pageKey] = images[pageKey] || {};

      document.querySelectorAll('[data-edit-id]').forEach(el => {
        edits[pageKey][el.getAttribute('data-edit-id')] = el.innerHTML;
      });

      document.querySelectorAll('[data-edit-img]').forEach(el => {
        const id = el.getAttribute('data-edit-img');
        if(el.tagName === 'IMG' && el.src.startsWith('data:')){
          images[pageKey][id] = el.src;
        } else if(el.dataset.pending){
          // Extract background image
          const bg = el.style.backgroundImage;
          const match = bg.match(/url\("?(data:[^"]+)"?\)/);
          if(match) images[pageKey][id] = match[1];
        }
      });

      setEdits(edits);
      setImages(images);
      updateStatus('✓ Saved at ' + new Date().toLocaleTimeString());
    });

    // Export handler
    document.getElementById('etExport').addEventListener('click', () => {
      const data = {
        edits: getEdits(),
        images: getImages(),
        exportedAt: new Date().toISOString(),
        version: 1
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saveetha-mba-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import handler
    document.getElementById('etImport').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = () => {
        const file = input.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result);
            if(!data.edits || !data.images) throw new Error('Invalid backup file');
            if(confirm('This will replace ALL current edits with the imported backup. Continue?')){
              setEdits(data.edits);
              setImages(data.images);
              updateStatus('✓ Imported. Reloading…');
              setTimeout(() => location.reload(), 800);
            }
          } catch(e){
            alert('Could not read backup file: ' + e.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // Reset handler
    document.getElementById('etReset').addEventListener('click', () => {
      if(confirm(`Reset all edits on THIS page (${pageKey})? This cannot be undone — export a backup first if you might want them back.`)){
        const edits = getEdits();
        const images = getImages();
        delete edits[pageKey];
        delete images[pageKey];
        setEdits(edits);
        setImages(images);
        location.reload();
      }
    });

    // Exit handler
    document.getElementById('etExit').addEventListener('click', () => {
      if(confirm('Exit edit mode? Unsaved changes will be lost.')){
        sessionStorage.removeItem('saveetha_auth');
        location.href = location.pathname;
      }
    });

    function updateStatus(msg){
      const s = document.getElementById('etStatus');
      if(s) s.textContent = msg;
    }

    // Auto-save prompt on exit attempt
    window.addEventListener('beforeunload', (e) => {
      const hasUnsaved = document.querySelectorAll('[data-edit-img][data-pending="1"]').length > 0;
      if(hasUnsaved){
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  // ============ BOOT ============
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot(){
    applyEdits();
    if(isEditMode) initEditMode();
  }
})();
