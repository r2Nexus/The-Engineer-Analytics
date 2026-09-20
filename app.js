// ============================================================
// CONFIG
// ============================================================

const SUPABASE_URL = "https://ncinltapmqboudktjgae.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6JpE7BTrVJUvdlp6jaeZzg_xAfM2Qtr";

const db = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ============================================================
// ELEMENTS
// ============================================================

const versionFrom = document.getElementById("versionFrom");
const versionTo = document.getElementById("versionTo");
const filterRunCount = document.getElementById("filterRunCount");

const statRuns = document.getElementById("statRuns");
const statWins = document.getElementById("statWins");
const statWinRate = document.getElementById("statWinRate");
const statAvgFloor = document.getElementById("statAvgFloor");
const statAvgDeck = document.getElementById("statAvgDeck");
const statAvgRelics = document.getElementById("statAvgRelics");

const ascensionChartCanvas =
    document.getElementById("ascensionChart");
let ascensionChart = null;

const enemyTableBody = document.getElementById("enemyTableBody");
const cardTableBody = document.getElementById("cardTableBody");
const relicTableBody = document.getElementById("relicTableBody");


// ============================================================
// STATE
// ============================================================

let versions = [];


// ============================================================
// INITIALIZATION
// ============================================================

async function init() {
    try {
        await loadVersions();
        await refreshDashboard();
    }
    catch (error) {
        console.error(error);
        alert("Failed to load analytics. Check the console.");
    }
}

init();


// ============================================================
// VERSION HANDLING
// ============================================================

async function loadVersions() {

    const { data, error } = await db
        .from("analytics_overview")
        .select("mod_version,runs,latest_run");

    if (error) {
        throw error;
    }

    versions = data
        .filter(row =>
            row.mod_version &&
            row.mod_version.toUpperCase() !== "TEST"
        )
        .sort((a, b) =>
            compareVersions(a.mod_version, b.mod_version)
        );

    versionFrom.innerHTML = "";
    versionTo.innerHTML = "";

    for (const row of versions) {

        const fromOption = document.createElement("option");
        fromOption.value = row.mod_version;
        fromOption.textContent = row.mod_version;

        const toOption = document.createElement("option");
        toOption.value = row.mod_version;
        toOption.textContent = row.mod_version;

        versionFrom.appendChild(fromOption);
        versionTo.appendChild(toOption);
    }

    if (versions.length > 0) {

        // Default = all versions.
        versionFrom.value = versions[0].mod_version;
        versionTo.value = versions[versions.length - 1].mod_version;
    }

    versionFrom.addEventListener("change", refreshDashboard);
    versionTo.addEventListener("change", refreshDashboard);
}


function compareVersions(a, b) {

    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);

    const length = Math.max(
        aParts.length,
        bParts.length
    );

    for (let i = 0; i < length; i++) {

        const av = aParts[i] ?? 0;
        const bv = bParts[i] ?? 0;

        if (av !== bv) {
            return av - bv;
        }
    }

    return 0;
}


function getSelectedVersions() {

    const fromIndex = versions.findIndex(
        v => v.mod_version === versionFrom.value
    );

    const toIndex = versions.findIndex(
        v => v.mod_version === versionTo.value
    );

    if (fromIndex === -1 || toIndex === -1) {
        return [];
    }

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);

    return versions
        .slice(start, end + 1)
        .map(v => v.mod_version);
}


// ============================================================
// REFRESH EVERYTHING
// ============================================================

async function refreshDashboard() {

    const selectedVersions = getSelectedVersions();

    if (selectedVersions.length === 0) {
        return;
    }

    filterRunCount.textContent = "Loading...";

    try {

        const [
            overviewResult,
            ascensionResult,
            enemyResult,
            cardResult,
            relicResult
        ] = await Promise.all([

            db
                .from("analytics_overview")
                .select("*")
                .in("mod_version", selectedVersions),

            db
                .from("analytics_ascensions")
                .select("*")
                .in("mod_version", selectedVersions),

            db
                .from("analytics_enemies")
                .select("*")
                .in("mod_version", selectedVersions),

            db
                .from("analytics_cards")
                .select("*")
                .in("mod_version", selectedVersions),

            db
                .from("analytics_relics")
                .select("*")
                .in("mod_version", selectedVersions)
        ]);

        checkError(overviewResult);
        checkError(ascensionResult);
        checkError(enemyResult);
        checkError(cardResult);
        checkError(relicResult);

        renderOverview(overviewResult.data, selectedVersions);
        renderAscensions(ascensionResult.data);
        renderEnemies(enemyResult.data);
        renderCards(cardResult.data);
        renderRelics(relicResult.data);
    }
    catch (error) {

        console.error(error);

        filterRunCount.textContent =
            "Failed to load data";
    }
}


