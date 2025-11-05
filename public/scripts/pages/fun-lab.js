import { format as d3Format } from "d3-format";
import { select } from "d3-selection";
import * as d3Shape from "d3-shape";
import { createSVG } from "../lib/charts/frame.js";
import { resolveColor } from "../lib/charts/theme.js";
const DATA_URL = "data/fun-lab/mascot-index.json";
const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = d3Format(".1%");
const d3Arc = d3Shape.arc;
const d3Pie = d3Shape.pie;
const app = document.getElementById("app");
if (!app) {
    throw new Error("Fun Lab requires an #app container");
}
app.innerHTML = `
  <div class="fun-lab stack" data-gap="lg">
    <section class="card stack" data-gap="sm">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Mascot Fun Lab kickoff</h2>
        <p id="fun-lab-summary" class="section-summary">Loading mascot taxonomy…</p>
      </header>
      <div class="fun-lab__meta">
        <span id="fun-lab-generated">Updated just now</span>
        <a id="fun-lab-download" href="${DATA_URL}" download>Download mascot JSON</a>
      </div>
    </section>
    <section class="card stack" data-gap="md">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Mascot archetype share</h2>
        <p id="fun-lab-chart-summary" class="section-summary">Crunching archetype shares…</p>
      </header>
      <div class="fun-lab__chart-grid">
        <div id="fun-lab-chart" class="fun-lab__chart-surface" role="presentation"></div>
        <div id="fun-lab-legend" class="fun-lab__legend" aria-live="polite"></div>
      </div>
    </section>
    <section class="card stack" data-gap="md">
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
const chartRoot = document.getElementById("fun-lab-chart");
const legendRoot = document.getElementById("fun-lab-legend");
const tableEl = document.getElementById("fun-lab-table");
function formatPercent(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return "0.0%";
    }
    return percentFormatter(Math.max(0, value));
}
async function fetchMascotIndex() {
    const response = await fetch(DATA_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json());
    if (!payload || !Array.isArray(payload.records)) {
        throw new Error("Mascot index payload is malformed");
    }
    return payload;
}
function describeSummary(data) {
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
    const pieces = [
        `We classified ${numberFormatter.format(total)} Division I programs into ${categories.length} mascot archetypes.`,
    ];
    if (topFamily) {
        const share = formatPercent(topFamily.count / total);
        pieces.push(`${topFamily.label} lead the board at ${numberFormatter.format(topFamily.count)} programs (${share}).`);
    }
    if (topCategory) {
        pieces.push(`${topCategory.label} is the most common archetype with ${numberFormatter.format(topCategory.count)} programs ` +
            `(${formatPercent(topCategory.count / total)}).`);
    }
    if (rareCategory && rareCategory !== topCategory) {
        pieces.push(`${rareCategory.label} shows up the least, with just ${numberFormatter.format(rareCategory.count)} programs ` +
            `(${formatPercent(rareCategory.count / total)}).`);
    }
    else if (secondCategory) {
        pieces.push(`${secondCategory.label} trails close behind at ${numberFormatter.format(secondCategory.count)} programs ` +
            `(${formatPercent(secondCategory.count / total)}).`);
    }
    return pieces.join(" ");
}
function formatGeneratedAt(timestamp) {
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
function buildLegend(root, categories, colorByCategory, total) {
    root.innerHTML = "";
    const list = root.ownerDocument?.createElement("ul") ?? document.createElement("ul");
    list.className = "fun-lab__legend-list";
    list.setAttribute("role", "list");
    categories.forEach((category, index) => {
        const color = colorByCategory.get(category.slug) ?? resolveColor(index);
        const item = root.ownerDocument?.createElement("li") ?? document.createElement("li");
        item.className = "fun-lab__legend-item";
        item.style.setProperty("--swatch-color", color);
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
        list.appendChild(item);
    });
    root.appendChild(list);
}
function renderChart(data, chartContainer, legendContainer) {
    chartContainer.innerHTML = "";
    const categories = [...data.categories].sort((a, b) => b.count - a.count);
    const total = data.total_programs;
    const width = 520;
    const height = 520;
    const radius = Math.min(width, height) / 2;
    const svg = createSVG(chartContainer, width, height, {
        title: "Mascot archetype share",
        description: "Donut chart showing the share of each mascot archetype across Division I programs.",
        id: "fun-lab-mascot-share",
    });
    const group = select(svg)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);
    const pie = d3Pie().value((d) => d.count).sort(null);
    const arc = d3Arc()
        .innerRadius(radius * 0.55)
        .outerRadius(radius - 12)
        .padAngle(0.012)
        .cornerRadius(6);
    const colorByCategory = new Map();
    const arcs = group
        .selectAll("path")
        .data(pie(categories))
        .join("path")
        .attr("class", "fun-lab__arc")
        .attr("fill", (d, i) => {
        const color = resolveColor(i);
        colorByCategory.set(d.data.slug, color);
        return color;
    })
        .attr("stroke", "var(--chart-bg)")
        .attr("stroke-width", 1.5)
        .attr("d", (d) => arc(d) ?? "");
    arcs.append("title").text((d) => {
        const share = formatPercent(d.data.count / total);
        return `${d.data.label}: ${numberFormatter.format(d.data.count)} programs (${share})`;
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
    buildLegend(legendContainer, categories, colorByCategory, total);
    return colorByCategory;
}
function renderTable(table, records, colorByCategory) {
    const tbody = table.tBodies[0] ?? table.createTBody();
    tbody.innerHTML = "";
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
        }
        else {
            conferenceCell.textContent = "—";
        }
    });
}
async function boot() {
    if (!summaryEl || !chartSummaryEl || !chartRoot || !legendRoot || !tableEl || !generatedEl) {
        throw new Error("Fun Lab layout failed to mount");
    }
    try {
        const data = await fetchMascotIndex();
        summaryEl.textContent = describeSummary(data);
        generatedEl.textContent = formatGeneratedAt(data.generated_at);
        const colorByCategory = renderChart(data, chartRoot, legendRoot);
        const sortedRecords = [...data.records].sort((a, b) => {
            if (a.category === b.category) {
                return a.full_name.localeCompare(b.full_name, "en-US");
            }
            return a.category_label.localeCompare(b.category_label, "en-US");
        });
        renderTable(tableEl, sortedRecords, colorByCategory);
        const leaders = [...data.categories].sort((a, b) => b.count - a.count);
        if (leaders.length >= 2) {
            const top = leaders[0];
            const runnerUp = leaders[1];
            chartSummaryEl.textContent = `${top.label} owns ${formatPercent(top.count / data.total_programs)} of Division I mascots, ` +
                `with ${runnerUp.label} next at ${formatPercent(runnerUp.count / data.total_programs)}.`;
        }
        else if (leaders.length === 1) {
            const top = leaders[0];
            chartSummaryEl.textContent = `${top.label} accounts for ${formatPercent(top.count / data.total_programs)} of Division I mascots.`;
        }
        else {
            chartSummaryEl.textContent = "No mascot taxonomy available yet.";
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summaryEl.textContent = "We couldn’t load the mascot index. Try refreshing to replay the experiment.";
        chartSummaryEl.textContent = `Load error: ${message}`;
        chartRoot.textContent = "No chart data";
        legendRoot.textContent = "";
    }
}
void boot();
