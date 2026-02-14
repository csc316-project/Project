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

  d3.select(".viz-tooltip").remove();
  const tooltip = d3.select("body").append("div")
    .attr("class", "viz-tooltip")
    .style("position", "absolute")
    .style("display", "none")
    .style("background-color", "rgba(0, 0, 0, 0.9)")
    .style("color", "white")
    .style("padding", "12px 16px")
    .style("border-radius", "8px")
    .style("font-size", "15px")
    .style("font-weight", "600")
    .style("pointer-events", "none")
    .style("z-index", "9999")
    .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.4)")
    .style("line-height", "1.5");

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
  const circles = node.append("circle")
      .attr("r", d => d.r)
      .attr("fill-opacity", 0.7)
      .attr("fill", (d, i) => color(i))
      .attr("stroke", "#333")
      .attr("stroke-width", 1)
      .style("cursor", "pointer");

  const labels = node.append("text")
      .style("font-size", d => `${Math.min(2.5 * d.r / d.data.id.split(/\s+/)[0].length, 24)}px`)
      .attr("text-anchor", "middle")
      .style("pointer-events", "none")
      .style("font-weight", "600");

  labels.append("tspan")
      .attr("x", 0)
      .attr("y", "0.35em")
      .text(d => d.data.id.split(/\s+/)[0]);

  node.on("mouseenter", function(event, d) {
    const currentNode = d3.select(this);
    
    // Enhance circle
    currentNode.select("circle")
      .transition()
      .duration(200)
      .attr("r", d.r * 1.15)
      .attr("fill-opacity", 0.95)
      .attr("stroke", "#000")
      .attr("stroke-width", 3);
    
    // Show tooltip
    tooltip
      .html(`<strong>${d.data.id}</strong><br/>${d.value} crashes`)
      .style("display", "block")
      .style("top", (event.pageY - 60) + "px")
      .style("left", (event.pageX + 15) + "px");
  })
  .on("mousemove", function(event) {
    tooltip
      .style("top", (event.pageY - 60) + "px")
      .style("left", (event.pageX + 15) + "px");
  })
  .on("mouseleave", function(event, d) {
    const currentNode = d3.select(this);
    
    // Reset circle
    currentNode.select("circle")
      .transition()
      .duration(200)
      .attr("r", d.r)
      .attr("fill-opacity", 0.7)
      .attr("stroke", "#333")
      .attr("stroke-width", 1);
    
    // Hide tooltip
    tooltip.style("display", "none");
  });
}
