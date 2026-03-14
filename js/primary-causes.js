export function render(container, data) {
    const width = container.node().getBoundingClientRect().width || 860;
    const palette = {
        "Unknown": {
            fill:   "#edd0ce",
            stroke: "#5c4d4d",
            text:   "#1c1916",
        },
        "Technical failure": {
            fill:   "#b9def1",
            stroke: "#266ac4",
            text:   "#1c1916",
        },
        "Human factor": {
            fill:   "#e8cbbd",
            stroke: "#9c3d14",
            text:   "#1c1916",
        },
        "Weather": {
            fill:   "#d0e3d8",
            stroke: "#3d7a5e",
            text:   "#1c1916",
        },
        "Other causes": {
            fill:   "#ddcfea",
            stroke: "#7a5c8c",
            text:   "#1c1916",
        },
        "Terrorism act, Hijacking, Sabotage": {
            fill:   "#e8ddc4",
            stroke: "#8c6f14",
            text:   "#1c1916",
        },
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
        .range([24, Math.min(width * 0.085, 64)]);
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
        const gap    = nodes[i].r + nodes[i + 1].r + 40;
        const needed = gap / (2 * Math.sin(step / 2));
        minArcR = Math.max(minArcR, needed);
    }
    const arcR    = minArcR * 1.08;
    const ySquish = 1.1;
    const planeX  = width / 2;
    const planeY  = 500;

    nodes.forEach((d, i) => {
        const angle = Math.PI / 2 + arcSpread / 2 - i * step;
        d.tx = planeX + Math.cos(angle) * arcR;
        d.ty = planeY - Math.sin(angle) * arcR * ySquish;
    });

    const pad   = 10;
    const topY  = d3.min(nodes, d => d.ty - d.r) - pad;
    const botY  = planeY + 60;
    const leftX = d3.min(nodes, d => d.tx - d.r - 7) - pad;
    const rightX= d3.max(nodes, d => d.tx + d.r + 7) + pad;
    const vbW   = rightX - leftX;
    const svgH  = botY - topY;

    const svg = container.append("svg")
        .attr("width", "100%")
        .attr("viewBox", `${leftX} ${topY} ${vbW} ${svgH}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("overflow", "visible");

    svg.append("rect")
        .attr("x", leftX).attr("y", topY)
        .attr("width", vbW).attr("height", svgH)
        .attr("fill", "#fdfcfa")
        .attr("rx", 4);

    const defs = svg.append("defs");

    const filt = defs.append("filter").attr("id", "pc-paper");
    filt.append("feTurbulence")
        .attr("type", "fractalNoise")
        .attr("baseFrequency", "0.65")
        .attr("numOctaves", "3")
        .attr("stitchTiles", "stitch");
    filt.append("feColorMatrix").attr("type", "saturate").attr("values", "0");
    filt.append("feBlend")
        .attr("in", "SourceGraphic")
        .attr("mode", "multiply")
        .attr("result", "blend");
    filt.append("feComposite")
        .attr("in", "blend")
        .attr("in2", "SourceGraphic")
        .attr("operator", "in");

    const shadow = defs.append("filter")
        .attr("id", "pc-shadow")
        .attr("x", "-20%").attr("y", "-20%")
        .attr("width", "140%").attr("height", "140%");
    shadow.append("feDropShadow")
        .attr("dx", "0").attr("dy", "2")
        .attr("stdDeviation", "4")
        .attr("flood-color", "rgba(28,25,22,0.12)");

    nodes.forEach((d, i) => {
        const gid  = `pc-grad-${i}`;
        const grad = defs.append("radialGradient")
            .attr("id", gid).attr("cx", "35%").attr("cy", "30%");
        grad.append("stop").attr("offset", "0%")
            .attr("stop-color", "#ffffff").attr("stop-opacity", 0.55);
        grad.append("stop").attr("offset", "100%")
            .attr("stop-color", d.color.fill).attr("stop-opacity", 1);
        d.gradId = gid;
    });

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
                .attr("fill-opacity", 0.18 + k * 0.07);
        }
    });

    const cell = svg.selectAll(".pc-bubble")
        .data(nodes)
        .join("g")
        .attr("class", "pc-bubble")
        .attr("transform", d => `translate(${d.tx},${d.ty})`)
        .style("cursor", "pointer")
        .attr("filter", "url(#pc-shadow)");

    cell.append("circle")
        .attr("r", d => d.r + 7)
        .attr("fill", "none")
        .attr("stroke", d => d.color.stroke)
        .attr("stroke-width", 1)
        .attr("stroke-opacity", 0.18)
        .attr("class", "pc-glow");

    cell.append("circle")
        .attr("r", d => d.r)
        .attr("fill", d => `url(#${d.gradId})`)
        .attr("stroke", d => d.color.stroke)
        .attr("stroke-width", 1.6)
        .attr("class", "pc-circle");

    cell.append("circle")
        .attr("r", d => d.r - 3)
        .attr("fill", "none")
        .attr("stroke", d => d.color.stroke)
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.25);

    cell.append("ellipse")
        .attr("rx", d => d.r * 0.36).attr("ry", d => d.r * 0.18)
        .attr("cx", d => -d.r * 0.16).attr("cy", d => -d.r * 0.34)
        .attr("fill", "rgba(255,255,255,0.55)");

    cell.append("text")
        .attr("dy", "-0.15em")
        .attr("text-anchor", "middle")
        .attr("font-size", d => Math.max(d.r * 0.36, 12))
        .attr("font-weight", "600")
        .attr("font-family", "DM Serif Display, Georgia, serif")
        .attr("fill", "rgba(0,0,0,0.75)")
        .text(d => `${d.pct}%`);

    cell.each(function(d) {
        const g     = d3.select(this);
        const words = d.cause.split(" ");
        const fs    = Math.min(
            Math.max(d.r * 0.185, 9),
            (d.r * 1.6) / Math.max(...words.map(w => w.length))
        );
        const lineH = fs + 2;
        const yBase = d.r * 0.22;

        if (words.length === 1) {
            g.append("text")
                .attr("dy", `${yBase + lineH}px`)
                .attr("text-anchor", "middle")
                .attr("font-size", fs)
                .attr("fill", "#736c65")
                .attr("font-family", "Georgia, serif")
                .text(d.cause);
        } else {
            const mid = Math.ceil(words.length / 2);
            [words.slice(0, mid).join(" "), words.slice(mid).join(" ")].forEach((line, li) => {
                g.append("text")
                    .attr("dy", `${yBase + lineH * (0.3 + li)}px`)
                    .attr("text-anchor", "middle")
                    .attr("font-size", fs)
                    .attr("fill", "#605a55")
                    .attr("font-family", "Georgia, serif")
                    .text(line);
            });
        }
    });

    const planeG = svg.append("g")
        .attr("transform", `translate(${planeX}, ${planeY})`);

    planeG.append("ellipse")
        .attr("rx", 36).attr("ry", 8).attr("cy", 22)
        .attr("fill", "rgba(28,25,22,0.07)");

    planeG.append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", "56px")
        .text("✈")
        .attr("fill", "#c45c26")
        .style("filter", "drop-shadow(0 2px 6px rgba(196,92,38,0.22))");

    const tip = d3.select(container.node())
        .append("div")
        .style("position", "absolute")
        .style("display", "none")
        .style("pointer-events", "none")
        .style("background", "#fdfcfa")
        .style("border", "1px solid #d4cfc4")
        .style("border-top", "3px solid #c45c26")
        .style("border-radius", "4px")
        .style("padding", "14px 18px")
        .style("font-family", "DM Sans, ui-sans-serif, system-ui, sans-serif")
        .style("font-size", "12px")
        .style("color", "#1c1916")
        .style("box-shadow", "0 4px 24px rgba(28,25,22,0.10)")
        .style("max-width", "220px")
        .style("z-index", "999");

    cell
        .on("mouseenter", function(event, d) {
            d3.select(this).select(".pc-circle")
                .transition().duration(160)
                .attr("r", d.r * 1.07).attr("stroke-width", 2.2);
            d3.select(this).select(".pc-glow")
                .transition().duration(160)
                .attr("r", d.r * 1.07 + 10).attr("stroke-opacity", 0.38);

            const rect = container.node().getBoundingClientRect();
            tip.style("display", "block")
                .style("left", `${event.clientX - rect.left + 16}px`)
                .style("top",  `${event.clientY - rect.top  - 16}px`)
                .html(`
                    <div style="font-family:'DM Serif Display',Georgia,serif;
                                font-size:15px;font-weight:400;
                                margin-bottom:10px;color:#1c1916;
                                padding-bottom:8px;border-bottom:1px solid #d4cfc4">
                        ${d.cause}
                    </div>
                    <div style="display:flex;justify-content:space-between;
                                gap:24px;margin-bottom:4px">
                        <span style="color:#5c564d;font-size:11px;
                                     text-transform:uppercase;letter-spacing:.08em">Crashes</span>
                        <span style="font-weight:700">${d.count.toLocaleString()}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;
                                gap:24px;margin-bottom:12px">
                        <span style="color:#5c564d;font-size:11px;
                                     text-transform:uppercase;letter-spacing:.08em">Share</span>
                        <span style="font-weight:700;color:#c45c26">${d.pct}%</span>
                    </div>
                    <div style="height:3px;border-radius:2px;background:#e8e2d9">
                        <div style="height:100%;border-radius:2px;
                                    background:#c45c26;width:${d.pct}%"></div>
                    </div>`);
        })
        .on("mousemove", function(event) {
            const rect = container.node().getBoundingClientRect();
            tip.style("left", `${event.clientX - rect.left + 16}px`)
                .style("top",  `${event.clientY - rect.top  - 16}px`);
        })
        .on("mouseleave", function(_, d) {
            d3.select(this).select(".pc-circle")
                .transition().duration(200)
                .attr("r", d.r).attr("stroke-width", 1.6);
            d3.select(this).select(".pc-glow")
                .transition().duration(200)
                .attr("r", d.r + 7).attr("stroke-opacity", 0.18);
            tip.style("display", "none");
        });

    cell.attr("opacity", 0)
        .transition()
        .delay((_, i) => 200 + i * 130)
        .duration(550)
        .attr("opacity", 1);
}
