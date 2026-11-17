let sourceData, data, activeView = "progress";

const $ = id => document.getElementById(id);

const fmt = n => Number(n || 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const fmtPct = n => n == null ? "—" : ${Number(n).toFixed(2)}%;

const chLabel = m =>
    ${Math.floor(m / 1000)}+${String(m % 1000).padStart(3, "0")};

function clone(x) {
    return JSON.parse(JSON.stringify(x));
}

async function init() {

    const res = await fetch("data.json");

    sourceData = await res.json();

    const saved = localStorage.getItem("pvrEarthworksV1");

    data = saved ? JSON.parse(saved) : clone(sourceData);

    $("loadStatus").textContent =
        `Loaded ${data.activities.length} activity rows · ` +
        `${data.chainages.length} chainages · ` +
        `${data.activities.reduce((s, a) =>
            s + a.completed.filter(Boolean).length, 0
        ).toLocaleString()} completed indicators`;

    for (const id of ["pChain", "qChain"]) {

        $(id).innerHTML =
            '<option value="">All chainages</option>' +
            data.chainages.map(m =>
                <option value="${m}">${chLabel(m)}</option>
            ).join("");

    }

    bind();

    renderAll();
}

function bind() {

    document.querySelectorAll(".tab").forEach(b =>
        b.addEventListener("click", () =>
            showView(b.dataset.view)
        )
    );

    ["pSearch", "pSide", "pChain"].forEach(id =>
        $(id).addEventListener(
            id === "pSearch" ? "input" : "change",
            renderProgress
        )
    );

    ["qSearch", "qSide", "qChain"].forEach(id =>
        $(id).addEventListener(
            id === "qSearch" ? "input" : "change",
            renderQuantities
        )
    );

    $("exportBtn").onclick = exportCSV;

    $("backupBtn").onclick = backup;

    $("resetBtn").onclick = () => {

        if (confirm(
            "Discard all local changes and restore the original workbook values?"
        )) {

            data = clone(sourceData);

            persist();

            renderAll();

        }

    };
}

function showView(view) {

    activeView = view;

    document.querySelectorAll(".tab").forEach(b =>
        b.classList.toggle("active", b.dataset.view === view)
    );

    ["progress", "quantities", "summary"].forEach(v =>
        $(${v}View).classList.toggle("hidden", v !== view)
    );

    if (view === "progress") renderProgress();

    if (view === "quantities") renderQuantities();

    if (view === "summary") renderSummary();
}

function calculate() {

    const rows = data.activities.map(a => {

        let mt = a.design.reduce(
            (s, n) => s + (Number(n) || 0), 0
        );

        let mu = 0;

        let count = 0;

        a.design.forEach((n, i) => {

            if (a.completed[i]) {

                mu += Number(n) || 0;

                count++;

            }

        });

        let mw = mt - mu;

        let mv = (
            a.hasMV &&
            mw !== null &&
            mt !== null &&
            mt !== 0
        ) ? (mu / mt * 100) : null;

        let mx = a.hasMX && mv !== null
            ? (100 - mv) / 100
            : null;

        return {
            ...a,
            mt,
            mu,
            mw,
            mv,
            mx,
            my: a.hasMY ? count * 20 : null,
            count
        };

    });

    const avg = arr => {

        let x = arr.filter(v =>
            v !== null && !Number.isNaN(v)
        );

        return x.length
            ? x.reduce((a, b) => a + b, 0) / x.length
            : null;

    };

    const overallMV = avg(rows.map(r => r.mv));

    const overallMX = avg(rows.map(r => r.mx));

    return {

        rows,

        mt: rows.reduce((s, r) => s + r.mt, 0),

        mu: rows.reduce((s, r) => s + r.mu, 0),

        mw: rows.reduce((s, r) => s + r.mw, 0),

        mv: overallMV,

        mx: overallMX === null ? null : overallMX * 100,

        checks: rows.reduce((s, r) => s + r.count, 0)

    };
}

function renderCards() {

    const c = calculate();

    $("mt").textContent = fmt(c.mt);

    $("mu").textContent = fmt(c.mu);

    $("mw").textContent = fmt(c.mw);

    $("mv").textContent = fmtPct(c.mv);

    $("mx").textContent = fmtPct(c.mx);
}

function filteredRows(prefix) {

    let q = $(prefix + "Search").value.toLowerCase();

    let side = $(prefix + "Side").value;

    return data.activities
        .map((a, i) => ({ ...a, index: i }))
        .filter(a =>
            (!q || a.activity.toLowerCase().includes(q)) &&
            (!side || a.side === side)
        );
}

function tableHead() {

    return `<thead><tr>
        <th class="activity">Activity</th>
        <th class="side">Side</th>
        ${data.chainages.map(m =>
            <th>${chLabel(m)}</th>
        ).join("")}
    </tr></thead>`;

}

function renderProgress() {

    let chain = $("pChain").value;

    let rows = filteredRows("p");

    $("progressTable").innerHTML =
        tableHead() +
        "<tbody>" +
        rows.map(a =>
            `<tr>
                <td class="activity">${esc(a.activity)}</td>
                <td class="side">${esc(a.side)}</td>
                ${a.completed.map((v, i) =>
                    `<td class="${v ? "done" : ""}">
                        <input
                            class="tick"
                            type="checkbox"
                            data-row="${a.index}"
                            data-col="${i}"
                            ${v ? "checked" : ""}
                            aria-label="${esc(a.activity)} ${esc(a.side)} ${chLabel(data.chainages[i])}"
                            ${chain && Number(chain) !== data.chainages[i] ? "disabled" : ""}
                        >
                    </td>`
                ).join("")}
            </tr>`
        ).join("") +
        "</tbody>";

    $("progressTable")
        .querySelectorAll("input.tick")
        .forEach(el =>
            el.addEventListener("change", e => {

                let a = data.activities[
                    +e.target.dataset.row
                ];

                let i = +e.target.dataset.col;

                a.completed[i] = e.target.checked;

                persist();

                renderCards();

                renderProgress();

                if (activeView === "summary") {
                    renderSummary();
                }

            })
        );
}

function renderQuantities() {

    let chain = $("qChain").value;

    let rows = filteredRows("q");

    $("quantityTable").innerHTML =
        tableHead() +
        "<tbody>" +
        rows.map(a =>
            `<tr>
                <td class="activity">${esc(a.activity)}</td>
                <td class="side">${esc(a.side)}</td>
                ${a.design.map((v, i) =>
                    `<td class="qtycell">
                        <input
                            class="qty"
                            type="number"
                            min="0"
                            step="any"
                            data-row="${a.index}"
                            data-col="${i}"
                            value="${Number(v) || 0}"
                            ${chain && Number(chain) !== data.chainages[i] ? "disabled" : ""}
                        >
                    </td>`
                ).join("")}
            </tr>`
        ).join("") +
        "</tbody>";

    $("quantityTable")
        .querySelectorAll("input.qty")
        .forEach(el =>
            el.addEventListener("change", e => {

                let a = data.activities[
                    +e.target.dataset.row
                ];

                let i = +e.target.dataset.col;

                let n = Number(e.target.value);

                if (!Number.isFinite(n) || n < 0) {

                    alert("Enter a valid non-negative quantity.");

                    e.target.value = a.design[i];

                    return;
                }

                a.design[i] = n;

                persist();

                renderCards();

            })
        );
}

function renderSummary() {

    const c = calculate();

    $("summaryTable").innerHTML = `
        <thead>
            <tr>
                <th>Activity</th>
                <th>Side</th>
                <th>MT · Design</th>
                <th>MU · Completed</th>
                <th>MW · Outstanding</th>
                <th>MV · % Completed</th>
                <th>MX · Outstanding</th>
                <th>MY · Distance (m)</th>
            </tr>
        </thead>

        <tbody>

            ${c.rows.map(r => `
                <tr>
                    <td>${esc(r.activity)}</td>
                    <td>${esc(r.side)}</td>
                    <td class="right">${fmt(r.mt)}</td>
                    <td class="right">${fmt(r.mu)}</td>
                    <td class="right">${fmt(r.mw)}</td>
                    <td>${fmtPct(r.mv)}</td>
                    <td>${r.mx === null ? "—" : fmtPct(r.mx * 100)}</td>
                    <td class="right">${r.my === null ? "—" : fmt(r.my)}</td>
                </tr>
            `).join("")}

            <tr>
                <th colspan="2">Overall</th>
                <th>${fmt(c.mt)}</th>
                <th>${fmt(c.mu)}</th>
                <th>${fmt(c.mw)}</th>
                <th>${fmtPct(c.mv)}</th>
                <th>${fmtPct(c.mx)}</th>
                <th>—</th>
            </tr>

        </tbody>
    `;
}

function renderAll() {

    renderCards();

    renderProgress();

    renderQuantities();

    renderSummary();

}

function persist() {

    localStorage.setItem(
        "pvrEarthworksV1",
        JSON.stringify(data)
    );

    $("saveStatus").textContent =
        "Saved locally · " + new Date().toLocaleTimeString();

}

function esc(s) {

    return String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

}

function exportCSV() {

    const c = calculate();

    const out = [[
        "Excel row",
        "Activity",
        "Side",
        "Chainage",
        "Design quantity",
        "Completed",
        "Completed quantity",
        "Outstanding quantity"
    ]];

    c.rows.forEach(r =>
        r.design.forEach((q, i) =>
            out.push([
                r.excelRow,
                r.activity,
                r.side,
                chLabel(data.chainages[i]),
                q,
                r.completed[i] ? "TRUE" : "FALSE",
                r.completed[i] ? q : 0,
                r.completed[i] ? 0 : q
            ])
        )
    );

    const csv = out.map(row =>
        row.map(v =>
            '"' + String(v ?? "").replace(/"/g, '""') + '"'
        ).join(",")
    ).join("\r\n");

    download(
        new Blob(["\ufeff" + csv], {
            type: "text/csv;charset=utf-8"
        }),
        "PVR_Earthworks_Progress.csv"
    );

}

function backup() {

    download(
        new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json"
        }),
        "PVR_Earthworks_Backup.json"
    );

}

function download(blob, name) {

    let a = document.createElement("a");

    a.href = URL.createObjectURL(blob);

    a.download = name;

    a.click();

    URL.revokeObjectURL(a.href);

}

init().catch(e => {

    $("loadStatus").textContent =
        "Could not load data.json. Open this folder using a local web server or desktop wrapper.";

    console.error(e);

});
