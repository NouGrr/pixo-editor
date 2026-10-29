const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const canvas = $("#canvas");
const ctx = canvas.getContext("2d");
const state = {
  image: null, fileName: "Sans titre", zoom: 1, rotation: 0, flipX: 1, flipY: 1,
  adjustments: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, clarity: 0, dehaze: 0, saturation: 0, vibrance: 0, temperature: 0, tint: 0, sharpness: 0, vignette: 0 },
  straighten: 0, cropRatio: null, cropPresetName: "Libre", imageScale: 1, cropFrameVisible: false, cropCommitted: null, cropImageLocked: true, renderWidth: 0, renderHeight: 0, cropX: 0, cropY: 0, cropStart: null, cropResize: null, panX: 0, panY: 0, panStart: null, tool: "heal", densityMode: "lighten", densityAmount: .35, brushSize: 36, brushOpacity: 1, blurDensity: 14, blurAmount: .7, densityMask: null, cloneSource: null, cloneBuffer: null, paintBuffer: null, lastPaintPoint: null, painting: false, maskMode: null, cutoutBase: null, cutoutEngine: null, upscaleCanvas: null, upscaleUrl: null, history: [], historyIndex: -1,
};

function snapshot() {
  if (!state.image) return;
  const data = canvas.toDataURL("image/png");
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(data); state.historyIndex++;
  $("#undoButton").disabled = state.historyIndex < 1;
  $("#redoButton").disabled = true;
}
function draw(bypassFilter = false) {
  if (!state.image) return;
  const image = state.image;
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const angle = (state.rotation + state.straighten) * Math.PI / 180;
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const naturalWidth = sourceWidth * c + sourceHeight * s;
  const naturalHeight = sourceWidth * s + sourceHeight * c;
  const width = Math.ceil(naturalWidth * state.imageScale);
  const height = Math.ceil(naturalHeight * state.imageScale);
  state.renderWidth = width; state.renderHeight = height;
  const sizeChanged = canvas.width !== width || canvas.height !== height;
  if (sizeChanged) {
    canvas.width = width; canvas.height = height;
  } else {
    ctx.clearRect(0, 0, width, height);
  }
  if ($(".rail-tool.active")?.matches('[data-panel="crop"]')) clampCropPan();
  ctx.save(); ctx.translate(width / 2 + state.panX, height / 2 + state.panY); ctx.rotate(angle); ctx.scale(state.flipX * state.imageScale, state.flipY * state.imageScale);
  const retouchActive = $(".rail-tool.active")?.matches('[data-panel="retouch"]');
  ctx.filter = (bypassFilter || retouchActive) ? "none" : filterString();
  ctx.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
  ctx.restore();
  if (!bypassFilter && !retouchActive) drawVignette(width, height);
  canvas.style.display = "block"; $("#emptyState").style.display = "none";
  fitCanvasToStage();
  $("#imageInfo").textContent = `${canvas.width} × ${canvas.height}px`;
}
let drawFrame = 0;
function scheduleDraw() {
  if (drawFrame) return;
  drawFrame = requestAnimationFrame(() => {
    drawFrame = 0;
    draw();
    updateCropOverlay();
  });
}
function fitCanvasToStage() {
  const stage = $(".stage-wrap");
  if (!stage || !canvas.width || !canvas.height) return;
  const availableWidth = Math.max(1, stage.clientWidth - 20);
  const availableHeight = Math.max(1, stage.clientHeight - 20);
  const fit = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);
  canvas.style.width = `${Math.max(1, Math.round(canvas.width * fit))}px`;
  canvas.style.height = `${Math.max(1, Math.round(canvas.height * fit))}px`;
}
function filterString() {
  const a = state.adjustments;
  const exposure = 100 + a.exposure * .7 + a.shadows * .12 + a.highlights * .05;
  const contrast = 100 + a.contrast + a.clarity * .45 + a.dehaze * .35 - a.highlights * .08;
  const saturate = 100 + a.saturation + a.vibrance * .7;
  const hue = a.temperature * .08 + a.tint * .05;
  const warmth = Math.abs(a.temperature) * .09;
  const sharpen = a.sharpness ? `contrast(${100 + a.sharpness * .18}%)` : "";
  return `brightness(${exposure}%) contrast(${contrast}%) saturate(${saturate}%) hue-rotate(${hue}deg) sepia(${warmth}%) ${sharpen}`;
}
function drawVignette(width, height) {
  const amount = Math.min(1, state.adjustments.vignette / 100);
  if (!amount) return;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .06, width / 2, height / 2, Math.max(width, height) * .56);
  const color = $("#vignetteColor").value;
  gradient.addColorStop(0, `${color}00`); gradient.addColorStop(.48, `${color}${Math.round(amount * 38).toString(16).padStart(2, "0")}`); gradient.addColorStop(.78, `${color}${Math.round(amount * 150).toString(16).padStart(2, "0")}`); gradient.addColorStop(1, `${color}${Math.round(amount * 255).toString(16).padStart(2, "0")}`);
  ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height); ctx.restore();
}
function loadFile(file) {
  if (!file) return;
  const image = new Image();
  image.onload = () => {
    state.image = image; state.fileName = file.name; state.history = []; state.historyIndex = -1;
    state.imageScale = 1; state.zoom = 1; state.panX = 0; state.panY = 0;
    state.rotation = 0; state.straighten = 0; state.flipX = 1; state.flipY = 1;
    canvas.style.transform = "scale(1)";
    $("#zoomValue").textContent = "100%";
    state.cropFrameVisible = false; state.cropRatio = null; state.cropPresetName = "Libre"; state.cropX = 0; state.cropY = 0;
    state.cropImageLocked = true;
    state.cutoutBase = null; state.cutoutEngine = null;
    state.upscaleCanvas = null;
    $(".canvas-area").classList.add("is-image-loaded");
    $("#documentName").textContent = file.name; $("#canvasHint").textContent = "Image prête à être éditée";
    draw();
    $("#preview4K").disabled = false;
    $("#downloadConverted").disabled = false;
    updateConvertInfo();
    if (state.cropRatio) {
      let width = canvas.width, height = Math.round(width / state.cropRatio);
      if (height > canvas.height) { height = canvas.height; width = Math.round(height * state.cropRatio); }
      $("#cropWidth").value = width; $("#cropHeight").value = height;
    } else {
      $("#cropWidth").value = canvas.width; $("#cropHeight").value = canvas.height;
    }
    commitCropDraft();
    snapshot();
    $("#cropOverlay").hidden = true;
    updateCropOverlay();
  };
  image.src = URL.createObjectURL(file);
}
$("#openButton").onclick = () => $("#fileInput").click();
$("#fileInput").onchange = (e) => loadFile(e.target.files[0]);
$("#stageWrap").ondragover = (e) => e.preventDefault();
$("#stageWrap").ondrop = (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); };
window.addEventListener("resize", fitCanvasToStage);
$$(".rail-tool").forEach((button) => button.onclick = () => {
  const previousPanel = $(".rail-tool.active")?.dataset.panel;
  if (previousPanel === "crop" && button.dataset.panel !== "crop") restoreCommittedCrop();
  $$(".rail-tool").forEach((b) => b.classList.remove("active")); button.classList.add("active");
  const panel = button.dataset.panel;
  $$(".panel").forEach((p) => p.hidden = p.dataset.content !== panel);
  $("#panelTitle").textContent = panel === "crop" ? "Recadrer" : panel === "adjust" ? "Ajuster" : "Retouche";
  if (panel === "crop") {
    state.cropFrameVisible = Boolean(state.image);
    if (!Number($("#cropWidth").value) || !Number($("#cropHeight").value)) {
      fitCropToRenderedImage();
    }
  }
  $("#cropOverlay").hidden = panel !== "crop" || !state.image || !state.cropFrameVisible;
  $(".stage-wrap").classList.toggle("retouch-active", panel === "retouch" && Boolean(state.image) && Boolean(state.tool));
  $(".stage-wrap").classList.toggle("adjust-active", panel === "adjust" && Boolean(state.image));
  $(".stage-wrap").classList.toggle("crop-active", panel === "crop" && Boolean(state.image));
  if (panel === "adjust") {
    updateAdjustmentControls();
  }
  if (panel === "retouch") {
    if (!state.tool) state.tool = "heal";
    $$(".retouch-tool").forEach((item) => item.classList.toggle("active", item.dataset.tool === state.tool));
    $("#cloneHelp").hidden = state.tool !== "clone";
    updateBlurControls();
    $(".stage-wrap").classList.add("retouch-active");
    updateBrushCursor();
  }
  draw();
  if (panel === "crop") updateCropOverlay();
});
$$(".preset").forEach((button) => button.onclick = () => {
  $$(".preset").forEach((b) => b.classList.remove("active")); button.classList.add("active");
  const ratio = button.dataset.ratio;
  state.cropFrameVisible = Boolean(state.image);
  state.cropPresetName = button.querySelector("b")?.textContent || "Format personnalisé";
  state.cropRatio = null;
  if (state.image && ratio !== "free") {
    state.cropRatio = Number(ratio);
    let width = state.renderWidth;
    let height = Math.round(width / state.cropRatio);
    if (height > state.renderHeight) {
      height = state.renderHeight;
      width = Math.round(height * state.cropRatio);
    }
    $("#cropWidth").value = width;
    $("#cropHeight").value = height;
  } else if (state.image) {
    state.cropRatio = null;
    $("#cropWidth").value = state.renderWidth;
    $("#cropHeight").value = state.renderHeight;
  }
  const selectedWidth = Number($("#cropWidth").value) || state.renderWidth;
  const selectedHeight = Number($("#cropHeight").value) || state.renderHeight;
  state.cropX = Math.max(0, Math.round((state.renderWidth - selectedWidth) / 2));
  state.cropY = Math.max(0, Math.round((state.renderHeight - selectedHeight) / 2));
  draw();
  updateCropOverlay();
});
["cropWidth", "cropHeight"].forEach((id) => $(`#${id}`).oninput = () => {
  const width = Number($("#cropWidth").value), height = Number($("#cropHeight").value);
  if (width > 0 && height > 0) {
    state.cropFrameVisible = Boolean(state.image);
    state.cropRatio = width / height;
    state.cropPresetName = "Format personnalisé";
    $$(".preset").forEach((button) => button.classList.remove("active"));
    state.cropX = Math.max(0, Math.round((canvas.width - width) / 2));
    state.cropY = Math.max(0, Math.round((canvas.height - height) / 2));
    draw();
    updateCropOverlay();
  }
});
const cropOverlay = $("#cropOverlay");
cropOverlay.onpointerdown = (event) => {
  if (!state.image || event.button !== 0) return;
  const handle = event.target.closest(".crop-handle");
  const width = Number($("#cropWidth").value) || canvas.width;
  const height = Number($("#cropHeight").value) || canvas.height;
  if (handle) {
    state.cropResize = { handle: handle.dataset.handle, x: event.clientX, y: event.clientY, cropX: state.cropX, cropY: state.cropY, width, height };
  } else {
    const rect = cropOverlay.getBoundingClientRect();
    const edgeDistance = Math.min(event.clientX - rect.left, rect.right - event.clientX, event.clientY - rect.top, rect.bottom - event.clientY);
    if (edgeDistance <= 18) {
      state.cropStart = { x: event.clientX, y: event.clientY, cropX: state.cropX, cropY: state.cropY };
    } else {
      state.panStart = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
    }
  }
  event.stopPropagation();
  cropOverlay.setPointerCapture(event.pointerId);
};
cropOverlay.onpointermove = (event) => {
  const scale = canvas.getBoundingClientRect().width / state.zoom / canvas.width || 1;
  if (state.cropResize) {
    resizeCrop(event, scale);
    return;
  }
  if (state.panStart) {
    updateImagePan(event, scale, true);
    scheduleDraw();
    return;
  }
  if (!state.cropStart) return;
  state.cropX = state.cropStart.cropX + (event.clientX - state.cropStart.x) / scale;
  state.cropY = state.cropStart.cropY + (event.clientY - state.cropStart.y) / scale;
  updateCropOverlay();
};
cropOverlay.onpointerup = (event) => {
  if (!state.cropStart && !state.cropResize && !state.panStart) return;
  state.cropStart = null;
  state.cropResize = null;
  if (state.panStart) state.panStart = null;
  cropOverlay.releasePointerCapture(event.pointerId);
};
cropOverlay.onpointercancel = () => { state.cropStart = null; state.cropResize = null; state.panStart = null; };
function clampCropPan() {
  const width = Number($("#cropWidth").value) || canvas.width;
  const height = Number($("#cropHeight").value) || canvas.height;
  const maxPanX = state.cropX;
  const minPanX = state.cropX + width - canvas.width;
  const maxPanY = state.cropY;
  const minPanY = state.cropY + height - canvas.height;
  state.panX = Math.max(Math.min(minPanX, maxPanX), Math.min(Math.max(minPanX, maxPanX), Number(state.panX) || 0));
  state.panY = Math.max(Math.min(minPanY, maxPanY), Math.min(Math.max(minPanY, maxPanY), Number(state.panY) || 0));
}
function updateImagePan(event, scale, restrictToCrop = false) {
  state.panX = state.panStart.panX + (event.clientX - state.panStart.x) / scale;
  state.panY = state.panStart.panY + (event.clientY - state.panStart.y) / scale;
  if (restrictToCrop) clampCropPan();
}
function resizeCrop(event, scale) {
  const resize = state.cropResize;
  const dx = (event.clientX - resize.x) / scale;
  const dy = (event.clientY - resize.y) / scale;
  const handle = resize.handle;
  const locked = Boolean(state.cropRatio);
  const ratio = state.cropRatio || resize.width / resize.height;
  const minSize = Math.min(32, canvas.width, canvas.height);
  let x = resize.cropX, y = resize.cropY, width = resize.width, height = resize.height;
  if (locked) {
    const horizontal = handle.includes("e") || handle.includes("w");
    const delta = horizontal ? (handle.includes("w") ? -dx : dx) : (handle.includes("n") ? -dy : dy);
    const size = Math.max(minSize, (horizontal ? resize.width : resize.height) + delta);
    width = horizontal ? size : size * ratio;
    height = horizontal ? size / ratio : size;
    if (handle.includes("w")) x = resize.cropX + resize.width - width;
    else if (!horizontal) x = resize.cropX + (resize.width - width) / 2;
    if (handle.includes("n")) y = resize.cropY + resize.height - height;
    else if (horizontal) y = resize.cropY + (resize.height - height) / 2;
  } else {
    if (handle.includes("w")) { x = resize.cropX + dx; width = resize.width - dx; }
    if (handle.includes("e")) width = resize.width + dx;
    if (handle.includes("n")) { y = resize.cropY + dy; height = resize.height - dy; }
    if (handle.includes("s")) height = resize.height + dy;
    width = Math.max(minSize, width); height = Math.max(minSize, height);
    if (handle.includes("w")) x = resize.cropX + resize.width - width;
    if (handle.includes("n")) y = resize.cropY + resize.height - height;
  }
  width = Math.min(width, canvas.width);
  height = Math.min(height, canvas.height);
  if (x < 0) { width += x; x = 0; }
  if (y < 0) { height += y; y = 0; }
  if (x + width > canvas.width) width = canvas.width - x;
  if (y + height > canvas.height) height = canvas.height - y;
  if (locked) {
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
    if (handle.includes("w")) x = resize.cropX + resize.width - width;
    if (handle.includes("n")) y = resize.cropY + resize.height - height;
  }
  $("#cropWidth").value = Math.max(1, Math.round(width));
  $("#cropHeight").value = Math.max(1, Math.round(height));
  state.cropX = Math.max(0, Math.round(x));
  state.cropY = Math.max(0, Math.round(y));
  updateCropOverlay();
}
function updateCropOverlay() {
  const overlay = $("#cropOverlay");
  if (!state.image || !state.cropFrameVisible || !$(".rail-tool.active")?.matches('[data-panel="crop"]')) { overlay.hidden = true; return; }
  overlay.hidden = false;
  const transformedRect = canvas.getBoundingClientRect();
  const imageRect = {
    left: transformedRect.left + (transformedRect.width - transformedRect.width / state.zoom) / 2,
    top: transformedRect.top + (transformedRect.height - transformedRect.height / state.zoom) / 2,
    width: transformedRect.width / state.zoom,
    height: transformedRect.height / state.zoom,
  };
  const stage = $(".stage-wrap");
  const stageRect = stage.getBoundingClientRect();
  const scale = imageRect.width / canvas.width || 1;
  let width = Number($("#cropWidth").value) || canvas.width;
  let height = Number($("#cropHeight").value) || canvas.height;
  width = Math.min(width, canvas.width);
  height = Math.min(height, canvas.height);
  const cropWidth = width * scale;
  const cropHeight = height * scale;
  const x = Math.max(0, Math.min(canvas.width - width, state.cropX));
  const y = Math.max(0, Math.min(canvas.height - height, state.cropY));
  state.cropX = x; state.cropY = y;
  overlay.style.width = `${Math.max(1, cropWidth)}px`;
  overlay.style.height = `${Math.max(1, cropHeight)}px`;
  overlay.style.left = `${imageRect.left - stageRect.left + (stage.scrollLeft || 0) + (x + width / 2) * scale}px`;
  overlay.style.top = `${imageRect.top - stageRect.top + (stage.scrollTop || 0) + (y + height / 2) * scale}px`;
  $("#cropPreviewLabel").textContent = `Aperçu — ${state.cropPresetName} · ${width} × ${height}`;
}
function commitCropDraft() {
  state.cropCommitted = {
    ratio: state.cropRatio,
    presetName: state.cropPresetName,
    frameVisible: state.cropFrameVisible,
    x: state.cropX,
    y: state.cropY,
    width: Number($("#cropWidth").value) || state.renderWidth,
    height: Number($("#cropHeight").value) || state.renderHeight,
  };
}
function restoreCommittedCrop() {
  if (!state.cropCommitted) return;
  const committed = state.cropCommitted;
  state.cropRatio = committed.ratio;
  state.cropPresetName = committed.presetName;
  state.cropFrameVisible = committed.frameVisible;
  state.cropX = committed.x;
  state.cropY = committed.y;
  $("#cropWidth").value = committed.width;
  $("#cropHeight").value = committed.height;
  $$(".preset").forEach((button) => {
    const name = button.querySelector("b")?.textContent;
    button.classList.toggle("active", name === committed.presetName);
  });
  updateCropOverlay();
}
function fitCropToRenderedImage() {
  if (!state.image) return;
  let width = state.renderWidth;
  let height = state.renderHeight;
  if (state.cropRatio) {
    width = state.renderWidth;
    height = Math.round(width / state.cropRatio);
    if (height > state.renderHeight) {
      height = state.renderHeight;
      width = Math.round(height * state.cropRatio);
    }
  }
  $("#cropWidth").value = width;
  $("#cropHeight").value = height;
  state.cropX = Math.max(0, Math.round((state.renderWidth - width) / 2));
  state.cropY = Math.max(0, Math.round((state.renderHeight - height) / 2));
  updateCropOverlay();
}
function setStraighten(value) {
  const degrees = Math.max(-180, Math.min(180, Number(value) || 0));
  state.straighten = degrees;
  $("#straightenRange").value = degrees;
  $("#straightenDegrees").value = degrees;
  draw();
  fitCropToRenderedImage();
}
$("#straightenRange").oninput = (e) => setStraighten(e.target.value);
$("#straightenDegrees").oninput = (e) => setStraighten(e.target.value);
["rotateLeft", "rotateRight"].forEach((id) => $(`#${id}`).onclick = () => { state.rotation += id === "rotateLeft" ? -90 : 90; draw(); fitCropToRenderedImage(); snapshot(); });
$("#flipHorizontal").onclick = () => { state.flipX *= -1; draw(); snapshot(); };
$("#flipVertical").onclick = () => { state.flipY *= -1; draw(); snapshot(); };
$("#applyCrop").onclick = () => {
  if (!state.image) return;
  draw(true);
  const width = Math.max(1, Number($("#cropWidth").value)), height = Math.max(1, Number($("#cropHeight").value));
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.min(width, canvas.width); cropCanvas.height = Math.min(height, canvas.height);
  const sx = Math.max(0, Math.min(canvas.width - cropCanvas.width, Math.round(state.cropX)));
  const sy = Math.max(0, Math.min(canvas.height - cropCanvas.height, Math.round(state.cropY)));
  cropCanvas.getContext("2d").drawImage(canvas, sx, sy, cropCanvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);
  const source = cropCanvas.toDataURL("image/png"), image = new Image();
  image.onload = () => {
    state.image = image; state.imageScale = 1; state.cropImageLocked = true; state.rotation = 0; state.straighten = 0; state.panX = 0; state.panY = 0;
    state.cropRatio = null; state.cropPresetName = "Libre"; state.cropFrameVisible = false;
    $("#straightenRange").value = 0; $("#straightenDegrees").value = 0;
    $$(".preset").forEach((b) => b.classList.toggle("active", b.dataset.ratio === "free"));
    draw();
    $("#cropWidth").value = canvas.width; $("#cropHeight").value = canvas.height;
    state.cropX = 0; state.cropY = 0;
    fitCropToRenderedImage();
    commitCropDraft(); snapshot();
  };
  image.src = source;
};
$$(".adjustment").forEach((input) => input.oninput = () => {
  if ($(".rail-tool.active")?.matches('[data-panel="retouch"]')) return;
  $$(".look-button").forEach((button) => button.classList.remove("active"));
  state.adjustments[input.id] = Number(input.value); $(`#${input.id}Output`).textContent = input.id === "vignette" ? input.value : `${input.value > 0 ? "+" : ""}${input.value}`; draw();
});
const looks = {
  clean: { exposure: 8, contrast: 8, highlights: -8, shadows: 12, clarity: 8, saturation: 4, vibrance: 10, sharpness: 12 },
  portrait: { exposure: 5, contrast: -5, highlights: -18, shadows: 15, clarity: -8, saturation: -4, vibrance: 8, temperature: 4 },
  product: { exposure: 12, contrast: 16, highlights: -8, shadows: 4, clarity: 22, dehaze: 12, saturation: 5, sharpness: 28 },
  cinema: { exposure: -3, contrast: 18, highlights: -22, shadows: -4, clarity: 12, saturation: -10, temperature: -5, vignette: 20 },
};
function updateAdjustmentControls() {
  Object.keys(state.adjustments).forEach((key) => {
    const input = $(`#${key}`), output = $(`#${key}Output`);
    if (input) input.value = state.adjustments[key];
    if (output) output.textContent = key === "vignette" ? state.adjustments[key] : `${state.adjustments[key] > 0 ? "+" : ""}${state.adjustments[key]}`;
  });
}


