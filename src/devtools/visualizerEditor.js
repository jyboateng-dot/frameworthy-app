/**
 * Dev-only visual editor overlay for the frame-customize visualizer pane.
 * Lets you click/drag/resize the frame and individual scene artefacts
 * directly in the browser, with a small freeform command bar, to try out
 * position/size tweaks without hand-editing pixel constants.
 *
 * NOT a customer-facing feature — only ever installed from CustomizeFramePage
 * behind an `import.meta.env.DEV` check, so it never ships in a production
 * build. Edits are visual-only (a CSS transform on the selected element) and
 * are never persisted anywhere: they're gone on reload, and don't carry over
 * between scenes since each scene mounts its own fresh SVG. To keep an edit,
 * read the dx/dy/scale values off the readout and ask for them to be baked into the
 * relevant source file (roomScenes.js for per-scene offsets, or this page's
 * own layout for a global change).
 *
 * The one thing that *does* survive a reload is whether the toggle itself is
 * on or off (localStorage), so refreshing the dev server doesn't force it
 * back on if you'd turned it off.
 */

const ACTIVE_STORAGE_KEY = 'fw-editor-active';
const TOOLBAR_POS_STORAGE_KEY = 'fw-editor-toolbar-pos';

const readStoredActive = () => {
    try {
        const raw = localStorage.getItem(ACTIVE_STORAGE_KEY);
        return raw === null ? true : raw === 'true';
    } catch {
        return true;
    }
};

const writeStoredActive = (active) => {
    try {
        localStorage.setItem(ACTIVE_STORAGE_KEY, String(active));
    } catch {
        // localStorage unavailable (private mode, etc.) — toggle just won't persist.
    }
};

const readStoredToolbarPos = () => {
    try {
        const raw = localStorage.getItem(TOOLBAR_POS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed.left === 'number' && typeof parsed.top === 'number') return parsed;
        return null;
    } catch {
        return null;
    }
};

const writeStoredToolbarPos = (pos) => {
    try {
        localStorage.setItem(TOOLBAR_POS_STORAGE_KEY, JSON.stringify(pos));
    } catch {
        // localStorage unavailable — position just won't persist.
    }
};

