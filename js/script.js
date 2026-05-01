/* =========================================================
   AuraDraw — script.js
   Bu faylda canvas editorning barcha ishlash logikasi bor:
   1) chizish instrumentlari, rang, stroke, opacity;
   2) layer yaratish/nomlash/o'chirish;
   3) undo/redo, save/load, export JPG/PNG;
   4) modal, dark mode, responsive fit funksiyalari.
   HTML ichidagi <script> qismi shu faylga ko'chirildi.
   ========================================================= */

'use strict'

// Qulay selector yordamchilari: $(...) va $$(...)
const $ = (id) => document.getElementById(id)
const stackEl = $('canvasStack')
const previewCanvas = $('previewCanvas')
const pctx = previewCanvas.getContext('2d', { willReadFrequently: true })

// HTML elementlarni bir joyga yig'ib olamiz
const ui = {
  panel: $('settingsPanel'), guideBtn: $('guideBtn'), guideModal: $('guideModal'), guideCloseBtn: $('guideCloseBtn'), topAddLayerBtn: $('topAddLayerBtn'), topCopyLayerBtn: $('topCopyLayerBtn'), panelBackdrop: $('panelBackdrop'), panelToggleBtn: $('panelToggleBtn'), darkModeBtn: $('darkModeBtn'),
  printBtn: $('printBtn'), copyPngBtn: $('copyPngBtn'), mirrorXBtn: $('mirrorXBtn'), mirrorYBtn: $('mirrorYBtn'),
  selectAllBtn: $('selectAllBtn'), openPanelBtn: $('openPanelBtn'), closePanelBtn: $('closePanelBtn'),
  presetSelect: $('presetSelect'), strokeColor: $('strokeColor'), fillColor: $('fillColor'), bgColor: $('bgColor'),
  swatches: $('swatches'), paintPalette: $('paintPalette'), topPaintPalette: $('topPaintPalette'), topColorOneCard: $('topColorOneCard'), topColorTwoCard: $('topColorTwoCard'), topColorOnePreview: $('topColorOnePreview'), topColorTwoPreview: $('topColorTwoPreview'), topPaintCustomColor: $('topPaintCustomColor'), colorOneCard: $('colorOneCard'), colorTwoCard: $('colorTwoCard'), colorOnePreview: $('colorOnePreview'), colorTwoPreview: $('colorTwoPreview'), paintCustomColor: $('paintCustomColor'), swapColorsBtn: $('swapColorsBtn'), brushSize: $('brushSize'), brushSizeValue: $('brushSizeValue'),
  opacity: $('opacity'), opacityValue: $('opacityValue'), smoothing: $('smoothing'), smoothingValue: $('smoothingValue'),
  lineCap: $('lineCap'), shapeMode: $('shapeMode'), textValue: $('textValue'), fontSize: $('fontSize'), fontFamily: $('fontFamily'),
  imageInput: $('imageInput'), railBrushSize: $('railBrushSize'), railBrushSizeValue: $('railBrushSizeValue'),
  railOpacity: $('railOpacity'), railOpacityValue: $('railOpacityValue'), zoomOutBtn: $('zoomOutBtn'), fitBtn: $('fitBtn'),
  zoomInBtn: $('zoomInBtn'), undoBtn: $('undoBtn'), redoBtn: $('redoBtn'), clearBtn: $('clearBtn'),
  saveBtn: $('saveBtn'), loadBtn: $('loadBtn'), exportPngBtn: $('exportPngBtn'), exportJpgBtn: $('exportJpgBtn'),
  activeToolText: $('activeToolText'), toolStatus: $('toolStatus'), sizeStatus: $('sizeStatus'), zoomStatus: $('zoomStatus'),
  layerStatus: $('layerStatus'), canvasStage: $('canvasStage'), canvasWrap: document.querySelector('.canvas-wrap'),
  toast: $('toast'), layerList: $('layerList'), canvasLayerTabs: $('canvasLayerTabs'), quickAddLayerBtn: $('quickAddLayerBtn'),
  layerPrevBtn: $('layerPrevBtn'), layerNextBtn: $('layerNextBtn'), addLayerBtn: $('addLayerBtn'), duplicateLayerBtn: $('duplicateLayerBtn'),
  layerOpacity: $('layerOpacity'), layerOpacityValue: $('layerOpacityValue'), dropZone: $('dropZone'),
  renameModal: $('renameModal'), renameLayerInput: $('renameLayerInput'), renameCloseBtn: $('renameCloseBtn'),
  renameCancelBtn: $('renameCancelBtn'), renameSaveBtn: $('renameSaveBtn'), confirmModal: $('confirmModal'), confirmTitle: $('confirmTitle'), confirmText: $('confirmText'), confirmCloseBtn: $('confirmCloseBtn'), confirmNoBtn: $('confirmNoBtn'), confirmYesBtn: $('confirmYesBtn'),
  selectRectPanelBtn: $('selectRectPanelBtn'), selectFreePanelBtn: $('selectFreePanelBtn'), selectAllPanelBtn: $('selectAllPanelBtn')
}

// Dastur holati: aktiv tool, rang, layer va tarix ma'lumotlari
const state = {
  tool: 'brush', width: 760, height: 460, bg: '#ffffff', zoom: 1,
  isDown: false, start: { x: 0, y: 0 }, last: { x: 0, y: 0 }, smooth: null, hasDrawnStroke: false,
  layers: [], activeLayerId: null, activeColorTarget: 'stroke', history: [], redo: [], maxHistory: 70, autosaveTimer: null,
  moveSnapshot: null, moveOffset: { x: 0, y: 0 }, restoring: false, renameLayerId: null, renameOriginalName: '',
  selection: null, selectFreePoints: [], transform: null, activeTextBox: null
}

const shapeTools = ['line', 'curve', 'circle', 'rect', 'roundrect', 'parallelogram', 'triangle', 'righttriangle', 'diamond', 'pentagon', 'hexagon', 'rarrow', 'larrow', 'uarrow', 'darrow', 'spark4', 'star', 'burst', 'cloud', 'bubble', 'heart', 'freeform']
const drawTools = ['brush', 'pencil', 'marker', 'spray', 'eraser']
const selectTools = ['selectrect', 'selectfree']
const palette = ['#111827', '#ffffff', '#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#e11d48', '#a855f7', '#6366f1', '#64748b']

function uid() { return crypto?.randomUUID ? crypto.randomUUID() : 'l' + Date.now() + Math.random().toString(16).slice(2) }
function toast(msg) { ui.toast.textContent = msg; ui.toast.classList.add('show'); clearTimeout(ui.toast.t); ui.toast.t = setTimeout(() => ui.toast.classList.remove('show'), 1500) }
function fileName(n) { return (n || 'AuraDraw').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 70) || 'AuraDraw' }

function createCanvas() {
  const c = document.createElement('canvas')
  c.className = 'layer-canvas'
  c.width = state.width; c.height = state.height
  c.style.width = state.width + 'px'; c.style.height = state.height + 'px'
  c.getContext('2d', { willReadFrequently: true }).clearRect(0, 0, state.width, state.height)
  return c
}
function activeLayer() { return state.layers.find(l => l.id === state.activeLayerId) || state.layers[0] || null }
function activeCtx() { return activeLayer()?.canvas.getContext('2d', { willReadFrequently: true }) }
function refreshLayers() {
  state.layers.forEach((l, i) => {
    l.canvas.classList.toggle('base-layer', i === 0)
    l.canvas.style.zIndex = i + 1
    l.canvas.style.opacity = l.opacity ?? 1
    l.canvas.style.display = (l.id === state.activeLayerId && l.visible !== false) ? 'block' : 'none'
  })
  previewCanvas.style.zIndex = 1000
}

function sizeStatic() {
  previewCanvas.width = state.width; previewCanvas.height = state.height
  previewCanvas.style.width = state.width + 'px'; previewCanvas.style.height = state.height + 'px'
  stackEl.style.width = state.width + 'px'; stackEl.style.height = state.height + 'px'; stackEl.style.background = state.bg
  ui.sizeStatus.textContent = `${state.width} × ${state.height}`
  updateViewport()
}
function updateViewport() {
  const pad = innerWidth <= 520 ? 12 : 18
  const vw = Math.ceil(state.width * state.zoom + pad * 2), vh = Math.ceil(state.height * state.zoom + pad * 2)
  ui.canvasWrap.style.minWidth = vw + 'px'; ui.canvasWrap.style.minHeight = vh + 'px'
  ui.canvasWrap.style.width = Math.max(ui.canvasStage.clientWidth, vw) + 'px'
  ui.canvasWrap.style.height = Math.max(ui.canvasStage.clientHeight, vh) + 'px'
}
// Yangi layer yaratish funksiyasi
function addLayer(name = `Layer ${state.layers.length + 1}`, makeActive = true, push = true) {
  const blank = createCanvas()
  const ctx = blank.getContext('2d', { willReadFrequently: true })
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, state.width, state.height)

  const layer = { id: uid(), name, visible: true, opacity: 1, canvas: blank }
  state.layers.push(layer)
  stackEl.insertBefore(layer.canvas, previewCanvas)

  if (makeActive) state.activeLayerId = layer.id

  refreshLayers()
  renderLayers()
  updateStatus()

  requestAnimationFrame(() => {
    ui.canvasLayerTabs?.querySelector('.sheet-tab.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  })

  if (push && !state.restoring) pushHistory()
  return layer
}

function deleteLayer(id) {
  if (state.layers.length <= 1) return toast('Kamida 1 layer kerak')
  const i = state.layers.findIndex(l => l.id === id); if (i < 0) return
  state.layers[i].canvas.remove(); state.layers.splice(i, 1)
  state.activeLayerId = state.layers[Math.max(0, i - 1)]?.id || state.layers[0].id
  refreshLayers(); renderLayers(); pushHistory()
}
function renameLayer(id, name) {
  const l = state.layers.find(x => x.id === id); if (!l) return
  l.name = (name || '').trim() || `Layer ${state.layers.indexOf(l) + 1}`
  renderLayers(); updateStatus(); scheduleAutosave()
}
function openRename(id) {
  const l = state.layers.find(x => x.id === id); if (!l) return
  state.renameLayerId = id; state.renameOriginalName = l.name; ui.renameLayerInput.value = l.name
  ui.renameModal.classList.add('show'); setTimeout(() => ui.renameLayerInput.select())
}
function closeRename(save = true) {
  if (!save && state.renameLayerId) renameLayer(state.renameLayerId, state.renameOriginalName)
  ui.renameModal.classList.remove('show'); state.renameLayerId = null
}
function renderLayerTabs() {
  ui.canvasLayerTabs.querySelectorAll('.sheet-tab').forEach(x => x.remove())
  state.layers.forEach(l => {
    const t = document.createElement('button')
    t.type = 'button'; t.className = 'sheet-tab' + (l.id === state.activeLayerId ? ' active' : '')
    t.innerHTML = `<span>${l.name}</span><button class="sheet-close" type="button"><i class="bi bi-x"></i></button>`
    t.onclick = e => { if (e.target.closest('.sheet-close')) return; state.activeLayerId = l.id; refreshLayers(); renderLayers(); updateStatus() }
    t.ondblclick = () => openRename(l.id)
    t.querySelector('.sheet-close').onclick = e => { e.stopPropagation(); deleteLayer(l.id) }
    ui.canvasLayerTabs.insertBefore(t, ui.quickAddLayerBtn)
  })
  const tools = ui.canvasLayerTabs.querySelector('.layer-tools')
  if (tools) ui.canvasLayerTabs.insertBefore(ui.quickAddLayerBtn, tools)
}
function renderLayers() {
  ui.layerList.innerHTML = ''; renderLayerTabs();
  [...state.layers].reverse().forEach(l => {
    const item = document.createElement('div'); item.className = 'layer-item' + (l.id === state.activeLayerId ? ' active' : '')
    item.innerHTML = `<input class="layer-name-input" value="${l.name.replaceAll('"', '&quot;')}"><button class="mini-btn" data-a="rename"><i class="bi bi-pencil-square"></i></button><button class="mini-btn" data-a="vis"><i class="bi ${l.visible !== false ? 'bi-eye' : 'bi-eye-slash'}"></i></button><button class="mini-btn" data-a="del"><i class="bi bi-trash3"></i></button>`
    item.onclick = () => { state.activeLayerId = l.id; refreshLayers(); renderLayers(); updateStatus() }
    const inp = item.querySelector('input')
    inp.onclick = e => e.stopPropagation(); inp.oninput = () => renameLayer(l.id, inp.value)
    item.querySelector('[data-a=rename]').onclick = e => { e.stopPropagation(); openRename(l.id) }
    item.querySelector('[data-a=vis]').onclick = e => { e.stopPropagation(); l.visible = !l.visible; refreshLayers(); renderLayers(); pushHistory() }
    item.querySelector('[data-a=del]').onclick = e => { e.stopPropagation(); deleteLayer(l.id) }
    ui.layerList.appendChild(item)
  })
  const l = activeLayer(); if (l) { ui.layerOpacity.value = Math.round((l.opacity ?? 1) * 100); ui.layerOpacityValue.textContent = ui.layerOpacity.value + '%' }
}
function composite(bg = true) {
  commitTextEditor(false)
  commitSelection(false)

  const out = document.createElement('canvas')
  out.width = state.width
  out.height = state.height
  const c = out.getContext('2d')

  if (bg) {
    c.fillStyle = state.bg
    c.fillRect(0, 0, state.width, state.height)
  }

  const l = activeLayer()
  if (l && l.visible !== false) {
    c.save()
    c.globalAlpha = l.opacity ?? 1
    c.drawImage(l.canvas, 0, 0)
    c.restore()
  }

  return out
}

function serialize() {
  return { width: state.width, height: state.height, bg: state.bg, activeLayerId: state.activeLayerId, layers: state.layers.map(l => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, data: l.canvas.toDataURL() })) }
}
function restore(s, cb) {
  if (!s?.layers?.length) return
  state.restoring = true; state.width = s.width || 760; state.height = s.height || 460; state.bg = s.bg || '#fff'; ui.bgColor.value = state.bg
  document.querySelectorAll('.layer-canvas').forEach(c => c.remove()); state.layers = []; sizeStatic()
  let loaded = 0
  s.layers.forEach((sl, i) => {
    const l = { id: sl.id || uid(), name: sl.name || `Layer ${i + 1}`, visible: sl.visible !== false, opacity: Number(sl.opacity) || 1, canvas: createCanvas() }
    state.layers.push(l); stackEl.insertBefore(l.canvas, previewCanvas)
    const img = new Image()
    img.onload = img.onerror = () => { try { l.canvas.getContext('2d').drawImage(img, 0, 0, state.width, state.height) } catch { } loaded++; if (loaded === s.layers.length) { state.activeLayerId = s.activeLayerId || state.layers[0].id; state.restoring = false; refreshLayers(); renderLayers(); updateStatus(); cb?.() } }
    img.src = sl.data
  })
}
// Undo/Redo uchun canvas holatini tarixga saqlash
function pushHistory() {
  if (state.restoring) return
  state.history.push(JSON.stringify(serialize()))
  if (state.history.length > state.maxHistory) state.history.shift()
  state.redo = []; updateHistory(); scheduleAutosave()
}
function updateHistory() { ui.undoBtn.disabled = state.history.length <= 1; ui.redoBtn.disabled = !state.redo.length }
function scheduleAutosave() { clearTimeout(state.autosaveTimer); state.autosaveTimer = setTimeout(() => localStorage.setItem('auradraw.autosave', JSON.stringify(serialize())), 260) }
function undo() { if (state.history.length <= 1) return; state.redo.push(state.history.pop()); restore(JSON.parse(state.history.at(-1)), updateHistory) }
function redo() { if (!state.redo.length) return; const x = state.redo.pop(); state.history.push(x); restore(JSON.parse(x), updateHistory) }