$$(".look-button").forEach((button) => button.onclick = () => {
  if ($(".rail-tool.active")?.matches('[data-panel="retouch"]')) return;
  const values = looks[button.dataset.look];
  const isActive = button.classList.contains("active");
  $$(".look-button").forEach((item) => item.classList.remove("active"));
  Object.keys(state.adjustments).forEach((key) => {
    state.adjustments[key] = isActive ? 0 : (values[key] || 0);
  });
  if (!isActive) button.classList.add("active");
  updateAdjustmentControls();
  draw(); snapshot();
});
$("#vignetteColor").oninput = () => {
  if ($(".rail-tool.active")?.matches('[data-panel="retouch"]')) return;
  $$(".look-button").forEach((button) => button.classList.remove("active")); draw();
};
$("#resetAdjustments").onclick = () => {
  if ($(".rail-tool.active")?.matches('[data-panel="retouch"]')) return;
  Object.keys(state.adjustments).forEach((key) => { state.adjustments[key] = 0; const input = $(`#${key}`); if (input) { input.value = 0; $(`#${key}Output`).textContent = "0"; } }); draw(); snapshot();
};
function updateBlurControls() { $("#blurOptions").hidden = state.tool !== "blur"; }
$$(".retouch-tool").forEach((button) => button.onclick = () => {
  const isActive = button.classList.contains("active");
  $$(".retouch-tool").forEach((item) => item.classList.remove("active"));
  state.tool = isActive ? null : button.dataset.tool;
  if (!isActive) button.classList.add("active");
  state.maskMode = null;
  $$(".mask-tool").forEach((item) => item.classList.remove("active"));
  $("#cloneHelp").hidden = state.tool !== "clone";
  if (state.tool !== "clone") { state.cloneSource = null; state.cloneBuffer = null; }
  updateBlurControls();
  if (state.tool) $("#canvasHint").textContent = `${button.querySelector("b")?.textContent || "Outil"} sélectionné — peignez sur l’image`;
  $(".stage-wrap").classList.toggle("retouch-active", Boolean(state.tool) && $(".rail-tool.active")?.matches('[data-panel="retouch"]'));
  updateBrushCursor();
});
$("#resetCloneSource").onclick = () => {
  state.cloneSource = null;
  state.cloneBuffer = null;
  if (state.tool === "clone") $("#canvasHint").textContent = "Tampon réinitialisé — cliquez sur l’image pour choisir une nouvelle source";
};
$$(".retouch-tab").forEach((button) => button.onclick = () => {
  const density = button.dataset.retouchTab === "density";
  $$(".retouch-tab").forEach((item) => item.classList.toggle("active", item === button));
  $("#densityPanel").hidden = !density;
  $("#repairTools").hidden = density;
  $$(".cutout-options, #autoCutout, .upscale-card, .convert-card, #cloneHelp, #clearRetouch").forEach((item) => { item.hidden = density; });
  if (density) {
    state.tool = "density";
    state.maskMode = null;
    updateBrushCursor();
  } else {
    state.tool = $(".retouch-tool.active")?.dataset.tool || null;
    $(".stage-wrap").classList.toggle("retouch-active", Boolean(state.tool));
    updateBrushCursor();
  }
});
$$("[data-density-mode]").forEach((button) => button.onclick = () => {
  $(".density-modes").querySelectorAll("[data-density-mode]").forEach((item) => item.classList.toggle("active", item === button));
  state.densityMode = button.dataset.densityMode;
  $("#densityModeOutput").textContent = state.densityMode === "lighten" ? "Éclaircir" : "Assombrir";
  state.tool = "density";
  state.maskMode = null;
  updateBrushCursor();
});
function updateDensityAmount(event) {
  const amount = Math.max(5, Math.min(100, Number(event.target.value)));
  state.densityAmount = amount / 100;
  event.target.value = amount;
  $("#densityAmountOutput").textContent = `${amount}%`;
  $("#densityPanel").style.setProperty("--density-strength", `${amount}%`);
  if (state.tool === "density") {
    $("#canvasHint").textContent = `${state.densityMode === "lighten" ? "Éclaircissement" : "Assombrissement"} à ${amount}% — peignez sur l’image`;
  }
}
$("#densityAmount").addEventListener("input", updateDensityAmount);
$("#densityAmount").addEventListener("change", updateDensityAmount);
$("#brushSize").oninput = (e) => { state.brushSize = Number(e.target.value); $("#brushSizeOutput").textContent = `${e.target.value} px`; updateBrushCursor(); };
$("#brushOpacity").oninput = (e) => { state.brushOpacity = Number(e.target.value) / 100; $("#brushOpacityOutput").textContent = `${e.target.value}%`; };
$("#blurDensity").oninput = (e) => { state.blurDensity = Number(e.target.value); $("#blurDensityOutput").textContent = `${e.target.value} px`; };
$("#blurAmount").oninput = (e) => { state.blurAmount = Number(e.target.value) / 100; $("#blurAmountOutput").textContent = `${e.target.value}%`; };
$$(".mask-tool:not([data-density-mode])").forEach((button) => button.onclick = () => {
  $$(".mask-tool").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.maskMode = button.dataset.maskMode;
});
let cutoutRun = 0;
let imglyLoader;
["cutoutTolerance", "cutoutSoftness"].forEach((id) => $(`#${id}`).oninput = (event) => {
  $(`#${id}Output`).textContent = event.target.value;
  if (state.cutoutBase && state.cutoutEngine === "local") {
    clearTimeout(state.cutoutTimer);
    state.cutoutTimer = setTimeout(() => applyCutout(state.cutoutBase, false), 140);
  }
});
function commitCanvas() {
  const image = new Image();
  image.onload = () => { state.image = image; draw(); snapshot(); };
  image.src = canvas.toDataURL("image/png");
}
function showProcessing() {
  $("#processingOverlay").hidden = false;
}
function hideProcessing() {
  $("#processingOverlay").hidden = true;
}
function create4KPreview() {
  if (!state.image) throw new Error("Importez une image avant de créer un aperçu.");
  const scale = Math.min(3840 / canvas.width, 3840 / canvas.height);
  const targetWidth = Math.max(canvas.width, Math.round(canvas.width * scale));
  const targetHeight = Math.max(canvas.height, Math.round(canvas.height * scale));
  const output = document.createElement("canvas");
  output.width = targetWidth; output.height = targetHeight;
  const outputContext = output.getContext("2d");
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(canvas, 0, 0, targetWidth, targetHeight);
  return output;
}
$("#preview4K").onclick = async () => {
  showProcessing();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    state.upscaleCanvas = create4KPreview();
    if (state.upscaleUrl) URL.revokeObjectURL(state.upscaleUrl);
    state.upscaleUrl = state.upscaleCanvas.toDataURL("image/png");
    $("#preview4KImage").src = state.upscaleUrl;
    $("#preview4KInfo").textContent = `${state.upscaleCanvas.width} × ${state.upscaleCanvas.height}px`;
    $("#previewModal").hidden = false;
  } catch (error) {
    $("#canvasHint").textContent = error.message;
  } finally {
    hideProcessing();
  }
};
$("#closePreview").onclick = () => { $("#previewModal").hidden = true; };
$("#previewModal").onclick = (event) => { if (event.target === $("#previewModal")) $("#previewModal").hidden = true; };
$("#download4K").onclick = async () => {
  if (!state.upscaleCanvas) return;
  showProcessing();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    const link = document.createElement("a");
    link.download = `${state.fileName.replace(/\.[^.]+$/, "")}-pixo-4k.png`;
    link.href = state.upscaleCanvas.toDataURL("image/png");
    link.click();
  } finally {
    hideProcessing();
  }
};
const convertTypes = {
  png: { mime: "image/png", extension: "png", label: "PNG" },
  jpeg: { mime: "image/jpeg", extension: "jpg", label: "JPG" },
  webp: { mime: "image/webp", extension: "webp", label: "WebP" },
  avif: { mime: "image/avif", extension: "avif", label: "AVIF" },
};
function updateConvertInfo() {
  const type = convertTypes[$("#convertFormat").value];
  const quality = Number($("#convertQuality").value);
  $("#convertQuality").disabled = type.mime === "image/png";
  $("#convertQualityOutput").textContent = type.mime === "image/png" ? "sans perte" : `${quality}%`;
  $("#convertInfo").textContent = state.image
    ? `${canvas.width} × ${canvas.height}px · ${type.label}${type.mime === "image/png" ? " sans perte" : ` à ${quality}%`}`
    : "Importez une image pour activer la conversion.";
}
$("#convertFormat").onchange = updateConvertInfo;
$("#convertQuality").oninput = () => { $("#convertQualityOutput").textContent = `${$("#convertQuality").value}%`; updateConvertInfo(); };
$("#downloadConverted").onclick = async () => {
  if (!state.image) return;
  showProcessing();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    const type = convertTypes[$("#convertFormat").value];
    const quality = Number($("#convertQuality").value) / 100;
    const dataUrl = canvas.toDataURL(type.mime, quality);
    const link = document.createElement("a");
    link.download = `${state.fileName.replace(/\.[^.]+$/, "")}-pixo.${type.extension}`;
    link.href = dataUrl;
    link.click();
  } finally {
    hideProcessing();
  }
};
function paintAt(p) {
  ctx.filter = "none";
  if (state.maskMode && state.cutoutBase) {
    const radius = state.brushSize / 2;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const left = Math.max(0, Math.floor(p.x - radius)), right = Math.min(canvas.width - 1, Math.ceil(p.x + radius));
    const top = Math.max(0, Math.floor(p.y - radius)), bottom = Math.min(canvas.height - 1, Math.ceil(p.y + radius));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const distance = Math.hypot(x - p.x, y - p.y);
      if (distance > radius) continue;
      const alpha = Math.round((1 - distance / radius) * 255 * state.brushOpacity);
      const index = (y * canvas.width + x) * 4 + 3;
      pixels.data[index] = state.maskMode === "add" ? Math.max(pixels.data[index], alpha) : Math.min(pixels.data[index], 255 - alpha);
    }
    ctx.putImageData(pixels, 0, 0);
    return;
  }
  if (state.tool === "density") {
    if (!state.densityMask) {
      state.densityMask = document.createElement("canvas");
      state.densityMask.width = canvas.width;
      state.densityMask.height = canvas.height;
    }
    const maskContext = state.densityMask.getContext("2d");
    const radius = state.brushSize / 2;
    const gradient = maskContext.createRadialGradient(p.x, p.y, radius * .18, p.x, p.y, radius);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(.72, "rgba(255,255,255,.82)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    maskContext.globalCompositeOperation = "lighter";
    maskContext.fillStyle = gradient;
    maskContext.beginPath();
    maskContext.arc(p.x, p.y, radius, 0, Math.PI * 2);
    maskContext.fill();
    maskContext.globalCompositeOperation = "source-over";
    const source = state.paintBuffer || canvas;
    const sourcePixels = source.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
    const maskPixels = maskContext.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < maskPixels.data.length; index += 4) {
      const coverage = maskPixels.data[index + 3] / 255;
      if (!coverage) continue;
      const strength = Math.min(1, coverage * state.densityAmount * state.brushOpacity);
      for (let channel = 0; channel < 3; channel++) {
        const value = sourcePixels.data[index + channel];
        pixels.data[index + channel] = state.densityMode === "lighten"
          ? Math.round(value + (255 - value) * strength)
          : Math.round(value * (1 - strength));
      }
    }
    ctx.putImageData(pixels, 0, 0);
    $("#canvasHint").textContent = `${state.densityMode === "lighten" ? "Éclaircissement" : "Assombrissement"} à ${Math.round(state.densityAmount * 100)}% — peignez sur l’image`;
    return;
  }
  if (state.tool === "clone" && state.cloneSource && state.cloneBuffer) {
    const source = state.cloneSource;
    const size = Math.ceil(state.brushSize * 2);
    const patch = document.createElement("canvas");
    patch.width = size; patch.height = size;
    patch.getContext("2d").drawImage(
      state.cloneBuffer,
      Math.round(source.x - state.brushSize),
      Math.round(source.y - state.brushSize),
      size,
      size,
      0,
      0,
      size,
      size,
    );
    ctx.save(); ctx.globalAlpha = state.brushOpacity; ctx.beginPath(); ctx.arc(p.x, p.y, state.brushSize / 2, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(patch, p.x - state.brushSize, p.y - state.brushSize);
    ctx.restore();
    return;
  }
  const sourceCanvas = state.paintBuffer || canvas;
  const patch = document.createElement("canvas"), size = Math.ceil(state.brushSize * 2);
  patch.width = size; patch.height = size;
  const patchContext = patch.getContext("2d");
  patchContext.filter = state.tool === "blur" ? `blur(${state.blurDensity}px)` : "none";
  patchContext.drawImage(sourceCanvas, p.x - state.brushSize, p.y - state.brushSize, size, size, 0, 0, size, size);
  if (state.tool === "sharpen") {
    const sharpened = patchContext.getImageData(0, 0, size, size);
    const original = new Uint8ClampedArray(sharpened.data);
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const index = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const blur = (original[index - size * 4 + channel] + original[index - 4 + channel] + original[index + 4 + channel] + original[index + size * 4 + channel]) / 4;
        sharpened.data[index + channel] = Math.max(0, Math.min(255, original[index + channel] + (original[index + channel] - blur) * 2.4));
      }
    }
    patchContext.putImageData(sharpened, 0, 0);
  }
  ctx.save(); ctx.globalAlpha = state.brushOpacity; ctx.beginPath(); ctx.arc(p.x, p.y, state.brushSize / 2, 0, Math.PI * 2); ctx.clip();
  if (state.tool === "heal") {
    const offset = Math.max(4, state.brushSize * .65);
    const healPatch = document.createElement("canvas");
    healPatch.width = size; healPatch.height = size;
    const healContext = healPatch.getContext("2d");
    healContext.drawImage(sourceCanvas, p.x - state.brushSize - offset, p.y - state.brushSize, size, size, 0, 0, size, size);
    const mask = document.createElement("canvas");
    mask.width = size; mask.height = size;
    const maskContext = mask.getContext("2d");
    const gradient = maskContext.createRadialGradient(size / 2, size / 2, state.brushSize * .12, size / 2, size / 2, state.brushSize / 2);
    gradient.addColorStop(0, "rgba(255,255,255,.92)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
    maskContext.fillStyle = gradient; maskContext.fillRect(0, 0, size, size);
    healContext.globalCompositeOperation = "destination-in";
    healContext.drawImage(mask, 0, 0);
    ctx.globalAlpha = state.brushOpacity;
    ctx.drawImage(healPatch, p.x - state.brushSize, p.y - state.brushSize);
  } else if (state.tool === "blur") {
    const mask = document.createElement("canvas");
    mask.width = size; mask.height = size;
    const maskContext = mask.getContext("2d");
    const gradient = maskContext.createRadialGradient(size / 2, size / 2, state.brushSize * .12, size / 2, size / 2, state.brushSize / 2);
    gradient.addColorStop(0, `rgba(255,255,255,${state.blurAmount})`);
    gradient.addColorStop(.72, `rgba(255,255,255,${state.blurAmount * .72})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    maskContext.fillStyle = gradient; maskContext.fillRect(0, 0, size, size);
    patchContext.globalCompositeOperation = "destination-in";
    patchContext.drawImage(mask, 0, 0);
    ctx.globalAlpha = state.brushOpacity;
    ctx.drawImage(patch, p.x - state.brushSize, p.y - state.brushSize);
  } else if (state.tool === "sharpen") {
    const mask = document.createElement("canvas");
    mask.width = size; mask.height = size;
    const maskContext = mask.getContext("2d");
    const gradient = maskContext.createRadialGradient(size / 2, size / 2, state.brushSize * .12, size / 2, size / 2, state.brushSize / 2);
    gradient.addColorStop(0, "rgba(255,255,255,.95)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    maskContext.fillStyle = gradient; maskContext.fillRect(0, 0, size, size);
    patchContext.globalCompositeOperation = "destination-in";
    patchContext.drawImage(mask, 0, 0);
    ctx.globalAlpha = state.brushOpacity;
    ctx.drawImage(patch, p.x - state.brushSize, p.y - state.brushSize);
  } else ctx.drawImage(patch, p.x - state.brushSize, p.y - state.brushSize);
  ctx.restore();
}
function paintStroke(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const spacing = Math.max(2, state.brushSize * .22);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    paintAt({
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    });
  }
}
canvas.onpointerdown = (event) => {
  if (!state.image || event.button !== 0) return;
  event.preventDefault();
  const activePanel = $(".rail-tool.active")?.dataset.panel;
  const cropMode = activePanel === "crop";
  const navigationMode = cropMode || activePanel === "adjust" || (activePanel === "retouch" && !state.tool);
  if (navigationMode) {
    state.panStart = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (activePanel !== "retouch") return;
  if (!["heal", "clone", "blur", "sharpen", "density"].includes(state.tool)) return;
  const p = point(event);
  if (state.tool === "clone" && !state.cloneSource) {
    state.cloneSource = p; state.cloneBuffer = document.createElement("canvas"); state.cloneBuffer.width = canvas.width; state.cloneBuffer.height = canvas.height;
    state.cloneBuffer.getContext("2d").drawImage(canvas, 0, 0);
    $("#canvasHint").textContent = "Source sélectionnée — cliquez et peignez à l’endroit où copier";
    return;
  }
  state.paintBuffer = document.createElement("canvas"); state.paintBuffer.width = canvas.width; state.paintBuffer.height = canvas.height;
  state.paintBuffer.getContext("2d").drawImage(canvas, 0, 0);
  state.densityMask = state.tool === "density" ? document.createElement("canvas") : null;
  if (state.densityMask) {
    state.densityMask.width = canvas.width;
    state.densityMask.height = canvas.height;
  }
  state.painting = true; state.lastPaintPoint = p; canvas.setPointerCapture(event.pointerId); paintAt(p);
};
canvas.onpointermove = (event) => {
  updateBrushCursor(event);
  if (state.panStart) {
    const scale = canvas.getBoundingClientRect().width / state.zoom / canvas.width || 1;
    const cropMode = $(".rail-tool.active")?.dataset.panel === "crop";
    updateImagePan(event, scale, cropMode);
    scheduleDraw();
    return;
  }
  if (!state.painting) return;
  const nextPoint = point(event);
  paintStroke(state.lastPaintPoint, nextPoint);
  state.lastPaintPoint = nextPoint;
};
canvas.onpointerenter = updateBrushCursor;
canvas.onpointerleave = () => { $("#brushCursor").style.display = "none"; };
canvas.onpointerup = (event) => {
  if (state.panStart) {
    state.panStart = null;
    snapshot();
    return;
  }
  if (!state.painting) return;
  const endPoint = point(event);
  paintStroke(state.lastPaintPoint, endPoint);
  state.painting = false; state.lastPaintPoint = null; state.paintBuffer = null; state.densityMask = null;
  canvas.releasePointerCapture(event.pointerId); commitCanvas();
};
canvas.onpointercancel = (event) => {
  if (state.panStart) {
    state.panStart = null;
    return;
  }
  if (!state.painting) return;
  state.painting = false; state.lastPaintPoint = null; state.paintBuffer = null; state.densityMask = null;
  canvas.releasePointerCapture(event.pointerId); commitCanvas();
};
function setZoom(value, focalEvent = null) {
  const previousZoom = state.zoom;
  if (focalEvent && state.image) {
    const transformedRect = canvas.getBoundingClientRect();
    const baseScale = transformedRect.width / previousZoom / canvas.width || 1;
    const focalX = (focalEvent.clientX - transformedRect.left) / (baseScale * previousZoom);
    const focalY = (focalEvent.clientY - transformedRect.top) / (baseScale * previousZoom);
    const nextZoom = Math.max(.25, Math.min(3, Number(value) || 1));
    state.panX = (state.panX * previousZoom + (focalX - canvas.width / 2) * (previousZoom - nextZoom)) / nextZoom;
    state.panY = (state.panY * previousZoom + (focalY - canvas.height / 2) * (previousZoom - nextZoom)) / nextZoom;
    state.zoom = nextZoom;
  } else {
    state.zoom = Math.max(.25, Math.min(3, Number(value) || 1));
  }
  $("#zoomValue").textContent = `${Math.round(state.zoom * 100)}%`;
  canvas.style.transform = `scale(${state.zoom})`;
  $(".stage-wrap").classList.toggle("is-zoomed", state.zoom > 1);
  draw();
  updateCropOverlay();
}
$("#zoomIn").onclick = () => setZoom(state.zoom + .1, { clientX: canvas.getBoundingClientRect().left + canvas.getBoundingClientRect().width / 2, clientY: canvas.getBoundingClientRect().top + canvas.getBoundingClientRect().height / 2 });
$("#zoomOut").onclick = () => setZoom(state.zoom - .1, { clientX: canvas.getBoundingClientRect().left + canvas.getBoundingClientRect().width / 2, clientY: canvas.getBoundingClientRect().top + canvas.getBoundingClientRect().height / 2 });
$("#fitButton").onclick = () => {
  state.panX = 0;
  state.panY = 0;
  $(".stage-wrap").scrollTo({ left: 0, top: 0, behavior: "smooth" });
  setZoom(1);
};
$("#stageWrap").onwheel = (event) => {
  if (!state.image || !$(".rail-tool.active")?.matches('[data-panel="crop"]')) return;
  if (event.ctrlKey) event.preventDefault();
};
function point(event) { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; }
function updateBrushCursor(event) {
  const cursor = $("#brushCursor");
  if (!state.image || !state.tool || !$(".stage-wrap").classList.contains("retouch-active")) { cursor.style.display = "none"; return; }
  cursor.style.display = "block";
  if (!event) return;
  const canvasRect = canvas.getBoundingClientRect(), stageRect = $(".stage-wrap").getBoundingClientRect();
  const scale = canvasRect.width / canvas.width;
  cursor.style.left = `${event.clientX - stageRect.left}px`;
  cursor.style.top = `${event.clientY - stageRect.top}px`;
  cursor.style.width = `${Math.max(8, state.brushSize * scale)}px`;
  cursor.style.height = `${Math.max(8, state.brushSize * scale)}px`;
}
async function loadImgly() {
  if (!imglyLoader) {
    imglyLoader = import("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm")
      .then((module) => module.removeBackground)
      .catch((error) => {
        imglyLoader = null;
        throw new Error(`Impossible de charger IMG.LY : ${error.message}`);
      });
  }
  return imglyLoader;
}
async function applyImglyCutout() {
  const removeBackground = await loadImgly();
  const sourceBlob = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Impossible de préparer l’image")), "image/png"));
  const resultBlob = await removeBackground(sourceBlob, {
    progress: (_key, current, total) => {
      void current; void total;
    },
  });
  const resultUrl = URL.createObjectURL(resultBlob);
  const resultImage = new Image();
  await new Promise((resolve, reject) => {
    resultImage.onload = resolve;
    resultImage.onerror = () => reject(new Error("IMG.LY a renvoyé une image invalide"));
    resultImage.src = resultUrl;
  });
  URL.revokeObjectURL(resultUrl);
  canvas.width = resultImage.naturalWidth;
  canvas.height = resultImage.naturalHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(resultImage, 0, 0);
  state.cutoutBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
  state.cutoutEngine = "imgly";
  $("#canvasHint").textContent = "Arrière-plan retiré avec IMG.LY — affinez avec le pinceau";
  snapshot();
}
$("#autoCutout").onclick = async () => {
  if (!state.image) return;
  state.maskMode = null;
  showProcessing();
  $("#autoCutout").disabled = true;
  try {
    await applyImglyCutout();
  } catch (error) {
    console.error(error);
    $("#canvasHint").textContent = `${error.message}. Utilisation du détourage local.`;
    if (!state.cutoutBase) state.cutoutBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    state.cutoutEngine = "local";
    await applyCutout(state.cutoutBase, true);
  } finally {
    hideProcessing();
    $("#autoCutout").disabled = false;
  }
};
async function applyCutout(sourcePixels, persist = true) {
  state.cutoutEngine = "local";
  const run = ++cutoutRun;
  showProcessing();
  $("#autoCutout").disabled = true;
  const pixels = new ImageData(new Uint8ClampedArray(sourcePixels.data), sourcePixels.width, sourcePixels.height);
  const { width, height } = pixels;
  const scale = Math.max(1, Math.ceil(Math.max(width, height) / 480));
  const workWidth = Math.max(1, Math.ceil(width / scale));
  const workHeight = Math.max(1, Math.ceil(height / scale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width; sourceCanvas.height = height;
  sourceCanvas.getContext("2d").putImageData(sourcePixels, 0, 0);
  const workCanvas = document.createElement("canvas");
  workCanvas.width = workWidth; workCanvas.height = workHeight;
  const workContext = workCanvas.getContext("2d", { willReadFrequently: true });
  workContext.drawImage(sourceCanvas, 0, 0, workWidth, workHeight);
  const workPixels = workContext.getImageData(0, 0, workWidth, workHeight);
  const workData = workPixels.data;
  const edgeColors = [];
  for (let x = 0; x < workWidth; x += Math.max(1, Math.floor(workWidth / 24))) {
    edgeColors.push(pixelColor(workData, x, 0, workWidth), pixelColor(workData, x, workHeight - 1, workWidth));
  }
  for (let y = 0; y < workHeight; y += Math.max(1, Math.floor(workHeight / 24))) {
    edgeColors.push(pixelColor(workData, 0, y, workWidth), pixelColor(workData, workWidth - 1, y, workWidth));
  }
  const visited = new Uint8Array(workWidth * workHeight);
  const queue = new Int32Array(workWidth * workHeight);
  let head = 0, tail = 0;
  const enqueue = (position) => {
    if (!visited[position]) { visited[position] = 1; queue[tail++] = position; }
  };
  for (let x = 0; x < workWidth; x++) { enqueue(x); enqueue((workHeight - 1) * workWidth + x); }
  for (let y = 1; y < workHeight - 1; y++) { enqueue(y * workWidth); enqueue(y * workWidth + workWidth - 1); }
  const tolerance = Number($("#cutoutTolerance").value);
  const softness = Number($("#cutoutSoftness").value);
  const background = edgeColors.reduce((sum, color) => sum.map((value, channel) => value + color[channel] / edgeColors.length), [0, 0, 0]);
  const backgroundSpread = Math.min(70, Math.max(...edgeColors.map((color) => Math.hypot(color[0] - background[0], color[1] - background[1], color[2] - background[2]))));
  const effectiveTolerance = tolerance + backgroundSpread * .55;
  const backgroundDistance = (index) => colorDistance(workData, index, background);
  const edgeBarrier = 72;
  const canCross = (fromIndex, toIndex) => Math.hypot(
    workData[fromIndex] - workData[toIndex],
    workData[fromIndex + 1] - workData[toIndex + 1],
    workData[fromIndex + 2] - workData[toIndex + 2],
  ) <= edgeBarrier && backgroundDistance(toIndex) <= effectiveTolerance + 16;
  const foreground = new Uint8Array(workWidth * workHeight);
  const foregroundQueue = new Int32Array(workWidth * workHeight);
  let foregroundHead = 0, foregroundTail = 0;
  const foregroundSeeds = [
    [.5, .42], [.38, .32], [.62, .42], [.46, .7], [.62, .72], [.76, .72],
  ];
  const addForegroundSeed = (x, y) => {
    const position = Math.max(0, Math.min(workWidth * workHeight - 1, y * workWidth + x));
    if (!foreground[position]) { foreground[position] = 1; foregroundQueue[foregroundTail++] = position; }
  };
  foregroundSeeds.forEach(([x, y]) => addForegroundSeed(Math.floor(x * workWidth), Math.floor(y * workHeight)));
  const foregroundColor = foregroundSeeds.map(([x, y]) => {
    const index = (Math.floor(y * workHeight) * workWidth + Math.floor(x * workWidth)) * 4;
    return [workData[index], workData[index + 1], workData[index + 2]];
  });
  const foregroundTolerance = 145;
  const canCrossForeground = (fromIndex, toIndex) => Math.hypot(
    workData[fromIndex] - workData[toIndex],
    workData[fromIndex + 1] - workData[toIndex + 1],
    workData[fromIndex + 2] - workData[toIndex + 2],
  ) <= edgeBarrier;
  while (foregroundHead < foregroundTail) {
    const position = foregroundQueue[foregroundHead++];
    const x = position % workWidth, y = Math.floor(position / workWidth);
    const index = position * 4;
    const similarity = Math.min(...foregroundColor.map((color) => colorDistance(workData, index, color)));
    if (similarity > foregroundTolerance) continue;
    const addForeground = (next, nextIndex) => {
      const nextSimilarity = Math.min(...foregroundColor.map((color) => colorDistance(workData, nextIndex, color)));
      if (!foreground[next] && nextSimilarity <= foregroundTolerance && canCrossForeground(index, nextIndex)) {
        foreground[next] = 1;
        foregroundQueue[foregroundTail++] = next;
      }
    };
    if (x > 0) addForeground(position - 1, index - 4);
    if (x < workWidth - 1) addForeground(position + 1, index + 4);
    if (y > 0) addForeground(position - workWidth, index - workWidth * 4);
    if (y < workHeight - 1) addForeground(position + workWidth, index + workWidth * 4);
  }
  const processBatch = () => {
    const batchEnd = Math.min(tail, head + 5000);
    while (head < batchEnd) {
      const position = queue[head++];
      const x = position % workWidth, y = Math.floor(position / workWidth);
      const index = position * 4;
      const distance = backgroundDistance(index);
      if (distance > effectiveTolerance) continue;
      const feather = Math.max(1, softness);
      const edgeAlpha = Math.max(0, Math.min(255, Math.round((distance - effectiveTolerance + feather) / feather * 255)));
      workData[index + 3] = Math.min(workData[index + 3], edgeAlpha);
      if (x > 0 && canCross(index, index - 4)) enqueue(position - 1);
      if (x < workWidth - 1 && canCross(index, index + 4)) enqueue(position + 1);
      if (y > 0 && canCross(index, index - workWidth * 4)) enqueue(position - workWidth);
      if (y < workHeight - 1 && canCross(index, index + workWidth * 4)) enqueue(position + workWidth);
    }
  };
  while (head < tail) {
    processBatch();
    if (run !== cutoutRun) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  if (run !== cutoutRun) return;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = workWidth; maskCanvas.height = workHeight;
  const maskContext = maskCanvas.getContext("2d");
  maskContext.putImageData(workPixels, 0, 0);
  const scaledMask = document.createElement("canvas");
  scaledMask.width = width; scaledMask.height = height;
  const scaledMaskContext = scaledMask.getContext("2d");
  scaledMaskContext.imageSmoothingEnabled = true;
  scaledMaskContext.drawImage(maskCanvas, 0, 0, width, height);
  const smoothMask = scaledMaskContext.getImageData(0, 0, width, height).data;
  let removed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const workX = Math.min(workWidth - 1, Math.floor(x / scale));
      const workY = Math.min(workHeight - 1, Math.floor(y / scale));
      const fullIndex = (y * width + x) * 4;
      const workIndex = (workY * workWidth + workX) * 4;
      pixels.data[fullIndex + 3] = smoothMask[fullIndex + 3];
      if (foreground[workY * workWidth + workX]) {
        pixels.data[fullIndex + 3] = Math.max(pixels.data[fullIndex + 3], 255);
      }
      if (pixels.data[fullIndex + 3] < 128) removed++;
    }
  }
  if (removed < width * height * .01) {
    $("#canvasHint").textContent = "Fond difficile à détecter — essayez une image avec un fond plus uniforme";
  } else {
    $("#canvasHint").textContent = "Arrière-plan retiré — affinez avec le pinceau";
  }
  ctx.putImageData(pixels, 0, 0);
  hideProcessing();
  $("#autoCutout").disabled = false;
  if (persist) commitCanvas();
}
function pixelColor(data, x, y, width) {
  const index = (y * width + x) * 4;
  return [data[index], data[index + 1], data[index + 2]];
}
function colorDistance(data, index, color) {
  return Math.hypot(data[index] - color[0], data[index + 1] - color[1], data[index + 2] - color[2]);
}
$("#clearRetouch").onclick = () => { state.cutoutBase = null; state.cutoutEngine = null; draw(); };
function restoreHistory(index) {
  const source = state.history[index];
  if (!source) return;
  const image = new Image();
  image.onload = () => {
    state.image = image; state.historyIndex = index; draw();
    $("#undoButton").disabled = state.historyIndex < 1;
    $("#redoButton").disabled = state.historyIndex >= state.history.length - 1;
  };
  image.src = source;
}
$("#undoButton").onclick = () => { if (state.historyIndex > 0) restoreHistory(state.historyIndex - 1); };
$("#redoButton").onclick = () => { if (state.historyIndex < state.history.length - 1) restoreHistory(state.historyIndex + 1); };
$("#resetButton").onclick = () => location.reload();
$("#exportButton").onclick = async () => {
  if (!state.image) return;
  showProcessing();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    const link = document.createElement("a");
    link.download = `${state.fileName.replace(/\.[^.]+$/, "")}-pixo.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    hideProcessing();
  }
};
