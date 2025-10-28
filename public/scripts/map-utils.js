const SVG_NS = 'http://www.w3.org/2000/svg';
const PAN_ZOOM_CONTROLLERS = new WeakMap();
const PAN_START_THRESHOLD = 6;

const USA_INSET_CONFIG = [
  {
    id: 'AK',
    label: 'Alaska',
    x: 24,
    y: 392,
    width: 216,
    height: 132,
    padding: 10,
    radius: 14,
    labelOffset: 12,
  },
  {
    id: 'HI',
    label: 'Hawaii',
    x: 264,
    y: 474,
    width: 156,
    height: 92,
    padding: 8,
    radius: 12,
    labelOffset: 10,
  },
  {
    id: 'PR',
    label: 'Puerto Rico',
    x: 432,
    y: 474,
    width: 156,
    height: 92,
    padding: 8,
    radius: 12,
    labelOffset: 10,
  },
];

function formatNumber(value, fractionDigits = 2) {
  return Number.parseFloat(value).toFixed(fractionDigits);
}

export function enhanceUsaInsets(svg) {
  if (!(svg instanceof SVGElement) || svg.dataset.usaInsetsApplied === 'true') {
    return;
  }

  const statesGroup = svg.querySelector('.state-map__states');
  if (!statesGroup) {
    svg.dataset.usaInsetsApplied = 'true';
    return;
  }

  const parent = statesGroup.parentNode;
  if (!(parent instanceof SVGElement)) {
    svg.dataset.usaInsetsApplied = 'true';
    return;
  }

  const backgroundLayer = document.createElementNS(SVG_NS, 'g');
  backgroundLayer.setAttribute('class', 'state-map__insets state-map__insets--background');
  backgroundLayer.setAttribute('aria-hidden', 'true');

  const labelLayer = document.createElementNS(SVG_NS, 'g');
  labelLayer.setAttribute('class', 'state-map__insets state-map__insets--labels');
  labelLayer.setAttribute('aria-hidden', 'true');

  parent.insertBefore(backgroundLayer, statesGroup);
  parent.append(labelLayer);

  USA_INSET_CONFIG.forEach((config) => {
    const shape = statesGroup.querySelector(`[data-state="${config.id}"]`);
    if (!(shape instanceof SVGElement)) {
      return;
    }

    const bbox = shape.getBBox();
    if (!bbox || bbox.width === 0 || bbox.height === 0) {
      return;
    }

    const padding = config.padding ?? 8;
    const availableWidth = Math.max(0, config.width - padding * 2);
    const availableHeight = Math.max(0, config.height - padding * 2);
    const scale = Math.min(availableWidth / bbox.width, availableHeight / bbox.height);
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }

    const scaledWidth = bbox.width * scale;
    const scaledHeight = bbox.height * scale;
    const extraX = (availableWidth - scaledWidth) / 2;
    const extraY = (availableHeight - scaledHeight) / 2;
    const offsetX = config.x + padding + extraX;
    const offsetY = config.y + padding + extraY;

    const wrapper = document.createElementNS(SVG_NS, 'g');
    wrapper.setAttribute('class', `state-inset state-inset--${config.id.toLowerCase()}`);
    const transform = `translate(${formatNumber(offsetX)}, ${formatNumber(offsetY)}) scale(${formatNumber(
      scale,
      4,
    )}) translate(${formatNumber(-bbox.x)}, ${formatNumber(-bbox.y)})`;
    wrapper.setAttribute('transform', transform);

    const parentNode = shape.parentNode;
    if (parentNode) {
      parentNode.insertBefore(wrapper, shape);
    }
    wrapper.append(shape);

    const background = document.createElementNS(SVG_NS, 'rect');
    background.setAttribute('class', 'state-inset__backdrop');
    background.setAttribute('x', formatNumber(config.x));
    background.setAttribute('y', formatNumber(config.y));
    background.setAttribute('width', formatNumber(config.width));
    background.setAttribute('height', formatNumber(config.height));
    const radius = config.radius ?? 12;
    background.setAttribute('rx', formatNumber(radius));
    background.setAttribute('ry', formatNumber(radius));
    background.setAttribute('pointer-events', 'none');
    backgroundLayer.append(background);

    if (config.label) {
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('class', 'state-inset__label');
      label.setAttribute('x', formatNumber(config.x + config.width / 2));
      const offset = config.labelOffset ?? 12;
      label.setAttribute('y', formatNumber(config.y + config.height - offset));
      label.setAttribute('text-anchor', 'middle');
      label.textContent = config.label;
      label.setAttribute('pointer-events', 'none');
      labelLayer.append(label);
    }
  });

  svg.dataset.usaInsetsApplied = 'true';
}

