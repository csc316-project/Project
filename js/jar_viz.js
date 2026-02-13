export function render_jar(svg, data) {
  const width = 800;
  const height = 800;
  const margin = 1;

    // only include crash count > 5
    const crashCounts = d3.rollups(
    data,
    v => v.length,
    d => d.Aircraft
    )
  .map(([Aircraft, value]) => ({ id: Aircraft, value }))
  .filter(d => d.value > 5);

  const color = d3.scaleOrdinal(d3.schemeTableau10);

  const pack = d3.pack()
      .size([width * 0.9, height * 0.9])
      .padding(3);

  const root = d3.hierarchy({ children: crashCounts })
      .sum(d => d.value);

  pack(root);

  const offsetX = width * 0.1;
  const offsetY = height * 0.05;

  const node = svg.append("g")
    .selectAll("g")
    .data(root.leaves())
    .join("g")
      .attr("transform", d => `translate(${d.x + offsetX},${d.y + offsetY})`);

  // Circles
  node.append("circle")
      .attr("r", d => d.r)
      .attr("fill-opacity", 0.7)
      .attr("fill", (d, i) => color(i))
      .attr("stroke", "#333")
      .attr("stroke-width", 1);

  // Aircraft labels
  node.append("text")
      .style("font-size", d => `${Math.min(2 * d.r / d.data.id.length, 18)}px`)
      .selectAll("tspan")
      .data(d => d.data.id.split(/\s+/))
      .join("tspan")
        .attr("x", 0)
        .attr("y", (t, i, nodes) => `${i - nodes.length / 2 + 0.35}em`)
        .text(t => t);

  // Crash count
  node.append("text")
      .attr("y", d => d.r / 2.5)
      .attr("font-size", "12px")
      .attr("fill-opacity", 0.7)
      .text(d => d.value);
}
