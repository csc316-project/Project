/**
 * Crashes (and fatalities) per year — line/area chart.
 * Expects CSV rows with Date (YYYY-MM-DD or similar) and optional Total fatalities.
 */
export function renderTimeline(container, rows) {
    var W = 480, H = 420, margin = { top: 32, right: 24, bottom: 48, left: 52 };
    var w = W - margin.left - margin.right, h = H - margin.top - margin.bottom;

    var byYear = {};
    var yearMaxCrash = {};
    var i, r, yr, lat, lon, dead;
    for (i = 0; i < rows.length; i++) {
        r = rows[i];
        lat = parseFloat(r.Latitude || r.lat || 0);
        lon = parseFloat(r.Longitude || r.lon || 0);
        if (isNaN(lat) || isNaN(lon)) continue;
        yr = null;
        var ds = (r.Date || "").trim();
        if (ds.indexOf("-") !== -1) yr = parseInt(ds.substring(0, ds.indexOf("-")), 10);
        else if (ds.indexOf("/") !== -1) { var p = ds.split("/"); yr = parseInt(p[p.length - 1], 10); }
        if (!yr || yr < 1900) continue;
        dead = parseInt(r["Total fatalities"] || r.Fatalities || 0, 10) || 0;
        if (!byYear[yr]) byYear[yr] = { year: yr, crashes: 0, fatalities: 0 };
        byYear[yr].crashes++;
        byYear[yr].fatalities += dead;

        if (!yearMaxCrash[yr] || dead > yearMaxCrash[yr].dead) {
            yearMaxCrash[yr] = {
                year: yr,
                dead: dead,
                loc: r["Crash location"] || r.Location || "Unknown",
                op: r.Operator || "Unknown",
                lat: lat,
                lon: lon
            };
        }
    }
    var arr = [];
    for (var k in byYear) { if (byYear.hasOwnProperty(k)) arr.push(byYear[k]); }
    arr.sort(function(a, b) { return a.year - b.year; });
    if (arr.length === 0) { container.append("p").text("No data to display."); return; }

    var svg = container.append("svg").attr("width", W).attr("height", H).attr("viewBox", "0 0 " + W + " " + H);
    var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var minYear = d3.min(arr, function(d) { return d.year; });
    var maxYear = d3.max(arr, function(d) { return d.year; });
    var xScale = d3.scaleLinear().domain([minYear, maxYear]).range([0, w]);
    var yScale = d3.scaleLinear().domain([0, d3.max(arr, function(d) { return d.crashes; })]).range([h, 0]);

    var line = d3.line()
        .x(function(d) { return xScale(d.year); })
        .y(function(d) { return yScale(d.crashes); })
        .curve(d3.curveMonotoneX);

    var clipId = "timeline-clip-path";
    var clip = g.append("clipPath").attr("id", clipId);
    var clipRect = clip.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 0)
        .attr("height", h);

    g.append("path")
        .datum(arr)
        .attr("class", "timeline-line")
        .attr("fill", "none")
        .attr("stroke", "#c45c26")
        .attr("stroke-width", 2)
        .attr("d", line)
        .attr("clip-path", "url(#" + clipId + ")");

    var xAxis = d3.axisBottom(xScale).ticks(12).tickFormat(d3.format("d"));
    g.append("g").attr("transform", "translate(0," + h + ")").call(xAxis).attr("color", "#5c564d");
    var yAxis = d3.axisLeft(yScale).ticks(6);
    g.append("g").call(yAxis).attr("color", "#5c564d");

    g.append("text").attr("x", w / 2).attr("y", h + 36).attr("text-anchor", "middle").attr("fill", "#5c564d").attr("font-size", "12px").text("Year");
    g.append("text").attr("x", -h / 2).attr("y", -42).attr("text-anchor", "middle").attr("transform", "rotate(-90)").attr("fill", "#5c564d").attr("font-size", "12px").text("Crashes");

    // Marker and tiny plane that move with the globe's current year
    var markerGroup = g.append("g").attr("class", "timeline-year-marker");
    var markerLine = markerGroup.append("line")
        .attr("y1", 0)
        .attr("y2", h)
        .attr("stroke", "#c45c26")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,4")
        .attr("opacity", 0.9);
    var markerCircle = markerGroup.append("circle")
        .attr("r", 4)
        .attr("fill", "#c45c26")
        .attr("stroke", "#fdfcfa")
        .attr("stroke-width", 1.5);
    var markerLabel = markerGroup.append("text")
        .attr("y", -8)
        .attr("text-anchor", "middle")
        .attr("fill", "#5c564d")
        .attr("font-size", "11px");

    var planeGroup = g.append("g").attr("class", "timeline-plane-marker");
    planeGroup.append("path")
        .attr("d", "M0,-6 L12,0 L0,6 Z")
        .attr("fill", "#c45c26")
        .attr("stroke", "#fdfcfa")
        .attr("stroke-width", 1.2);

    var infoBox = d3.select("#timeline-info-box");
    var infoContent = infoBox.empty() ? null : infoBox.select(".timeline-info-content");
    var infoToggle = d3.select("#timeline-info-toggle");
    var infoVisible = !infoBox.empty() && !infoBox.classed("collapsed");
    var lastYear = null;

    if (!infoToggle.empty()) {
        infoToggle.on("click", function() {
            infoVisible = !infoVisible;
            infoBox.classed("collapsed", !infoVisible);
            infoToggle.text(infoVisible ? "Hide" : "Show");
            // When re-showing, refresh content for the current year
            if (infoVisible && lastYear !== null) {
                updateYearHighlight(lastYear);
            }
        });
    }

    function updateYearHighlight(year) {
        if (!arr.length) return;
        lastYear = year;
        var target = arr[0];
        for (var i2 = 0; i2 < arr.length; i2++) {
            if (arr[i2].year <= year) target = arr[i2];
            else break;
        }
        var x = xScale(target.year);
        var y = yScale(target.crashes);

        // Reveal line progressively up to this year
        clipRect.attr("width", x);

        markerLine.attr("x1", x).attr("x2", x);
        markerCircle.attr("cx", x).attr("cy", y);
        markerLabel.attr("x", x).text(target.year.toString());

        // Move the tiny plane along the line
        planeGroup.attr("transform", "translate(" + x + "," + y + ") rotate(0)");

        // Update global "crashes this year" index text, if present
        var yearCountEl = d3.select("#crash-count-year");
        if (!yearCountEl.empty()) {
            yearCountEl.text(target.crashes);
        }

        // Update the timeline info box with the most fatal crash for this year
        if (infoContent && infoVisible) {
            var crash = yearMaxCrash[target.year];
            if (!crash || crash.dead === 0) {
                infoContent.html('<p class="timeline-info-placeholder">No fatal crash recorded for ' + target.year + '.</p>');
            } else {
                infoContent.html(
                    '<div class="timeline-crash-details">' +
                    '<div class="timeline-crash-main">Year ' + crash.year + ' — ' + crash.dead + ' fatalities</div>' +
                    '<div class="timeline-crash-meta">' +
                    '<div class="timeline-crash-label">Location</div>' +
                    '<div class="timeline-crash-value">' + crash.loc + '</div>' +
                    '</div>' +
                    '<div class="timeline-crash-meta">' +
                    '<div class="timeline-crash-label">Operator</div>' +
                    '<div class="timeline-crash-value">' + crash.op + '</div>' +
                    '</div>' +
                    '<div class="timeline-crash-actions">' +
                    '<button type="button" class="timeline-globe-btn">Show on globe</button>' +
                    '</div>' +
                    '</div>'
                );

                var globeBtn = infoContent.select(".timeline-globe-btn");
                globeBtn.on("click", function() {
                    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
                        try {
                            window.dispatchEvent(new CustomEvent("timeline-select-crash", {
                                detail: {
                                    year: crash.year,
                                    lat: crash.lat,
                                    lon: crash.lon,
                                    dead: crash.dead,
                                    loc: crash.loc,
                                    op: crash.op
                                }
                            }));
                        } catch (e) {
                            // ignore
                        }
                    }
                });
            }
        }
    }

    if (typeof window !== "undefined") {
        var initialYear = (window.vizApp && window.vizApp.year) || arr[arr.length - 1].year;
        updateYearHighlight(initialYear);
        window.addEventListener("viz-year-change", function(ev) {
            var y = ev && ev.detail && ev.detail.year;
            if (typeof y === "number") updateYearHighlight(y);
        });
    }
}