const DEFAULT_PAN_ZOOM_OPTIONS = {
  minScale: 1,
  maxScale: 6,
  initialScale: 1,
  zoomStep: 0.35,
  controls: true,
};

function createZoomButton(label, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-zoom-controls__button';
  button.setAttribute('aria-label', ariaLabel);
  button.textContent = label;
  return button;
}

function createPanZoomController(container, baseOptions = {}) {
  const options = { ...DEFAULT_PAN_ZOOM_OPTIONS, ...baseOptions };
  const state = {
    container,
    element: null,
    scale: options.initialScale,
    minScale: options.minScale,
    maxScale: options.maxScale,
    zoomStep: options.zoomStep,
    x: 0,
    y: 0,
    baseWidth: 0,
    baseHeight: 0,
    pointerId: null,
    pointerStart: null,
    isPanning: false,
    resizeObserver: null,
  };

  let controls = null;

  function clampTranslation() {
    if (!state.element) return;
    const containerRect = container.getBoundingClientRect();
    const contentWidth = state.baseWidth * state.scale;
    const contentHeight = state.baseHeight * state.scale;
    const minX = Math.min(0, containerRect.width - contentWidth);
    const minY = Math.min(0, containerRect.height - contentHeight);
    const maxX = Math.max(0, containerRect.width - contentWidth);
    const maxY = Math.max(0, containerRect.height - contentHeight);

    state.x = Math.min(Math.max(state.x, minX), maxX);
    state.y = Math.min(Math.max(state.y, minY), maxY);
  }

  function applyTransform() {
    if (!state.element) return;
    state.element.style.transform = `matrix(${state.scale}, 0, 0, ${state.scale}, ${state.x}, ${state.y})`;
  }

  function updateBaseMetrics() {
    if (!state.element) return;
    const previousTransform = state.element.style.transform;
    state.element.style.transform = 'none';
    const rect = state.element.getBoundingClientRect();
    state.baseWidth = rect.width || container.clientWidth;
    state.baseHeight = rect.height || container.clientHeight;
    state.element.style.transform = previousTransform;
  }

  function setScale(nextScale, focalPoint) {
    if (!state.element) return;
    const targetScale = Math.min(Math.max(nextScale, state.minScale), state.maxScale);
    if (!Number.isFinite(targetScale)) {
      return;
    }

    if (!focalPoint) {
      state.scale = targetScale;
      clampTranslation();
      applyTransform();
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const relativeX = (focalPoint.x - containerRect.left - state.x) / state.scale;
    const relativeY = (focalPoint.y - containerRect.top - state.y) / state.scale;

    state.scale = targetScale;
    state.x = focalPoint.x - containerRect.left - relativeX * state.scale;
    state.y = focalPoint.y - containerRect.top - relativeY * state.scale;
    clampTranslation();
    applyTransform();
  }

  function zoomBy(delta, focalPoint) {
    const nextScale = state.scale * (1 + delta);
    setScale(nextScale, focalPoint);
  }

  function reset() {
    if (!state.element) return;
    updateBaseMetrics();
    const containerRect = container.getBoundingClientRect();
    const contentWidth = state.baseWidth * state.scale;
    const contentHeight = state.baseHeight * state.scale;
    state.x = (containerRect.width - contentWidth) / 2;
    state.y = (containerRect.height - contentHeight) / 2;
    clampTranslation();
    applyTransform();
  }

  function handleWheel(event) {
    if (!state.element) return;
    if (event.ctrlKey) {
      // Allow pinch-zoom gestures handled by the browser.
      return;
    }
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const scaleDelta = state.zoomStep * direction;
    const focal = { x: event.clientX, y: event.clientY };
    zoomBy(scaleDelta, focal);
  }

  function handlePointerDown(event) {
    if (!state.element) return;
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (!container.contains(event.target)) {
      return;
    }
    if (event.target instanceof Element) {
      const interactive = event.target.closest(
        'button, a, input, select, textarea, [data-panzoom-ignore]',
      );
      if (interactive && !interactive.classList.contains('map-panzoom__surface')) {
        return;
      }
      if (event.target.closest('.map-zoom-controls')) {
        return;
      }
    }
    state.pointerId = event.pointerId;
    state.pointerStart = {
      x: event.clientX,
      y: event.clientY,
      originX: state.x,
      originY: state.y,
    };
    state.isPanning = false;
  }

  function handlePointerMove(event) {
    if (state.pointerId !== event.pointerId || !state.pointerStart) {
      return;
    }
    const dx = event.clientX - state.pointerStart.x;
    const dy = event.clientY - state.pointerStart.y;
    if (!state.isPanning) {
      const distance = Math.hypot(dx, dy);
      if (distance < PAN_START_THRESHOLD) {
        return;
      }
      state.isPanning = true;
      if (container.setPointerCapture) {
        try {
          container.setPointerCapture(event.pointerId);
        } catch (error) {
          console.warn('Failed to capture pointer for pan/zoom surface.', error);
        }
      }
      container.classList.add('map-panzoom--panning');
    }
    state.x = state.pointerStart.originX + dx;
    state.y = state.pointerStart.originY + dy;
    clampTranslation();
    applyTransform();
  }

  function handlePointerUp(event) {
    if (state.pointerId !== event.pointerId) {
      return;
    }
    if (state.isPanning && container.hasPointerCapture && container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    container.classList.remove('map-panzoom--panning');
    state.pointerId = null;
    state.pointerStart = null;
    state.isPanning = false;
  }

  function ensureControls() {
    if (!options.controls) {
      return;
    }
    if (controls && controls.isConnected) {
      return;
    }
    controls = document.createElement('div');
    controls.className = 'map-zoom-controls';

    const zoomIn = createZoomButton('+', 'Zoom in');
    const zoomOut = createZoomButton('−', 'Zoom out');
    const resetButton = createZoomButton('⟳', 'Reset view');

    zoomIn.addEventListener('click', () => {
      const rect = container.getBoundingClientRect();
      const focal = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      zoomBy(state.zoomStep, focal);
    });
    zoomOut.addEventListener('click', () => {
      const rect = container.getBoundingClientRect();
      const focal = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      zoomBy(-state.zoomStep, focal);
    });
    resetButton.addEventListener('click', () => {
      state.scale = options.initialScale;
      reset();
    });

    controls.append(zoomIn, zoomOut, resetButton);
    container.append(controls);
  }

  container.classList.add('map-panzoom');
  container.addEventListener('wheel', handleWheel, { passive: false });
  container.addEventListener('pointerdown', handlePointerDown);
  container.addEventListener('pointermove', handlePointerMove);
  container.addEventListener('pointerup', handlePointerUp);
  container.addEventListener('pointercancel', handlePointerUp);
  container.addEventListener('lostpointercapture', handlePointerUp);

  if ('ResizeObserver' in window) {
    state.resizeObserver = new ResizeObserver(() => {
      updateBaseMetrics();
      clampTranslation();
      applyTransform();
    });
    state.resizeObserver.observe(container);
  }

  ensureControls();

  return {
    attach(newElement, overrideOptions = {}) {
      if (!(newElement instanceof Element)) {
        return;
      }
      if (state.element && state.element !== newElement) {
        state.element.classList.remove('map-panzoom__surface');
        state.element.style.transform = '';
        state.element.style.touchAction = '';
        state.element.style.willChange = '';
        state.element.style.transformOrigin = '';
      }

      Object.assign(state, {
        element: newElement,
        scale: overrideOptions.initialScale ?? options.initialScale,
        minScale: overrideOptions.minScale ?? options.minScale,
        maxScale: overrideOptions.maxScale ?? options.maxScale,
        zoomStep: overrideOptions.zoomStep ?? options.zoomStep,
      });

      state.element.classList.add('map-panzoom__surface');
      state.element.style.touchAction = 'none';
      state.element.style.transformOrigin = '0 0';
      state.element.style.willChange = 'transform';

      updateBaseMetrics();
      state.x = (container.clientWidth - state.baseWidth * state.scale) / 2;
      state.y = (container.clientHeight - state.baseHeight * state.scale) / 2;
      clampTranslation();
      applyTransform();
    },
    zoomBy(delta, focalPoint) {
      zoomBy(delta, focalPoint);
    },
    reset() {
      state.scale = options.initialScale;
      reset();
    },
  };
}

export function enablePanZoom(container, element, options = {}) {
  if (!(container instanceof HTMLElement) || !(element instanceof Element)) {
    return null;
  }
  let controller = PAN_ZOOM_CONTROLLERS.get(container);
  if (!controller) {
    controller = createPanZoomController(container, options);
    PAN_ZOOM_CONTROLLERS.set(container, controller);
  }
  controller.attach(element, options);
  return controller;
}