function checkError(result) {

    if (result.error) {
        throw result.error;
    }
}


// ============================================================
// OVERVIEW
// ============================================================

function renderOverview(rows, selectedVersions) {

    const runs = sum(rows, "runs");
    const wins = sum(rows, "wins");
    const losses = sum(rows, "losses");

    const winRate =
        runs > 0
            ? wins / runs * 100
            : 0;

    const avgFloor = weightedAverage(
        rows,
        "avg_floor",
        "runs"
    );

    const avgDeck = weightedAverage(
        rows,
        "avg_deck_size",
        "runs"
    );

    const avgRelics = weightedAverage(
        rows,
        "avg_relics",
        "runs"
    );

    statRuns.textContent = formatNumber(runs);
    statWins.textContent = formatNumber(wins);
    statWinRate.textContent = formatPercent(winRate);

    statAvgFloor.textContent =
        formatDecimal(avgFloor);

    statAvgDeck.textContent =
        formatDecimal(avgDeck);

    statAvgRelics.textContent =
        formatDecimal(avgRelics);

    const versionText =
        selectedVersions.length === 1
            ? "1 version"
            : `${selectedVersions.length} versions`;

    filterRunCount.textContent =
        `${formatNumber(runs)} runs across ${versionText}`;
}


// ============================================================
// ASCENSIONS
// ============================================================

function renderAscensions(rows) {

    const grouped = new Map();

    for (const row of rows) {

        const ascension = Number(row.ascension);

        if (!grouped.has(ascension)) {
            grouped.set(ascension, {
                ascension: ascension,
                runs: 0,
                wins: 0
            });
        }

        const item = grouped.get(ascension);

        item.runs += Number(row.runs ?? 0);
        item.wins += Number(row.wins ?? 0);
    }

    const results = [...grouped.values()]
        .sort((a, b) =>
            a.ascension - b.ascension
        );

    const labels = results.map(
        item => `A${item.ascension}`
    );

    const winRates = results.map(
        item =>
            item.runs > 0
                ? item.wins / item.runs * 100
                : 0
    );

    const runCounts = results.map(
        item => item.runs
    );


    // Destroy old chart before making a new one.
    // Necessary when changing the version range.
    if (ascensionChart) {
        ascensionChart.destroy();
    }


    ascensionChart = new Chart(
        ascensionChartCanvas,
        {
            type: "bar",

            data: {
                labels: labels,

                datasets: [
                    {
                        label: "Win Rate",
                        data: winRates,

                        backgroundColor:
                            "rgba(140, 140, 140, 0.8)",

                        borderColor:
                            "rgba(180, 180, 180, 1)",

                        borderWidth: 1,

                        borderRadius: 4
                    }
                ]
            },

            options: {

                responsive: true,
                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {

                        callbacks: {

                            label: function(context) {

                                const index =
                                    context.dataIndex;

                                return [
                                    `Win Rate: ${context.raw.toFixed(1)}%`,
                                    `Runs: ${runCounts[index]}`
                                ];
                            }
                        }
                    }
                },

                scales: {

                    x: {

                        grid: {
                            display: false
                        },

                        ticks: {
                            color: "#aaa"
                        }
                    },

                    y: {

                        beginAtZero: true,
                        max: 100,

                        ticks: {
                            color: "#aaa",

                            callback: function(value) {
                                return value + "%";
                            }
                        },

                        grid: {
                            color: "#333"
                        },

                        title: {
                            display: true,
                            text: "Win Rate",
                            color: "#aaa"
                        }
                    }
                }
            }
        }
    );
}


// ============================================================
// ENEMIES
// ============================================================

