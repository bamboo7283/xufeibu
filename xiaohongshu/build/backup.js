'use strict';

// PNG preserves the backup bytes while allowing import through the container's
// image picker. Saving through the native album API replaces blocked downloads.
const BACKUP_HEADER_HEIGHT = 112;
const BACKUP_MAGIC = [82, 66, 75, 49]; // RBK1

function backupHash(bytes) {
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
  }
  return hash;
}

function backupPayload() {
  return JSON.stringify(Object.assign({ app: 'xufeibu', exportedAt: nowStamp() }, state));
}

function makeBackupImage(serialized) {
  const payload = new TextEncoder().encode(serialized);
  const count = payload.length + 12;
  const side = Math.max(512, Math.ceil(Math.sqrt(count / 3)));
  if (side > 2048) throw new Error('备份内容太大，请先缩小部分自定义图标');
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side + BACKUP_HEADER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法生成备份图片');
  ctx.fillStyle = '#eaf6f3';
  ctx.fillRect(0, 0, side, BACKUP_HEADER_HEIGHT);
  ctx.fillStyle = '#12302b';
  ctx.font = 'bold 27px sans-serif';
  ctx.fillText('续费手账 · 备份图', 22, 44);
  ctx.font = '16px sans-serif';
  ctx.fillText('请保存原图，勿裁剪或截图', 22, 76);
  ctx.font = '13px sans-serif';
  ctx.fillText('包含私人会员记录，请勿公开分享', 22, 99);

  const image = ctx.createImageData(side, side);
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = 234;
    image.data[i + 1] = 247;
    image.data[i + 2] = 241;
    image.data[i + 3] = 255;
  }
  const header = new Uint8Array(12);
  header.set(BACKUP_MAGIC, 0);
  const hash = backupHash(payload);
  for (let i = 0; i < 4; i++) {
    header[4 + i] = (payload.length >>> (24 - i * 8)) & 255;
    header[8 + i] = (hash >>> (24 - i * 8)) & 255;
  }
  for (let i = 0; i < count; i++) {
    const pixel = Math.floor(i / 3);
    image.data[pixel * 4 + i % 3] = i < 12 ? header[i] : payload[i - 12];
  }
  ctx.putImageData(image, 0, BACKUP_HEADER_HEIGHT);
  return canvas.toDataURL('image/png');
}

function decodeBackupImage(img) {
  const side = img.naturalWidth;
  if (side < 512 || side > 2048 || img.naturalHeight !== side + BACKUP_HEADER_HEIGHT) {
    throw new Error('图片尺寸不符，请选择续费手账保存的原始备份图');
  }
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side + BACKUP_HEADER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法读取备份图片');
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, BACKUP_HEADER_HEIGHT, side, side).data;
  const byteAt = (i) => pixels[Math.floor(i / 3) * 4 + i % 3];
  for (let i = 0; i < 4; i++) {
    if (byteAt(i) !== BACKUP_MAGIC[i]) throw new Error('不是有效的续费手账备份图，或图片经过了压缩');
  }
  let length = 0, expectedHash = 0;
  for (let i = 0; i < 4; i++) {
    length = (length * 256 + byteAt(4 + i)) >>> 0;
    expectedHash = (expectedHash * 256 + byteAt(8 + i)) >>> 0;
  }
  if (!length || length + 12 > side * side * 3) throw new Error('备份图片的数据长度无效');
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = byteAt(i + 12);
  if (backupHash(bytes) !== expectedHash) throw new Error('备份图片已经被压缩或修改，请选原图');
  return new TextDecoder('utf-8').decode(bytes);
}

function parseBackup(serialized) {
  const raw = JSON.parse(serialized);
  if (!raw || raw.app !== 'xufeibu' || !Array.isArray(raw.subs) || !Array.isArray(raw.categories)) {
    throw new Error('这不是续费手账或原版时笺的备份');
  }
  return normalize(raw);
}

function showImportPreview(incoming) {
  if (!incoming.subs.length && !incoming.categories.length) {
    toast('备份里没有会员或大类', 'alert');
    return;
  }
  importBackup.pending = incoming;
  const body = `<p style="margin:0 0 16px">备份里有 <b>${incoming.subs.length}</b> 个会员、<b>${incoming.categories.length}</b> 个大类；当前有 ${state.subs.length} 个会员。</p>
    <div class="form">
      <button class="btn btn-primary" data-act="import-merge">合并：保留两边较新的记录</button>
      <button class="btn btn-danger" data-act="import-replace">替换：用备份覆盖当前记录</button>
    </div>`;
  openSheet('确认导入', body, '');
}

async function exportBackup() {
  try {
    const image = makeBackupImage(backupPayload());
    const api = window.xhs && window.xhs.miniTool;
    if (!api || typeof api.saveImageToPhotosAlbum !== 'function') {
      openSheet('备份图片预览', `<p class="field-hint">请在小红书内打开小工具，再用“导出备份”保存到相册。</p><img class="backup-preview" src="${image}" alt="备份图片">`, '');
      return;
    }
    let path = image;
    if (typeof api.writeTempFile === 'function') {
      try { path = (await api.writeTempFile({ data: image })).filePath || image; }
      catch (e) { path = image; }
    }
    await api.saveImageToPhotosAlbum({ filePath: path });
    toast('备份图已保存到相册，请保留原图');
  } catch (error) {
    toast((error && error.message) || '保存备份图失败，请重试', 'alert');
  }
}

function importBackup() {
  openSheet('导入备份', `<div class="form">
    <p class="field-hint">从相册选择本工具保存的备份原图。旧版网页导出的 JSON 可粘贴到下方。</p>
    <button class="btn btn-primary" data-act="import-image">${icon('upload')}从相册选备份图</button>
    <label class="field"><span class="field-label">旧版 JSON 备份</span><span class="field-box"><textarea id="backup-text" rows="4" placeholder="粘贴原版时笺导出的 JSON"></textarea></span></label>
    <button class="btn" data-act="import-text">读取上方文字</button>
  </div>`, '');
}

function importBackupText() {
  try { showImportPreview(parseBackup($('#backup-text').value)); }
  catch (error) { toast((error && error.message) || '备份文字无效', 'alert'); }
}

function importBackupImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file || !file.type.startsWith('image/')) {
      toast('请选择备份图片', 'alert');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try { showImportPreview(parseBackup(decodeBackupImage(img))); }
      catch (error) { toast((error && error.message) || '备份图片读取失败', 'alert'); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('图片打不开，请选择原始备份图', 'alert'); };
    img.src = url;
  };
  input.click();
}
