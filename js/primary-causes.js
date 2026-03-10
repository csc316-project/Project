export function render(container, data) {
   const width = container.node().getBoundingClientRect().width || 860;
   const palette = {
       "Unknown":           { fill: "#1e293b", stroke: "#64748b", text: "#0d1829" },
       "Technical failure": { fill: "#1e3a5f", stroke: "#3b82f6", text: "#0d1829" },
       "Human factor":      { fill: "#3b1d1d", stroke: "#f87171", text: "#0d1829" },
       "Weather":           { fill: "#1a3329", stroke: "#34d399", text: "#0d1829" },
       "Other causes":      { fill: "#2d1f42", stroke: "#a78bfa", text: "#0d1829" },
       "Terrorism act, Hijacking, Sabotage":  { fill: "#4a3c23", stroke: "#fae08b", text: "#0d1829" }
   };
   const counts = d3.rollup(data, v => v.length, d => d["Crash cause"] || "Unknown");
   const total  = d3.sum(counts.values());
   const sorted = Array.from(counts, ([cause, count]) => ({
       cause, count,
       pct: ((count / total) * 100).toFixed(1),
       color: palette[cause] || palette["Unknown"],
   })).sort((a, b) => b.count - a.count);

   const n = sorted.length;

   const rScale = d3.scaleSqrt()
       .domain([0, d3.max(sorted, d => d.count)])
       .range([32, Math.min(width * 0.11, 82)]);
   sorted.forEach(d => { d.r = rScale(d.count); });
   const arcSlots  = new Array(n);
   const slotOrder = [2, 1, 3, 0, 4];
   sorted.forEach((d, i) => {
       arcSlots[i < slotOrder.length ? slotOrder[i] : i] = d;
   });
   const nodes = arcSlots;
   const arcSpread = Math.PI * 0.9;
   const step      = arcSpread / (n - 1);
   let minArcR = 140;
   for (let i = 0; i < n - 1; i++) {
       const gap    = nodes[i].r + nodes[i + 1].r + 22;
       const needed = gap / (2 * Math.sin(step / 2));
       minArcR = Math.max(minArcR, needed);
   }
   const arcR   = minArcR * 0.94;
   const ySquish = 1.1;
   const planeX = width / 2;
   const planeY = 500;


   nodes.forEach((d, i) => {
       const angle = Math.PI / 2 + arcSpread / 2 - i * step;
       d.tx = planeX + Math.cos(angle) * arcR;
       d.ty = planeY - Math.sin(angle) * arcR * ySquish;
   });
   const topY    = d3.min(nodes, d => d.ty - d.r) - 24;
   const botY    = planeY + 50;
   const svgH    = botY - topY;
   const svg = container.append("svg")
       .attr("width", "100%")
       .attr("viewBox", `0 ${topY} ${width} ${svgH}`)
       .attr("preserveAspectRatio", "xMidYMid meet")
       .style("overflow", "visible");
   const defs = svg.append("defs");
   nodes.forEach((d, i) => {
       const gid = `pc-grad-${i}`;
       const grad = defs.append("radialGradient")
           .attr("id", gid).attr("cx", "35%").attr("cy", "30%");
       grad.append("stop").attr("offset", "0%")
           .attr("stop-color", d.color.stroke).attr("stop-opacity", 0.22);
       grad.append("stop").attr("offset", "100%")
           .attr("stop-color", d.color.fill).attr("stop-opacity", 0.95);
       d.gradId = gid;
   });


   // the bubble connector dots
   nodes.forEach(d => {
       const dotCount = 5;
       for (let k = 1; k <= dotCount; k++) {
           const t  = k / (dotCount + 2.3);
           const ox = planeX, oy = planeY - 20;
           const dx = ox + (d.tx - ox) * t;
           const dy = oy + (d.ty - oy) * t;
           const dr = 1.8 + k * 1.2;
           svg.append("circle")
               .attr("cx", dx).attr("cy", dy).attr("r", dr)
               .attr("fill", d.color.stroke)
               .attr("fill-opacity", 0.2 + k * 0.09);
       }
   });


   const cell = svg.selectAll(".pc-bubble")
       .data(nodes)
       .join("g")
       .attr("class", "pc-bubble")
       .attr("transform", d => `translate(${d.tx},${d.ty})`)
       .style("cursor", "pointer");


   cell.append("circle")
       .attr("r", d => d.r + 7)
       .attr("fill", "none")
       .attr("stroke", d => d.color.stroke)
       .attr("stroke-width", 1)
       .attr("stroke-opacity", 0.2)
       .attr("class", "pc-glow");


   cell.append("circle")
       .attr("r", d => d.r)
       .attr("fill", d => `url(#${d.gradId})`)
       .attr("stroke", d => d.color.stroke)
       .attr("stroke-width", 1.8)
       .attr("class", "pc-circle");
// highlight bubble
   cell.append("ellipse")
       .attr("rx", d => d.r * 0.36).attr("ry", d => d.r * 0.2)
       .attr("cx", d => -d.r * 0.16).attr("cy", d => -d.r * 0.34)
       .attr("fill", "rgba(255,255,255,0.12)");


   cell.append("text")
       .attr("dy", "-0.15em")
       .attr("text-anchor", "middle")
       .attr("font-size", d => Math.max(d.r * 0.38, 12))
       .attr("font-weight", "800")
       .attr("font-family", "ui-monospace, monospace")
       .attr("fill", d => d.color.text)
       .text(d => `${d.pct}%`);


   cell.each(function(d) {
       const g     = d3.select(this);
       const words = d.cause.split(" ");
       const fs = Math.min(Math.max(d.r * 0.185, 9), (d.r * 1.6) / Math.max(...words.map(w => w.length)));
       const lineH = fs + 2;
       const yBase = d.r * 0.22;


       if (words.length === 1) {
           g.append("text")
               .attr("dy", `${yBase + lineH}px`)
               .attr("text-anchor", "middle")
               .attr("font-size", fs)
               .attr("fill", "rgba(255,255,255,0.58)")
               .attr("font-family", "ui-sans-serif, system-ui, sans-serif")
               .text(d.cause);
       } else {
           const mid = Math.ceil(words.length / 2);
           [words.slice(0, mid).join(" "), words.slice(mid).join(" ")].forEach((line, li) => {
               g.append("text")
                   .attr("dy", `${yBase + lineH * (0.3 + li)}px`)
                   .attr("text-anchor", "middle")
                   .attr("font-size", fs)
                   .attr("fill", "rgba(255,255,255,0.58)")
                   .attr("font-family", "ui-sans-serif, system-ui, sans-serif")
                   .text(line);
           });
       }
   });
   // plane
   const planeG = svg.append("g")
       .attr("transform", `translate(${planeX}, ${planeY})`);


   planeG.append("ellipse")
       .attr("rx", 38).attr("ry", 10).attr("cy", 22)
       .attr("fill", "rgba(125,211,252,0.06)");


   planeG.append("text")
       .attr("text-anchor", "middle")
       .attr("dominant-baseline", "central")
       .attr("font-size", "60px")
       .text("✈")
       .attr("fill", "rgb(13,24,41)")
       .style("filter", "drop-shadow(0 0 12px rgba(125,211,252,0.4))");


   const tip = d3.select(container.node())
       .append("div")
       .style("position", "absolute")
       .style("display", "none")
       .style("pointer-events", "none")
       .style("background", "rgba(2,6,23,0.97)")
       .style("border", "1px solid rgba(255,255,255,0.14)")
       .style("border-radius", "12px")
       .style("padding", "14px 18px")
       .style("font-family", "ui-sans-serif, system-ui, sans-serif")
       .style("font-size", "12px")
       .style("color", "rgba(255,255,255,0.92)")
       .style("box-shadow", "0 12px 28px rgba(0,0,0,0.55)")
       .style("backdrop-filter", "blur(8px)")
       .style("max-width", "220px")
       .style("z-index", "999");


   cell
       .on("mouseenter", function(event, d) {
           d3.select(this).select(".pc-circle")
               .transition().duration(180)
               .attr("r", d.r * 1.08).attr("stroke-width", 2.5);
           d3.select(this).select(".pc-glow")
               .transition().duration(180)
               .attr("r", d.r * 1.08 + 10).attr("stroke-opacity", 0.5);


           const rect = container.node().getBoundingClientRect();
           tip.style("display", "block")
               .style("left", `${event.clientX - rect.left + 16}px`)
               .style("top",  `${event.clientY - rect.top  - 16}px`)
               .html(`
                   <div style="color:${d.color.text};font-weight:800;font-size:15px;margin-bottom:8px">${d.cause}</div>
                   <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:4px">
                       <span style="color:rgba(255,255,255,0.5)">Crashes</span>
                       <span style="font-weight:700">${d.count.toLocaleString()}</span>
                   </div>
                   <div style="display:flex;justify-content:space-between;gap:24px;margin-bottom:10px">
                       <span style="color:rgba(255,255,255,0.5)">Share</span>
                       <span style="font-weight:700;color:${d.color.text}">${d.pct}%</span>
                   </div>
                   <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.08)">
                       <div style="height:100%;border-radius:2px;background:${d.color.stroke};width:${d.pct}%"></div>
                   </div>`);
       })
       .on("mousemove", function(event) {
           const rect = container.node().getBoundingClientRect();
           tip.style("left", `${event.clientX - rect.left + 16}px`)
               .style("top",  `${event.clientY - rect.top  - 16}px`);
       })
       .on("mouseleave", function(_, d) {
           d3.select(this).select(".pc-circle")
               .transition().duration(220).attr("r", d.r).attr("stroke-width", 1.8);
           d3.select(this).select(".pc-glow")
               .transition().duration(220).attr("r", d.r + 7).attr("stroke-opacity", 0.2);
           tip.style("display", "none");
       });


   // entrance animation
   cell.attr("opacity", 0)
       .transition().delay((_, i) => 200 + i * 130).duration(550)
       .attr("opacity", 1);
}