function renderEnemies(rows) {

    const grouped = new Map();

    for (const row of rows) {

        const id = row.encounter;

        if (!grouped.has(id)) {

            grouped.set(id, {
                encounter: id,
                fights: 0,
                deaths: 0,
                survived: 0,

                totalTurns: 0,
                totalDamage: 0
            });
        }

        const item = grouped.get(id);

        const fights =
            Number(row.fights ?? 0);

        item.fights += fights;
        item.deaths += Number(row.deaths ?? 0);
        item.survived += Number(row.survived ?? 0);

        item.totalTurns +=
            Number(row.avg_turns ?? 0)
            * fights;

        item.totalDamage +=
            Number(row.avg_damage ?? 0)
            * fights;
    }

    const results = [...grouped.values()]
        .sort((a, b) =>
            b.fights - a.fights
        );

    enemyTableBody.innerHTML = "";

    for (const item of results) {

        const survivalRate =
            item.fights > 0
                ? item.survived / item.fights * 100
                : 0;

        const avgTurns =
            item.fights > 0
                ? item.totalTurns / item.fights
                : 0;

        const avgDamage =
            item.fights > 0
                ? item.totalDamage / item.fights
                : 0;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${cleanName(item.encounter)}</td>
            <td>${formatNumber(item.fights)}</td>
            <td>${formatNumber(item.deaths)}</td>
            <td>${formatPercent(survivalRate)}</td>
            <td>${formatDecimal(avgTurns)}</td>
            <td>${formatDecimal(avgDamage)}</td>
        `;

        enemyTableBody.appendChild(row);
    }
}


// ============================================================
// CARDS
// ============================================================

function renderCards(rows) {

    const grouped = new Map();

    for (const row of rows) {

        const id = row.card_id;

        if (!grouped.has(id)) {

            grouped.set(id, {
                cardId: id,

                offers: 0,
                picks: 0,

                runs: 0,
                copies: 0,

                weightedWins: 0
            });
        }

        const item = grouped.get(id);

        const runs =
            Number(row.runs_with_card ?? 0);

        item.offers +=
            Number(row.offers ?? 0);

        item.picks +=
            Number(row.picks ?? 0);

        item.runs += runs;

        item.copies +=
            Number(row.total_copies ?? 0);

        // analytics_cards currently stores the
        // per-version win rate rather than raw wins.
        //
        // This gives us a weighted cross-version rate.
        item.weightedWins +=
            runs
            * Number(row.win_rate ?? 0)
            / 100;
    }

    const results = [...grouped.values()]
        .sort((a, b) =>
            b.offers - a.offers
        );

    cardTableBody.innerHTML = "";

    for (const item of results) {

        const pickRate =
            item.offers > 0
                ? item.picks / item.offers * 100
                : null;

        const avgCopies =
            item.runs > 0
                ? item.copies / item.runs
                : null;

        const winRate =
            item.runs > 0
                ? item.weightedWins / item.runs * 100
                : null;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${cleanName(item.cardId)}</td>

            <td>${formatNumber(item.offers)}</td>

            <td>${formatNumber(item.picks)}</td>

            <td>
                ${pickRate === null
            ? "-"
            : formatPercent(pickRate)}
            </td>

            <td>${formatNumber(item.runs)}</td>

            <td>
                ${avgCopies === null
            ? "-"
            : avgCopies.toFixed(2)}
            </td>

            <td>
                ${winRate === null
            ? "-"
            : formatPercent(winRate)}
            </td>
        `;

        cardTableBody.appendChild(row);
    }
}


// ============================================================
// RELICS
// ============================================================

