import * as d3 from "d3";
import { buildChemistry, evaluateMatchup } from "./chemistry";
import { renderChemistryGraph } from "./graph";
import { simulateSeries } from "./simulate";
import { decodeMatchup, writeHash } from "./state";
import { isEraStyle, type EraStyle } from "./era";
import type { LaunchOptions, MatchupState, Player, Team } from "./types";

interface FilterState {
  query: string;
  era: string;
  archetype: string;
}

export interface RumbleExperience {
  open(initial?: MatchupState): void;
  close(): void;
  isOpen(): boolean;
}

const SLOT_COUNT = 5;

function createTeam(id: "A" | "B", name: string): Team {
  return {
    id,
    name,
    slots: new Array<Player | null>(SLOT_COUNT).fill(null),
  };
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatPlayerMeta(player: Player): string {
  const parts: string[] = [];
  if (player.pos) {
    parts.push(player.pos);
  }
  if (player.era) {
    parts.push(player.era);
  }
  return parts.join(" · ");
}

function filterPlayers(
  players: Player[],
  taken: Set<string>,
  filters: FilterState
): Player[] {
  const queryTokens = filters.query ? filters.query.split(/\s+/).filter(Boolean) : [];
  return players.filter((player) => {
    if (taken.has(player.id)) {
      return false;
    }
    if (queryTokens.length) {
      const haystackValues = [
        player.name,
        player.era ?? "",
        player.pos ?? "",
        player.archetypes.join(" "),
      ];
      const haystack = haystackValues.map((value) => normalizeText(value));
      const combined = `${haystack.join(" ")}`.trim();
      const identifier = normalizeText(player.id);
      const matchesTokens = queryTokens.every((token) => combined.includes(token) || identifier.includes(token));
      if (!matchesTokens) {
        return false;
      }
    }
    if (filters.era && normalizeText(player.era).indexOf(filters.era) === -1) {
      return false;
    }
    if (filters.archetype) {
      const hasTag = player.archetypes.some((tag) => normalizeText(tag).includes(filters.archetype));
      if (!hasTag) {
        return false;
      }
    }
    return true;
  });
}

function getTeamPlayers(team: Team): Player[] {
  return team.slots.filter((slot): slot is Player => Boolean(slot));
}

function nextOpenSlot(team: Team): number | null {
  for (let i = 0; i < team.slots.length; i += 1) {
    if (!team.slots[i]) {
      return i;
    }
  }
  return null;
}

function buildPlayerListItem(player: Player): HTMLElement {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "rumble-player-option";
  item.dataset.playerId = player.id;
  const meta = formatPlayerMeta(player) || "—";
  item.innerHTML = `
    <span class="rumble-player-option__name">${player.name}</span>
    <span class="rumble-player-option__meta">${meta}</span>
  `;
  return item;
}

function buildSlotNode(player: Player | null, index: number): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "rumble-slot";
  slot.dataset.index = String(index);
  if (!player) {
    slot.innerHTML = `<span class="rumble-slot__placeholder">Slot ${index + 1}</span>`;
    return slot;
  }
  const meta = formatPlayerMeta(player) || "—";
  slot.innerHTML = `
    <span class="rumble-slot__name">${player.name}</span>
    <span class="rumble-slot__meta">${meta}</span>
    <button type="button" class="rumble-slot__remove" aria-label="Remove ${player.name}" data-remove="${player.id}">Remove</button>
  `;
  return slot;
}

