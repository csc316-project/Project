var W = 480, H = 420;

(function() {
    var box = d3.select("#globe-container");
    var loadEl = box.select(".loading");
    if (loadEl.size() > 0) loadEl.remove();

    var svg = box.append("svg");
    svg.attr("width", W);
    svg.attr("height", H);
    var cvs = box.append("canvas");
    cvs.attr("width", W).attr("height", H);
    var ctx = cvs.node().getContext("2d");

    var proj = d3.geoOrthographic();
    proj.scale(190);
    proj.translate([W/2, H/2]);
    proj.clipAngle(90);
    var path = d3.geoPath().projection(proj);

    var yearNow = 2023, playing = false, speed = 1;
    var rotX = 0, rotY = 0;
    var drag = false;
    var lastX = 0, lastY = 0, startX = 0, startY = 0, tDown = 0;
    var crashes = [], byYear = [], hitList = [], selected = [];
    var selIdx = 0;
    var playTimer = null, raf = null;
    var yearRange = { lo: 1900, hi: 2023 };

    function parseCSV(rows) {
        var arr = [];
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var lat = parseFloat(r.Latitude || r.lat || 0);
            var lon = parseFloat(r.Longitude || r.lon || 0);
            var yr;
            var ds = (r.Date || "").trim();
            if (ds.indexOf("-") !== -1) {
                yr = parseInt(ds.substring(0, ds.indexOf("-")), 10);
            } else if (ds.indexOf("/") !== -1) {
                var p = ds.split("/");
                yr = parseInt(p[p.length - 1], 10);
            } else {
                yr = null;
            }
            if (isNaN(lat) || isNaN(lon)) continue;
            if (yr === null || yr === undefined) continue;
            arr.push({
                lat: lat, lon: lon, year: yr,
                loc: r["Crash location"] || r.Location || "Unknown",
                op: r.Operator || "Unknown",
                dead: parseInt(r["Total fatalities"] || r.Fatalities || 0, 10) || 0,
                country: r.Country || "Unknown"
            });
        }
        crashes = arr;
    }

    function drawMap(geo) {
        var topo = topojson.feature(geo, geo.objects.countries);
        var feats = topo.features;
        var g = svg.append("g");
        var paths = g.selectAll("path").data(feats);
        paths.enter().append("path");
        g.selectAll("path")
            .attr("d", path)
            .attr("fill", "#e8e2d9")
            .attr("stroke", "#c4b9a5")
            .attr("stroke-width", 0.8);
        var grat = d3.geoGraticule();
        var gratPath = svg.append("path");
        gratPath.datum(grat).attr("d", path).attr("fill", "none");
        gratPath
            .attr("stroke", "rgba(92,86,77,0.25)")
            .attr("stroke-width", 0.5);
        var sc = proj.scale();
        var circ = svg.append("circle");
        circ.attr("cx", W/2).attr("cy", H/2).attr("r", sc);
        circ
            .attr("fill", "none")
            .attr("stroke", "#c4b9a5")
            .attr("stroke-width", 2);
    }

    function getHeatCells() {
        var cell = 3, map = {}, n = byYear.length, idx, c, gx, gy, id, out = [], key;
        idx = 0;
        while (idx < n) {
            c = byYear[idx];
            gx = Math.floor((c.lon + 180) / cell);
            gy = Math.floor((c.lat + 90) / cell);
            id = String(gx) + "_" + String(gy);
            if (!map[id]) map[id] = { x: gx*cell - 180 + cell/2, y: gy*cell - 90 + cell/2, cnt: 0 };
            map[id].cnt++;
            idx++;
        }
        for (key in map) { if (map.hasOwnProperty(key)) out.push(map[key]); }
        return out;
    }

    function rgbFromT(t) {
        var r, g, b;
        if (t < 0.25) {
            r = 0; g = Math.floor(t*4*255); b = 128 + Math.floor(t*4*127);
        } else if (t < 0.5) {
            r = Math.floor((t-0.25)*4*255); g = 255; b = Math.floor((1-(t-0.25)*4)*255);
        } else if (t < 0.75) {
            r = 255; g = Math.floor((1-(t-0.5)*4*0.5)*255); b = 0;
        } else {
            r = 255; g = Math.floor((0.5-(t-0.75)*4*0.5)*255); b = 0;
        }
        return { r: r, g: g, b: b };
    }

    function drawHeat(cells) {
        if (!cells || cells.length === 0) return;
        var mx = 0, i, j, b, pt, cx, cy, sc, maxR2, t, rad, rgb;
        for (i = 0; i < cells.length; i++) { if (cells[i].cnt > mx) mx = cells[i].cnt; }
        cx = W/2; cy = H/2; sc = proj.scale(); maxR2 = (sc+50)*(sc+50);
        for (j = 0; j < cells.length; j++) {
            b = cells[j];
            pt = proj([b.x, b.y]);
            if (!pt || isNaN(pt[0])) continue;
            if ((pt[0]-cx)*(pt[0]-cx) + (pt[1]-cy)*(pt[1]-cy) > maxR2) continue;
            t = b.cnt / mx;
            rad = Math.sqrt(t) * 50;
            rgb = rgbFromT(t);
            ctx.fillStyle = "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0.7)";
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], rad, 0, 2*Math.PI);
            ctx.fill();
        }
    }

    function drawCrashDots() {
        hitList = [];
        var list = byYear;
        if (list.length > 2000) {
            var sorted = list.slice().sort(function(a,b) { return b.dead - a.dead; });
            var top = sorted.slice(0, 600), rest = sorted.slice(600);
            var step = Math.ceil(rest.length / 1400);
            for (var i = 0; i < rest.length; i += step) top.push(rest[i]);
            list = top;
        }
        var lim = proj.scale() + 50, cx = W/2, cy = H/2;
        for (var k = 0; k < list.length; k++) {
            var p = list[k];
            var xy = proj([p.lon, p.lat]);
            if (!xy || Math.hypot(xy[0]-cx, xy[1]-cy) > lim) continue;
            var rad = p.dead > 0 ? Math.min(3, 1 + p.dead/100) : 1.5;
            hitList.push({ d: p, x: xy[0], y: xy[1], r: rad });
            var hi = false;
            for (var s = 0; s < selected.length; s++)
                if (selected[s].lat === p.lat && selected[s].lon === p.lon && selected[s].year === p.year) { hi = true; break; }
            ctx.beginPath();
            ctx.arc(xy[0], xy[1], hi ? rad+2 : rad, 0, Math.PI*2);
            if (hi) {
                ctx.fillStyle = "rgba(255,200,50,0.9)";
                ctx.fill();
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.fillStyle = "rgba(255,100,100,0.6)";
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.9)";
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    function refreshLegend(cells) {
        var leg = d3.select("#legend-items");
        if (!cells.length) { leg.html('<div class="legend-item">No crashes</div>'); return; }
        var mx = 0;
        for (var i = 0; i < cells.length; i++) if (cells[i].cnt > mx) mx = cells[i].cnt;
        leg.html('<div style="display:flex;height:10px;background:linear-gradient(90deg,blue,cyan,yellow,orange,red);width:100%;margin-bottom:5px;"></div><div style="text-align:center;font-size:12px;opacity:0.8;">Max density: ' + mx + '</div>');
    }

    function repaint() {
        ctx.clearRect(0, 0, W, H);
        var heat = [];
        if (byYear.length > 500) {
            heat = getHeatCells();
            drawHeat(heat);
        }
        drawCrashDots();
        refreshLegend(heat);
    }

    function applyYear() {
        byYear = [];
        for (var i = 0; i < crashes.length; i++) if (crashes[i].year <= yearNow) byYear.push(crashes[i]);
        d3.select("#crash-count").text(byYear.length);
        repaint();
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
            try {
                window.dispatchEvent(new CustomEvent("viz-year-change", { detail: { year: yearNow } }));
            } catch (e) {
                // ignore if CustomEvent is not supported
            }
        }
    }

    function frame() {
        if (raf) return;
        raf = requestAnimationFrame(function() {
            proj.rotate([rotY, -rotX]);
            svg.selectAll("path").attr("d", path);
            applyYear();
            raf = null;
        });
    }

    function wireControls() {
        var yrs = [];
        for (var i = 0; i < crashes.length; i++) yrs.push(crashes[i].year);
        yearRange.lo = Math.min.apply(null, yrs);
        yearRange.hi = Math.max.apply(null, yrs);
        var slider = d3.select("#year-slider");
        var disp = d3.select("#year-display");
        slider.attr("min", yearRange.lo);
        slider.attr("max", yearRange.hi);
        slider.attr("value", yearRange.hi);
        slider.on("input", function() {
            yearNow = +this.value;
            disp.text(yearNow);
            if (raf === null) frame();
        });
        yearNow = yearRange.hi;
        disp.text(yearNow);

        var playBtn = d3.select("#play-pause");
        playBtn.on("click", function() {
            playing = !playing;
            playBtn.text(playing ? "Pause" : "Play");
            if (playing) {
                var step = 1000 / speed;
                if (playTimer) clearInterval(playTimer);
                playTimer = setInterval(function() {
                    if (yearNow >= yearRange.hi) yearNow = yearRange.lo;
                    else yearNow++;
                    slider.property("value", yearNow);
                    disp.text(yearNow);
                    frame();
                }, step);
            } else {
                clearInterval(playTimer);
            }
        });

        d3.select("#speed-slider").on("input", function() {
            speed = parseFloat(this.value, 10);
            d3.select("#speed-display").text(speed.toFixed(1));
            // If currently playing, update the timer without resetting the year
            if (playing) {
                if (playTimer) clearInterval(playTimer);
                var step = 1000 / speed;
                playTimer = setInterval(function() {
                    if (yearNow >= yearRange.hi) yearNow = yearRange.lo;
                    else yearNow++;
                    slider.property("value", yearNow);
                    disp.text(yearNow);
                    frame();
                }, step);
            }
        });

        d3.select("#reset").on("click", function() {
            playing = false;
            clearInterval(playTimer);
            d3.select("#play-pause").text("Play");
            yearNow = yearRange.lo;
            slider.property("value", yearRange.lo);
            disp.text(yearRange.lo);
            frame();
        });

    }

    function wireMouse() {
        var node = cvs.node();
        var canvasSel = d3.select(node);
        var winSel = d3.select(window);

        function handleDown(ev) {
            ev.preventDefault();
            drag = true;
            var x = ev.clientX, y = ev.clientY;
            if (ev.touches) { x = ev.touches[0].clientX; y = ev.touches[0].clientY; }
            lastX = x; lastY = y; startX = x; startY = y; tDown = Date.now();
            node.style.cursor = "grabbing";
        }

        function handleMove(ev) {
            if (!drag) {
                var r = node.getBoundingClientRect();
                var mx = ev.clientX - r.left, my = ev.clientY - r.top;
                if (ev.touches) { mx = ev.touches[0].clientX - r.left; my = ev.touches[0].clientY - r.top; }
                var over = null, i, h;
                for (i = 0; i < hitList.length; i++) {
                    h = hitList[i];
                    if ((mx - h.x)*(mx - h.x) + (my - h.y)*(my - h.y) < 100) { over = h; break; }
                }
                node.style.cursor = over ? "pointer" : "default";
                return;
            }
            ev.preventDefault();
            var x = ev.clientX, y = ev.clientY;
            if (ev.touches) { x = ev.touches[0].clientX; y = ev.touches[0].clientY; }
            rotY += (x - lastX) * 0.5;
            rotX += (y - lastY) * 0.5;
            if (rotX > 90) rotX = 90; else if (rotX < -90) rotX = -90;
            lastX = x; lastY = y;
            frame();
        }

        function handleUp(ev) {
            if (!drag) return;
            drag = false;
            node.style.cursor = "default";
            var x = ev.clientX, y = ev.clientY;
            if (ev.changedTouches) { x = ev.changedTouches[0].clientX; y = ev.changedTouches[0].clientY; }
            var dx = x - startX, dy = y - startY;
            if (dx*dx + dy*dy < 25 && (Date.now() - tDown) < 300) clickAt(ev);
        }

        function handleWheel(ev) {
            ev.preventDefault();
            var s = proj.scale();
            s = ev.deltaY > 0 ? s * 0.9 : s * 1.1;
            if (s < 150) s = 150; else if (s > 600) s = 600;
            proj.scale(s);
            frame();
        }

        canvasSel.on("mousedown", handleDown);
        canvasSel.on("touchstart", handleDown);
        canvasSel.on("wheel", handleWheel);
        winSel.on("mousemove", handleMove);
        winSel.on("touchmove", handleMove);
        winSel.on("mouseup", handleUp);
        winSel.on("touchend", handleUp);
        d3.select("#prev-crash").on("click", function() { navSel(-1); });
        d3.select("#next-crash").on("click", function() { navSel(1); });
    }

    function clickAt(ev) {
        var rect = cvs.node().getBoundingClientRect();
        var cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
        if (ev.changedTouches) { cx = ev.changedTouches[0].clientX - rect.left; cy = ev.changedTouches[0].clientY - rect.top; }
        var best = null, bestD = 15, i, d, j, a;
        for (i = 0; i < hitList.length; i++) {
            d = Math.sqrt((cx - hitList[i].x)*(cx - hitList[i].x) + (cy - hitList[i].y)*(cy - hitList[i].y));
            if (d < bestD) { bestD = d; best = hitList[i]; }
        }
        if (best) {
            selected = [];
            for (j = 0; j < byYear.length; j++) {
                a = byYear[j];
                if (a.lat === best.d.lat && a.lon === best.d.lon) selected.push(a);
            }
            selected.sort(function(aa, bb) { return bb.dead - aa.dead; });
            selIdx = 0;
            showSel();
        } else {
            selected = [];
            d3.select("#crash-info-box").classed("active", false);
        }
        repaint();
    }

    function navSel(dir) {
        if (selected.length < 2) return;
        selIdx = selIdx + dir;
        if (selIdx < 0) selIdx = 0;
        if (selIdx > selected.length - 1) selIdx = selected.length - 1;
        showSel();
    }

    function showSel() {
        var c = selected[selIdx];
        var info = d3.select("#crash-info-box");
        info.classed("active", true);
        var inner = info.select(".info-box-content");
        inner.html(
            '<button type="button" class="crash-close" aria-label="Clear selection">×</button>' +
            '<div class="crash-details">' +
            '<div class="crash-navigation">' +
            '<button type="button" class="nav-button" id="prev-crash">Previous</button>' +
            '<span class="nav-info">Crash ' + (selIdx+1) + ' of ' + selected.length + '</span>' +
            '<button type="button" class="nav-button" id="next-crash">Next</button>' +
            '</div>' +
            '<div class="crash-title">Crash details</div>' +
            '<div class="crash-detail-item"><b>Date:</b> ' + c.year + '</div>' +
            '<div class="crash-detail-item"><b>Loc:</b> ' + c.loc + '</div>' +
            '<div class="crash-detail-item"><b>Op:</b> ' + c.op + '</div>' +
            '<div class="crash-detail-item"><b>Fatalities:</b> ' + c.dead + '</div></div>'
        );
        inner.select("#prev-crash").on("click", function() { navSel(-1); });
        inner.select("#next-crash").on("click", function() { navSel(1); });
        inner.select(".crash-close").on("click", function() {
            selected = [];
            selIdx = 0;
            info.classed("active", false);
            inner.html('<p class="info-placeholder">Click on a crash point to see details</p>');
            repaint();
        });
    }

    var worldUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
    var csvUrl = "data/Plane_Crashes_with_Coordinates.csv";
    Promise.all([d3.json(worldUrl), d3.csv(csvUrl)]).then(function(res) {
        parseCSV(res[1]);
        drawMap(res[0]);
        applyYear();
        wireControls();
        wireMouse();

        if (typeof window !== "undefined") {
            window.vizApp = {};
            Object.defineProperty(window.vizApp, "year", { get: function() { return yearNow; } });
            Object.defineProperty(window.vizApp, "data", { get: function() { return crashes; } });
            Object.defineProperty(window.vizApp, "filtered", { get: function() { return byYear; } });

            window.addEventListener("timeline-select-crash", function(ev) {
                var d = ev && ev.detail;
                if (!d || !crashes.length) return;
                // Move globe time to this crash's year
                yearNow = d.year;
                var slider = d3.select("#year-slider");
                var disp = d3.select("#year-display");
                if (!slider.empty()) slider.property("value", yearNow);
                if (!disp.empty()) disp.text(yearNow);
                applyYear();

                // Collect all crashes at this exact lat/lon for this year
                selected = [];
                for (var i = 0; i < byYear.length; i++) {
                    var c = byYear[i];
                    if (c.year === d.year &&
                        Math.abs(c.lat - d.lat) < 1e-3 &&
                        Math.abs(c.lon - d.lon) < 1e-3) {
                        selected.push(c);
                    }
                }
                if (!selected.length) return;
                selected.sort(function(a, b) { return b.dead - a.dead; });
                selIdx = 0;

                // Rotate globe so this point is centered
                rotY = -d.lon;
                rotX = d.lat;
                if (rotX > 90) rotX = 90; else if (rotX < -90) rotX = -90;
                frame();
                showSel();
            });
        }
    }).catch(function(e) { console.error("Load error:", e); });
})();
