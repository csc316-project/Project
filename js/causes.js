/**
 * Crash cause breakdown — horizontal bar chart with metric + region filter and animations.
 * Features:
 * - Metrics: Number of crashes, Total fatalities
 * - Region filter
 * - Animated bars
 */
export function renderCauses(container, rows) {
    const W = 900, H = 340, margin = { top: 20, right: 24, bottom: 20, left: 200 };
    const w = W - margin.left - margin.right, h = H - margin.top - margin.bottom;
    const rightPadding = 50;

    // Metrics
    const metrics = {
        "Number of crashes": d => 1,
        "Total fatalities": d => +d["Crew fatalities"] + +d["PAX fatalities"] + +d["Other fatalities"] || 0
    };

    // Regions
    const regions = Array.from(new Set(
        rows.map(d => d["Region"])
            .filter(r => r && r.trim() !== "" && r.trim().toLowerCase() !== "world")
    )).sort();

    const wrapper = container.append("div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("align-items", "center");

    // Dropdown menu
    const menuDiv = wrapper.append("div")
        .style("display", "flex")
        .style("gap", "20px")
        .style("align-items", "center")
        .style("margin-bottom", "15px")
        .style("font-family", "sans-serif")
        .style("font-size", "14px");

    // Metric dropdown
    menuDiv.append("label").text("Metric:").style("margin-right", "5px");
    const metricSelect = menuDiv.append("select")
        .style("padding", "4px 8px")
        .style("border-radius", "4px")
        .style("border", "1px solid #ccc")
        .style("background-color", "#fff");
    metricSelect.selectAll("option")
        .data(Object.keys(metrics))
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);

    // Region dropdown
    menuDiv.append("label").text("Region:").style("margin-left", "10px").style("margin-right", "5px");
    const regionSelect = menuDiv.append("select")
        .style("padding", "4px 8px")
        .style("border-radius", "4px")
        .style("border", "1px solid #ccc")
        .style("background-color", "#fff");
    regionSelect.append("option").attr("value", "All").text("All");
    regionSelect.selectAll("option.region-option")
        .data(regions)
        .enter()
        .append("option")
        .attr("class", "region-option")
        .attr("value", d => d)
        .text(d => d);

    // SVG centered
    const svg = wrapper.append("svg")
        .attr("width", W)
        .attr("height", H)
        .attr("viewBox", `0 0 ${W} ${H}`)
        .style("display", "block")
        .style("margin", "0 auto");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const yScale = d3.scaleBand().range([0, h]).padding(0.25);
    const xScale = d3.scaleLinear().range([0, w - rightPadding]); // leave room for labels

    function updateChart() {
        const selectedMetric = metricSelect.property("value");
        const selectedRegion = regionSelect.property("value");

        const filteredRows = rows.filter(d =>
            selectedRegion === "All" || (d["Region"] || "").trim() === selectedRegion
        );

        const counts = {};
        filteredRows.forEach(r => {
            const cause = (r["Crash cause"] || "").trim() || "Unknown";
            counts[cause] = (counts[cause] || 0) + metrics[selectedMetric](r);
        });

        const arr = Object.keys(counts).map(k => ({ cause: k, value: counts[k] }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        if (arr.length === 0) {
            g.selectAll("*").remove();
            g.append("text").text("No data").attr("x", 10).attr("y", 20);
            return;
        }

        xScale.domain([0, d3.max(arr, d => d.value)]);
        yScale.domain(arr.map(d => d.cause));

        // Bars
        const bars = g.selectAll("rect").data(arr, d => d.cause);
        bars.exit().transition().duration(800).attr("width", 0).remove();
        bars.transition().duration(800)
            .attr("y", d => yScale(d.cause))
            .attr("width", d => xScale(d.value))
            .attr("height", yScale.bandwidth());
        bars.enter().append("rect")
            .attr("x", 0)
            .attr("y", d => yScale(d.cause))
            .attr("width", 0)
            .attr("height", yScale.bandwidth())
            .attr("fill", "rgba(196, 92, 38, 0.35)")
            .attr("stroke", "#c45c26")
            .attr("stroke-width", 1)
            .attr("rx", 4)
            .transition().duration(800)
            .attr("width", d => xScale(d.value));

        // Cause labels
        const causeLabels = g.selectAll(".cause-label").data(arr, d => d.cause);
        causeLabels.exit().remove();
        causeLabels.enter().append("text")
            .attr("class", "cause-label")
            .attr("x", -8)
            .attr("y", d => yScale(d.cause) + yScale.bandwidth()/2)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .attr("fill", "#1c1916")
            .attr("font-size", "12px")
            .text(d => d.cause)
          .merge(causeLabels)
            .transition().duration(800)
            .attr("y", d => yScale(d.cause) + yScale.bandwidth()/2);

        // Value labels
        const countLabels = g.selectAll(".count-label").data(arr, d => d.cause);
        countLabels.exit().remove();
        countLabels.enter().append("text")
            .attr("class", "count-label")
            .attr("x", d => xScale(d.value) + 6)
            .attr("y", d => yScale(d.cause) + yScale.bandwidth()/2)
            .attr("dy", "0.35em")
            .attr("fill", "#5c564d")
            .attr("font-size", "11px")
            .text(d => d.value)
          .merge(countLabels)
            .transition().duration(800)
            .attr("x", d => xScale(d.value) + 6)
            .attr("y", d => yScale(d.cause) + yScale.bandwidth()/2)
            .text(d => d.value);

        // X-axis
        g.selectAll(".x-axis").remove();
        g.append("g").attr("class", "x-axis").call(d3.axisTop(xScale).ticks(6)).attr("color", "#5c564d");
    }

    updateChart();
    metricSelect.on("change", updateChart);
    regionSelect.on("change", updateChart);
}
