# Hyperscape Login Button - Quick Add

## Option 1: Bookmarklet (Easiest)

1. **Copy this code:**
```javascript
javascript:(function(){const s=document.createElement('script');s.textContent=`(function(){function e(){if(document.getElementById('hyperscape-main-login-btn'))return;const t=document.createElement('div');t.id='hyperscape-main-login-btn';t.style.cssText='position:fixed;top:20px;right:20px;z-index:9999;display:flex;gap:10px;align-items:center';const n=document.createElement('a');n.href='/hyperscape/login';n.target='_blank';n.style.cssText='display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;box-shadow:0 4px 12px rgba(102,126,234,0.3);transition:transform 0.2s,box-shadow 0.2s';n.innerHTML='🔐 Hyperscape Login';n.title='Login to Hyperscape';n.addEventListener('mouseenter',()=>{n.style.transform='translateY(-2px)';n.style.boxShadow='0 6px 16px rgba(102,126,234,0.4)'});n.addEventListener('mouseleave',()=>{n.style.transform='translateY(0)';n.style.boxShadow='0 4px 12px rgba(102,126,234,0.3)'});t.appendChild(n);document.body.appendChild(t);console.log('✅ Hyperscape login button added')}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',e)}else{e()}})();`;document.head.appendChild(s)})();
```

2. **Create a bookmark:**
   - Create a new bookmark in your browser
   - Name it: "Add Hyperscape Login"
   - Paste the code above as the URL
   - Save it

3. **Use it:**
   - Go to `http://localhost:3000` (ElizaOS UI)
   - Click the bookmark
   - A "🔐 Hyperscape Login" button will appear in the top-right corner

## Option 2: Browser Console

1. Open ElizaOS UI: `http://localhost:3000`
2. Press F12 to open Developer Tools
3. Go to the Console tab
4. Paste this code and press Enter:

```javascript
(function(){function injectButton(){if(document.getElementById('hyperscape-main-login-btn'))return;const container=document.createElement('div');container.id='hyperscape-main-login-btn';container.style.cssText='position:fixed;top:20px;right:20px;z-index:9999;display:flex;gap:10px;align-items:center';const btn=document.createElement('a');btn.href='/hyperscape/login';btn.target='_blank';btn.style.cssText='display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;box-shadow:0 4px 12px rgba(102,126,234,0.3);transition:transform 0.2s,box-shadow 0.2s';btn.innerHTML='🔐 Hyperscape Login';btn.title='Login to Hyperscape';btn.addEventListener('mouseenter',()=>{btn.style.transform='translateY(-2px)';btn.style.boxShadow='0 6px 16px rgba(102,126,234,0.4)'});btn.addEventListener('mouseleave',()=>{btn.style.transform='translateY(0)';btn.style.boxShadow='0 4px 12px rgba(102,126,234,0.3)'});container.appendChild(btn);document.body.appendChild(container);console.log('✅ Hyperscape login button added')}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',injectButton)}else{injectButton()}})();
```

5. The button will appear in the top-right corner!

## What the Button Does

- Clicking it opens `/hyperscape/login` in a new tab
- From there you can authenticate your agent with Privy
- The button stays visible until you refresh the page