function mirror(axis) {
  commitTextEditor(false)

  if (state.selection) {
    const s = state.selection

    if (s.type === 'shape') {
      s.flipX = axis === 'x' ? !s.flipX : !!s.flipX
      s.flipY = axis === 'y' ? !s.flipY : !!s.flipY
      renderSelection()
      pushHistory()
      toast(axis === 'x' ? 'Selection gorizontal flip qilindi' : 'Selection vertikal flip qilindi')
      return true
    }

    const flipped = document.createElement('canvas')
    flipped.width = s.canvas.width
    flipped.height = s.canvas.height
    const fctx = flipped.getContext('2d', { willReadFrequently: true })
    fctx.save()
    if (axis === 'x') {
      fctx.translate(flipped.width, 0)
      fctx.scale(-1, 1)
    } else {
      fctx.translate(0, flipped.height)
      fctx.scale(1, -1)
    }
    fctx.drawImage(s.canvas, 0, 0)
    fctx.restore()
    s.canvas = flipped
    renderSelection()
    pushHistory()
    toast(axis === 'x' ? 'Selection gorizontal flip qilindi' : 'Selection vertikal flip qilindi')
    return true
  }

  const layer = activeLayer()
  if (!layer) return false

  const source = document.createElement('canvas')
  source.width = state.width
  source.height = state.height
  source.getContext('2d', { willReadFrequently: true }).drawImage(layer.canvas, 0, 0)

  const ctx = layer.canvas.getContext('2d', { willReadFrequently: true })
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, state.width, state.height)
  if (axis === 'x') {
    ctx.translate(state.width, 0)
    ctx.scale(-1, 1)
  } else {
    ctx.translate(0, state.height)
    ctx.scale(1, -1)
  }
  ctx.drawImage(source, 0, 0)
  ctx.restore()

  pushHistory()
  scheduleAutosave()
  toast(axis === 'x' ? 'Layer gorizontal flip qilindi' : 'Layer vertikal flip qilindi')
  return true
}

function setTool(t) {
  if (state.activeTextBox && t !== 'text') commitTextEditor(true)
  if (state.selection && !['move', 'selectrect', 'selectfree'].includes(t)) commitSelection(true)
  state.tool = t
  document.querySelectorAll('[data-tool]').forEach(b => {
    const active = b.dataset.tool === t; b.classList.toggle('active', active)
    if (active && innerWidth <= 980) requestAnimationFrame(() => b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }))
  })
  const names = { brush: 'Brush', pencil: 'Pencil', marker: 'Marker', spray: 'Spray', eraser: 'Eraser', move: 'Move', selectrect: 'Rectangle select', selectfree: 'Free select', line: 'Line', curve: 'Curve', circle: 'Oval', rect: 'Rectangle', roundrect: 'Rounded rectangle', parallelogram: 'Parallelogram', triangle: 'Triangle', righttriangle: 'Right triangle', diamond: 'Diamond', pentagon: 'Pentagon', hexagon: 'Hexagon', rarrow: 'Right arrow', larrow: 'Left arrow', uarrow: 'Up arrow', darrow: 'Down arrow', spark4: '4 star', star: 'Star', burst: 'Burst', cloud: 'Cloud', bubble: 'Speech bubble', heart: 'Heart', freeform: 'Freeform', text: 'Text', bucket: 'Bucket fill', picker: 'Color picker' }
  const n = names[t] || t; ui.toolStatus.textContent = n; ui.activeToolText.textContent = 'Active tool: ' + n
  stackEl.style.cursor = t === 'move' ? 'grab' : selectTools.includes(t) ? 'crosshair' : t === 'eraser' ? 'cell' : ['text', 'picker', 'bucket'].includes(t) ? 'copy' : 'crosshair'
}
function point(e) {
  const base = activeLayer()?.canvas || previewCanvas
  const r = base.getBoundingClientRect()
  const src = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e)
  const rawX = (src.clientX - r.left) / state.zoom
  const rawY = (src.clientY - r.top) / state.zoom

  // Resize/rotate handlelar canvas chegarasidan ozgina tashqarida bo‘lsa ham ushlanishi uchun.
  if (state.selection) {
    return {
      x: Math.max(-180, Math.min(state.width + 180, rawX)),
      y: Math.max(-180, Math.min(state.height + 180, rawY))
    }
  }

  return {
    x: Math.max(0, Math.min(state.width, rawX)),
    y: Math.max(0, Math.min(state.height, rawY))
  }
}


function ensureRangeDots() {
  document.querySelectorAll('.stroke-dock .mini-control').forEach(box => {
    if (!box.querySelector('.range-thumb-dot')) {
      const dot = document.createElement('i')
      dot.className = 'range-thumb-dot'
      dot.setAttribute('aria-hidden', 'true')
      box.appendChild(dot)
    }
  });

  [ui.railBrushSize, ui.railOpacity].forEach(input => {
    if (!input) return
    const update = () => {
      const min = Number(input.min) || 0
      const max = Number(input.max) || 100
      const val = Number(input.value) || 0
      const pct = Math.max(0, Math.min(1, (val - min) / (max - min)))
      input.style.setProperty('--pct', (pct * 100) + '%')
      input.parentElement?.style.setProperty('--pct', pct)
    }
    input.removeEventListener?.('input', input.__auraRangeUpdate || (() => { }))
    input.__auraRangeUpdate = update
    input.addEventListener('input', update)
    update()
  })
}


function updateStatus() { ui.sizeStatus.textContent = `${state.width} × ${state.height}`; ui.zoomStatus.textContent = Math.round(state.zoom * 100) + '%'; ui.layerStatus.textContent = activeLayer()?.name || 'Layer' }

function style(c) {
  const size = Math.max(1, +ui.brushSize.value || 8), op = Math.max(.05, Math.min(1, (+ui.opacity.value || 100) / 100))
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = op; c.lineWidth = size; c.lineCap = 'round'; c.lineJoin = 'round'; c.miterLimit = 3; c.strokeStyle = ui.strokeColor.value; c.fillStyle = ui.fillColor.value; c.globalCompositeOperation = state.tool === 'eraser' ? 'destination-out' : 'source-over'
  if (state.tool === 'pencil') { c.lineWidth = Math.max(1, size * .45); c.globalAlpha = op }
  if (state.tool === 'marker') { c.lineWidth = Math.max(7, size * 1.85); c.globalAlpha = Math.min(.50, op * .48); c.globalCompositeOperation = 'source-over' }
  if (state.tool === 'eraser') { c.lineWidth = Math.max(4, size * 1.25); c.globalAlpha = 1; c.globalCompositeOperation = 'destination-out' }
}
function drawPath(c, pts, close = false) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); if (close) c.closePath() }
function poly(cx, cy, r, n, rot = -Math.PI / 2) { return Array.from({ length: n }, (_, i) => ({ x: cx + Math.cos(rot + i * 2 * Math.PI / n) * r, y: cy + Math.sin(rot + i * 2 * Math.PI / n) * r })) }
function starPts(cx, cy, r1, r2, n = 5) { return Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + i * Math.PI / n; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r } }) }

function drawShape(c, tool, a, b) {
  style(c); c.globalCompositeOperation = 'source-over'
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y), sw = Math.max(1, w), sh = Math.max(1, h), mode = ui.shapeMode.value
  const finish = () => { if (mode === 'fill' || mode === 'both') c.fill(); if (mode === 'stroke' || mode === 'both') c.stroke() }
  c.beginPath()
  if (tool === 'line') { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke() }
  else if (tool === 'curve') { c.moveTo(a.x, a.y); c.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - Math.max(28, Math.abs(b.x - a.x) * .34), b.x, b.y); c.stroke() }
  else if (tool === 'circle') { c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); finish() }
  else if (tool === 'rect') { c.rect(x, y, w, h); finish() }
  else if (tool === 'roundrect') { c.roundRect(x, y, w, h, Math.min(28, w / 3, h / 3)); finish() }
  else if (tool === 'triangle') { drawPath(c, [{ x: x + w / 2, y }, { x: x + w, y: y + h }, { x, y: y + h }], true); finish() }
  else if (tool === 'righttriangle') { drawPath(c, [{ x, y }, { x, y: y + h }, { x: x + w, y: y + h }], true); finish() }
  else if (tool === 'parallelogram') { drawPath(c, [{ x: x + w * .24, y }, { x: x + w, y }, { x: x + w * .76, y: y + h }, { x, y: y + h }], true); finish() }
  else if (tool === 'diamond') { drawPath(c, [{ x: x + w / 2, y }, { x: x + w, y: y + h / 2 }, { x: x + w / 2, y: y + h }, { x, y: y + h / 2 }], true); finish() }
  else if (tool === 'pentagon') { drawPath(c, poly(x + w / 2, y + h / 2, Math.min(w, h) / 2, 5), true); finish() }
  else if (tool === 'hexagon') { drawPath(c, poly(x + w / 2, y + h / 2, Math.min(w, h) / 2, 6, Math.PI / 6), true); finish() }
  else if (tool === 'star') { drawPath(c, starPts(x + w / 2, y + h / 2, Math.min(w, h) / 2, Math.min(w, h) * .24, 5), true); finish() }
  else if (tool === 'spark4') { drawPath(c, starPts(x + w / 2, y + h / 2, Math.min(w, h) / 2, Math.min(w, h) * .13, 4), true); finish() }
  else if (tool === 'burst') { drawPath(c, starPts(x + w / 2, y + h / 2, Math.min(w, h) / 2, Math.min(w, h) * .31, 9), true); finish() }
  else if (tool === 'heart') { c.moveTo(x + w / 2, y + h * .92); c.bezierCurveTo(x - w * .10, y + h * .48, x + w * .10, y + h * .02, x + w / 2, y + h * .30); c.bezierCurveTo(x + w * .90, y + h * .02, x + w * 1.10, y + h * .48, x + w / 2, y + h * .92); finish() }
  else if (tool === 'cloud') { c.moveTo(x + sw * .18, y + sh * .72); c.bezierCurveTo(x + sw * .05, y + sh * .72, x + sw * .05, y + sh * .47, x + sw * .22, y + sh * .45); c.bezierCurveTo(x + sw * .22, y + sh * .22, x + sw * .48, y + sh * .18, x + sw * .58, y + sh * .36); c.bezierCurveTo(x + sw * .74, y + sh * .26, x + sw * .92, y + sh * .36, x + sw * .91, y + sh * .56); c.bezierCurveTo(x + sw * 1.02, y + sh * .58, x + sw * .99, y + sh * .78, x + sw * .86, y + sh * .72); c.lineTo(x + sw * .18, y + sh * .72); c.closePath(); finish() }
  else if (tool === 'bubble') { const r = Math.min(18, sw * .12, sh * .18), bh = sh * .72; c.roundRect(x, y, sw, bh, r); if (mode === 'fill' || mode === 'both') c.fill(); if (mode === 'stroke' || mode === 'both') c.stroke(); c.beginPath(); c.moveTo(x + sw * .28, y + bh); c.lineTo(x + sw * .14, y + sh); c.lineTo(x + sw * .50, y + bh); c.closePath(); finish() }
  else if (tool === 'freeform') { drawPath(c, [{ x: x + w * .08, y: y + h * .85 }, { x: x + w * .28, y: y + h * .20 }, { x: x + w * .52, y: y + h * .52 }, { x: x + w * .70, y: y + h * .08 }, { x: x + w * .92, y: y + h * .86 }], false); c.stroke() }
  else if (['rarrow', 'larrow', 'uarrow', 'darrow'].includes(tool)) { let pts; if (tool === 'rarrow') pts = [{ x, y: y + h * .32 }, { x: x + w * .62, y: y + h * .32 }, { x: x + w * .62, y }, { x: x + w, y: y + h / 2 }, { x: x + w * .62, y: y + h }, { x: x + w * .62, y: y + h * .68 }, { x, y: y + h * .68 }]; if (tool === 'larrow') pts = [{ x: x + w, y: y + h * .32 }, { x: x + w * .38, y: y + h * .32 }, { x: x + w * .38, y }, { x, y: y + h / 2 }, { x: x + w * .38, y: y + h }, { x: x + w * .38, y: y + h * .68 }, { x: x + w, y: y + h * .68 }]; if (tool === 'uarrow') pts = [{ x: x + w * .32, y: y + h }, { x: x + w * .32, y: y + h * .38 }, { x, y: y + h * .38 }, { x: x + w / 2, y }, { x: x + w, y: y + h * .38 }, { x: x + w * .68, y: y + h * .38 }, { x: x + w * .68, y: y + h }]; if (tool === 'darrow') pts = [{ x: x + w * .32, y }, { x: x + w * .32, y: y + h * .62 }, { x, y: y + h * .62 }, { x: x + w / 2, y: y + h }, { x: x + w, y: y + h * .62 }, { x: x + w * .68, y: y + h * .62 }, { x: x + w * .68, y }]; drawPath(c, pts, true); finish() }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'
}