export function installVisualizerEditor() {
    if (window.__fwEditor) window.__fwEditor.destroy();

    const paneRoot = document.querySelector('[data-testid="visualizer-pane"]') || document.body;

    const state = {
        active: readStoredActive(),
        selected: null,
        elementState: new WeakMap(),
        drag: null,
        resize: null,
        edgeResize: null,
        depthDrag: null,
        justDragged: false,
        toolbarDrag: null,
        deletedElements: new Set(),
    };

    function getState(el) {
        if (!state.elementState.has(el)) {
            const base = el.style.transform && el.style.transform !== 'none' ? el.style.transform : '';
            state.elementState.set(el, {
                baseTransform: base,
                baseDisplay: el.style.display,
                dx: 0,
                dy: 0,
                scaleX: 1,
                scaleY: 1,
                dz: 0,
                deleted: false,
            });
        }
        return state.elementState.get(el);
    }

    function applyTransform(el) {
        const s = getState(el);
        el.style.transform = `${s.baseTransform} perspective(1200px) translate3d(${s.dx}px, ${s.dy}px, ${s.dz}px) scale3d(${s.scaleX}, ${s.scaleY}, 1)`.trim();
        el.style.transformOrigin = 'center center';
    }

    // Decouple the frame from the reference-artefact scene, and decouple
    // individual artefacts from each other and from loose leaf shapes — see
    // the module docstring above for the full rationale.
    function resolveSelectionTarget(el, drillDown) {
        if (drillDown) return el;
        const frameContainer = el.closest('[data-testid="frame-render"]');
        if (frameContainer) return frameContainer;
        const svgRoot = el.closest('svg');
        if (svgRoot) {
            let node = el;
            while (node && node !== svgRoot) {
                if (node.tagName === 'g') return node;
                node = node.parentElement;
            }
            return el;
        }
        return el;
    }

    const style = document.createElement('style');
    style.id = 'fw-editor-style';
    style.textContent = `
        /* The scene SVG (and its floor-continuation div, which extends the
           floor colour below the SVG viewBox) are pointer-events:none in the
           real app — a decorative backdrop meant to be click-through. Edit
           mode needs to actually hit them, so force interactivity while active. */
        body.fw-editing [data-testid="visualizer-pane"] svg,
        body.fw-editing [data-testid="visualizer-pane"] svg *,
        body.fw-editing [data-artefact="floor-base"] {
            pointer-events: auto !important;
        }
        #fw-editor-hover-box, #fw-editor-select-box { position: fixed; pointer-events: none; z-index: 999999; box-sizing: border-box; }
        #fw-editor-hover-box { border: 1.5px dashed #3b82f6; background: rgba(59,130,246,0.08); }
        #fw-editor-select-box { border: 2px solid #ef4444; background: rgba(239,68,68,0.05); }
        #fw-editor-label { position: fixed; z-index: 1000000; background: #111827; color: #fff; font: 11px/1.4 monospace; padding: 2px 6px; border-radius: 3px; pointer-events: none; white-space: nowrap; }
        .fw-editor-handle { position: fixed; width: 10px; height: 10px; background: #ef4444; border: 1.5px solid #fff; border-radius: 2px; z-index: 1000001; pointer-events: auto; }
        .fw-editor-side-handle { position: fixed; z-index: 1000001; background: #f97316; border: 1.5px solid #fff; border-radius: 999px; pointer-events: auto; }
        .fw-editor-side-handle[data-side="left"], .fw-editor-side-handle[data-side="right"] { width: 8px; height: 26px; cursor: ew-resize; }
        .fw-editor-side-handle[data-side="top"], .fw-editor-side-handle[data-side="bottom"] { width: 26px; height: 8px; cursor: ns-resize; }
        #fw-editor-depth-handle { position: fixed; width: 18px; height: 18px; display: grid; place-items: center; z-index: 1000001; border: 1.5px solid #fff; border-radius: 999px; background: #2563eb; color: #fff; font: 700 10px/1 system-ui, sans-serif; cursor: ns-resize; pointer-events: auto; user-select: none; }
        #fw-editor-toolbar { position: fixed; bottom: 12px; left: 12px; z-index: 1000002; background: rgba(17,24,39,0.92); color: #e5e7eb; font: 12px/1.4 system-ui, sans-serif; padding: 0 10px 8px; border-radius: 8px; display: flex; flex-direction: column; gap: 6px; width: 340px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
        #fw-editor-toolbar-handle { cursor: move; margin: 0 -10px 6px; padding: 6px 10px; border-radius: 8px 8px 0 0; background: rgba(255,255,255,0.06); font: 10px/1 system-ui, sans-serif; letter-spacing: 0.04em; color: #6b7280; user-select: none; text-align: center; }
        #fw-editor-toolbar input { width: 100%; box-sizing: border-box; background: #1f2937; color: #f9fafb; border: 1px solid #374151; border-radius: 4px; padding: 4px 6px; font: 12px monospace; }
        .fw-editor-actions { display: flex; gap: 6px; }
        .fw-editor-actions button { cursor: pointer; border: 1px solid #4b5563; background: #1f2937; color: #e5e7eb; border-radius: 4px; padding: 4px 7px; font: 11px/1.2 system-ui, sans-serif; }
        .fw-editor-actions button:hover { background: #374151; }
        #fw-editor-delete { border-color: #b91c1c; color: #fecaca; }
        #fw-editor-hint { font: 10px/1.3 system-ui, sans-serif; color: #6b7280; }
        #fw-editor-readout { white-space: pre-wrap; max-height: 120px; overflow: auto; font: 11px monospace; color: #9ca3af; }
        #fw-editor-toggle { position: fixed; top: 12px; left: 12px; z-index: 1000002; cursor: pointer; background: #111827; color: #fff; font: 12px system-ui, sans-serif; padding: 6px 10px; border-radius: 999px; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
    `;
    document.head.appendChild(style);
    document.body.classList.toggle('fw-editing', state.active);

    const uiRoot = document.createElement('div');
    uiRoot.id = 'fw-editor-root';
    document.body.appendChild(uiRoot);

    const hoverBox = document.createElement('div'); hoverBox.id = 'fw-editor-hover-box'; hoverBox.style.display = 'none';
    const selectBox = document.createElement('div'); selectBox.id = 'fw-editor-select-box'; selectBox.style.display = 'none';
    const label = document.createElement('div'); label.id = 'fw-editor-label'; label.style.display = 'none';
    const toggle = document.createElement('div');
    toggle.id = 'fw-editor-toggle';
    toggle.textContent = state.active ? '✏️ Edit Mode: ON (app frozen)' : '✏️ Edit Mode: OFF (app live)';
    const toolbar = document.createElement('div'); toolbar.id = 'fw-editor-toolbar';
    toolbar.innerHTML = `
        <div id="fw-editor-toolbar-handle">⠿⠿⠿ drag to move</div>
        <div id="fw-editor-selected-name">No selection — click an element in the visualizer</div>
        <input id="fw-editor-cmd" placeholder="command: move left 10 / shrink 20% / scale 1.2 / reset" />
        <div class="fw-editor-actions">
            <button type="button" id="fw-editor-select-viewport">Select viewport</button>
            <button type="button" id="fw-editor-delete">Delete selected</button>
            <button type="button" id="fw-editor-restore">Restore hidden</button>
        </div>
        <div id="fw-editor-readout"></div>
        <div id="fw-editor-hint">Select viewport to edit the visualizer window. Orange side handles resize each edge independently; red corners scale X/Y; blue Z adjusts depth. Click an artefact to edit it instead.</div>
    `;
    uiRoot.append(hoverBox, selectBox, label, toggle, toolbar);

    // The toolbar defaults to bottom-left (via CSS), but a saved drag
    // position overrides that — switching to explicit left/top pins it in
    // place regardless of viewport size, same tradeoff `bottom/left` made.
    const storedToolbarPos = readStoredToolbarPos();
    if (storedToolbarPos) {
        toolbar.style.left = storedToolbarPos.left + 'px';
        toolbar.style.top = storedToolbarPos.top + 'px';
        toolbar.style.bottom = 'auto';
    }

    const handles = ['nw', 'ne', 'sw', 'se'].map((pos) => {
        const h = document.createElement('div');
        h.className = 'fw-editor-handle';
        h.dataset.pos = pos;
        h.style.cursor = pos === 'ne' || pos === 'sw' ? 'nesw-resize' : 'nwse-resize';
        h.style.display = 'none';
        uiRoot.appendChild(h);
        return h;
    });
    const depthHandle = document.createElement('div');
    depthHandle.id = 'fw-editor-depth-handle';
    depthHandle.textContent = 'Z';
    depthHandle.style.display = 'none';
    uiRoot.appendChild(depthHandle);
    const sideHandles = ['left', 'right', 'top', 'bottom'].map((side) => {
        const h = document.createElement('div');
        h.className = 'fw-editor-side-handle';
        h.dataset.side = side;
        h.style.display = 'none';
        uiRoot.appendChild(h);
        return h;
    });

    function describe(el) {
        if (!el) return '';
        const artefact = el.getAttribute && el.getAttribute('data-artefact');
        if (artefact) return `${artefact} (artefact)`;
        const testid = el.getAttribute('data-testid');
        const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '';
        const groupTag = el.tagName === 'g' ? ' (group)' : '';
        return `${el.tagName.toLowerCase()}${testid ? `[data-testid=${testid}]` : ''}${cls ? '.' + cls : ''}${groupTag}`;
    }

    function positionBoxToEl(box, el) {
        const r = el.getBoundingClientRect();
        box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
        box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
        return r;
    }

    function positionHandles(el) {
        const r = el.getBoundingClientRect();
        const coords = { nw: [r.left, r.top], ne: [r.right, r.top], sw: [r.left, r.bottom], se: [r.right, r.bottom] };
        handles.forEach((h) => {
            const [x, y] = coords[h.dataset.pos];
            h.style.left = (x - 5) + 'px'; h.style.top = (y - 5) + 'px'; h.style.display = 'block';
        });
        depthHandle.style.left = (r.left + r.width / 2 - 9) + 'px';
        depthHandle.style.top = (r.top - 31) + 'px';
        depthHandle.style.display = 'grid';
        const showSideHandles = el === paneRoot;
        const sideCoords = {
            left: [r.left - 5, r.top + r.height / 2 - 13],
            right: [r.right - 3, r.top + r.height / 2 - 13],
            top: [r.left + r.width / 2 - 13, r.top - 5],
            bottom: [r.left + r.width / 2 - 13, r.bottom - 3],
        };
        sideHandles.forEach((h) => {
            const [x, y] = sideCoords[h.dataset.side];
            h.style.left = x + 'px'; h.style.top = y + 'px';
            h.style.display = showSideHandles ? 'block' : 'none';
        });
    }

    function updateReadout() {
        const nameEl = document.getElementById('fw-editor-selected-name');
        const readout = document.getElementById('fw-editor-readout');
        if (!state.selected) { nameEl.textContent = 'No selection — click an element in the visualizer'; readout.textContent = ''; return; }
        const s = getState(state.selected);
        const r = state.selected.getBoundingClientRect();
        nameEl.textContent = describe(state.selected);
        readout.textContent = `x: ${s.dx.toFixed(1)}px  y: ${s.dy.toFixed(1)}px  z: ${s.dz.toFixed(1)}px\nscale x: ${s.scaleX.toFixed(3)}  scale y: ${s.scaleY.toFixed(3)}\nrect: ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    }

    function refreshSelectedVisuals() {
        if (!state.selected) return;
        const r = positionBoxToEl(selectBox, state.selected);
        positionHandles(state.selected);
        label.style.display = 'block';
        label.style.left = r.left + 'px'; label.style.top = (r.top - 20) + 'px';
        label.textContent = describe(state.selected);
        updateReadout();
    }

    function clearSelection() {
        state.selected = null;
        selectBox.style.display = 'none'; label.style.display = 'none';
        handles.forEach((h) => h.style.display = 'none');
        depthHandle.style.display = 'none';
        sideHandles.forEach((h) => h.style.display = 'none');
        updateReadout();
    }

    function deleteSelected() {
        if (!state.selected) return;
        const el = state.selected;
        const s = getState(el);
        s.deleted = true;
        state.deletedElements.add(el);
        el.style.setProperty('display', 'none', 'important');
        clearSelection();
    }

    function restoreHidden() {
        state.deletedElements.forEach((el) => {
            const s = getState(el);
            s.deleted = false;
            if (s.baseDisplay) el.style.display = s.baseDisplay;
            else el.style.removeProperty('display');
        });
        state.deletedElements.clear();
    }

    const BLOCKED_EVENTS = ['mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'click', 'dblclick'];
    function freezeAppEvents(e) {
        if (!state.active) return;
        if (uiRoot.contains(e.target)) return;
        if (!paneRoot.contains(e.target)) return;
        e.stopPropagation();
    }
    BLOCKED_EVENTS.forEach((type) => document.addEventListener(type, freezeAppEvents, true));

    function onMouseMove(e) {
        if (state.toolbarDrag) {
            const d = state.toolbarDrag;
            toolbar.style.left = (d.startLeft + (e.clientX - d.startX)) + 'px';
            toolbar.style.top = (d.startTop + (e.clientY - d.startY)) + 'px';
            return;
        }
        if (state.drag && state.selected) {
            const s = getState(state.selected);
            s.dx = state.drag.s.dx + (e.clientX - state.drag.startX);
            s.dy = state.drag.s.dy + (e.clientY - state.drag.startY);
            applyTransform(state.selected); refreshSelectedVisuals();
            return;
        }
        if (state.resize && state.selected) {
            const s = getState(state.selected);
            const { pos, startX, startY, startRect, startScaleX, startScaleY } = state.resize;
            const horizontalDelta = (e.clientX - startX) * (pos.includes('e') ? 1 : -1);
            const verticalDelta = (e.clientY - startY) * (pos.includes('s') ? 1 : -1);
            // The transform is centred, so growing an edge by one pixel grows
            // the visual width on both sides. This keeps the element anchored
            // in place while still allowing independent width and height edits.
            s.scaleX = Math.max(0.1, startScaleX * ((startRect.width + horizontalDelta * 2) / startRect.width));
            s.scaleY = Math.max(0.1, startScaleY * ((startRect.height + verticalDelta * 2) / startRect.height));
            applyTransform(state.selected); refreshSelectedVisuals();
            return;
        }
        if (state.edgeResize && state.selected) {
            const s = getState(state.selected);
            const { side, startX, startY, startRect, startDx, startDy, startScaleX, startScaleY } = state.edgeResize;
            if (side === 'left' || side === 'right') {
                const delta = e.clientX - startX;
                const widthDelta = side === 'left' ? -delta : delta;
                const nextWidth = Math.max(12, startRect.width + widthDelta);
                const actualDelta = side === 'left' ? startRect.width - nextWidth : nextWidth - startRect.width;
                s.scaleX = startScaleX * (nextWidth / startRect.width);
                // Scaling is centred, so shift its centre half the resized edge's travel.
                s.dx = startDx + actualDelta / 2;
            } else {
                const delta = e.clientY - startY;
                const heightDelta = side === 'top' ? -delta : delta;
                const nextHeight = Math.max(12, startRect.height + heightDelta);
                const actualDelta = side === 'top' ? startRect.height - nextHeight : nextHeight - startRect.height;
                s.scaleY = startScaleY * (nextHeight / startRect.height);
                s.dy = startDy + actualDelta / 2;
            }
            applyTransform(state.selected); refreshSelectedVisuals();
            return;
        }
        if (state.depthDrag && state.selected) {
            const s = getState(state.selected);
            s.dz = Math.max(-600, Math.min(600, state.depthDrag.startZ + (state.depthDrag.startY - e.clientY)));
            applyTransform(state.selected); refreshSelectedVisuals();
            return;
        }
        if (!state.active) return;
        if (uiRoot.contains(e.target)) { hoverBox.style.display = 'none'; return; }
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || uiRoot.contains(el) || !paneRoot.contains(el)) { hoverBox.style.display = 'none'; return; }
        const target = resolveSelectionTarget(el, e.altKey);
        if (target === state.selected) { hoverBox.style.display = 'none'; return; }
        hoverBox.style.display = 'block';
        positionBoxToEl(hoverBox, target);
    }

    // Drag-to-move only starts when mousedown lands on the ALREADY-selected
    // artefact — never via an interactive overlay box — so clicking through
    // a large selection to reach something smaller behind it still works.
    function onMouseDown(e) {
        if (e.target.id === 'fw-editor-toolbar-handle') {
            const r = toolbar.getBoundingClientRect();
            toolbar.style.left = r.left + 'px';
            toolbar.style.top = r.top + 'px';
            toolbar.style.bottom = 'auto';
            state.toolbarDrag = { startX: e.clientX, startY: e.clientY, startLeft: r.left, startTop: r.top };
            e.preventDefault();
            return;
        }
        if (e.target.classList && e.target.classList.contains('fw-editor-handle') && state.selected) {
            const r = state.selected.getBoundingClientRect();
            const s = getState(state.selected);
            state.resize = {
                pos: e.target.dataset.pos,
                startX: e.clientX,
                startY: e.clientY,
                startRect: r,
                startScaleX: s.scaleX,
                startScaleY: s.scaleY,
            };
            e.preventDefault();
            return;
        }
        if (e.target.classList && e.target.classList.contains('fw-editor-side-handle') && state.selected === paneRoot) {
            const r = state.selected.getBoundingClientRect();
            const s = getState(state.selected);
            state.edgeResize = {
                side: e.target.dataset.side,
                startX: e.clientX,
                startY: e.clientY,
                startRect: r,
                startDx: s.dx,
                startDy: s.dy,
                startScaleX: s.scaleX,
                startScaleY: s.scaleY,
            };
            e.preventDefault();
            return;
        }
        if (e.target.id === 'fw-editor-depth-handle' && state.selected) {
            state.depthDrag = { startY: e.clientY, startZ: getState(state.selected).dz };
            e.preventDefault();
            return;
        }
        if (!state.active || uiRoot.contains(e.target)) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || uiRoot.contains(el) || !paneRoot.contains(el)) return;
        const target = resolveSelectionTarget(el, e.altKey);
        if (target === state.selected) {
            state.drag = { startX: e.clientX, startY: e.clientY, s: { ...getState(state.selected) } };
            e.preventDefault();
        }
    }

    function onMouseUp() {
        if (state.toolbarDrag) {
            state.toolbarDrag = null;
            const r = toolbar.getBoundingClientRect();
            writeStoredToolbarPos({ left: r.left, top: r.top });
            return;
        }
        if (state.drag || state.resize || state.edgeResize || state.depthDrag) state.justDragged = true;
        state.drag = null; state.resize = null; state.edgeResize = null; state.depthDrag = null;
    }

    function onClick(e) {
        if (!state.active) return;
        if (state.justDragged) { state.justDragged = false; return; }
        if (uiRoot.contains(e.target)) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || uiRoot.contains(el) || !paneRoot.contains(el)) return;
        e.preventDefault();
        state.selected = resolveSelectionTarget(el, e.altKey);
        hoverBox.style.display = 'none';
        selectBox.style.display = 'block';
        refreshSelectedVisuals();
    }

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('click', onClick, true);
    const onWindowScroll = () => { if (state.selected) refreshSelectedVisuals(); };
    const onWindowResize = () => { if (state.selected) refreshSelectedVisuals(); };
    window.addEventListener('scroll', onWindowScroll, true);
    window.addEventListener('resize', onWindowResize);
    const onKeydown = (e) => {
        if (e.key === 'Escape' && state.selected) clearSelection();
        const editingText = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
        if (!editingText && (e.key === 'Delete' || e.key === 'Backspace') && state.selected) {
            e.preventDefault();
            deleteSelected();
        }
    };
    document.addEventListener('keydown', onKeydown);

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        state.active = !state.active;
        writeStoredActive(state.active);
        toggle.textContent = state.active ? '✏️ Edit Mode: ON (app frozen)' : '✏️ Edit Mode: OFF (app live)';
        document.body.classList.toggle('fw-editing', state.active);
        if (!state.active) hoverBox.style.display = 'none';
    });

    const cmdInput = document.getElementById('fw-editor-cmd');
    document.getElementById('fw-editor-select-viewport').addEventListener('click', () => {
        state.selected = paneRoot;
        hoverBox.style.display = 'none';
        selectBox.style.display = 'block';
        refreshSelectedVisuals();
    });
    document.getElementById('fw-editor-delete').addEventListener('click', deleteSelected);
    document.getElementById('fw-editor-restore').addEventListener('click', restoreHidden);
    cmdInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key !== 'Enter') return;
        const cmd = cmdInput.value.trim().toLowerCase();
        cmdInput.value = '';
        if (cmd === 'delete') { deleteSelected(); return; }
        if (cmd === 'restore' || cmd === 'restore hidden') { restoreHidden(); return; }
        if (!state.selected) return;
        const s = getState(state.selected);
        let m;
        if (cmd === 'reset') { s.dx = 0; s.dy = 0; s.dz = 0; s.scaleX = 1; s.scaleY = 1; }
        else if ((m = cmd.match(/^move (left|right|up|down) (\d+(?:\.\d+)?)(px)?$/))) {
            const n = parseFloat(m[2]);
            if (m[1] === 'left') s.dx -= n; if (m[1] === 'right') s.dx += n;
            if (m[1] === 'up') s.dy -= n; if (m[1] === 'down') s.dy += n;
        }
        else if ((m = cmd.match(/^(shrink|expand) (\d+(?:\.\d+)?)%$/))) {
            const n = parseFloat(m[2]) / 100;
            const factor = m[1] === 'shrink' ? (1 - n) : (1 + n);
            s.scaleX *= factor; s.scaleY *= factor;
        }
        else if ((m = cmd.match(/^scale (\d+(?:\.\d+)?)$/))) { s.scaleX = parseFloat(m[1]); s.scaleY = parseFloat(m[1]); }
        else if ((m = cmd.match(/^scale (width|height) (\d+(?:\.\d+)?)$/))) {
            if (m[1] === 'width') s.scaleX = parseFloat(m[2]); else s.scaleY = parseFloat(m[2]);
        }
        else if ((m = cmd.match(/^(?:z|depth) (-?\d+(?:\.\d+)?)$/))) { s.dz = Math.max(-600, Math.min(600, parseFloat(m[1]))); }
        else if ((m = cmd.match(/^(x|y) (-?\d+(?:\.\d+)?)$/))) { if (m[1] === 'x') s.dx = parseFloat(m[2]); else s.dy = parseFloat(m[2]); }
        applyTransform(state.selected); refreshSelectedVisuals();
    });

    window.__fwEditor = {
        destroy() {
            restoreHidden();
            BLOCKED_EVENTS.forEach((type) => document.removeEventListener(type, freezeAppEvents, true));
            document.removeEventListener('mousemove', onMouseMove, true);
            document.removeEventListener('mousedown', onMouseDown, true);
            document.removeEventListener('mouseup', onMouseUp, true);
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onKeydown);
            window.removeEventListener('scroll', onWindowScroll, true);
            window.removeEventListener('resize', onWindowResize);
            document.body.classList.remove('fw-editing');
            uiRoot.remove(); style.remove();
            delete window.__fwEditor;
        },
    };

    return window.__fwEditor;
}
