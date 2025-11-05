import { formatNumber } from "../charts/theme.js";
const NAME_SCALE_MIN = 0.72;
const NAME_SCALE_MAX = 1;
const NAME_SCALE_START = 20;
const NAME_SCALE_END = 42;
const MIN_VISIBLE_RATIO = 0.085;
const ROW_ACCENTS = [
    ["#4c7fff", "#335eea"],
    ["#ff6aa8", "#ff4280"],
    ["#ffb561", "#ff8e3c"],
    ["#8a7aff", "#6d5cff"],
    ["#42c5a5", "#2e9f86"],
    ["#ff7fcd", "#ff55a8"],
    ["#5aa7ff", "#3f86ff"],
    ["#ffd15a", "#ffa53d"],
    ["#4ed9a6", "#2cbf88"],
    ["#7aa8ff", "#5e8cff"]
];
const DEFAULT_TONE_CLASSES = [
    "stat-card--tone-1",
    "stat-card--tone-2",
    "stat-card--tone-3",
    "stat-card--tone-4",
];
export function createSkeletonCard() {
    const card = document.createElement("article");
    card.className = "stat-card stat-card--loading";
    card.innerHTML = `<div class="stat-card__loading">Loading leaderboards…</div>`;
    return card;
}
export function renderLeaderboardCards(container, cards, options = {}) {
    const { limit = 10, axisTickCount = 6, toneClasses = DEFAULT_TONE_CLASSES, toneOffset = 0, defaultSeasonLabel, } = options;
    cards.forEach((cardDef, index) => {
        const toneClass = toneClasses[(toneOffset + index) % toneClasses.length];
        const card = createLeaderboardCard(cardDef, {
            toneClass,
            limit,
            axisTickCount,
            defaultSeasonLabel,
        });
        container.appendChild(card);
    });
}
function createLeaderboardCard(cardDef, options) {
    const card = document.createElement("article");
    card.className = "stat-card";
    if (cardDef.className) {
        card.classList.add(...cardDef.className.split(/\s+/).filter(Boolean));
    }
    if (options.toneClass) {
        card.classList.add(options.toneClass);
    }
    card.dataset.metricId = cardDef.id;
    if (cardDef.dataset) {
        for (const [key, value] of Object.entries(cardDef.dataset)) {
            card.dataset[key] = value;
        }
    }
    if (cardDef.accent?.primary) {
        const primary = cardDef.accent.primary;
        const secondary = cardDef.accent.secondary ?? primary;
        card.style.setProperty("--chart-accent", primary);
        card.style.setProperty("--chart-accent-muted", `color-mix(in srgb, ${secondary} 55%, white 45%)`);
        card.style.setProperty("--chart-accent-track", `color-mix(in srgb, ${secondary} 22%, white 78%)`);
        card.style.setProperty("--chart-accent-stroke", `color-mix(in srgb, ${primary} 78%, black 22%)`);
    }
    const header = document.createElement("header");
    header.className = "stat-card__head";
    card.appendChild(header);
    const title = document.createElement("h3");
    title.className = "stat-card__title";
    title.textContent = cardDef.title;
    header.appendChild(title);
    const seasonLabel = cardDef.seasonLabel ?? options.defaultSeasonLabel;
    if (seasonLabel) {
        const season = document.createElement("span");
        season.className = "stat-card__season";
        season.textContent = seasonLabel;
        header.appendChild(season);
    }
    const body = document.createElement("div");
    body.className = "stat-card__body";
    card.appendChild(body);
    const chart = document.createElement("div");
    chart.className = "stat-card__chart leaderboard-chart";
    chart.setAttribute("role", "group");
    const ariaLabel = cardDef.ariaLabel ?? `${cardDef.title} leaders`;
    chart.setAttribute("aria-label", ariaLabel);
    body.appendChild(chart);
    renderMetricChart(chart, cardDef, options);
    return card;
}
function renderMetricChart(container, cardDef, options) {
    const leaders = cardDef.leaders.slice(0, options.limit);
    if (!leaders.length) {
        container.innerHTML = `<p class="stat-card__empty">No data available.</p>`;
        return;
    }
    container.innerHTML = "";
    container.classList.add("leaderboard-chart--hydrated");
    const doc = container.ownerDocument ?? document;
    const list = doc.createElement("div");
    list.className = "leaderboard-chart__rows";
    container.appendChild(list);
    const values = leaders.map((leader) => leader.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const displayMax = computeDisplayMax(maxValue, options.axisTickCount - 1);
    const prefersLower = cardDef.direction === "asc";
    const range = maxValue - minValue;
    leaders.forEach((leader, index) => {
        const row = createLeaderboardRow(doc, leader, index, {
            displayMax,
            prefersLower,
            range,
            maxValue,
        });
        list.appendChild(row);
    });
    const axis = createLeaderboardAxis(doc, cardDef.axisLabel ?? cardDef.title, displayMax, options.axisTickCount);
    if (axis) {
        container.appendChild(axis);
    }
}
function createLeaderboardRow(doc, leader, index, options) {
    const row = doc.createElement("div");
    row.className = "leaderboard-chart__row";
    row.dataset.rank = `${index + 1}`;
    const [accentStart, accentEnd] = ROW_ACCENTS[index % ROW_ACCENTS.length] ?? ROW_ACCENTS[0];
    row.style.setProperty("--leaderboard-accent-start", accentStart);
    row.style.setProperty("--leaderboard-accent-end", accentEnd);
    const label = doc.createElement("div");
    label.className = "leaderboard-chart__label";
    row.appendChild(label);
    const rank = doc.createElement("span");
    rank.className = "leaderboard-chart__rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    label.appendChild(rank);
    const identity = doc.createElement("div");
    identity.className = "leaderboard-chart__identity";
    label.appendChild(identity);
    const name = doc.createElement("span");
    name.className = "leaderboard-chart__name";
    name.textContent = leader.name;
    identity.appendChild(name);
    if (leader.team) {
        const team = doc.createElement("span");
        team.className = "leaderboard-chart__team";
        team.textContent = leader.team;
        identity.appendChild(team);
    }
    const metrics = doc.createElement("div");
    metrics.className = "leaderboard-chart__metrics";
    row.appendChild(metrics);
    const value = doc.createElement("span");
    value.className = "leaderboard-chart__value";
    value.textContent = leader.valueFormatted ?? formatNumber(leader.value);
    metrics.appendChild(value);
    const scaleLabel = leader.team ? `${leader.name} (${leader.team})` : leader.name;
    const scale = computeNameScale(scaleLabel);
    row.style.setProperty("--name-scale", `${scale}`);
    if (leader.team) {
        const teamScale = Math.max(NAME_SCALE_MIN, Math.min(NAME_SCALE_MAX, scale + 0.08));
        row.style.setProperty("--team-scale", `${teamScale}`);
    }
    let ratio;
    if (options.prefersLower) {
        if (!(Number.isFinite(options.range) && options.range > 0)) {
            ratio = 1;
        }
        else {
            ratio = (options.maxValue - leader.value) / options.range;
        }
    }
    else {
        ratio = options.displayMax > 0 ? leader.value / options.displayMax : 0;
    }
    const fillRatio = ratio > 0 ? Math.max(ratio, MIN_VISIBLE_RATIO) : 0;
    row.style.setProperty("--leaderboard-fill", `${Math.min(fillRatio, 1)}`);
    return row;
}
function createLeaderboardAxis(doc, label, maxValue, tickCount = 6) {
    if (!(Number.isFinite(maxValue) && maxValue > 0)) {
        return null;
    }
    const ticks = buildAxisTicks(maxValue, tickCount);
    if (ticks.length <= 1) {
        return null;
    }
    const axis = doc.createElement("footer");
    axis.className = "leaderboard-chart__axis";
    const ticksContainer = doc.createElement("div");
    ticksContainer.className = "leaderboard-chart__axis-track";
    ticks.forEach((tick) => {
        const tickEl = doc.createElement("span");
        tickEl.className = "leaderboard-chart__axis-tick";
        tickEl.textContent = formatNumber(tick);
        const ratio = maxValue > 0 ? Math.min(Math.max(tick / maxValue, 0), 1) : 0;
        tickEl.style.setProperty("--tick-position", `${ratio}`);
        ticksContainer.appendChild(tickEl);
    });
    axis.appendChild(ticksContainer);
    const axisLabel = doc.createElement("span");
    axisLabel.className = "leaderboard-chart__axis-label";
    axisLabel.textContent = label;
    axis.appendChild(axisLabel);
    return axis;
}
function buildAxisTicks(maxValue, count = 6) {
    if (!(Number.isFinite(maxValue) && maxValue > 0)) {
        return [0, 1];
    }
    const desired = Math.max(2, count);
    const step = computeTickStep(maxValue, desired - 1);
    if (!(Number.isFinite(step) && step > 0)) {
        return [0, maxValue];
    }
    const ticks = [0];
    for (let value = step; value < maxValue; value += step) {
        ticks.push(Number.parseFloat(value.toFixed(6)));
        if (ticks.length >= desired - 1) {
            break;
        }
    }
    if (ticks[ticks.length - 1] !== maxValue) {
        ticks.push(maxValue);
    }
    return ticks;
}
function computeTickStep(maxValue, segments) {
    const rawStep = maxValue / Math.max(1, segments);
    if (!(Number.isFinite(rawStep) && rawStep > 0)) {
        return 0;
    }
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / magnitude;
    let niceNormalized;
    if (normalized < 1.5) {
        niceNormalized = 1;
    }
    else if (normalized < 3) {
        niceNormalized = 2;
    }
    else if (normalized < 7) {
        niceNormalized = 5;
    }
    else {
        niceNormalized = 10;
    }
    return niceNormalized * magnitude;
}
function computeDisplayMax(maxValue, segments = 4) {
    if (!(Number.isFinite(maxValue) && maxValue > 0)) {
        return 1;
    }
    const step = computeTickStep(maxValue, segments);
    if (!(Number.isFinite(step) && step > 0)) {
        return maxValue;
    }
    const steps = Math.max(1, Math.ceil(maxValue / step));
    return Number.parseFloat((steps * step).toPrecision(6));
}
function computeNameScale(label) {
    const length = label.length;
    if (length <= NAME_SCALE_START) {
        return NAME_SCALE_MAX;
    }
    if (length >= NAME_SCALE_END) {
        return NAME_SCALE_MIN;
    }
    const progress = (length - NAME_SCALE_START) / (NAME_SCALE_END - NAME_SCALE_START);
    const scale = NAME_SCALE_MAX - progress * (NAME_SCALE_MAX - NAME_SCALE_MIN);
    return Number(scale.toFixed(3));
}
