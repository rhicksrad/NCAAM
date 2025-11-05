import { arc as d3Arc, format as d3Format, pie as d3Pie, select } from "../lib/vendor/d3-bundle.js";
import type { PieArcDatum, Selection } from "d3";

import { createChartContainer, type ChartContainerHandle } from "../lib/charts/container.js";
import { setChartDefaults } from "../lib/charts/defaults.js";
import { createSVG } from "../lib/charts/frame.js";
import { resolveColor } from "../lib/charts/theme.js";
import { requireOk } from "../lib/health.js";

const DATA_URL = new URL("../../data/fun-lab/mascot-index.json", import.meta.url).toString();

interface MascotIndexRecord {
  id: number;
  full_name: string;
  college: string;
  mascot: string;
  abbreviation: string | null;
  conference: {
    id: number;
    name: string;
    short_name: string | null;
  } | null;
  category: string;
  category_label: string;
  family: string;
  family_label: string;
}

interface MascotCategorySummary {
  slug: string;
  label: string;
  family: string;
  family_label: string;
  count: number;
}

interface MascotFamilySummary {
  slug: string;
  label: string;
  count: number;
}

interface MascotIndexPayload {
  generated_at?: string;
  source?: Record<string, unknown>;
  total_programs: number;
  total_conferences?: number;
  families: MascotFamilySummary[];
  categories: MascotCategorySummary[];
  records: MascotIndexRecord[];
}

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = d3Format(".1%");

const app = document.getElementById("app");
if (!app) {
  throw new Error("Fun Lab requires an #app container");
}

setChartDefaults();

app.innerHTML = `
  <div class="fun-lab stack" data-gap="lg">
    <section class="card stack fun-lab__intro" data-gap="sm">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Mascot Fun Lab kickoff</h2>
        <p id="fun-lab-summary" class="section-summary">Loading mascot taxonomy…</p>
      </header>
      <div class="fun-lab__meta">
        <span id="fun-lab-generated">Updated just now</span>
        <a id="fun-lab-download" href="${DATA_URL}" download>Download mascot JSON</a>
      </div>
    </section>
    <section class="card stack fun-lab__archetype" data-gap="lg">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Mascot archetype share</h2>
        <p id="fun-lab-chart-summary" class="section-summary">Crunching archetype shares…</p>
      </header>
      <article class="viz-card fun-lab__chart-card">
        <div id="fun-lab-chart" class="fun-lab__chart-surface viz-canvas" role="presentation"></div>
      </article>
      <div id="fun-lab-legend" class="fun-lab__legend" aria-live="polite">
        <p class="fun-lab__legend-empty">Crunching archetype tiles…</p>
      </div>
    </section>
    <section class="card stack fun-lab__index" data-gap="md">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Division I mascot index</h2>
        <p class="section-summary">Sort, regroup, and remix each program’s mascot archetype for future Fun Lab experiments.</p>
      </header>
      <div class="table-shell fun-lab__table-shell">
        <table id="fun-lab-table" aria-label="Division I mascot taxonomy index">
          <thead>
            <tr>
              <th scope="col">Program</th>
              <th scope="col">Mascot</th>
              <th scope="col">Category</th>
              <th scope="col">Family</th>
              <th scope="col">Conference</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  </div>
`;

const summaryEl = document.getElementById("fun-lab-summary");
const generatedEl = document.getElementById("fun-lab-generated");
const chartSummaryEl = document.getElementById("fun-lab-chart-summary");
const chartRoot = document.getElementById("fun-lab-chart") as HTMLElement | null;
const legendRoot = document.getElementById("fun-lab-legend") as HTMLElement | null;
const tableEl = document.getElementById("fun-lab-table") as HTMLTableElement | null;

const chartHandle = chartRoot ? createChartContainer(chartRoot, { ratio: 0.82 }) : null;

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0%";
  }
  return percentFormatter(Math.max(0, value));
}

function measureContainerSize(element: HTMLElement): { width: number; height: number } {
  const doc = element.ownerDocument ?? document;
  const view = doc.defaultView;
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || element.clientWidth || element.offsetWidth));
  const height = Math.max(1, Math.round(rect.height || element.clientHeight || element.offsetHeight));
  if (width > 0 && height > 0) {
    return { width, height };
  }
  const fallbackWidth = view ? Math.round(view.innerWidth * 0.9) : 600;
  const fallbackHeight = Math.round(fallbackWidth * 0.6);
  return { width: Math.max(1, fallbackWidth), height: Math.max(1, fallbackHeight) };
}

function readBarRadius(element: HTMLElement): number {
  const doc = element.ownerDocument ?? document;
  const view = doc.defaultView;
  if (!view) {
    return 8;
  }
  const value = Number.parseFloat(view.getComputedStyle(element).getPropertyValue("--chart-bar-radius"));
  return Number.isFinite(value) ? value : 8;
}