function applyVectorStyle(ctx, s) {
  ctx.globalAlpha = Number.isFinite(s.opacity) ? s.opacity : 1
  ctx.lineWidth = Math.max(1, Number(s.strokeWidth) || 1)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 3
  ctx.strokeStyle = s.strokeColor || '#111827'
  ctx.fillStyle = s.fillColor || '#2563eb'
  ctx.globalCompositeOperation = 'source-over'
}

function drawVectorShapePath(ctx, tool, x, y, w, h) {
  const sw = Math.max(1, w)
  const sh = Math.max(1, h)

  ctx.beginPath()

  if (tool === 'line') {
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y + h)
    return false
  }

  if (tool === 'curve') {
    ctx.moveTo(x, y + h)
    ctx.quadraticCurveTo(x + w / 2, y - Math.max(28, Math.abs(w) * .34), x + w, y + h * .15)
    return false
  }

  if (tool === 'circle') {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    return true
  }

  if (tool === 'rect') {
    ctx.rect(x, y, w, h)
    return true
  }

  if (tool === 'roundrect') {
    ctx.roundRect(x, y, w, h, Math.min(28, w / 3, h / 3))
    return true
  }

  if (tool === 'triangle') {
    ctx.moveTo(x + w / 2, y)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.closePath()
    return true
  }

  if (tool === 'righttriangle') {
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x + w, y + h)
    ctx.closePath()
    return true
  }

  if (tool === 'parallelogram') {
    ctx.moveTo(x + w * .24, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w * .76, y + h)
    ctx.lineTo(x, y + h)
    ctx.closePath()
    return true
  }

  if (tool === 'diamond') {
    ctx.moveTo(x + w / 2, y)
    ctx.lineTo(x + w, y + h / 2)
    ctx.lineTo(x + w / 2, y + h)
    ctx.lineTo(x, y + h / 2)
    ctx.closePath()
    return true
  }

  if (tool === 'pentagon' || tool === 'hexagon') {
    const n = tool === 'pentagon' ? 5 : 6
    const rot = tool === 'pentagon' ? -Math.PI / 2 : Math.PI / 6
    const cx = x + w / 2
    const cy = y + h / 2
    const rx = w / 2
    const ry = h / 2

    for (let i = 0; i < n; i++) {
      const a = rot + i * Math.PI * 2 / n
      const px = cx + Math.cos(a) * rx
      const py = cy + Math.sin(a) * ry
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    return true
  }

  if (tool === 'star' || tool === 'spark4' || tool === 'burst') {
    const count = tool === 'spark4' ? 4 : tool === 'burst' ? 9 : 5
    const innerRatio = tool === 'spark4' ? .26 : tool === 'burst' ? .31 : .48
    const cx = x + w / 2
    const cy = y + h / 2
    const rx = w / 2
    const ry = h / 2

    for (let i = 0; i < count * 2; i++) {
      const r = i % 2 === 0 ? 1 : innerRatio
      const a = -Math.PI / 2 + i * Math.PI / count
      const px = cx + Math.cos(a) * rx * r
      const py = cy + Math.sin(a) * ry * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    return true
  }

  if (tool === 'heart') {
    ctx.moveTo(x + w / 2, y + h * .92)
    ctx.bezierCurveTo(x - w * .10, y + h * .48, x + w * .10, y + h * .02, x + w / 2, y + h * .30)
    ctx.bezierCurveTo(x + w * .90, y + h * .02, x + w * 1.10, y + h * .48, x + w / 2, y + h * .92)
    ctx.closePath()
    return true
  }

  if (tool === 'cloud') {
    ctx.moveTo(x + sw * .18, y + sh * .72)
    ctx.bezierCurveTo(x + sw * .05, y + sh * .72, x + sw * .05, y + sh * .47, x + sw * .22, y + sh * .45)
    ctx.bezierCurveTo(x + sw * .22, y + sh * .22, x + sw * .48, y + sh * .18, x + sw * .58, y + sh * .36)
    ctx.bezierCurveTo(x + sw * .74, y + sh * .26, x + sw * .92, y + sh * .36, x + sw * .91, y + sh * .56)
    ctx.bezierCurveTo(x + sw * 1.02, y + sh * .58, x + sw * .99, y + sh * .78, x + sw * .86, y + sh * .72)
    ctx.lineTo(x + sw * .18, y + sh * .72)
    ctx.closePath()
    return true
  }

  if (tool === 'bubble') {
    const r = Math.min(18, sw * .12, sh * .18)
    const bh = sh * .72

    ctx.roundRect(x, y, sw, bh, r)
    ctx.moveTo(x + sw * .28, y + bh)
    ctx.lineTo(x + sw * .14, y + sh)
    ctx.lineTo(x + sw * .50, y + bh)
    ctx.closePath()
    return true
  }

  if (tool === 'freeform') {
    ctx.moveTo(x + w * .08, y + h * .85)
    ctx.lineTo(x + w * .28, y + h * .20)
    ctx.lineTo(x + w * .52, y + h * .52)
    ctx.lineTo(x + w * .70, y + h * .08)
    ctx.lineTo(x + w * .92, y + h * .86)
    return false
  }

  if (['rarrow', 'larrow', 'uarrow', 'darrow'].includes(tool)) {
    let pts

    if (tool === 'rarrow') pts = [{ x, y: y + h * .32 }, { x: x + w * .62, y: y + h * .32 }, { x: x + w * .62, y }, { x: x + w, y: y + h / 2 }, { x: x + w * .62, y: y + h }, { x: x + w * .62, y: y + h * .68 }, { x, y: y + h * .68 }]
    if (tool === 'larrow') pts = [{ x: x + w, y: y + h * .32 }, { x: x + w * .38, y: y + h * .32 }, { x: x + w * .38, y }, { x, y: y + h / 2 }, { x: x + w * .38, y: y + h }, { x: x + w * .38, y: y + h * .68 }, { x: x + w, y: y + h * .68 }]
    if (tool === 'uarrow') pts = [{ x: x + w * .32, y: y + h }, { x: x + w * .32, y: y + h * .38 }, { x, y: y + h * .38 }, { x: x + w / 2, y }, { x: x + w, y: y + h * .38 }, { x: x + w * .68, y: y + h * .38 }, { x: x + w * .68, y: y + h }]
    if (tool === 'darrow') pts = [{ x: x + w * .32, y }, { x: x + w * .32, y: y + h * .62 }, { x, y: y + h * .62 }, { x: x + w / 2, y: y + h }, { x: x + w, y: y + h * .62 }, { x: x + w * .68, y: y + h * .62 }, { x: x + w * .68, y }]

    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
    ctx.closePath()
    return true
  }

  ctx.rect(x, y, w, h)
  return true
}

function renderVectorSelection(ctx, s) {
  ctx.save()

  const cx = s.x + s.w / 2
  const cy = s.y + s.h / 2

  ctx.translate(cx, cy)
  ctx.rotate(s.rotation || 0)
  ctx.scale(s.flipX ? -1 : 1, s.flipY ? -1 : 1)

  applyVectorStyle(ctx, s)

  const pad = Math.max(8, (s.strokeWidth || 1) * 2)
  const localX = -s.w / 2 + pad
  const localY = -s.h / 2 + pad
  const localW = Math.max(1, s.w - pad * 2)
  const localH = Math.max(1, s.h - pad * 2)

  const closed = drawVectorShapePath(ctx, s.shape, localX, localY, localW, localH)

  if (s.shapeMode === 'fill' || s.shapeMode === 'both') {
    if (closed) ctx.fill()
  }

  if (s.shapeMode === 'stroke' || s.shapeMode === 'both' || !closed) {
    ctx.stroke()
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
}

function clearPreview() {
  pctx.clearRect(0, 0, state.width, state.height)
}

function normalizeRect(a, b) {
  const x1 = Math.max(0, Math.min(a.x, b.x))
  const y1 = Math.max(0, Math.min(a.y, b.y))
  const x2 = Math.min(state.width, Math.max(a.x, b.x))
  const y2 = Math.min(state.height, Math.max(a.y, b.y))
  return { x: Math.round(x1), y: Math.round(y1), w: Math.round(Math.max(0, x2 - x1)), h: Math.round(Math.max(0, y2 - y1)) }
}

function selectionCenter(s = state.selection) {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 }
}

function rotatedPoint(localX, localY, s = state.selection) {
  const c = selectionCenter(s)
  const a = s.rotation || 0
  const dx = localX - s.w / 2
  const dy = localY - s.h / 2
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) }
}

function toLocalSelectionPoint(p, s = state.selection) {
  const c = selectionCenter(s)
  const a = -(s.rotation || 0)
  const dx = p.x - c.x
  const dy = p.y - c.y
  return { x: dx * Math.cos(a) - dy * Math.sin(a) + s.w / 2, y: dx * Math.sin(a) + dy * Math.cos(a) + s.h / 2 }
}

function drawSelectionFrame(x, y, w, h) {
  pctx.save()
  pctx.setLineDash([6, 4])
  pctx.lineWidth = 1.4
  pctx.strokeStyle = '#2563eb'
  pctx.strokeRect(x + .5, y + .5, w, h)
  pctx.setLineDash([])
  pctx.fillStyle = 'rgba(37,99,235,.08)'
  pctx.fillRect(x, y, w, h)
  pctx.restore()
}

function drawTransformFrame(s) {
  if (!s) return

  const corners = [
    rotatedPoint(0, 0, s),
    rotatedPoint(s.w, 0, s),
    rotatedPoint(s.w, s.h, s),
    rotatedPoint(0, s.h, s)
  ]

  const sides = [
    rotatedPoint(s.w / 2, 0, s),
    rotatedPoint(s.w, s.h / 2, s),
    rotatedPoint(s.w / 2, s.h, s),
    rotatedPoint(0, s.h / 2, s)
  ]

  const rotate = rotatedPoint(s.w / 2, -46, s)

  pctx.save()
  pctx.setLineDash([5, 4])
  pctx.lineWidth = 1.45
  pctx.strokeStyle = 'rgba(15,23,42,.94)'
  pctx.beginPath()
  pctx.moveTo(corners[0].x, corners[0].y)
  for (let i = 1; i < corners.length; i++)pctx.lineTo(corners[i].x, corners[i].y)
  pctx.closePath()
  pctx.stroke()

  pctx.setLineDash([])
  pctx.strokeStyle = 'rgba(37,99,235,.90)'
  pctx.lineWidth = 1.5
  pctx.beginPath()
  pctx.moveTo(sides[0].x, sides[0].y)
  pctx.lineTo(rotate.x, rotate.y)
  pctx.stroke()

  const handle = (pt, size = 10) => {
    pctx.fillStyle = '#fff'
    pctx.strokeStyle = '#0f172a'
    pctx.lineWidth = 1.45
    pctx.beginPath()
    pctx.rect(pt.x - size / 2, pt.y - size / 2, size, size)
    pctx.fill()
    pctx.stroke()
    pctx.fillStyle = '#2563eb'
    pctx.beginPath()
    pctx.arc(pt.x, pt.y, 2.3, 0, Math.PI * 2)
    pctx.fill()
  }

  corners.forEach(p => handle(p, 13))
  sides.forEach(p => handle(p, 12))

  pctx.fillStyle = '#fff'
  pctx.strokeStyle = '#0f172a'
  pctx.lineWidth = 1.45
  pctx.beginPath()
  pctx.arc(rotate.x, rotate.y, 15, 0, Math.PI * 2)
  pctx.fill()
  pctx.stroke()

  pctx.strokeStyle = '#0f172a'
  pctx.lineWidth = 1.55
  pctx.beginPath()
  pctx.arc(rotate.x, rotate.y, 6, Math.PI * .2, Math.PI * 1.7)
  pctx.stroke()

  pctx.restore()
}

