import * as d3 from "d3";
import type { ChemistryEdge, Player } from "./types";

export interface GraphRenderOptions {
  title: string;
}

const NODE_MIN_RADIUS = 16;
const NODE_MAX_RADIUS = 34;

export function renderChemistryGraph(
  container: HTMLElement,
  players: Player[],
  edges: ChemistryEdge[],
  options: GraphRenderOptions
): void {
  container.replaceChildren();
  container.classList.add("rumble-graph");

  const width = container.clientWidth || 320;
  const height = container.clientHeight || 260;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("role", "img")
    .attr("aria-label", `${options.title} chemistry graph`)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("class", "rumble-graph__svg");

  svg.append("title").text(`${options.title} chemistry graph`);

  const tooltip = d3
    .select(container)
    .append("div")
    .attr("class", "rumble-graph__tooltip")
    .attr("role", "status")
    .attr("aria-live", "polite")
    .style("opacity", 0);

  const impactExtent = d3.extent(players, (player) => player.impact) as [number, number];
  const impactScale = d3
    .scaleLinear()
    .domain(impactExtent[0] === impactExtent[1] ? [0, impactExtent[1] || 1] : impactExtent)
    .range([NODE_MIN_RADIUS, NODE_MAX_RADIUS]);

  const nodes = players.map((player) => ({
    id: player.id,
    name: player.name,
    impact: player.impact,
    radius: impactScale(player.impact),
  }));

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(edges)
        .id((d: d3.SimulationNodeDatum & { id: string }) => d.id)
        .distance((link) => (link.weight > 0 ? 90 : 120))
        .strength((link) => Math.min(Math.abs(link.weight) / 10, 1))
    )
    .force("charge", d3.forceManyBody().strength(-180))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force(
      "collision",
      d3.forceCollide<(typeof nodes)[number]>().radius((node) => node.radius + 6)
    );

  const linkGroup = svg.append("g").attr("class", "rumble-graph__links");
  const nodeGroup = svg.append("g").attr("class", "rumble-graph__nodes");

  const linkColor = d3.scaleDiverging<string>().domain([-10, 0, 10]).interpolator(d3.interpolateRdYlGn);

  const links = linkGroup
    .selectAll("line")
    .data(edges)
    .join("line")
    .attr("class", (edge) => `rumble-graph__link${edge.weight < 0 ? " rumble-graph__link--negative" : ""}`)
    .attr("stroke", (edge) => linkColor(edge.weight))
    .attr("stroke-width", (edge) => Math.max(1, Math.min(4, Math.abs(edge.weight) / 2)))
    .attr("stroke-dasharray", (edge) => (edge.weight < 0 ? "6 6" : null))
    .on("mouseenter", (_, edge) => {
      const reasons = edge.reasons.join(", ");
      tooltip
        .style("opacity", 1)
        .text(`${reasons || "Chemistry"}`);
    })
    .on("mouseleave", () => {
      tooltip.transition().duration(150).style("opacity", 0);
    });

  const nodesSelection = nodeGroup
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "rumble-graph__node");

  nodesSelection
    .append("circle")
    .attr("r", (node) => node.radius)
    .attr("fill", "var(--rumble-node-fill, #2f7bff)")
    .attr("stroke", "var(--rumble-node-stroke, #021a4a)")
    .attr("stroke-width", 2);

  nodesSelection
    .append("text")
    .attr("class", "rumble-graph__label")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .text((node) => node.name.split(" ").pop() ?? node.name);

  simulation.on("tick", () => {
    links
      .attr("x1", (edge) => (edge.source as { x: number }).x)
      .attr("y1", (edge) => (edge.source as { y: number }).y)
      .attr("x2", (edge) => (edge.target as { x: number }).x)
      .attr("y2", (edge) => (edge.target as { y: number }).y);

    nodesSelection.attr("transform", (node) => `translate(${node.x},${node.y})`);
  });

  const observer = new ResizeObserver(() => {
    const nextWidth = container.clientWidth || width;
    const nextHeight = container.clientHeight || height;
    svg.attr("viewBox", `0 0 ${nextWidth} ${nextHeight}`);
  });
  observer.observe(container);
}