function renderRelics(rows) {

    const grouped = new Map();

    for (const row of rows) {

        const id = row.relic_id;

        if (!grouped.has(id)) {

            grouped.set(id, {
                relicId: id,
                runs: 0,
                weightedWins: 0
            });
        }

        const item = grouped.get(id);

        const runs =
            Number(row.runs_with_relic ?? 0);

        item.runs += runs;

        item.weightedWins +=
            runs
            * Number(row.win_rate ?? 0)
            / 100;
    }

    const results = [...grouped.values()]
        .sort((a, b) =>
            b.runs - a.runs
        );

    relicTableBody.innerHTML = "";

    for (const item of results) {

        const winRate =
            item.runs > 0
                ? item.weightedWins / item.runs * 100
                : 0;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${cleanName(item.relicId)}</td>
            <td>${formatNumber(item.runs)}</td>
            <td>${formatPercent(winRate)}</td>
        `;

        relicTableBody.appendChild(row);
    }
}


// ============================================================
// HELPERS
// ============================================================

function sum(rows, field) {

    return rows.reduce(
        (total, row) =>
            total + Number(row[field] ?? 0),
        0
    );
}


function weightedAverage(
    rows,
    valueField,
    weightField
) {

    let total = 0;
    let weight = 0;

    for (const row of rows) {

        const value =
            Number(row[valueField]);

        const rowWeight =
            Number(row[weightField] ?? 0);

        if (
            !Number.isFinite(value) ||
            rowWeight <= 0
        ) {
            continue;
        }

        total += value * rowWeight;
        weight += rowWeight;
    }

    if (weight === 0) {
        return null;
    }

    return total / weight;
}


function formatNumber(value) {

    return Number(value ?? 0)
        .toLocaleString();
}


function formatPercent(value) {

    return `${Number(value ?? 0).toFixed(1)}%`;
}


function formatDecimal(value) {

    if (
        value === null ||
        value === undefined ||
        !Number.isFinite(value)
    ) {
        return "-";
    }

    return value.toFixed(1);
}


function cleanName(value) {

    if (!value) {
        return "-";
    }

    return value
        .replace(/^THEENGINEER-/, "")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, letter =>
            letter.toUpperCase()
        );
}

// ============================================================
// SORTABLE TABLES
// ============================================================

function enableTableSorting() {

    document
        .querySelectorAll("table.sortable th[data-sort]")
        .forEach(header => {

            header.addEventListener("click", () => {

                const table = header.closest("table");
                const tbody = table.querySelector("tbody");

                const headers = [
                    ...table.querySelectorAll("th")
                ];

                const columnIndex =
                    headers.indexOf(header);

                const type =
                    header.dataset.sort;

                const currentDirection =
                    header.dataset.direction;

                const direction =
                    currentDirection === "asc"
                        ? "desc"
                        : "asc";


                // Reset the other headers.
                headers.forEach(otherHeader => {

                    if (otherHeader !== header) {
                        delete otherHeader.dataset.direction;
                    }
                });

                header.dataset.direction = direction;


                const rows = [
                    ...tbody.querySelectorAll("tr")
                ];


                rows.sort((a, b) => {

                    const aText =
                        a.children[columnIndex]
                            ?.textContent
                            ?.trim() ?? "";

                    const bText =
                        b.children[columnIndex]
                            ?.textContent
                            ?.trim() ?? "";


                    if (type === "number") {

                        const aValue =
                            parseSortableNumber(aText);

                        const bValue =
                            parseSortableNumber(bText);

                        const aMissing =
                            Number.isNaN(aValue);

                        const bMissing =
                            Number.isNaN(bValue);


                        // Missing values always go at the end,
                        // regardless of ascending / descending sort.
                        if (aMissing && bMissing) {
                            return 0;
                        }

                        if (aMissing) {
                            return 1;
                        }

                        if (bMissing) {
                            return -1;
                        }


                        const comparison =
                            aValue - bValue;

                        return direction === "asc"
                            ? comparison
                            : -comparison;
                    }


                    const comparison =
                        aText.localeCompare(
                            bText,
                            undefined,
                            {
                                numeric: true,
                                sensitivity: "base"
                            }
                        );

                    return direction === "asc"
                        ? comparison
                        : -comparison;
                });


                tbody.replaceChildren(...rows);
            });
        });
}


function parseSortableNumber(text) {

    if (!text || text === "-") {
        return NaN;
    }

    const cleaned = text
        .replaceAll(",", "")
        .replace("%", "")
        .trim();

    return Number.parseFloat(cleaned);
}


enableTableSorting();

// ============================================================
// TABLE SEARCH
// ============================================================

function enableTableSearch() {

    document
        .querySelectorAll(".table-search")
        .forEach(input => {

            input.addEventListener("input", () => {

                const tableId =
                    input.dataset.table;

                const table =
                    document.getElementById(tableId);

                if (!table) {
                    return;
                }

                const query =
                    input.value
                        .trim()
                        .toLowerCase();

                const rows =
                    table.querySelectorAll("tbody tr");

                rows.forEach(row => {

                    const text =
                        row.textContent
                            .toLowerCase();

                    const matches =
                        text.includes(query);

                    row.style.display =
                        matches
                            ? ""
                            : "none";
                });
            });
        });
}

enableTableSearch();