function renderSelection() {
  clearPreview()
  const s = state.selection
  if (!s) return

  if (s.type === 'shape') {
    renderVectorSelection(pctx, s)
  } else {
    pctx.save()
    const c = selectionCenter(s)
    pctx.translate(c.x, c.y)
    pctx.rotate(s.rotation || 0)
    pctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h)
    pctx.restore()
  }

  drawTransformFrame(s)
}

function isInsideSelection(p) {
  const s = state.selection
  if (!s) return false
  const lp = toLocalSelectionPoint(p, s)
  return lp.x >= 0 && lp.x <= s.w && lp.y >= 0 && lp.y <= s.h
}

function hitSelectionHandle(p) {
  const s = state.selection
  if (!s) return null

  const pts = {
    nw: rotatedPoint(0, 0, s),
    n: rotatedPoint(s.w / 2, 0, s),
    ne: rotatedPoint(s.w, 0, s),
    e: rotatedPoint(s.w, s.h / 2, s),
    se: rotatedPoint(s.w, s.h, s),
    s: rotatedPoint(s.w / 2, s.h, s),
    sw: rotatedPoint(0, s.h, s),
    w: rotatedPoint(0, s.h / 2, s),
    rotate: rotatedPoint(s.w / 2, -46, s)
  }

  for (const [k, pt] of Object.entries(pts)) {
    if (Math.hypot(p.x - pt.x, p.y - pt.y) < 28) return k
  }

  const lp = toLocalSelectionPoint(p, s)
  const edge = 20
  const nearLeft = Math.abs(lp.x) < edge
  const nearRight = Math.abs(lp.x - s.w) < edge
  const nearTop = Math.abs(lp.y) < edge
  const nearBottom = Math.abs(lp.y - s.h) < edge
  const insideX = lp.x > -edge && lp.x < s.w + edge
  const insideY = lp.y > -edge && lp.y < s.h + edge

  if (nearLeft && nearTop) return 'nw'
  if (nearRight && nearTop) return 'ne'
  if (nearRight && nearBottom) return 'se'
  if (nearLeft && nearBottom) return 'sw'
  if (nearTop && insideX) return 'n'
  if (nearRight && insideY) return 'e'
  if (nearBottom && insideX) return 's'
  if (nearLeft && insideY) return 'w'

  return null
}

function commitSelection(push = false) {
  const s = state.selection
  if (!s) return false

  const ctx = activeCtx()

  if (ctx) {
    if (s.type === 'shape') {
      renderVectorSelection(ctx, s)
    } else {
      ctx.save()
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      const c = selectionCenter(s)
      ctx.translate(c.x, c.y)
      ctx.rotate(s.rotation || 0)
      ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h)
      ctx.restore()
    }
  }

  state.selection = null
  state.transform = null
  clearPreview()

  if (push) pushHistory()
  else scheduleAutosave()

  return true
}

function cancelSelection() {
  state.selection = null
  state.transform = null
  clearPreview()
}

function selectionHasPixels(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return true
  }
  return false
}

function makeRectSelection(rect) {
  // Paint kabi: faqat active layerdagi belgilangan to‘rtburchak maydon olinadi.
  commitSelection(false)

  if (rect.w < 3 || rect.h < 3) return false

  const layer = activeLayer()
  const ctx = activeCtx()
  if (!layer || !ctx) return false

  const temp = document.createElement('canvas')
  temp.width = rect.w
  temp.height = rect.h
  const tctx = temp.getContext('2d', { willReadFrequently: true })

  tctx.clearRect(0, 0, rect.w, rect.h)
  tctx.drawImage(layer.canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)

  // Belgilangan joy bo‘sh bo‘lsa ham Paint kabi selection chiqadi,
  // ammo layerdagi faqat shu joy kesiladi.
  ctx.clearRect(rect.x, rect.y, rect.w, rect.h)

  state.selection = {
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    canvas: temp,
    rotation: 0
  }

  renderSelection()
  scheduleAutosave()
  return true
}

function makeFreeSelection(points) {
  // Erkin selection: faqat chizilgan polygon ichidagi piksel olinadi.
  commitSelection(false)

  if (!points || points.length < 4) return false

  const minX = Math.max(0, Math.floor(Math.min(...points.map(p => p.x))))
  const minY = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))))
  const maxX = Math.min(state.width, Math.ceil(Math.max(...points.map(p => p.x))))
  const maxY = Math.min(state.height, Math.ceil(Math.max(...points.map(p => p.y))))
  const w = maxX - minX
  const h = maxY - minY

  if (w < 4 || h < 4) return false

  const layer = activeLayer()
  const ctx = activeCtx()
  if (!layer || !ctx) return false

  const temp = document.createElement('canvas')
  temp.width = w
  temp.height = h
  const tctx = temp.getContext('2d', { willReadFrequently: true })

  tctx.save()
  tctx.beginPath()
  points.forEach((p, i) => {
    const px = p.x - minX
    const py = p.y - minY
    if (i === 0) tctx.moveTo(px, py)
    else tctx.lineTo(px, py)
  })
  tctx.closePath()
  tctx.clip()
  tctx.drawImage(layer.canvas, minX, minY, w, h, 0, 0, w, h)
  tctx.restore()

  // Original layerdan faqat polygon ichini o‘chiramiz.
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  state.selection = { x: minX, y: minY, w, h, canvas: temp, rotation: 0 }
  renderSelection()
  scheduleAutosave()
  return true
}

function beginTransformSelection(p, handle) {
  const s = state.selection
  if (!s) return false

  state.transform = {
    handle,
    start: p,
    baseX: s.x,
    baseY: s.y,
    baseW: s.w,
    baseH: s.h,
    baseRotation: s.rotation || 0,
    baseCenter: selectionCenter(s),
    offX: p.x - s.x,
    offY: p.y - s.y
  }

  state.isDown = true
  return true
}

function updateTransformSelection(p) {
  const s = state.selection
  const tr = state.transform
  if (!s || !tr) return

  if (tr.handle === 'move') {
    s.x = Math.round(p.x - tr.offX)
    s.y = Math.round(p.y - tr.offY)
    renderSelection()
    return
  }

  if (tr.handle === 'rotate') {
    const c = tr.baseCenter
    const a0 = Math.atan2(tr.start.y - c.y, tr.start.x - c.x)
    const a1 = Math.atan2(p.y - c.y, p.x - c.x)
    s.rotation = tr.baseRotation + (a1 - a0)
    renderSelection()
    return
  }

  const c = tr.baseCenter
  const dx = p.x - c.x
  const dy = p.y - c.y
  const inv = -(tr.baseRotation || 0)

  const lx = dx * Math.cos(inv) - dy * Math.sin(inv)
  const ly = dx * Math.sin(inv) + dy * Math.cos(inv)

  let halfW = tr.baseW / 2
  let halfH = tr.baseH / 2

  if (['e', 'ne', 'se', 'w', 'nw', 'sw'].includes(tr.handle)) halfW = Math.abs(lx)
  if (['s', 'se', 'sw', 'n', 'ne', 'nw'].includes(tr.handle)) halfH = Math.abs(ly)

  const minSize = s.type === 'shape' ? Math.max(42, (s.strokeWidth || 1) * 8) : 18

  s.w = Math.round(Math.max(minSize, halfW * 2))
  s.h = Math.round(Math.max(minSize, halfH * 2))
  s.x = Math.round(c.x - s.w / 2)
  s.y = Math.round(c.y - s.h / 2)
  s.rotation = tr.baseRotation

  renderSelection()
}

function endTransformSelection() {
  if (!state.transform) return
  state.transform = null
  renderSelection()
  scheduleAutosave()
}

function makeShapeTransformSelection(tool, a, b) {
  const r = normalizeRect(a, b)
  if (r.w < 3 || r.h < 3) return false

  const strokeWidth = Math.max(1, Number(ui.brushSize.value) || 1)
  const pad = Math.max(16, strokeWidth * 3)

  state.selection = {
    type: 'shape',
    shape: tool,
    x: Math.max(0, r.x - pad),
    y: Math.max(0, r.y - pad),
    w: r.w + pad * 2,
    h: r.h + pad * 2,
    rotation: 0,
    strokeWidth,
    strokeColor: ui.strokeColor.value,
    fillColor: ui.fillColor.value,
    opacity: Math.max(.05, Math.min(1, (Number(ui.opacity.value) || 100) / 100)),
    shapeMode: ui.shapeMode.value
  }

  renderSelection()
  return true
}

function selectAll() {
  const ok = makeRectSelection({ x: 0, y: 0, w: state.width, h: state.height })
  if (ok) {
    setTool('move')
    toast('Select All bajarildi')
  }
  return ok
}

function stampCircle(ctx, p, r) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill() }
function sprayPaint(ctx, p) {
  const radius = Math.max(3, +ui.brushSize.value || 8), density = Math.max(12, Math.round(radius * 2.6)), op = Math.max(.05, Math.min(1, (+ui.opacity.value || 100) / 100))
  ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(.75, op); ctx.fillStyle = ui.strokeColor.value
  for (let i = 0; i < density; i++) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * radius; ctx.fillRect(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, Math.max(1, radius * .045), Math.max(1, radius * .045)) }
  ctx.restore()
}
function drawInterpolatedLine(ctx, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy); if (dist < .01) return
  const step = Math.max(.65, (+ui.brushSize.value || 8) * .18), steps = Math.max(1, Math.ceil(dist / step)); ctx.beginPath(); ctx.moveTo(from.x, from.y)
  for (let i = 1; i <= steps; i++) { const t = i / steps; ctx.lineTo(from.x + dx * t, from.y + dy * t) }
  ctx.stroke()
}
function drawSmoothBrush(ctx, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy); if (dist < .01) return
  const step = Math.max(.8, (+ui.brushSize.value || 8) * .22), steps = Math.max(1, Math.ceil(dist / step)); ctx.beginPath(); ctx.moveTo(from.x, from.y); let prev = { ...from }
  for (let i = 1; i <= steps; i++) { const t = i / steps, cur = { x: from.x + dx * t, y: from.y + dy * t }, mid = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 }; ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y); prev = cur }
  ctx.lineTo(to.x, to.y); ctx.stroke()
}
function brushDraw(p) {
  const ctx = activeCtx(); if (!ctx) return; style(ctx)
  if (state.tool === 'spray') { const from = state.last || p, dist = Math.hypot(p.x - from.x, p.y - from.y), steps = Math.max(1, Math.ceil(dist / 2.8)); for (let i = 0; i <= steps; i++) { const t = i / steps; sprayPaint(ctx, { x: from.x + (p.x - from.x) * t, y: from.y + (p.y - from.y) * t }) } state.last = p; return }
  const from = state.last || p
  if (!state.hasDrawnStroke) { ctx.save(); style(ctx); ctx.fillStyle = ui.strokeColor.value; stampCircle(ctx, p, Math.max(.7, ctx.lineWidth / 2)); ctx.restore(); state.hasDrawnStroke = true; state.last = p; return }
  if (state.tool === 'pencil' || state.tool === 'eraser') { drawInterpolatedLine(ctx, from, p); state.last = p }
  else { const smooth = (+ui.smoothing.value || 0) / 100; if (smooth > .02) { if (!state.smooth) state.smooth = { ...from }; const target = { x: state.smooth.x + (p.x - state.smooth.x) * (1 - smooth * .45), y: state.smooth.y + (p.y - state.smooth.y) * (1 - smooth * .45) }; drawSmoothBrush(ctx, from, target); state.smooth = target; state.last = target } else { drawSmoothBrush(ctx, from, p); state.last = p } }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
}

function isTypingTarget(target) {
  return !!(
    target &&
    (
      target.closest?.('.text-editor-box') ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    )
  )
}


function canvasPointToStagePixels(p) {
  const stageRect = ui.canvasStage.getBoundingClientRect()
  const stackRect = stackEl.getBoundingClientRect()
  return {
    x: stackRect.left - stageRect.left + p.x * state.zoom,
    y: stackRect.top - stageRect.top + p.y * state.zoom
  }
}

function commitTextEditor(push = true) {
  const box = state.activeTextBox
  if (!box) return false

  const textarea = box.querySelector('textarea')
  const text = (textarea.value || '').trimEnd()

  const x = Number(box.dataset.canvasX) || 0
  const y = Number(box.dataset.canvasY) || 0
  const w = Math.max(20, Number(box.dataset.canvasW) || 160)
  const h = Math.max(20, Number(box.dataset.canvasH) || 42)

  box.remove()
  state.activeTextBox = null

  if (!text.trim()) {
    clearPreview()
    return false
  }

  const ctx = activeCtx()
  if (!ctx) return false

  const fontSize = Math.max(8, Number(ui.fontSize.value) || 48)
  const lineHeight = fontSize * 1.22
  const maxWidth = Math.max(20, w - 10)

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = Math.max(.05, Math.min(1, (Number(ui.opacity.value) || 100) / 100))
  ctx.fillStyle = ui.strokeColor.value
  ctx.font = `850 ${fontSize}px ${ui.fontFamily.value}`
  ctx.textBaseline = 'top'

  const words = text.split(/\s+/)
  const lines = []
  let line = ''

  text.split('\n').forEach(paragraph => {
    const parts = paragraph.split(/\s+/)
    line = ''
    parts.forEach(word => {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    })
    lines.push(line)
  })

  lines.forEach((ln, i) => {
    const yy = y + 5 + i * lineHeight
    if (yy <= y + h + lineHeight) ctx.fillText(ln, x + 6, yy)
  })

  ctx.restore()

  if (push) pushHistory()
  toast('Text qo‘shildi')
  return true
}