async function fetchMascotIndex(): Promise<MascotIndexPayload> {
  const response = await requireOk(DATA_URL, "Fun Lab", {
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json()) as MascotIndexPayload;
  if (!payload || !Array.isArray(payload.records)) {
    throw new Error("Mascot index payload is malformed");
  }
  return payload;
}

function describeSummary(data: MascotIndexPayload): string {
  const total = data.total_programs;
  if (!total || total <= 0) {
    return "No mascot data available yet.";
  }

  const categories = [...data.categories].sort((a, b) => b.count - a.count);
  const families = [...data.families].sort((a, b) => b.count - a.count);
  const topCategory = categories[0];
  const secondCategory = categories[1];
  const rareCategory = categories[categories.length - 1];
  const topFamily = families[0];

  const pieces: string[] = [
    `We classified ${numberFormatter.format(total)} Division I programs into ${categories.length} mascot archetypes.`,
  ];
  if (topFamily) {
    const share = formatPercent(topFamily.count / total);
    pieces.push(`${topFamily.label} lead the board at ${numberFormatter.format(topFamily.count)} programs (${share}).`);
  }
  if (topCategory) {
    pieces.push(
      `${topCategory.label} is the most common archetype with ${numberFormatter.format(topCategory.count)} programs ` +
        `(${formatPercent(topCategory.count / total)}).`,
    );
  }
  if (rareCategory && rareCategory !== topCategory) {
    pieces.push(
      `${rareCategory.label} shows up the least, with just ${numberFormatter.format(rareCategory.count)} programs ` +
        `(${formatPercent(rareCategory.count / total)}).`,
    );
  } else if (secondCategory) {
    pieces.push(
      `${secondCategory.label} trails close behind at ${numberFormatter.format(secondCategory.count)} programs ` +
        `(${formatPercent(secondCategory.count / total)}).`,
    );
  }

  return pieces.join(" ");
}

function formatGeneratedAt(timestamp?: string): string {
  if (!timestamp) {
    return "Generated from the latest worker snapshot.";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Generated from the latest worker snapshot.";
  }
  return `Generated ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function describeChartSummary(
  categories: MascotCategorySummary[],
  totalPrograms: number,
  activeCategory: string | null,
): string {
  if (!totalPrograms || totalPrograms <= 0 || categories.length === 0) {
    return "No mascot taxonomy available yet.";
  }

  if (activeCategory) {
    const selected = categories.find(category => category.slug === activeCategory);
    if (selected) {
      const share = formatPercent(selected.count / totalPrograms);
      return `${selected.label} programs only — ${numberFormatter.format(selected.count)} schools (${share}) in the index. Click again to reset.`;
    }
  }

  if (categories.length >= 2) {
    const [top, runnerUp] = categories;
    return `${top.label} owns ${formatPercent(top.count / totalPrograms)} of Division I mascots, with ${runnerUp.label} next at ${formatPercent(
      runnerUp.count / totalPrograms,
    )}.`;
  }

  if (categories.length === 1) {
    const top = categories[0];
    return `${top.label} accounts for ${formatPercent(top.count / totalPrograms)} of Division I mascots.`;
  }

  return "No mascot taxonomy available yet.";
}

function buildLegend(
  root: HTMLElement,
  categories: MascotCategorySummary[],
  colorByCategory: Map<string, string>,
  total: number,
  onToggle: (slug: string) => void,
  activeCategory: string | null,
): void {
  root.innerHTML = "";
  if (categories.length === 0) {
    const empty = root.ownerDocument?.createElement("p") ?? document.createElement("p");
    empty.className = "fun-lab__legend-empty";
    empty.textContent = "No mascot taxonomy available yet.";
    root.appendChild(empty);
    return;
  }
  const list = root.ownerDocument?.createElement("ul") ?? document.createElement("ul");
  list.className = "fun-lab__legend-list";
  list.setAttribute("role", "list");

  categories.forEach((category, index) => {
    const color = colorByCategory.get(category.slug) ?? resolveColor(index);
    const item = root.ownerDocument?.createElement("li") ?? document.createElement("li");
    item.className = "fun-lab__legend-item";
    item.dataset.category = category.slug;
    item.style.setProperty("--swatch-color", color);
    item.setAttribute("role", "button");
    item.tabIndex = 0;

    const isActive = activeCategory === category.slug;
    const isDimmed = activeCategory !== null && !isActive;
    if (isActive) {
      item.classList.add("fun-lab__legend-item--active");
    }
    if (isDimmed) {
      item.classList.add("fun-lab__legend-item--dimmed");
    }
    item.setAttribute("aria-pressed", isActive ? "true" : "false");

    const swatch = item.ownerDocument.createElement("span");
    swatch.className = "fun-lab__legend-swatch";
    swatch.setAttribute("aria-hidden", "true");
    item.appendChild(swatch);

    const info = item.ownerDocument.createElement("div");
    info.className = "fun-lab__legend-info";

    const label = item.ownerDocument.createElement("span");
    label.className = "fun-lab__legend-label";
    label.textContent = category.label;
    info.appendChild(label);

    const meta = item.ownerDocument.createElement("span");
    meta.className = "fun-lab__legend-meta";
    const percent = formatPercent(category.count / total);
    meta.innerHTML = `<strong>${percent}</strong> • ${numberFormatter.format(category.count)} programs`;
    info.appendChild(meta);

    item.appendChild(info);

    const handleToggle = () => {
      onToggle(category.slug);
    };
    item.addEventListener("click", event => {
      event.preventDefault();
      handleToggle();
    });
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        handleToggle();
      }
    });

    list.appendChild(item);
  });

  root.appendChild(list);
}

interface ChartControls {
  colorByCategory: Map<string, string>;
  setActiveCategory: (slug: string | null) => void;
  onArcToggle: (callback: (slug: string) => void) => void;
}

function renderChart(
  categories: MascotCategorySummary[],
  total: number,
  chartContainer: HTMLElement,
  handle: ChartContainerHandle,
): ChartControls {
  const colorByCategory = new Map<string, string>();
  categories.forEach((category, index) => {
    colorByCategory.set(category.slug, resolveColor(index));
  });

  let activeSlug: string | null = null;
  let arcToggleHandler: ((slug: string) => void) | null = null;
  let arcs: Selection<SVGPathElement, PieArcDatum<MascotCategorySummary>, SVGGElement, unknown> | null = null;

  const applyActiveState = () => {
    if (!arcs) {
      return;
    }
    arcs.each(function (d: PieArcDatum<MascotCategorySummary>) {
      const element = this as SVGPathElement;
      const isActive = activeSlug !== null && d.data.slug === activeSlug;
      const isDimmed = activeSlug !== null && d.data.slug !== activeSlug;
      element.classList.toggle("fun-lab__arc--dimmed", isDimmed);
      element.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  handle.mount(() => {
    chartContainer.innerHTML = "";

    const { width, height } = measureContainerSize(chartContainer);
    const radius = Math.min(width, height) / 2;

    const svg = createSVG(chartContainer, width, height, {
      title: "Mascot archetype share",
      description: "Donut chart showing the share of each mascot archetype across Division I programs.",
      id: "fun-lab-mascot-share",
    });

    const group = select(svg)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const barRadius = readBarRadius(chartContainer);

    const pie = d3Pie<MascotCategorySummary>().value((d: MascotCategorySummary) => d.count).sort(null);
    const arc = d3Arc<MascotCategorySummary>()
      .innerRadius(radius * 0.55)
      .outerRadius(Math.max(0, radius - 12))
      .padAngle(0.012)
      .cornerRadius(barRadius);

    const invokeToggle = (slug: string) => {
      if (arcToggleHandler) {
        arcToggleHandler(slug);
      }
    };

    arcs = group
      .selectAll<SVGPathElement>("path.fun-lab__arc")
      .data(pie(categories))
      .join("path") as Selection<SVGPathElement, PieArcDatum<MascotCategorySummary>, SVGGElement, unknown>;

    arcs
      .attr("class", "fun-lab__arc")
      .attr("fill", (d: PieArcDatum<MascotCategorySummary>, index: number) => {
        const color = colorByCategory.get(d.data.slug);
        if (color) {
          return color;
        }
        const fallback = resolveColor(index);
        colorByCategory.set(d.data.slug, fallback);
        return fallback;
      })
      .attr("stroke", "var(--chart-bg)")
      .attr("stroke-width", "calc(var(--chart-line-width) * 1px)")
      .attr("d", (d: PieArcDatum<MascotCategorySummary>) => arc(d) ?? "")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("focusable", "true")
      .attr("aria-pressed", "false")
      .attr("aria-label", (d: PieArcDatum<MascotCategorySummary>) => `Toggle ${d.data.label} programs`)
      .on("click", (event: PointerEvent, d: PieArcDatum<MascotCategorySummary>) => {
        event.preventDefault();
        invokeToggle(d.data.slug);
      })
      .on("keydown", (event: KeyboardEvent, d: PieArcDatum<MascotCategorySummary>) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          invokeToggle(d.data.slug);
        }
      });

    arcs.append("title").text((d: PieArcDatum<MascotCategorySummary>) => {
      const share = formatPercent(d.data.count / total);
      return `${d.data.label}: ${numberFormatter.format(d.data.count)} programs (${share}). Click to isolate this archetype.`;
    });

    group
      .append("text")
      .attr("class", "fun-lab__chart-total")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .text(numberFormatter.format(total));

    group
      .append("text")
      .attr("class", "fun-lab__chart-total fun-lab__chart-total--caption")
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .text("programs");

    applyActiveState();
  });

  return {
    colorByCategory,
    setActiveCategory: (slug: string | null) => {
      if (!arcs) {
        return;
      }
      arcs.each(function (this: SVGPathElement, d: PieArcDatum<MascotCategorySummary>) {
        const element = this;
        const isActive = slug !== null && d.data.slug === slug;
        const isDimmed = slug !== null && d.data.slug !== slug;
        element.classList.toggle("fun-lab__arc--dimmed", isDimmed);
        element.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    },
    onArcToggle: (callback: (slug: string) => void) => {
      arcToggleHandler = callback;
    },
  };
}

function renderTable(
  table: HTMLTableElement,
  records: MascotIndexRecord[],
  colorByCategory: Map<string, string>,
): void {
  const tbody = table.tBodies[0] ?? table.createTBody();
  tbody.innerHTML = "";

  if (records.length === 0) {
    const row = tbody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = table.tHead?.rows[0]?.cells.length ?? 5;
    cell.className = "fun-lab__cell fun-lab__cell--empty";
    cell.textContent = "No programs match this filter yet.";
    return;
  }

  records.forEach(record => {
    const row = tbody.insertRow();

    const programCell = row.insertCell();
    programCell.className = "fun-lab__cell fun-lab__cell--program";
    programCell.textContent = record.full_name;

    const mascotCell = row.insertCell();
    mascotCell.className = "fun-lab__cell fun-lab__cell--mascot";
    mascotCell.textContent = record.mascot;

    const categoryCell = row.insertCell();
    categoryCell.className = "fun-lab__cell fun-lab__cell--category";
    const chip = table.ownerDocument?.createElement("span") ?? document.createElement("span");
    chip.className = "fun-lab__chip";
    chip.textContent = record.category_label;
    const color = colorByCategory.get(record.category);
    if (color) {
      chip.style.setProperty("--chip-color", color);
    }
    categoryCell.appendChild(chip);

    const familyCell = row.insertCell();
    familyCell.className = "fun-lab__cell fun-lab__cell--family";
    familyCell.textContent = record.family_label;

    const conferenceCell = row.insertCell();
    conferenceCell.className = "fun-lab__cell fun-lab__cell--conference";
    if (record.conference) {
      const label = record.conference.short_name ?? record.conference.name;
      conferenceCell.textContent = label;
      if (record.conference.name && record.conference.name !== label) {
        conferenceCell.title = record.conference.name;
      }
    } else {
      conferenceCell.textContent = "—";
    }
  });
}

async function boot(): Promise<void> {
  if (!summaryEl || !chartSummaryEl || !chartRoot || !legendRoot || !tableEl || !generatedEl) {
    throw new Error("Fun Lab layout failed to mount");
  }

  if (!chartHandle) {
    throw new Error("Fun Lab chart containers failed to initialize");
  }

  const chartContainerHandle = chartHandle!;

  const summaryNode = summaryEl;
  const chartSummaryNode = chartSummaryEl;
  const chartHost = chartRoot;
  const legendHost = legendRoot;
  const tableNode = tableEl;
  const generatedNode = generatedEl;

  try {
    const data = await fetchMascotIndex();
    summaryNode.textContent = describeSummary(data);
    generatedNode.textContent = formatGeneratedAt(data.generated_at);

    const categories = [...data.categories].sort((a, b) => b.count - a.count);
    const chartControls = renderChart(categories, data.total_programs, chartHost, chartContainerHandle);

    const sortedRecords = [...data.records].sort((a, b) => {
      if (a.category === b.category) {
        return a.full_name.localeCompare(b.full_name, "en-US");
      }
      return a.category_label.localeCompare(b.category_label, "en-US");
    });
    let activeCategory: string | null = null;

    const handleCategoryToggle = (slug: string) => {
      const next = activeCategory === slug ? null : slug;
      applyCategoryFilter(next);
    };

    function applyCategoryFilter(next: string | null) {
      activeCategory = next;
      const filteredRecords = next ? sortedRecords.filter(record => record.category === next) : sortedRecords;
      renderTable(tableNode, filteredRecords, chartControls.colorByCategory);
      chartControls.setActiveCategory(next);
      buildLegend(legendHost, categories, chartControls.colorByCategory, data.total_programs, handleCategoryToggle, next);
      chartSummaryNode.textContent = describeChartSummary(categories, data.total_programs, next);
    }

    chartControls.onArcToggle(handleCategoryToggle);
    applyCategoryFilter(null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summaryNode.textContent = "We couldn’t load the mascot index. Try refreshing to replay the experiment.";
    chartSummaryNode.textContent = `Load error: ${message}`;
    chartHost.textContent = "No chart data";
    legendHost.textContent = "";
  }
}

void boot();
