/**
 * Crash cause breakdown — horizontal bar chart.
 * Expects CSV with Crash cause (or similar) column.
 */
export function renderCauses(container, rows) {
    var W = 900, H = 340, margin = { top: 20, right: 24, bottom: 20, left: 140 };
    var w = W - margin.left - margin.right, h = H - margin.top - margin.bottom;

    var counts = {};
    var i, r, cause;
    for (i = 0; i < rows.length; i++) {
        r = rows[i];
        cause = (r["Crash cause"] || "").trim() || "Unknown";
        counts[cause] = (counts[cause] || 0) + 1;
    }
    var arr = [];
    for (var k in counts) { if (counts.hasOwnProperty(k)) arr.push({ cause: k, count: counts[k] }); }
    arr.sort(function(a, b) { return b.count - a.count; });
    var top = arr.slice(0, 10);
    if (top.length === 0) { container.append("p").text("No data."); return; }

    var svg = container.append("svg").attr("width", W).attr("height", H).attr("viewBox", "0 0 " + W + " " + H);
    var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var xScale = d3.scaleLinear().domain([0, d3.max(top, function(d) { return d.count; })]).range([0, w]);
    var yScale = d3.scaleBand().domain(top.map(function(d) { return d.cause; })).range([0, h]).padding(0.25);

    g.selectAll("rect").data(top).enter().append("rect")
        .attr("x", 0).attr("y", function(d) { return yScale(d.cause); })
        .attr("width", function(d) { return xScale(d.count); }).attr("height", yScale.bandwidth())
        .attr("fill", "rgba(196, 92, 38, 0.35)").attr("stroke", "#c45c26").attr("stroke-width", 1)
        .attr("rx", 4);

    g.selectAll(".cause-label").data(top).enter().append("text")
        .attr("class", "cause-label")
        .attr("x", -8).attr("y", function(d) { return yScale(d.cause) + yScale.bandwidth() / 2; })
        .attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", "#1c1916").attr("font-size", "12px")
        .text(function(d) { return d.cause; });

    g.selectAll(".count-label").data(top).enter().append("text")
        .attr("class", "count-label")
        .attr("x", function(d) { return xScale(d.count) + 6; }).attr("y", function(d) { return yScale(d.cause) + yScale.bandwidth() / 2; })
        .attr("dy", "0.35em").attr("fill", "#5c564d").attr("font-size", "11px")
        .text(function(d) { return d.count; });

    var xAxis = d3.axisTop(xScale).ticks(6);
    g.append("g").call(xAxis).attr("color", "#5c564d");
}