function positionTextBox(box) {
  const x = Number(box.dataset.canvasX) || 0
  const y = Number(box.dataset.canvasY) || 0
  const w = Number(box.dataset.canvasW) || 180
  const h = Number(box.dataset.canvasH) || 52
  const pt = canvasPointToStagePixels({ x, y })

  box.style.left = pt.x + 'px'
  box.style.top = pt.y + 'px'
  box.style.width = (w * state.zoom) + 'px'
  box.style.height = (h * state.zoom) + 'px'
  box.style.transform = `scale(1)`

  const textarea = box.querySelector('textarea')
  const fontSize = Math.max(8, Number(ui.fontSize.value) || 48)
  textarea.style.fontSize = (fontSize * state.zoom) + 'px'
  textarea.style.fontFamily = ui.fontFamily.value
  textarea.style.color = ui.strokeColor.value
}

function addText(p) {
  commitTextEditor(false)
  commitSelection(true)

  const box = document.createElement('div')
  box.className = 'text-editor-box'
  box.dataset.canvasX = String(Math.round(p.x))
  box.dataset.canvasY = String(Math.round(p.y))
  box.dataset.canvasW = '220'
  box.dataset.canvasH = String(Math.max(54, Number(ui.fontSize.value) * 1.55))

  box.innerHTML = `
    <textarea spellcheck="false" aria-label="Canvas text"></textarea>
    <i class="text-handle tl"></i><i class="text-handle tm"></i><i class="text-handle tr"></i>
    <i class="text-handle rm"></i><i class="text-handle br"></i><i class="text-handle bm"></i>
    <i class="text-handle bl"></i><i class="text-handle lm"></i>
  `

  ui.canvasStage.appendChild(box)
  state.activeTextBox = box
  positionTextBox(box)

  const textarea = box.querySelector('textarea')
  textarea.value = ui.textValue.value || 'Text'

  requestAnimationFrame(() => {
    textarea.focus()
    textarea.select()
  });

  ['click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'touchstart', 'touchmove', 'touchend'].forEach(evt => {
    box.addEventListener(evt, event => event.stopPropagation(), { passive: false })
  })

  let dragging = false
  let resizing = false
  let sx = 0, sy = 0, startX = 0, startY = 0, startW = 0, startH = 0

  box.addEventListener('pointerdown', event => {
    event.stopPropagation()

    const rect = box.getBoundingClientRect()
    const edge = 14
    const nearRight = event.clientX > rect.right - edge
    const nearBottom = event.clientY > rect.bottom - edge

    if (event.target === textarea && !(nearRight || nearBottom)) return

    sx = event.clientX
    sy = event.clientY
    startX = Number(box.dataset.canvasX) || 0
    startY = Number(box.dataset.canvasY) || 0
    startW = Number(box.dataset.canvasW) || 220
    startH = Number(box.dataset.canvasH) || 54

    resizing = nearRight || nearBottom
    dragging = !resizing

    box.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  })

  box.addEventListener('pointermove', event => {
    if (!dragging && !resizing) return

    const dx = (event.clientX - sx) / state.zoom
    const dy = (event.clientY - sy) / state.zoom

    if (dragging) {
      box.dataset.canvasX = String(Math.max(0, Math.min(state.width - 20, startX + dx)))
      box.dataset.canvasY = String(Math.max(0, Math.min(state.height - 20, startY + dy)))
    }

    if (resizing) {
      box.dataset.canvasW = String(Math.max(80, startW + dx))
      box.dataset.canvasH = String(Math.max(34, startH + dy))
    }

    positionTextBox(box)
    event.preventDefault()
  })

  const stop = event => {
    dragging = false
    resizing = false
    box.releasePointerCapture?.(event.pointerId)
  }
  box.addEventListener('pointerup', stop)
  box.addEventListener('pointercancel', stop)

  textarea.addEventListener('keydown', event => {
    // Text yozish paytida global shortcutlar ishlamasin.
    event.stopPropagation()

    if (event.key === 'Escape') {
      box.remove()
      state.activeTextBox = null
      event.preventDefault()
      return
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      commitTextEditor(true)
      event.preventDefault()
    }
  })

  textarea.addEventListener('keyup', event => event.stopPropagation())
  textarea.addEventListener('keypress', event => event.stopPropagation())
}

function pickColor(p) { const d = composite(true).getContext('2d').getImageData(p.x | 0, p.y | 0, 1, 1).data; ui.strokeColor.value = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''); setTool('brush'); toast('Color picked') }
function hex(hex) { hex = hex.replace('#', ''); return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255] }
function bucket(p) {
  const ctx = activeCtx(); if (!ctx) return; const sx = p.x | 0, sy = p.y | 0; if (sx < 0 || sy < 0 || sx >= state.width || sy >= state.height) return
  const img = ctx.getImageData(0, 0, state.width, state.height), data = img.data, i = (sy * state.width + sx) * 4, target = [data[i], data[i + 1], data[i + 2], data[i + 3]], fill = hex(ui.fillColor.value)
  const tol = 36, match = (idx) => { let dr = data[idx] - target[0], dg = data[idx + 1] - target[1], db = data[idx + 2] - target[2], da = data[idx + 3] - target[3]; return dr * dr + dg * dg + db * db + da * da <= tol * tol }
  if (Math.abs(target[0] - fill[0]) < 3 && Math.abs(target[1] - fill[1]) < 3 && Math.abs(target[2] - fill[2]) < 3 && Math.abs(target[3] - fill[3]) < 3) return
  const visited = new Uint8Array(state.width * state.height), st = [[sx, sy]]; let painted = 0
  while (st.length) { const [x, y] = st.pop(); if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue; const pi = y * state.width + x; if (visited[pi]) continue; visited[pi] = 1; const di = pi * 4; if (!match(di)) continue; data[di] = fill[0]; data[di + 1] = fill[1]; data[di + 2] = fill[2]; data[di + 3] = 255; painted++; st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]) }
  if (painted) { ctx.putImageData(img, 0, 0); pushHistory(); toast('Bucket fill bajarildi') }
}

function isFreeDrawTool() { return drawTools.includes(state.tool) }
function resetPointer() { state.smooth = null; state.hasDrawnStroke = false; state.moveSnapshot = null }
function down(e) {
  if (state.activeTextBox && !e.target.closest?.('.text-editor-box')) commitTextEditor(true)
  e.preventDefault()

  const p = point(e)
  state.start = p
  state.last = p
  state.smooth = { ...p }
  state.hasDrawnStroke = false

  if (state.selection) {
    const h = hitSelectionHandle(p)
    if (h) return beginTransformSelection(p, h)
    if (isInsideSelection(p)) return beginTransformSelection(p, 'move')

    if (!['selectrect', 'selectfree'].includes(state.tool)) {
      commitSelection(true)
      toast('Canvasga joylandi')
      state.isDown = false
      return
    }
  }

  if (state.tool === 'text') return addText(p)
  if (state.tool === 'picker') return pickColor(p)
  if (state.tool === 'bucket') return bucket(p)

  if (state.tool === 'selectrect') {
    cancelSelection()
    state.isDown = true
    return
  }

  if (state.tool === 'selectfree') {
    cancelSelection()
    state.selectFreePoints = [p]
    state.isDown = true
    return
  }

  if (state.tool === 'move') {
    const l = activeLayer()
    if (!l) return
    state.moveSnapshot = document.createElement('canvas')
    state.moveSnapshot.width = state.width
    state.moveSnapshot.height = state.height
    state.moveSnapshot.getContext('2d').drawImage(l.canvas, 0, 0)
    state.moveOffset = p
    state.isDown = true
    return
  }

  if (shapeTools.includes(state.tool)) {
    state.isDown = true
    return
  }

  if (isFreeDrawTool()) {
    state.isDown = true
    brushDraw(p)
    return
  }
}

function move(e) {
  if (!state.isDown) return
  e.preventDefault()

  const p = point(e)

  if (state.transform) {
    updateTransformSelection(p)
    return
  }

  if (state.tool === 'selectrect') {
    clearPreview()
    const r = normalizeRect(state.start, p)
    drawSelectionFrame(r.x, r.y, r.w, r.h)
    state.last = p
    return
  }

  if (state.tool === 'selectfree') {
    const last = state.selectFreePoints.at(-1)
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2) {
      state.selectFreePoints.push(p)
    }

    clearPreview()
    pctx.save()
    pctx.setLineDash([6, 4])
    pctx.lineWidth = 1.5
    pctx.strokeStyle = '#2563eb'
    pctx.beginPath()
    state.selectFreePoints.forEach((pt, i) => {
      if (i === 0) pctx.moveTo(pt.x, pt.y)
      else pctx.lineTo(pt.x, pt.y)
    })
    pctx.stroke()
    pctx.restore()

    state.last = p
    return
  }

  if (state.tool === 'move') {
    const l = activeLayer()
    if (!l || !state.moveSnapshot) return
    const ctx = l.canvas.getContext('2d')
    const dx = p.x - state.moveOffset.x
    const dy = p.y - state.moveOffset.y

    ctx.clearRect(0, 0, state.width, state.height)
    ctx.drawImage(state.moveSnapshot, dx, dy)

    state.last = p
    return
  }

  if (shapeTools.includes(state.tool)) {
    clearPreview()
    drawShape(pctx, state.tool, state.start, p)
    state.last = p
    return
  }

  if (isFreeDrawTool()) {
    brushDraw(p)
  }
}

function up() {
  if (!state.isDown) return
  state.isDown = false

  if (state.transform) {
    endTransformSelection()
    resetPointer()
    return
  }

  if (state.tool === 'selectrect') {
    const r = normalizeRect(state.start, state.last || state.start)
    clearPreview()
    if (makeRectSelection(r)) setTool('move')
    resetPointer()
    return
  }

  if (state.tool === 'selectfree') {
    clearPreview()
    if (makeFreeSelection(state.selectFreePoints)) setTool('move')
    state.selectFreePoints = []
    resetPointer()
    return
  }

  if (state.tool === 'move') {
    resetPointer()
    pushHistory()
    return
  }

  if (shapeTools.includes(state.tool)) {
    const made = makeShapeTransformSelection(state.tool, state.start, state.last || state.start)
    clearPreview()
    renderSelection()
    resetPointer()

    if (made) {
      setTool('move')
      toast('Shakl tayyor: resize / rotate mumkin')
    }
    return
  }

  if (isFreeDrawTool()) {
    resetPointer()
    pushHistory()
    return
  }

  resetPointer()
}

function setZoom(v) { state.zoom = Math.max(.2, Math.min(2.5, v)); stackEl.style.transform = `scale(${state.zoom})`; updateViewport(); if (state.activeTextBox) positionTextBox(state.activeTextBox); updateStatus() }
function fit() { const r = ui.canvasStage.getBoundingClientRect(); setZoom(Math.min((r.width - 48) / state.width, (r.height - 48) / state.height, 1)) }
function paintRangeProgress(input) {
  if (!input) return
  const min = Number(input.min) || 0
  const max = Number(input.max) || 100
  const val = Number(input.value) || 0
  const pct = Math.max(0, Math.min(1, (val - min) / (max - min)))
  input.style.setProperty('--pct', (pct * 100) + '%')
  input.parentElement?.style.setProperty('--pct', pct)
}
function syncStrokeControls(source) {
  if (source === 'railSize') ui.brushSize.value = ui.railBrushSize.value; if (source === 'panelSize') ui.railBrushSize.value = ui.brushSize.value; if (source === 'railOpacity') ui.opacity.value = ui.railOpacity.value; if (source === 'panelOpacity') ui.railOpacity.value = ui.opacity.value
  ui.brushSizeValue.textContent = ui.brushSize.value + 'px'; ui.railBrushSizeValue.textContent = ui.railBrushSize.value; ui.opacityValue.textContent = ui.opacity.value + '%'; ui.railOpacityValue.textContent = ui.railOpacity.value; ui.smoothingValue.textContent = ui.smoothing.value + '%';
  [ui.brushSize, ui.opacity, ui.railBrushSize, ui.railOpacity, ui.smoothing].forEach(paintRangeProgress)
}
function exportImg(type) { const a = document.createElement('a'), ext = type === 'image/jpeg' ? 'jpg' : 'png'; a.download = fileName(activeLayer()?.name || 'AuraDraw') + '.' + ext; a.href = composite(true).toDataURL(type, .95); a.click() }
function printCanvas() { const box = document.getElementById('printOnlyCanvas') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'printOnlyCanvas' })); box.innerHTML = `<img src="${composite(true).toDataURL()}">`; setTimeout(() => print(), 80) }
function importImage(file) {
  if (!file?.type.startsWith('image/')) return

  const rd = new FileReader()

  rd.onload = () => {
    const img = new Image()

    img.onload = () => {
      commitTextEditor(false)
      commitSelection(true)

      const scale = Math.min(state.width * .82 / img.width, state.height * .82 / img.height, 1)
      const w = Math.max(20, img.width * scale)
      const h = Math.max(20, img.height * scale)

      const temp = document.createElement('canvas')
      temp.width = Math.ceil(w)
      temp.height = Math.ceil(h)

      const tctx = temp.getContext('2d', { willReadFrequently: true })
      tctx.clearRect(0, 0, temp.width, temp.height)
      tctx.drawImage(img, 0, 0, temp.width, temp.height)

      state.selection = {
        type: 'image',
        x: Math.round((state.width - temp.width) / 2),
        y: Math.round((state.height - temp.height) / 2),
        w: temp.width,
        h: temp.height,
        canvas: temp,
        rotation: 0
      }

      setTool('move')
      renderSelection()
      scheduleAutosave()
      toast('Rasm import qilindi: move / resize / rotate mumkin')
    }

    img.src = rd.result
  }

  rd.readAsDataURL(file)
}

