const dataCache = new Map();
const chartRegistry = new Map();
const pendingDefinitions = new Map();
const sizingRegistry = new Map();
let observerRef = null;

const FALLBACK_RATIO = 0.6;

function getChartContainer(canvas) {
  if (!canvas) return null;
  return canvas.closest('.viz-canvas') ?? canvas.parentElement ?? null;
}

function setupCanvasSizing(canvas) {
  const container = getChartContainer(canvas);
  if (!container) {
    return null;
  }

  const previousInline = {
    containerHeight: container.style.height,
    canvasHeight: canvas.style.height,
  };

  const ratioAttr = Number.parseFloat(canvas.dataset.chartRatio ?? canvas.dataset.aspectRatio);
  const ratio = Number.isFinite(ratioAttr) && ratioAttr > 0 ? ratioAttr : FALLBACK_RATIO;

  const updateHeight = () => {
    const width = container.clientWidth;
    if (!width) {
      return;
    }
    const styles = window.getComputedStyle(container);
    const minHeight = Number.parseFloat(styles.minHeight) || 0;
    const maxHeight = Number.parseFloat(styles.maxHeight);
    let nextHeight = width * ratio;
    if (minHeight) {
      nextHeight = Math.max(nextHeight, minHeight);
    }
    if (Number.isFinite(maxHeight) && maxHeight > 0) {
      nextHeight = Math.min(nextHeight, maxHeight);
    }
    container.style.height = `${nextHeight}px`;
    canvas.style.height = '100%';
  };

  updateHeight();

  const resizeCallback = () => updateHeight();
  let observer;
  if ('ResizeObserver' in window) {
    observer = new ResizeObserver(resizeCallback);
    observer.observe(container);
  } else {
    window.addEventListener('resize', resizeCallback, { passive: true });
  }

  return () => {
    if (observer) {
      observer.disconnect();
    } else {
      window.removeEventListener('resize', resizeCallback);
    }
    container.style.height = previousInline.containerHeight;
    canvas.style.height = previousInline.canvasHeight;
  };
}

function ensureChartDefaults() {
  if (!window.Chart || ensureChartDefaults._set) return;
  ensureChartDefaults._set = true;
  const { Chart } = window;
  Chart.defaults.font.family = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  Chart.defaults.font.weight = 500;
  Chart.defaults.color = '#0b2545';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.align = 'end';
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(11, 37, 69, 0.88)';
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.titleColor = '#f5f8ff';
  Chart.defaults.plugins.tooltip.bodyColor = '#f5f8ff';
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.elements.bar.borderRadius = 6;
  Chart.defaults.elements.bar.borderSkipped = false;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
}

async function loadJson(url) {
  if (!dataCache.has(url)) {
    dataCache.set(
      url,
      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status}`);
          }
          return response.json();
        })
        .then((json) => (typeof structuredClone === 'function' ? structuredClone(json) : JSON.parse(JSON.stringify(json))))
    );
  }
  return dataCache.get(url);
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function evenSample(series, limit) {
  if (!limit || series.length <= limit) {
    return series;
  }
  const step = Math.ceil(series.length / limit);
  const sampled = [];
  for (let i = 0; i < series.length; i += step) {
    sampled.push(series[i]);
  }
  return sampled;
}

function rankAndSlice(series, limit, valueAccessor = (item) => item.value ?? item.players ?? 0) {
  if (!limit || series.length <= limit) {
    return series;
  }
  return [...series]
    .sort((a, b) => valueAccessor(b) - valueAccessor(a))
    .slice(0, limit);
}

const helpers = {
  formatNumber(value, maximumFractionDigits = 1) {
    const options = { maximumFractionDigits };
    if (maximumFractionDigits === 0) {
      options.minimumFractionDigits = 0;
    }
    return new Intl.NumberFormat('en-US', options).format(value);
  },
  evenSample,
  rankAndSlice,
};

function scheduleMount(callback) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 1200 });
  } else {
    window.setTimeout(callback, 0);
  }
}

function instantiateChart(canvas, definition) {
  if (!canvas || chartRegistry.has(canvas)) {
    return;
  }

  const run = async () => {
    const existingCleanup = sizingRegistry.get(canvas);
    if (existingCleanup) {
      existingCleanup();
      sizingRegistry.delete(canvas);
    }
    const sizingCleanup = setupCanvasSizing(canvas);
    try {
      ensureChartDefaults();
      const sourceData = definition.source ? await loadJson(definition.source) : undefined;
      const config = await definition.createConfig(sourceData, helpers);
      if (!config || !canvas.isConnected) {
        if (sizingCleanup) {
          sizingCleanup();
        }
        return;
      }
      if (prefersReducedMotion()) {
        config.options = config.options || {};
        config.options.animation = false;
      }
      const chart = new window.Chart(canvas.getContext('2d'), config);
      chartRegistry.set(canvas, chart);
      if (sizingCleanup) {
        sizingRegistry.set(canvas, sizingCleanup);
      }
    } catch (error) {
      if (sizingCleanup) {
        sizingCleanup();
      }
      console.error('Unable to mount chart', error);
      const container = canvas.closest('[data-chart-wrapper]');
      if (container && !container.querySelector('.viz-error__message')) {
        container.classList.add('viz-error');
        const message = document.createElement('p');
        message.className = 'viz-error__message';
        message.textContent = 'Chart failed to load.';
        container.appendChild(message);
      }
    }
  };

  scheduleMount(run);
}

function getObserver() {
  if (!('IntersectionObserver' in window)) {
    return null;
  }
  if (!observerRef) {
    observerRef = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          const definition = pendingDefinitions.get(entry.target);
          if (definition) {
            instantiateChart(entry.target, definition);
            pendingDefinitions.delete(entry.target);
          }
          observerRef.unobserve(entry.target);
        });
      },
      { rootMargin: '120px 0px' }
    );
  }
  return observerRef;
}

export function registerCharts(configs) {
  const observer = getObserver();

  configs.forEach((config) => {
    const canvas =
      typeof config.element === 'string' ? document.querySelector(config.element) : config.element;
    if (!canvas) {
      return;
    }
    pendingDefinitions.set(canvas, config);
    if (observer) {
      observer.observe(canvas);
    } else {
      instantiateChart(canvas, config);
      pendingDefinitions.delete(canvas);
    }
  });
}

export function destroyCharts() {
  chartRegistry.forEach((chart, canvas) => {
    chart.destroy();
    const cleanup = sizingRegistry.get(canvas);
    if (cleanup) {
      cleanup();
      sizingRegistry.delete(canvas);
    }
  });
  chartRegistry.clear();
  pendingDefinitions.clear();
  if (observerRef) {
    observerRef.disconnect();
    observerRef = null;
  }
}

export { helpers };
