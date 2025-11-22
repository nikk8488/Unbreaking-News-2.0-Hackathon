document.addEventListener('DOMContentLoaded', () => {
  // Bind buttons
  document.getElementById('mode-normal').onclick = () => setMode('normal');
  document.getElementById('mode-ela').onclick = () => setMode('ela');
  document.getElementById('mode-noise').onclick = () => setMode('noise');
  document.getElementById('mode-mag').onclick = () => setMode('mag');
  document.getElementById('ela-scale').oninput = updateView;

  // Magnifier events
  const stage = document.getElementById('stage');
  stage.onmousemove = handleMag;
  stage.onmouseleave = () => document.getElementById('magnifier').style.display = 'none';

  // Load
  init();
});

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
let originalImg = null;
let currentMode = 'normal';

function init() {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('src');
  if(url) {
    chrome.runtime.sendMessage({ action: "fetchImage", url: url }, (res) => {
      document.getElementById('loader').style.display = 'none';
      if(res.success) {
        // Parse Metadata from Raw Buffer
        parseMeta(res.raw);
        // Load Visuals
        originalImg = new Image();
        originalImg.onload = () => {
          canvas.width = originalImg.width;
          canvas.height = originalImg.height;
          updateView();
        };
        originalImg.src = res.data;
      } else {
        alert("Security Block: Cannot access this image directly.");
      }
    });
  }
}

function setMode(m) {
  currentMode = m;
  document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`mode-${m}`).classList.add('active');
  document.getElementById('controls-ela').style.display = m === 'ela' ? 'block' : 'none';
  document.getElementById('magnifier').style.display = 'none';
  updateView();
}

function updateView() {
  if(!originalImg) return;
  ctx.drawImage(originalImg, 0, 0);

  if(currentMode === 'ela') {
    const w = canvas.width, h = canvas.height;
    const url = canvas.toDataURL('image/jpeg', 0.90);
    const img = new Image();
    img.onload = () => {
      const tC = document.createElement('canvas'); tC.width=w; tC.height=h;
      tC.getContext('2d').drawImage(img,0,0);

      const orig = ctx.getImageData(0,0,w,h);
      const comp = tC.getContext('2d').getImageData(0,0,w,h);
      const out = ctx.createImageData(w,h);
      const scale = parseInt(document.getElementById('ela-scale').value);

      for(let i=0; i<orig.data.length; i+=4) {
        out.data[i] = Math.abs(orig.data[i]-comp.data[i]) * scale;
        out.data[i+1] = Math.abs(orig.data[i+1]-comp.data[i+1]) * scale;
        out.data[i+2] = Math.abs(orig.data[i+2]-comp.data[i+2]) * scale;
        out.data[i+3] = 255;
      }
      ctx.putImageData(out,0,0);
    };
    img.src = url;
  } else if(currentMode === 'noise') {
    const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
    const d = imgData.data;
    const buf = new Uint8ClampedArray(d);
    const w = canvas.width;
    for(let i=0; i<d.length; i+=4) {
      if(i > 4 && i < d.length-4) {
        const diff = Math.abs(buf[i] - buf[i-4]) * 5;
        d[i]=diff; d[i+1]=diff; d[i+2]=diff;
      }
    }
    ctx.putImageData(imgData,0,0);
  }
}

function handleMag(e) {
  if(currentMode !== 'mag' || !originalImg) return;
  const mag = document.getElementById('magnifier');
  mag.style.display = 'block';

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  mag.style.left = (e.clientX - 60) + 'px';
  mag.style.top = (e.clientY - 60) + 'px';

  mag.style.backgroundImage = `url(${canvas.toDataURL()})`;
  mag.style.backgroundSize = `${canvas.width*2}px ${canvas.height*2}px`;
  mag.style.backgroundPosition = `-${x*2 - 60}px -${y*2 - 60}px`;
}

function parseMeta(arr) {
  const view = new DataView(new Uint8Array(arr).buffer);
  let txt = "File loaded.\n";
  try {
    if(view.getUint16(0) === 0xFFD8) {
      txt += "Type: JPEG Image\n";
      // Simple check for Exif Header
      const h = String.fromCharCode(view.getUint8(6), view.getUint8(7), view.getUint8(8), view.getUint8(9));
      if(h === "Exif" || h === "JFIF") txt += `Header: ${h} found.\n`;
    } else if (view.getUint8(0) === 0x89) {
      txt += "Type: PNG Image\n";
    }
    txt += `Size: ${arr.length} bytes`;
  } catch(e) { txt += "Meta parse error"; }
  document.getElementById('meta-display').textContent = txt;
}