function deleteCurrentSelectionOnly() {
  if (!state.selection) return false

  // Rectangle/free selections were already cut from layer into preview.
  // Deleting means we simply discard the floating selection.
  state.selection = null
  state.transform = null
  clearPreview()
  pushHistory()
  toast('Tanlangan qism o‘chirildi')
  return true
}


function cropCanvasToSelection() {
  const s = state.selection
  if (!s) {
    toast('Crop uchun selection tanlang')
    return false
  }

  const cropX = Math.max(0, Math.round(s.x))
  const cropY = Math.max(0, Math.round(s.y))
  const cropW = Math.max(20, Math.min(state.width - cropX, Math.round(s.w)))
  const cropH = Math.max(20, Math.min(state.height - cropY, Math.round(s.h)))

  commitSelection(true)

  const snapshots = state.layers.map(layer => {
    const snap = document.createElement('canvas')
    snap.width = cropW
    snap.height = cropH
    snap.getContext('2d', { willReadFrequently: true }).drawImage(layer.canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
    return { layer, snap }
  })

  state.width = cropW
  state.height = cropH
  sizeStatic()

  snapshots.forEach(({ layer, snap }) => {
    const fresh = createCanvas()
    fresh.getContext('2d', { willReadFrequently: true }).drawImage(snap, 0, 0)
    layer.canvas.replaceWith(fresh)
    layer.canvas = fresh
  })

  refreshLayers()
  renderLayers()
  updateStatus()
  updateViewport()
  pushHistory()
  toast(`Crop: ${state.width} × ${state.height}`)
  return true
}


function requestDelete() {
  if (state.selection) {
    openConfirmModal({
      title: 'Tanlangan qismni o‘chirish',
      text: 'Faqat selection ichidagi qism o‘chiriladi. Barcha layer emas.',
      yesText: 'Tanlangan qismni o‘chirish',
      onYes: deleteCurrentSelectionOnly
    })
    return
  }

  openConfirmModal({
    title: 'Active layerni tozalash',
    text: 'Selection yo‘q. Active layerdagi barcha chizmalarni o‘chirmoqchimisiz?',
    yesText: 'Layerni tozalash',
    onYes: () => {
      const ctx = activeCtx()
      if (!ctx) return
      ctx.clearRect(0, 0, state.width, state.height)
      pushHistory()
      toast('Active layer tozalandi')
    }
  })
}



function openConfirmModal({ title = 'Tanlangan qismni o‘chirish', text = 'Faqat selection ichidagi qism o‘chiriladi. Barcha layer emas.', yesText = 'Tanlangan qismni o‘chirish', onYes } = {}) {
  if (!ui.confirmModal) {
    if (typeof onYes === 'function') onYes()
    return
  }

  ui.confirmTitle.textContent = title
  ui.confirmText.textContent = text
  ui.confirmYesBtn.innerHTML = `<i class="bi bi-trash3"></i> ${yesText}`

  ui.confirmModal.classList.add('show')
  ui.confirmModal.setAttribute('aria-hidden', 'false')

  const close = () => {
    ui.confirmModal.classList.remove('show')
    ui.confirmModal.setAttribute('aria-hidden', 'true')
    ui.confirmYesBtn.onclick = null
  }

  ui.confirmCloseBtn.onclick = close
  ui.confirmNoBtn.onclick = close
  ui.confirmModal.onclick = (event) => {
    if (event.target === ui.confirmModal) close()
  }
  ui.confirmYesBtn.onclick = () => {
    close()
    if (typeof onYes === 'function') onYes()
  }
}

function deleteCurrentSelectionOnly() {
  if (!state.selection) return false

  // Selection oldindan layerdan kesib previewga chiqarilgan.
  // O‘chirish — previewdagi floating selectionni tashlab yuborish.
  state.selection = null
  state.transform = null
  clearPreview()
  pushHistory()
  toast('Tanlangan qism o‘chirildi')
  return true
}

function requestDelete() {
  if (state.selection) {
    openConfirmModal({
      title: 'Tanlangan qismni o‘chirish',
      text: 'Faqat selection ichidagi qism o‘chiriladi. Barcha layer emas.',
      yesText: 'Tanlangan qismni o‘chirish',
      onYes: deleteCurrentSelectionOnly
    })
    return
  }

  openConfirmModal({
    title: 'Active layerni tozalash',
    text: 'Selection yo‘q. Active layerdagi barcha chizmalarni o‘chirmoqchimisiz?',
    yesText: 'Layerni tozalash',
    onYes: () => {
      const ctx = activeCtx()
      if (!ctx) return
      ctx.clearRect(0, 0, state.width, state.height)
      pushHistory()
      toast('Active layer tozalandi')
    }
  })
}


function clearActive() { requestDelete() }


function resizeSelectionByWheel(delta, keepAspect = false) {
  const s = state.selection
  if (!s) return false

  const c = selectionCenter(s)
  const factor = delta < 0 ? 1.06 : .94
  const minSize = s.type === 'shape' ? Math.max(42, (s.strokeWidth || 1) * 8) : 18

  let nextW = Math.max(minSize, s.w * factor)
  let nextH = Math.max(minSize, s.h * (keepAspect ? factor : factor))

  s.w = Math.round(nextW)
  s.h = Math.round(nextH)
  s.x = Math.round(c.x - s.w / 2)
  s.y = Math.round(c.y - s.h / 2)

  renderSelection()
  scheduleAutosave()
  return true
}

function rotateSelectionByWheel(delta) {
  const s = state.selection
  if (!s) return false
  s.rotation = (s.rotation || 0) + (delta < 0 ? -Math.PI / 90 : Math.PI / 90)
  renderSelection()
  scheduleAutosave()
  return true
}

function handleCanvasWheel(e) {
  if (e.target.closest?.('.stroke-dock')) return

  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    setZoom(state.zoom + (e.deltaY < 0 ? .08 : -.08))
    return
  }

  // Shift + wheel = chiziq qalinligi, Alt + wheel = shaffoflik.
  if (!state.selection) {
    if (e.shiftKey) {
      e.preventDefault()
      adjustBrushByWheel(e.deltaY)
      return
    }
    if (e.altKey) {
      e.preventDefault()
      adjustOpacityByWheel(e.deltaY)
      return
    }
    return
  }

  const p = point(e)
  const overSelection = hitSelectionHandle(p) || isInsideSelection(p)

  if (!overSelection) {
    if (e.shiftKey) {
      e.preventDefault()
      adjustBrushByWheel(e.deltaY)
      return
    }
    if (e.altKey) {
      e.preventDefault()
      adjustOpacityByWheel(e.deltaY)
      return
    }
    return
  }

  e.preventDefault()

  if (e.shiftKey) {
    rotateSelectionByWheel(e.deltaY)
  } else if (e.altKey) {
    adjustOpacityByWheel(e.deltaY)
  } else {
    resizeSelectionByWheel(e.deltaY, true)
  }
}



function resizeCanvasWithShift(nextW, nextH, shiftX = 0, shiftY = 0, record = false) {
  nextW = Math.max(240, Math.min(5000, Math.round(nextW)))
  nextH = Math.max(180, Math.min(5000, Math.round(nextH)))
  shiftX = Math.round(shiftX || 0)
  shiftY = Math.round(shiftY || 0)

  if (nextW === state.width && nextH === state.height && !shiftX && !shiftY) return false

  commitTextEditor(false)
  commitSelection(false)

  const snapshots = state.layers.map(layer => {
    const snap = document.createElement('canvas')
    snap.width = state.width
    snap.height = state.height
    snap.getContext('2d').drawImage(layer.canvas, 0, 0)
    return { layer, snap }
  })

  state.width = nextW
  state.height = nextH
  sizeStatic()

  snapshots.forEach(({ layer, snap }) => {
    const fresh = createCanvas()
    const ctx = fresh.getContext('2d', { willReadFrequently: true })
    ctx.clearRect(0, 0, state.width, state.height)
    ctx.drawImage(snap, shiftX, shiftY)
    layer.canvas.replaceWith(fresh)
    layer.canvas = fresh
  })

  refreshLayers()
  renderLayers()
  updateStatus()
  updateViewport()

  if (record) pushHistory()
  else scheduleAutosave()

  return true
}

function enableLayerResizeHandles() {
  const handles = stackEl.querySelectorAll('[data-layer-resize]')
  let resizing = false
  let mode = ''
  let sx = 0
  let sy = 0
  let startW = 0
  let startH = 0
  let changed = false

  handles.forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      event.preventDefault()
      event.stopPropagation()

      resizing = true
      mode = handle.dataset.layerResize
      sx = event.clientX
      sy = event.clientY
      startW = state.width
      startH = state.height
      changed = false

      document.body.style.userSelect = 'none'
      handle.setPointerCapture?.(event.pointerId)
    })

    handle.addEventListener('pointermove', event => {
      if (!resizing) return

      event.preventDefault()
      event.stopPropagation()

      const dx = (event.clientX - sx) / state.zoom
      const dy = (event.clientY - sy) / state.zoom

      const left = mode.includes('l')
      const right = mode.includes('r')
      const top = mode.includes('t')
      const bottom = mode.includes('b')

      let nextW = startW
      let nextH = startH

      if (right) nextW = startW + dx
      if (left) nextW = startW - dx
      if (bottom) nextH = startH + dy
      if (top) nextH = startH - dy

      const clampedW = Math.max(240, Math.min(5000, Math.round(nextW)))
      const clampedH = Math.max(180, Math.min(5000, Math.round(nextH)))

      const shiftX = left ? clampedW - startW : 0
      const shiftY = top ? clampedH - startH : 0

      changed = resizeCanvasWithShift(clampedW, clampedH, shiftX, shiftY, false) || changed
    })

    const stop = event => {
      if (!resizing) return

      resizing = false
      document.body.style.userSelect = ''
      handle.releasePointerCapture?.(event.pointerId)

      if (changed) {
        pushHistory()
        toast(`Layer: ${state.width} × ${state.height}`)
      }
    }

    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  })
}



function setControlsOpen(open) {
  ui.panel.classList.toggle('open', open)
  ui.panelBackdrop?.classList.toggle('show', open)
  ui.panelToggleBtn?.classList.toggle('active', open)
}

function toggleControls() {
  setControlsOpen(!ui.panel.classList.contains('open'))
}



function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function setRangeValue(input, value, source) {
  if (!input) return
  input.value = String(clampNumber(Math.round(value), Number(input.min) || 0, Number(input.max) || 100))

  if (input === ui.railBrushSize || input === ui.brushSize) {
    syncStrokeControls(source || (input === ui.railBrushSize ? 'railSize' : 'panelSize'))
    toast(`Qalinlik: ${ui.brushSize.value}`)
    return
  }

  if (input === ui.railOpacity || input === ui.opacity) {
    syncStrokeControls(source || (input === ui.railOpacity ? 'railOpacity' : 'panelOpacity'))
    toast(`Shaffoflik: ${ui.opacity.value}%`)
    return
  }

  paintRangeProgress(input)
}

function adjustBrushByWheel(delta) {
  const step = Math.abs(delta) > 80 ? 2 : 1
  const next = Number(ui.railBrushSize.value || ui.brushSize.value || 8) + (delta < 0 ? step : -step)
  setRangeValue(ui.railBrushSize, next, 'railSize')
}

function adjustOpacityByWheel(delta) {
  const step = Math.abs(delta) > 80 ? 5 : 2
  const next = Number(ui.railOpacity.value || ui.opacity.value || 100) + (delta < 0 ? step : -step)
  setRangeValue(ui.railOpacity, next, 'railOpacity')
}

function bindWheelRange(input, source) {
  if (!input) return
  input.addEventListener('wheel', event => {
    event.preventDefault()
    event.stopPropagation()
    const isOpacity = input.id.toLowerCase().includes('opacity')
    const step = isOpacity ? (Math.abs(event.deltaY) > 80 ? 5 : 2) : (Math.abs(event.deltaY) > 80 ? 2 : 1)
    const next = Number(input.value || 0) + (event.deltaY < 0 ? step : -step)
    setRangeValue(input, next, source)
  }, { passive: false })
}



function createCleanLayerUniversal() {
  commitTextEditor(false)
  if (state.selection) commitSelection(true)
  const layer = addLayer(`Layer ${state.layers.length + 1}`, true, true)
  const ctx = layer.canvas.getContext('2d', { willReadFrequently: true })
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, state.width, state.height)
  refreshLayers()
  renderLayers()
  updateStatus()
  toast('Yangi toza layer qo‘shildi')
}