function uniqueSorted<T>(values: Iterable<T>): string[] {
  const set = new Set<string>();
  for (const value of values) {
    if (value) {
      set.add(String(value));
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function renderHistogram(container: HTMLElement, margins: number[]): void {
  container.replaceChildren();
  if (!margins.length) {
    container.textContent = "Run a simulation to view the margin distribution.";
    return;
  }
  const width = container.clientWidth || 360;
  const height = container.clientHeight || 200;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("class", "rumble-histogram");

  const bins = d3.bin<number, number>().thresholds(12)(margins);
  const xScale = d3
    .scaleLinear()
    .domain([d3.min(margins) ?? -20, d3.max(margins) ?? 20])
    .nice()
    .range([32, width - 16]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (bin) => bin.length) ?? 1])
    .nice()
    .range([height - 24, 16]);

  const bar = svg
    .append("g")
    .attr("class", "rumble-histogram__bars")
    .selectAll("rect")
    .data(bins)
    .join("rect")
    .attr("x", (bin) => xScale(bin.x0 ?? 0) + 1)
    .attr("width", (bin) => Math.max(0, xScale(bin.x1 ?? 0) - xScale(bin.x0 ?? 0) - 2))
    .attr("y", (bin) => yScale(bin.length))
    .attr("height", (bin) => yScale.range()[0] - yScale(bin.length))
    .attr("fill", "var(--rumble-bar-fill, #1f7bff)");

  bar.append("title").text((bin) => `Margin ${bin.x0?.toFixed(1)} to ${bin.x1?.toFixed(1)}: ${bin.length} games`);

  const axis = d3.axisBottom(xScale).ticks(6);
  svg
    .append("g")
    .attr("transform", `translate(0,${height - 24})`)
    .attr("class", "rumble-histogram__axis")
    .call(axis);

  svg
    .append("text")
    .attr("class", "rumble-histogram__label")
    .attr("x", width / 2)
    .attr("y", height - 4)
    .attr("text-anchor", "middle")
    .text("Margin (Team A - Team B)");
}

function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

export async function createRumbleExperience(options: LaunchOptions): Promise<RumbleExperience> {
  const { root, getPlayerPool, presets = {}, mode = "overlay" } = options;
  const isOverlay = mode !== "inline";
  const overlay = document.createElement("div");
  overlay.className = isOverlay ? "rumble-overlay" : "rumble-inline";
  const shellUid = Math.random().toString(36).slice(2);
  const eraSelectId = `rumble-era-style-${shellUid}`;
  const titleId = `rumble-shell-title-${shellUid}`;
  const descriptionId = `rumble-shell-description-${shellUid}`;
  const shellAttributes = isOverlay
    ? `role="dialog" aria-modal="true" aria-labelledby="${titleId}" aria-describedby="${descriptionId}"`
    : `role="region" aria-labelledby="${titleId}" aria-describedby="${descriptionId}"`;
  overlay.innerHTML = `
    <div class="rumble-shell" ${shellAttributes}>
      <header class="rumble-shell__header">
        <div class="rumble-shell__titles">
          <span class="eyebrow rumble-shell__eyebrow">Game Simulator</span>
          <h2 id="${titleId}">Roster Rumble — 5v5</h2>
          <p id="${descriptionId}" class="rumble-shell__description">Build two all-time lineups, compare chemistry, then run a 100-game sim.</p>
        </div>
        <button type="button" class="rumble-shell__close" aria-label="Close Roster Rumble">×</button>
      </header>
      <div class="rumble-shell__body">
        <section class="rumble-team rumble-team--a" data-team="A">
          <header class="rumble-team__header">
            <h3>Team A</h3>
            <div class="rumble-team__actions">
              <button type="button" data-action="clear" data-team="A">Clear Team</button>
              <button type="button" data-action="swap">Swap Teams</button>
              <button type="button" data-action="preset" data-team="A">Load Preset</button>
            </div>
          </header>
          <div class="rumble-team__controls">
            <label>Search</label>
            <input type="search" data-rumble-search="A" placeholder="Search players" />
            <div class="rumble-team__filters">
              <select data-rumble-era="A"><option value="">All eras</option></select>
              <select data-rumble-archetype="A"><option value="">All archetypes</option></select>
            </div>
          </div>
          <div class="rumble-team__slots" data-rumble-slots="A"></div>
          <div class="rumble-team__pool" data-rumble-pool="A" role="list"></div>
          <div class="rumble-team__graph" data-rumble-graph="A" aria-label="Team A chemistry graph"></div>
        </section>
        <section class="rumble-results">
          <div class="rumble-results__controls">
            <button type="button" data-rumble-run>Simulate 100 Games</button>
            <div class="rumble-era-style">
              <label class="sr-only" for="${eraSelectId}">Era Style</label>
              <select id="${eraSelectId}" data-rumble-era-style aria-label="Era Style">
                <option value="current">Era Style: Current</option>
                <option value="nineties">Era Style: 90s (bullyball)</option>
                <option value="pre3">Era Style: Pre–3 Point Line</option>
                <option value="oldschool">Era Style: Old School</option>
              </select>
            </div>
          </div>
          <div class="rumble-results__kpis">
            <div>
              <span class="rumble-results__label">Team A Win%</span>
              <strong data-kpi="a">—</strong>
            </div>
            <div>
              <span class="rumble-results__label">Team B Win%</span>
              <strong data-kpi="b">—</strong>
            </div>
            <div>
              <span class="rumble-results__label">Avg Margin</span>
              <strong data-kpi="margin">—</strong>
            </div>
          </div>
          <div class="rumble-results__histogram" data-rumble-hist></div>
          <div class="rumble-results__insights">
            <h4>What helps Team A?</h4>
            <ul data-insight="a"></ul>
            <h4>What hurts Team B?</h4>
            <ul data-insight="b"></ul>
            <p class="rumble-results__hint" data-insight-hint hidden></p>
          </div>
        </section>
        <section class="rumble-team rumble-team--b" data-team="B">
          <header class="rumble-team__header">
            <h3>Team B</h3>
            <div class="rumble-team__actions">
              <button type="button" data-action="clear" data-team="B">Clear Team</button>
              <button type="button" data-action="swap">Swap Teams</button>
              <button type="button" data-action="preset" data-team="B">Load Preset</button>
            </div>
          </header>
          <div class="rumble-team__controls">
            <label>Search</label>
            <input type="search" data-rumble-search="B" placeholder="Search players" />
            <div class="rumble-team__filters">
              <select data-rumble-era="B"><option value="">All eras</option></select>
              <select data-rumble-archetype="B"><option value="">All archetypes</option></select>
            </div>
          </div>
          <div class="rumble-team__slots" data-rumble-slots="B"></div>
          <div class="rumble-team__pool" data-rumble-pool="B" role="list"></div>
          <div class="rumble-team__graph" data-rumble-graph="B" aria-label="Team B chemistry graph"></div>
        </section>
      </div>
      <footer class="rumble-shell__footer">Pick five for each side to unlock the sim.</footer>
    </div>
  `;

  if (isOverlay) {
    root.appendChild(overlay);
  } else {
    root.replaceChildren(overlay);
    overlay.classList.add("is-ready", "is-open");
  }

  const closeButton = overlay.querySelector<HTMLButtonElement>(".rumble-shell__close");
  const simulateButton = overlay.querySelector<HTMLButtonElement>("[data-rumble-run]");
  const eraSelect = overlay.querySelector<HTMLSelectElement>("[data-rumble-era-style]");
  const histogramContainer = overlay.querySelector<HTMLElement>("[data-rumble-hist]");
  const insightsA = overlay.querySelector<HTMLUListElement>("[data-insight='a']");
  const insightsB = overlay.querySelector<HTMLUListElement>("[data-insight='b']");
  const eraHint = overlay.querySelector<HTMLElement>("[data-insight-hint]");
  if (!closeButton || !simulateButton || !eraSelect || !histogramContainer || !insightsA || !insightsB || !eraHint) {
    throw new Error("Failed to initialize Roster Rumble UI");
  }

  let eraStyle: EraStyle = "current";

  eraSelect.value = eraStyle;

  if (!isOverlay) {
    closeButton.setAttribute("tabindex", "-1");
    closeButton.setAttribute("aria-hidden", "true");
  }

  const teamNodes = {
    A: {
      slots: overlay.querySelector<HTMLElement>("[data-rumble-slots='A']"),
      pool: overlay.querySelector<HTMLElement>("[data-rumble-pool='A']"),
      graph: overlay.querySelector<HTMLElement>("[data-rumble-graph='A']"),
      search: overlay.querySelector<HTMLInputElement>("[data-rumble-search='A']"),
      era: overlay.querySelector<HTMLSelectElement>("[data-rumble-era='A']"),
      archetype: overlay.querySelector<HTMLSelectElement>("[data-rumble-archetype='A']"),
    },
    B: {
      slots: overlay.querySelector<HTMLElement>("[data-rumble-slots='B']"),
      pool: overlay.querySelector<HTMLElement>("[data-rumble-pool='B']"),
      graph: overlay.querySelector<HTMLElement>("[data-rumble-graph='B']"),
      search: overlay.querySelector<HTMLInputElement>("[data-rumble-search='B']"),
      era: overlay.querySelector<HTMLSelectElement>("[data-rumble-era='B']"),
      archetype: overlay.querySelector<HTMLSelectElement>("[data-rumble-archetype='B']"),
    },
  } as const;

  if (!teamNodes.A.slots || !teamNodes.A.pool || !teamNodes.A.graph || !teamNodes.B.slots || !teamNodes.B.pool || !teamNodes.B.graph) {
    throw new Error("Missing team containers");
  }

  const teams = {
    A: createTeam("A", "Team A"),
    B: createTeam("B", "Team B"),
  };

  const filters: Record<"A" | "B", FilterState> = {
    A: { query: "", era: "", archetype: "" },
    B: { query: "", era: "", archetype: "" },
  };

  let players: Player[] = [];
  let playerLookup = new Map<string, Player>();
  let isMounted = !isOverlay;

  const applyFilters = (teamId: "A" | "B") => {
    const node = teamNodes[teamId];
    if (!node.pool) return;
    const taken = new Set<string>();
    getTeamPlayers(teams.A).forEach((player) => taken.add(player.id));
    getTeamPlayers(teams.B).forEach((player) => taken.add(player.id));
    const results = filterPlayers(players, taken, filters[teamId]);
    const sorted = results.slice().sort((a, b) => a.name.localeCompare(b.name));
    node.pool.replaceChildren();
    if (!sorted.length) {
      const empty = document.createElement("p");
      empty.className = "rumble-empty";
      empty.textContent = "No players match the filters.";
      node.pool.append(empty);
      return;
    }
    const limit = filters[teamId].query ? 50 : 30;
    sorted.slice(0, limit).forEach((player) => {
      const item = buildPlayerListItem(player);
      item.addEventListener("click", () => {
        const slotIndex = nextOpenSlot(teams[teamId]);
        if (slotIndex === null) {
          return;
        }
        teams[teamId].slots[slotIndex] = player;
        updateTeam(teamId);
        updateFooter();
        updateHash();
      });
      node.pool?.append(item);
    });
  };

  const updateTeam = (teamId: "A" | "B") => {
    const node = teamNodes[teamId];
    const team = teams[teamId];
    if (node.slots) {
      node.slots.replaceChildren();
      team.slots.forEach((player, index) => {
        const slotNode = buildSlotNode(player, index);
        const remove = slotNode.querySelector<HTMLButtonElement>("[data-remove]");
        if (remove) {
          remove.addEventListener("click", () => {
            team.slots[index] = null;
            updateTeam(teamId);
            updateFooter();
            updateHash();
          });
        }
        node.slots?.append(slotNode);
      });
    }
    if (node.graph) {
      const roster = getTeamPlayers(team);
      const chemistry = buildChemistry(roster, eraStyle);
      if (roster.length) {
        renderChemistryGraph(node.graph, roster, chemistry.edges, { title: team.name });
      } else {
        node.graph.textContent = "Add players to visualize chemistry.";
      }
    }
    applyFilters("A");
    applyFilters("B");
  };

  const applyPreset = (teamId: "A" | "B") => {
    const optionsList = Object.keys(presets);
    if (!optionsList.length) {
      return;
    }
    const presetKey = optionsList[teamId === "A" ? 0 : 1] ?? optionsList[0];
    const preset = presets[presetKey];
    if (!Array.isArray(preset)) {
      return;
    }
    teams[teamId].slots = new Array<Player | null>(SLOT_COUNT).fill(null);
    let slot = 0;
    preset.forEach((id) => {
      if (slot >= SLOT_COUNT) return;
      const player = playerLookup.get(id);
      if (player) {
        teams[teamId].slots[slot] = player;
        slot += 1;
      }
    });
    updateTeam(teamId);
    updateFooter();
    updateHash();
  };

  const swapTeams = () => {
    const temp = teams.A.slots;
    teams.A.slots = teams.B.slots;
    teams.B.slots = temp;
    updateTeam("A");
    updateTeam("B");
    updateFooter();
    updateHash();
  };

  const updateFooter = () => {
    const footer = overlay.querySelector<HTMLElement>(".rumble-shell__footer");
    const filled = getTeamPlayers(teams.A).length === SLOT_COUNT && getTeamPlayers(teams.B).length === SLOT_COUNT;
    if (footer) {
      footer.textContent = filled ? "Ready to simulate." : "Pick five for each side to unlock the sim.";
    }
    simulateButton.disabled = !filled;
  };

  const updateInsights = () => {
    const rosterA = getTeamPlayers(teams.A);
    const rosterB = getTeamPlayers(teams.B);
    const chemistryA = buildChemistry(rosterA, eraStyle);
    const chemistryB = buildChemistry(rosterB, eraStyle);
    const matchup = evaluateMatchup(rosterA, rosterB, eraStyle);
    const reasonsA = [...chemistryA.reasons.slice(0, 3), ...matchup.reasonsA.slice(0, 2)];
    const reasonsB = [...chemistryB.reasons.slice(0, 3), ...matchup.reasonsB.slice(0, 2)];
    insightsA.replaceChildren();
    insightsB.replaceChildren();
    if (!reasonsA.length) {
      const item = document.createElement("li");
      item.textContent = "Build a lineup to surface strengths.";
      insightsA.append(item);
    } else {
      reasonsA.forEach((reason) => {
        const item = document.createElement("li");
        item.textContent = reason;
        insightsA.append(item);
      });
    }
    if (!reasonsB.length) {
      const item = document.createElement("li");
      item.textContent = "Add opponents to reveal weaknesses.";
      insightsB.append(item);
    } else {
      reasonsB.forEach((reason) => {
        const item = document.createElement("li");
        item.textContent = reason;
        insightsB.append(item);
      });
    }

    const hintText = (() => {
      switch (eraStyle) {
        case "nineties":
          return "Post-ups and POA defense boosted; 3s devalued.";
        case "pre3":
          return "No 3s; spacing bonuses reduced; interior play rewarded.";
        case "oldschool":
          return "Few possessions; size, ORB, and defense prioritized.";
        default:
          return "";
      }
    })();
    if (hintText) {
      eraHint.textContent = hintText;
      eraHint.hidden = false;
    } else {
      eraHint.textContent = "";
      eraHint.hidden = true;
    }
  };

  const updateHash = () => {
    const state: MatchupState = {
      a: getTeamPlayers(teams.A).map((player) => player.id),
      b: getTeamPlayers(teams.B).map((player) => player.id),
      style: eraStyle,
    };
    writeHash(state);
  };

  const runSimulation = () => {
    const rosterA = getTeamPlayers(teams.A);
    const rosterB = getTeamPlayers(teams.B);
    if (rosterA.length !== SLOT_COUNT || rosterB.length !== SLOT_COUNT) {
      return;
    }
    const result = simulateSeries(rosterA, rosterB, { games: 100, eraStyle });
    const kpiA = overlay.querySelector<HTMLElement>("[data-kpi='a']");
    const kpiB = overlay.querySelector<HTMLElement>("[data-kpi='b']");
    const kpiMargin = overlay.querySelector<HTMLElement>("[data-kpi='margin']");
    if (kpiA && kpiB && kpiMargin) {
      kpiA.textContent = formatPercent((result.teamAWins / result.margins.length) * 100);
      kpiB.textContent = formatPercent((result.teamBWins / result.margins.length) * 100);
      kpiMargin.textContent = `${(result.avgScoreA - result.avgScoreB).toFixed(1)} pts`;
    }
    renderHistogram(histogramContainer, result.margins);
    updateInsights();
  };

  const applyState = (state: MatchupState | null | undefined) => {
    if (!state) {
      return;
    }
    teams.A.slots = new Array<Player | null>(SLOT_COUNT).fill(null);
    teams.B.slots = new Array<Player | null>(SLOT_COUNT).fill(null);
    state.a.forEach((id, index) => {
      if (index < SLOT_COUNT) {
        const player = playerLookup.get(id);
        if (player) {
          teams.A.slots[index] = player;
        }
      }
    });
    state.b.forEach((id, index) => {
      if (index < SLOT_COUNT) {
        const player = playerLookup.get(id);
        if (player) {
          teams.B.slots[index] = player;
        }
      }
    });
    if (isEraStyle(state.style)) {
      eraStyle = state.style;
    } else {
      eraStyle = "current";
    }
    eraSelect.value = eraStyle;
    updateTeam("A");
    updateTeam("B");
    updateFooter();
    if (
      getTeamPlayers(teams.A).length === SLOT_COUNT &&
      getTeamPlayers(teams.B).length === SLOT_COUNT
    ) {
      runSimulation();
    } else {
      updateInsights();
    }
  };

  if (isOverlay) {
    closeButton.addEventListener("click", () => {
      overlay.classList.remove("is-open");
    });
  }

  simulateButton.addEventListener("click", runSimulation);
  eraSelect.addEventListener("change", () => {
    const next = eraSelect.value;
    if (isEraStyle(next)) {
      eraStyle = next;
    } else {
      eraStyle = "current";
    }
    updateTeam("A");
    updateTeam("B");
    updateInsights();
    runSimulation();
    updateHash();
  });

  overlay.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.dataset.action === "swap") {
      swapTeams();
    }
    if (target.dataset.action === "clear" && target.dataset.team) {
      const teamId = target.dataset.team as "A" | "B";
      teams[teamId].slots = new Array<Player | null>(SLOT_COUNT).fill(null);
      updateTeam(teamId);
      updateFooter();
      updateHash();
    }
    if (target.dataset.action === "preset" && target.dataset.team) {
      applyPreset(target.dataset.team as "A" | "B");
    }
  });

  ["A", "B"].forEach((id) => {
    const teamId = id as "A" | "B";
    const node = teamNodes[teamId];
    node.search?.addEventListener("input", () => {
      filters[teamId].query = normalizeText(node.search?.value ?? "");
      applyFilters(teamId);
    });
    node.era?.addEventListener("change", () => {
      filters[teamId].era = normalizeText(node.era?.value ?? "");
      applyFilters(teamId);
    });
    node.archetype?.addEventListener("change", () => {
      filters[teamId].archetype = normalizeText(node.archetype?.value ?? "");
      applyFilters(teamId);
    });
  });

  players = await getPlayerPool();
  playerLookup = new Map(players.map((player) => [player.id, player]));

  const eraOptions = uniqueSorted(players.map((player) => player.era).filter(Boolean));
  const archetypeOptions = uniqueSorted(players.flatMap((player) => player.archetypes));

  ["A", "B"].forEach((id) => {
    const teamId = id as "A" | "B";
    const node = teamNodes[teamId];
    eraOptions.forEach((era) => {
      const option = document.createElement("option");
      option.value = era;
      option.textContent = era;
      node.era?.append(option);
    });
    archetypeOptions.forEach((archetype) => {
      const option = document.createElement("option");
      option.value = archetype;
      option.textContent = archetype;
      node.archetype?.append(option);
    });
  });

  applyFilters("A");
  applyFilters("B");
  updateTeam("A");
  updateTeam("B");
  updateFooter();
  updateInsights();

  const experience: RumbleExperience = {
    open(initial?: MatchupState) {
      if (!isMounted) {
        overlay.classList.add("is-ready");
        isMounted = true;
      }
      if (isOverlay) {
        overlay.classList.add("is-open");
      }
      if (initial) {
        applyState(initial);
      }
    },
    close() {
      if (isOverlay) {
        overlay.classList.remove("is-open");
      }
    },
    isOpen() {
      return isOverlay ? overlay.classList.contains("is-open") : true;
    },
  };

  const hashState = decodeMatchup(window.location.hash.startsWith("#rumble=") ? window.location.hash.slice(8) : null);
  if (hashState) {
    applyState(hashState);
  }

  return experience;
}