function copyActiveLayerUniversal() {
  commitTextEditor(false)
  if (state.selection) commitSelection(true)

  const current = activeLayer()
  if (!current) return

  const layer = addLayer(`${current.name || 'Layer'} copy`, true, false)
  const ctx = layer.canvas.getContext('2d', { willReadFrequently: true })
  ctx.clearRect(0, 0, state.width, state.height)
  ctx.drawImage(current.canvas, 0, 0)

  refreshLayers()
  renderLayers()
  updateStatus()
  pushHistory()
  toast('Layer nusxa olindi')
}



function rotateActiveByAngle(angle) {
  commitTextEditor(false)
  const rad = angle * Math.PI / 180

  if (state.selection) {
    const s = state.selection
    if (s.type === 'shape') {
      s.rotation = (s.rotation || 0) + rad
      renderSelection()
      pushHistory()
      toast(`Selection ${angle}° rotate qilindi`)
      return true
    }

    if (s.canvas) {
      const src = s.canvas
      const swap = Math.abs(angle) % 180 === 90
      const out = document.createElement('canvas')
      out.width = swap ? src.height : src.width
      out.height = swap ? src.width : src.height
      const octx = out.getContext('2d', { willReadFrequently: true })
      octx.save()
      octx.translate(out.width / 2, out.height / 2)
      octx.rotate(rad)
      octx.drawImage(src, -src.width / 2, -src.height / 2)
      octx.restore()
      const cx = s.x + s.w / 2
      const cy = s.y + s.h / 2
      s.canvas = out
      s.w = out.width
      s.h = out.height
      s.x = Math.round(cx - s.w / 2)
      s.y = Math.round(cy - s.h / 2)
      s.rotation = 0
      renderSelection()
      pushHistory()
      toast(`Selection ${angle}° rotate qilindi`)
      return true
    }
  }

  const layer = activeLayer()
  if (!layer) return false
  const src = document.createElement('canvas')
  src.width = state.width
  src.height = state.height
  src.getContext('2d', { willReadFrequently: true }).drawImage(layer.canvas, 0, 0)
  const ctx = layer.canvas.getContext('2d', { willReadFrequently: true })
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, state.width, state.height)
  ctx.translate(state.width / 2, state.height / 2)
  ctx.rotate(rad)
  ctx.drawImage(src, -state.width / 2, -state.height / 2)
  ctx.restore()
  pushHistory()
  scheduleAutosave()
  toast(`Layer ${angle}° rotate qilindi`)
  return true
}

function bindStrictTransformTools() {
  const actions = [
    ['rotateRightBtn', () => rotateActiveByAngle(90)],
    ['rotateLeftBtn', () => rotateActiveByAngle(-90)],
    ['rotate180Btn', () => rotateActiveByAngle(180)],
    ['mirrorYBtn', () => mirror('y')],
    ['mirrorXBtn', () => mirror('x')]
  ]
  actions.forEach(([id, fn]) => {
    const btn = document.getElementById(id)
    if (!btn || btn.dataset.strictTransformBound === 'true') return
    btn.dataset.strictTransformBound = 'true'
    btn.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      fn()
    })
  })
}

// Barcha tugma, input va canvas eventlarini ulash
function bind() {
  document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool))
  document.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => { document.querySelectorAll('.tab-btn').forEach(x => x.classList.toggle('active', x === b)); document.querySelectorAll('.tab-content').forEach(x => x.classList.toggle('active', x.id === 'tab-' + b.dataset.tab)) })
  ui.panelToggleBtn.onclick = toggleControls; ui.openPanelBtn.onclick = () => setControlsOpen(true); ui.closePanelBtn.onclick = () => setControlsOpen(false); if (ui.panelBackdrop) ui.panelBackdrop.onclick = () => setControlsOpen(false)

  if (ui.guideBtn) ui.guideBtn.onclick = () => ui.guideModal?.classList.add('show')
  if (ui.guideCloseBtn) ui.guideCloseBtn.onclick = () => ui.guideModal?.classList.remove('show')
  if (ui.guideModal) ui.guideModal.onclick = event => { if (event.target === ui.guideModal) ui.guideModal.classList.remove('show') }

  ui.darkModeBtn.onclick = () => { document.body.classList.toggle('dark'); localStorage.setItem('auradraw.theme', document.body.classList.contains('dark') ? 'dark' : 'light') }
  ui.printBtn.onclick = printCanvas; ui.copyPngBtn.onclick = () => composite(true).toBlob(async b => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('PNG copied') } catch { exportImg('image/png') } })
  bindStrictTransformTools(); ui.undoBtn.onclick = undo; ui.redoBtn.onclick = redo; ui.clearBtn.onclick = clearActive; ui.selectAllBtn.onclick = selectAll
  ui.selectRectPanelBtn.onclick = () => setTool('selectrect'); ui.selectFreePanelBtn.onclick = () => setTool('selectfree'); ui.selectAllPanelBtn.onclick = selectAll
  ui.saveBtn.onclick = () => { commitTextEditor(false); commitSelection(false); localStorage.setItem('auradraw.manual', JSON.stringify(serialize())); toast('Saved') }
  ui.loadBtn.onclick = () => { const d = localStorage.getItem('auradraw.manual') || localStorage.getItem('auradraw.autosave'); if (d) restore(JSON.parse(d), () => { pushHistory(); toast('Loaded') }); else toast('No saved canvas') }
  ui.exportPngBtn.onclick = () => exportImg('image/png'); ui.exportJpgBtn.onclick = () => exportImg('image/jpeg')
  ui.zoomInBtn.onclick = () => setZoom(state.zoom + .1); ui.zoomOutBtn.onclick = () => setZoom(state.zoom - .1); ui.fitBtn.onclick = fit
  ui.railBrushSize.onpointerdown = e => e.stopPropagation(); ui.railOpacity.onpointerdown = e => e.stopPropagation()
  bindWheelRange(ui.railBrushSize, 'railSize'); bindWheelRange(ui.railOpacity, 'railOpacity'); bindWheelRange(ui.brushSize, 'panelSize'); bindWheelRange(ui.opacity, 'panelOpacity')
  ui.strokeColor.oninput = () => { if (state.activeTextBox) positionTextBox(state.activeTextBox) }; ui.fontSize.oninput = () => { if (state.activeTextBox) positionTextBox(state.activeTextBox) }; ui.fontFamily.onchange = () => { if (state.activeTextBox) positionTextBox(state.activeTextBox) }
  ui.brushSize.oninput = () => syncStrokeControls('panelSize'); ui.opacity.oninput = () => syncStrokeControls('panelOpacity'); ui.smoothing.oninput = () => syncStrokeControls(); ui.railBrushSize.oninput = () => syncStrokeControls('railSize'); ui.railOpacity.oninput = () => syncStrokeControls('railOpacity')
  ui.bgColor.oninput = () => { state.bg = ui.bgColor.value; stackEl.style.background = state.bg; scheduleAutosave() }
  ui.presetSelect.onchange = () => { const [w, h] = ui.presetSelect.value.split('x').map(Number); resizeCanvas(w, h) }


  if (ui.quickAddLayerBtn) ui.quickAddLayerBtn.onclick = createCleanLayerUniversal
  if (ui.addLayerBtn) ui.addLayerBtn.onclick = createCleanLayerUniversal
  if (ui.duplicateLayerBtn) ui.duplicateLayerBtn.onclick = copyActiveLayerUniversal

  ui.layerOpacity.oninput = () => { const l = activeLayer(); if (!l) return; l.opacity = +ui.layerOpacity.value / 100; l.canvas.style.opacity = l.opacity; ui.layerOpacityValue.textContent = ui.layerOpacity.value + '%'; scheduleAutosave() }
  ui.renameCloseBtn.onclick = () => closeRename(false); ui.renameCancelBtn.onclick = () => closeRename(false); ui.renameSaveBtn.onclick = () => closeRename(true); ui.renameLayerInput.oninput = () => state.renameLayerId && renameLayer(state.renameLayerId, ui.renameLayerInput.value)
  ui.imageInput.onchange = e => { importImage(e.target.files[0]); e.target.value = '' }
  if (window.PointerEvent) { stackEl.addEventListener('pointerdown', e => { if (e.button !== undefined && e.button !== 0) return; stackEl.setPointerCapture?.(e.pointerId); down(e) }); stackEl.addEventListener('pointermove', move); stackEl.addEventListener('pointerup', e => { stackEl.releasePointerCapture?.(e.pointerId); up() }); stackEl.addEventListener('pointercancel', e => { stackEl.releasePointerCapture?.(e.pointerId); up() }) }
  else { stackEl.addEventListener('mousedown', down); stackEl.addEventListener('mousemove', move); addEventListener('mouseup', up); stackEl.addEventListener('touchstart', down, { passive: false }); stackEl.addEventListener('touchmove', move, { passive: false }); addEventListener('touchend', up) }
  ui.canvasStage.addEventListener('wheel', handleCanvasWheel, { passive: false })
  ui.dropZone.ondragover = e => e.preventDefault(); ui.dropZone.ondrop = e => { e.preventDefault(); importImage(e.dataTransfer.files[0]) }
  addEventListener('resize', () => setTimeout(() => { updateViewport(); if (innerWidth < 980) fit() }, 120))

  document.addEventListener('pointerdown', event => {
    if (!ui.panel.classList.contains('open')) return
    const insidePanel = event.target.closest?.('#settingsPanel')
    const panelButton = event.target.closest?.('#panelToggleBtn,#openPanelBtn')
    if (!insidePanel && !panelButton) setControlsOpen(false)
  }, true)

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') { e.preventDefault(); cropCanvasToSelection(); return }
    if (isTypingTarget(e.target)) {
      return
    }
    const k = e.key.toLowerCase(); if (e.ctrlKey && k === 'a') { e.preventDefault(); selectAll() } else if (e.ctrlKey && k === 'z') { e.preventDefault(); undo() } else if (e.ctrlKey && k === 'y') { e.preventDefault(); redo() } else if (e.ctrlKey && k === 'p') { e.preventDefault(); printCanvas() } else if (k === 'b') setTool('brush'); else if (k === 'p') setTool('pencil'); else if (k === 'h') setTool('marker'); else if (k === 's') setTool('spray'); else if (k === 'e') setTool('eraser'); else if (k === 'm') setTool('move'); else if (k === 'l') setTool('line'); else if (k === 'r') setTool('rect'); else if (k === 'c') setTool('circle'); else if (k === 't') setTool('text'); else if (k === 'enter') { if (state.activeTextBox) commitTextEditor(true); else commitSelection(true) } else if (k === 'escape') { ui.confirmModal?.classList.remove('show'); ui.guideModal?.classList.remove('show'); ui.confirmModal?.classList.remove('show'); if (state.activeTextBox) { state.activeTextBox.remove(); state.activeTextBox = null } else cancelSelection() } else if (k === 'delete') clearActive()
  })
}
function resizeCanvas(w, h, record = true) {
  w = Math.round(w); h = Math.round(h); const snaps = state.layers.map(l => { const c = document.createElement('canvas'); c.width = state.width; c.height = state.height; c.getContext('2d').drawImage(l.canvas, 0, 0); return { l, c } })
  state.width = w; state.height = h; sizeStatic(); snaps.forEach(({ l, c }) => { const n = createCanvas(); n.getContext('2d').drawImage(c, 0, 0); l.canvas.replaceWith(n); l.canvas = n }); refreshLayers(); renderLayers(); updateStatus(); if (record) pushHistory()
}

function updatePaintColorUI(active = 'stroke') {
  if (!ui.colorOnePreview || !ui.colorTwoPreview) return

  ui.colorOnePreview.style.background = ui.strokeColor.value
  ui.colorTwoPreview.style.background = ui.fillColor.value
  ui.colorOneCard?.classList.toggle('active', active === 'stroke')
  ui.colorTwoCard?.classList.toggle('active', active === 'fill')
}

function initPaintPalette() {
  if (!ui.paintPalette) return

  const colors = [
    '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
    '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
    '#f8fafc', '#e5e7eb', '#d1d5db', '#cbd5e1', '#f1f5f9', '#e2e8f0', '#f8fafc', '#f8fafc', '#f8fafc', '#f8fafc'
  ]

  let activeTarget = 'stroke'
  ui.paintPalette.innerHTML = ''

  const setColor = (color) => {
    if (activeTarget === 'stroke') ui.strokeColor.value = color
    else ui.fillColor.value = color
    updatePaintColorUI(activeTarget)
  }

  colors.forEach(color => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'paint-swatch'
    btn.style.background = color
    btn.title = color
    btn.addEventListener('click', () => setColor(color))
    ui.paintPalette.appendChild(btn)
  })

  ui.colorOneCard?.addEventListener('click', () => {
    activeTarget = 'stroke'
    updatePaintColorUI('stroke')
  })

  ui.colorTwoCard?.addEventListener('click', () => {
    activeTarget = 'fill'
    updatePaintColorUI('fill')
  })

  ui.paintCustomColor?.addEventListener('input', () => {
    setColor(ui.paintCustomColor.value)
  })

  ui.paintCustomColor?.parentElement?.addEventListener('click', () => {
    ui.paintCustomColor.click()
  })

  ui.swapColorsBtn?.addEventListener('click', () => {
    const a = ui.strokeColor.value
    ui.strokeColor.value = ui.fillColor.value
    ui.fillColor.value = a
    updatePaintColorUI(activeTarget)
  })

  ui.strokeColor.addEventListener('input', () => updatePaintColorUI(activeTarget))
  ui.fillColor.addEventListener('input', () => updatePaintColorUI(activeTarget))

  updatePaintColorUI(activeTarget)
}





function syncPaintColorCssVars() {
  document.documentElement.style.setProperty('--stroke-live', ui.strokeColor?.value || '#111827')
  document.documentElement.style.setProperty('--fill-live', ui.fillColor?.value || '#ffffff')
}

function updateTopPaintColorUI(active = state.activeColorTarget || 'stroke') {
  state.activeColorTarget = active

  const stroke = ui.strokeColor.value
  const fill = ui.fillColor.value

  if (ui.topColorOnePreview) ui.topColorOnePreview.style.background = stroke
  if (ui.topColorTwoPreview) ui.topColorTwoPreview.style.background = fill

  ui.topColorOneCard?.classList.toggle('active', active === 'stroke')
  ui.topColorTwoCard?.classList.toggle('active', active === 'fill')

  if (ui.colorOnePreview) ui.colorOnePreview.style.background = stroke
  if (ui.colorTwoPreview) ui.colorTwoPreview.style.background = fill
  ui.colorOneCard?.classList.toggle('active', active === 'stroke')
  ui.colorTwoCard?.classList.toggle('active', active === 'fill')

  if (ui.paintCustomColor) ui.paintCustomColor.value = active === 'stroke' ? stroke : fill
  if (ui.topPaintCustomColor) ui.topPaintCustomColor.value = active === 'stroke' ? stroke : fill

  document.querySelectorAll('.top-swatch,.paint-swatch').forEach(btn => {
    const color = (btn.dataset.color || '').toLowerCase()
    const current = (active === 'stroke' ? stroke : fill).toLowerCase()
    btn.classList.toggle('active', color === current)
  })
  syncPaintColorCssVars()
}

function setActivePaintColor(color, target = state.activeColorTarget || 'stroke') {
  const normalized = String(color || '').trim()
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) return

  if (target === 'stroke') {
    ui.strokeColor.value = normalized
  } else {
    ui.fillColor.value = normalized
  }

  updateTopPaintColorUI(target); syncPaintColorCssVars()
}

function initTopPaintPalette() {
  if (!ui.topPaintPalette) return

  const colors = [
    '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
    '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
    '#f8fafc', '#e5e7eb', '#d1d5db', '#cbd5e1', '#f1f5f9', '#e2e8f0', '#ffffff', '#ffffff', '#ffffff', '#ffffff'
  ]

  ui.topPaintPalette.innerHTML = ''

  colors.forEach(color => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'top-swatch'
    btn.dataset.color = color
    btn.style.setProperty('--swatch-color', color)
    btn.style.backgroundColor = color
    btn.title = color

    btn.addEventListener('click', () => setActivePaintColor(color, state.activeColorTarget || 'stroke'))

    // Windows Paintga yaqin: o‘ng click bilan Color 2/Fill tanlanadi.
    btn.addEventListener('contextmenu', event => {
      event.preventDefault()
      setActivePaintColor(color, 'fill')
    })

    ui.topPaintPalette.appendChild(btn)
  })

  ui.topColorOneCard?.addEventListener('click', () => {
    state.activeColorTarget = 'stroke'
    updateTopPaintColorUI('stroke')
  })

  ui.topColorTwoCard?.addEventListener('click', () => {
    state.activeColorTarget = 'fill'
    updateTopPaintColorUI('fill')
  })

  ui.topPaintCustomColor?.addEventListener('input', () => {
    setActivePaintColor(ui.topPaintCustomColor.value, state.activeColorTarget || 'stroke')
  })

  ui.topPaintCustomColor?.parentElement?.addEventListener('click', () => {
    ui.topPaintCustomColor.click()
  })

  // Controls ichidagi eski rang inputlari bilan ham to‘liq sinxron.
  ui.strokeColor.addEventListener('input', () => updateTopPaintColorUI('stroke'))
  ui.fillColor.addEventListener('input', () => updateTopPaintColorUI('fill'))

  updateTopPaintColorUI(state.activeColorTarget || 'stroke')
}



function forceSyncAllColorPanels(activeTarget) {
  const target = activeTarget || state.activeColorTarget || 'stroke'
  state.activeColorTarget = target

  const stroke = ui.strokeColor?.value || '#111827'
  const fill = ui.fillColor?.value || '#2563eb'

  // Top JPG-side previews
  const topStroke = document.getElementById('topColorOnePreview')
  const topFill = document.getElementById('topColorTwoPreview')
  if (topStroke) topStroke.style.background = stroke
  if (topFill) topFill.style.background = fill

  // Controls panel previews
  const controlStroke = document.getElementById('colorOnePreview')
  const controlFill = document.getElementById('colorTwoPreview')
  if (controlStroke) controlStroke.style.background = stroke
  if (controlFill) controlFill.style.background = fill

  // Active state
  document.getElementById('topColorOneCard')?.classList.toggle('active', target === 'stroke')
  document.getElementById('topColorTwoCard')?.classList.toggle('active', target === 'fill')
  document.getElementById('colorOneCard')?.classList.toggle('active', target === 'stroke')
  document.getElementById('colorTwoCard')?.classList.toggle('active', target === 'fill')

  // Native color inputs
  const customTop = document.getElementById('topPaintCustomColor')
  const customControls = document.getElementById('paintCustomColor')
  if (customTop) customTop.value = target === 'stroke' ? stroke : fill
  if (customControls) customControls.value = target === 'stroke' ? stroke : fill

  // CSS live variables
  document.documentElement.style.setProperty('--stroke-live', stroke)
  document.documentElement.style.setProperty('--fill-live', fill)

  // Highlight selected swatch in both palettes
  document.querySelectorAll('.top-swatch,.paint-swatch').forEach(btn => {
    const color = (btn.dataset.color || btn.title || '').toLowerCase()
    const current = (target === 'stroke' ? stroke : fill).toLowerCase()
    btn.classList.toggle('active', color === current)
  })
}

function setAuraColorFromAnyPalette(color, target) {
  if (!/^#[0-9a-f]{6}$/i.test(String(color || ''))) return
  const active = target || state.activeColorTarget || 'stroke'

  if (active === 'stroke') {
    ui.strokeColor.value = color
  } else {
    ui.fillColor.value = color
  }

  forceSyncAllColorPanels(active)
}


function normalizeTopSwatchColors() {
  document.querySelectorAll('#topPaintPalette .top-swatch').forEach(btn => {
    const bg = btn.dataset.color || btn.title || btn.style.backgroundColor
    if (btn.dataset.color) return
    // Most generated buttons already have style background; dataset is only a safety fallback.
    if (/^#[0-9a-f]{6}$/i.test(bg)) {
      btn.dataset.color = bg
      btn.title = bg
      btn.style.setProperty('--swatch-color', bg)
      btn.style.backgroundColor = bg
    }
  })
}

function bindTopPaintPaletteHard() {
  const topPanel = document.getElementById('topPaintColors')
  if (!topPanel || topPanel.dataset.bound === 'true') return
  topPanel.dataset.bound = 'true'

  topPanel.addEventListener('click', event => {
    const color1 = event.target.closest('#topColorOneCard')
    const color2 = event.target.closest('#topColorTwoCard')
    const swatch = event.target.closest('.top-swatch')
    const edit = event.target.closest('.paint-strip-edit,.top-edit-color')

    if (color1) {
      event.preventDefault()
      state.activeColorTarget = 'stroke'
      forceSyncAllColorPanels('stroke')
      return
    }

    if (color2) {
      event.preventDefault()
      state.activeColorTarget = 'fill'
      forceSyncAllColorPanels('fill')
      return
    }

    if (swatch) {
      event.preventDefault()
      const color = swatch.dataset.color || swatch.title
      setAuraColorFromAnyPalette(color, state.activeColorTarget || 'stroke')
      return
    }

    if (edit) {
      const input = document.getElementById('topPaintCustomColor')
      if (input) input.click()
    }
  })

  topPanel.addEventListener('contextmenu', event => {
    const swatch = event.target.closest('.top-swatch')
    if (!swatch) return
    event.preventDefault()
    const color = swatch.dataset.color || swatch.title
    setAuraColorFromAnyPalette(color, 'fill')
  })

  const customTop = document.getElementById('topPaintCustomColor')
  customTop?.addEventListener('input', () => {
    setAuraColorFromAnyPalette(customTop.value, state.activeColorTarget || 'stroke')
  })

  // Controls color inputs and cards remain fully synced too.
  ui.strokeColor?.addEventListener('input', () => forceSyncAllColorPanels('stroke'))
  ui.fillColor?.addEventListener('input', () => forceSyncAllColorPanels('fill'))

  document.getElementById('colorOneCard')?.addEventListener('click', () => {
    state.activeColorTarget = 'stroke'
    forceSyncAllColorPanels('stroke')
  })

  document.getElementById('colorTwoCard')?.addEventListener('click', () => {
    state.activeColorTarget = 'fill'
    forceSyncAllColorPanels('fill')
  })

  document.getElementById('paintCustomColor')?.addEventListener('input', event => {
    setAuraColorFromAnyPalette(event.target.value, state.activeColorTarget || 'stroke')
  })

  forceSyncAllColorPanels(state.activeColorTarget || 'stroke')
}


// Dastur ishga tushganda bajariladigan asosiy init funksiyasi
function init() {
  palette.forEach(c => { const b = document.createElement('button'); b.className = 'swatch'; b.style.background = c; b.onclick = () => ui.strokeColor.value = c; ui.swatches.appendChild(b) })
  if (localStorage.getItem('auradraw.theme') === 'dark') document.body.classList.add('dark')
  bind(); sizeStatic(); enableLayerResizeHandles(); addLayer('Layer 1', true, false)
  const auto = localStorage.getItem('auradraw.autosave')
  if (auto) { try { restore(JSON.parse(auto), () => { pushHistory(); if (innerWidth < 980) fit() }) } catch { pushHistory() } } else pushHistory()
  setTool('brush')
  initTopPaintPalette()
  normalizeTopSwatchColors()
  bindTopPaintPaletteHard()
  forceSyncAllColorPanels(state.activeColorTarget || 'stroke')
  ensureRangeDots(); syncStrokeControls(); updateHistory()
}
init();
/* =========================================================
   ABOUT OFF-CANVAS LOGIKASI
   Bu kod top-actions-group ichidagi About iconini ishlatadi:
   - bosilganda off-canvas panel ochiladi;
   - X tugmasi, backdrop yoki Escape bosilganda yopiladi;
   - panel ichidagi soat har soniyada yangilanadi.
   ========================================================= */
(function initAboutOffcanvas() {
  const aboutBtn = document.getElementById('aboutBtn')
  const aboutPanel = document.getElementById('aboutOffcanvas')
  const aboutBackdrop = document.getElementById('aboutBackdrop')
  const aboutCloseBtn = document.getElementById('aboutCloseBtn')
  const aboutClock = document.getElementById('aboutClock')

  // Agar HTML elementlar topilmasa, xatolik chiqarmasdan to‘xtaydi.
  if (!aboutBtn || !aboutPanel || !aboutBackdrop || !aboutCloseBtn) return

  // Off-canvas panelni ochish funksiyasi.
  const openAbout = () => {
    aboutPanel.classList.add('open')
    aboutBackdrop.classList.add('show')
    aboutPanel.setAttribute('aria-hidden', 'false')
    aboutBackdrop.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }

  // Off-canvas panelni yopish funksiyasi.
  const closeAbout = () => {
    aboutPanel.classList.remove('open')
    aboutBackdrop.classList.remove('show')
    aboutPanel.setAttribute('aria-hidden', 'true')
    aboutBackdrop.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
  }

  // Raqamli soatni rasmda ko‘rsatilgandek AM/PM formatida chiqaradi.
  const updateAboutClock = () => {
    if (!aboutClock) return
    const now = new Date()
    aboutClock.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  // Eventlar: tugma, close, backdrop va Escape.
  aboutBtn.addEventListener('click', openAbout)
  aboutCloseBtn.addEventListener('click', closeAbout)
  aboutBackdrop.addEventListener('click', closeAbout)
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && aboutPanel.classList.contains('open')) closeAbout()
  })

  updateAboutClock()
  setInterval(updateAboutClock, 1000)
})()

/* ===== Dastur yuklangandan keyin loadingni yopish ===== */
const appLoader = document.getElementById('appLoader')
const loaderProgressBar = document.getElementById('loaderProgressBar')
const loaderPercent = document.getElementById('loaderPercent')

let loaderValue = 0

const loaderTimer = setInterval(() => {
  loaderValue += Math.floor(Math.random() * 9) + 4

  if (loaderValue >= 96) {
    loaderValue = 96
    clearInterval(loaderTimer)
  }

  if (loaderProgressBar) loaderProgressBar.style.width = loaderValue + '%'
  if (loaderPercent) loaderPercent.textContent = loaderValue + '%'
}, 120)

window.addEventListener('load', () => {
  setTimeout(() => {
    loaderValue = 100

    if (loaderProgressBar) loaderProgressBar.style.width = '100%'
    if (loaderPercent) loaderPercent.textContent = '100%'

    setTimeout(() => {
      appLoader?.classList.add('hide')
    }, 450)
  }, 500)
})