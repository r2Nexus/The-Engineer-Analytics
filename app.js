// ============================================================
// CONFIG
// ============================================================

const SUPABASE_URL =
    "https://ncinltapmqboudktjgae.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_6JpE7BTrVJUvdlp6jaeZzg_xAfM2Qtr";

const DEFAULT_FROM_VERSION =
    "1.0.0";

const ROLLING_WINDOW =
    20;

const db =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );


// ============================================================
// PAGE
// ============================================================

const page =
    document.body.dataset.page;


// ============================================================
// COMMON ELEMENTS
// ============================================================

const versionFrom =
    document.getElementById(
        "versionFrom"
    );

const versionTo =
    document.getElementById(
        "versionTo"
    );

const filterRunCount =
    document.getElementById(
        "filterRunCount"
    );

const includeForeignMods =
    document.getElementById(
        "includeForeignMods"
    );

const reloadButton =
    document.getElementById(
        "reloadButton"
    );


// ============================================================
// STATE
// ============================================================

let versions = [];

let ascensionChart = null;
let winRateTimelineChart = null;

let recentRuns = [];
let visibleRunCount = 5;

let cardData = [];
let cardMatchups = [];


// ============================================================
// INIT
// ============================================================

async function init() {

    try {

        await loadVersions();

        bindCommonEvents();

        if (page === "overview") {
            bindOverviewEvents();
        }

        if (page === "cards") {
            bindCardEvents();
        }

        if (page === "enemies") {
            enableTableSorting();
            enableTableSearch();
        }

        await refreshCurrentPage();
    }
    catch (error) {

        console.error(error);

        alert(
            "Failed to load analytics. Check the console."
        );
    }
}

init();


// ============================================================
// EVENTS
// ============================================================

function bindCommonEvents() {

    versionFrom.addEventListener(
        "change",
        refreshCurrentPage
    );

    versionTo.addEventListener(
        "change",
        refreshCurrentPage
    );

    includeForeignMods
        ?.addEventListener(
            "change",
            refreshCurrentPage
        );

    reloadButton
        ?.addEventListener(
            "click",
            reloadAll
        );
}


function bindOverviewEvents() {

    enableTableSorting();
    enableTableSearch();

    document
        .getElementById(
            "showMoreRuns"
        )
        ?.addEventListener(
            "click",
            () => {

                visibleRunCount += 10;

                renderRecentRuns();
            }
        );
}


function bindCardEvents() {

    document
        .getElementById(
            "cardSearch"
        )
        ?.addEventListener(
            "input",
            renderCards
        );


    document
        .getElementById(
            "cardSortBy"
        )
        ?.addEventListener(
            "change",
            renderCards
        );


    document
        .getElementById(
            "cardSortDirection"
        )
        ?.addEventListener(
            "change",
            renderCards
        );


    document
        .getElementById(
            "engineerCardsOnly"
        )
        ?.addEventListener(
            "change",
            renderCards
        );
}


// ============================================================
// RELOAD
// ============================================================

async function reloadAll() {

    if (!reloadButton) {
        return;
    }

    const oldFrom =
        versionFrom.value;

    const oldTo =
        versionTo.value;


    reloadButton.disabled =
        true;

    reloadButton.textContent =
        "↻ Loading...";


    try {

        await loadVersions(
            oldFrom,
            oldTo
        );

        await refreshCurrentPage();
    }
    finally {

        reloadButton.disabled =
            false;

        reloadButton.textContent =
            "↻ Reload";
    }
}


// ============================================================
// VERSION HANDLING
// ============================================================

async function loadVersions(
    preserveFrom = null,
    preserveTo = null
) {

    const {
        data,
        error
    } = await db
        .from(
            "analytics_overview"
        )
        .select(
            "mod_version,latest_run"
        );


    if (error) {
        throw error;
    }


    const versionMap =
        new Map();


    for (const row of data) {

        const version =
            row.mod_version;


        if (
            !version ||
            version
                .toUpperCase() ===
            "TEST"
        ) {
            continue;
        }


        if (
            !versionMap.has(
                version
            )
        ) {

            versionMap.set(
                version,
                {
                    mod_version:
                    version,

                    latest_run:
                    row.latest_run
                }
            );

            continue;
        }


        const current =
            versionMap.get(
                version
            );


        if (
            new Date(
                row.latest_run
            ) >
            new Date(
                current.latest_run
            )
        ) {

            current.latest_run =
                row.latest_run;
        }
    }


    versions =
        [...versionMap.values()]
            .sort(
                (a, b) =>
                    compareVersions(
                        a.mod_version,
                        b.mod_version
                    )
            );


    versionFrom.innerHTML =
        "";

    versionTo.innerHTML =
        "";


    for (
        const row of versions
        ) {

        const fromOption =
            document.createElement(
                "option"
            );

        fromOption.value =
            row.mod_version;

        fromOption.textContent =
            row.mod_version;


        const toOption =
            document.createElement(
                "option"
            );

        toOption.value =
            row.mod_version;

        toOption.textContent =
            row.mod_version;


        versionFrom.appendChild(
            fromOption
        );

        versionTo.appendChild(
            toOption
        );
    }


    if (
        versions.length === 0
    ) {
        return;
    }


    const availableVersions =
        new Set(
            versions.map(
                value =>
                    value.mod_version
            )
        );


    if (
        preserveFrom &&
        availableVersions.has(
            preserveFrom
        )
    ) {

        versionFrom.value =
            preserveFrom;
    }
    else if (
        availableVersions.has(
            DEFAULT_FROM_VERSION
        )
    ) {

        versionFrom.value =
            DEFAULT_FROM_VERSION;
    }
    else {

        versionFrom.value =
            versions[0]
                .mod_version;
    }


    if (
        preserveTo &&
        availableVersions.has(
            preserveTo
        )
    ) {

        versionTo.value =
            preserveTo;
    }
    else {

        versionTo.value =
            versions[
            versions.length - 1
                ].mod_version;
    }
}


function compareVersions(
    a,
    b
) {

    const aParts =
        a
            .split(".")
            .map(Number);

    const bParts =
        b
            .split(".")
            .map(Number);


    const length =
        Math.max(
            aParts.length,
            bParts.length
        );


    for (
        let i = 0;
        i < length;
        i++
    ) {

        const av =
            aParts[i] ?? 0;

        const bv =
            bParts[i] ?? 0;


        if (av !== bv) {
            return av - bv;
        }
    }


    return 0;
}


function getSelectedVersions() {

    const fromIndex =
        versions.findIndex(
            value =>
                value.mod_version ===
                versionFrom.value
        );

    const toIndex =
        versions.findIndex(
            value =>
                value.mod_version ===
                versionTo.value
        );


    if (
        fromIndex === -1 ||
        toIndex === -1
    ) {
        return [];
    }


    const start =
        Math.min(
            fromIndex,
            toIndex
        );

    const end =
        Math.max(
            fromIndex,
            toIndex
        );


    return versions
        .slice(
            start,
            end + 1
        )
        .map(
            value =>
                value.mod_version
        );
}


// ============================================================
// QUERIES
// ============================================================

const ANALYTICS_PAGE_SIZE = 1000;


// Stable ordering is important when using range pagination.
const ANALYTICS_ORDER_COLUMNS = {

    analytics_overview: [
        "mod_version",
        "has_foreign_content"
    ],

    analytics_ascensions: [
        "mod_version",
        "has_foreign_content",
        "ascension"
    ],

    analytics_enemies: [
        "mod_version",
        "has_foreign_content",
        "encounter"
    ],

    analytics_cards: [
        "mod_version",
        "has_foreign_content",
        "card_id"
    ],

    analytics_relics: [
        "mod_version",
        "has_foreign_content",
        "relic_id"
    ],

    analytics_card_matchups: [
        "mod_version",
        "has_foreign_content",
        "picked_card_id",
        "skipped_card_id"
    ]
};


async function analyticsQuery(
    viewName,
    selectedVersions
) {

    const allRows = [];

    let from = 0;


    while (true) {

        let query = db
            .from(viewName)
            .select("*")
            .in(
                "mod_version",
                selectedVersions
            );


        if (
            !includeForeignMods
                ?.checked
        ) {

            query = query.eq(
                "has_foreign_content",
                false
            );
        }


        const orderColumns =
            ANALYTICS_ORDER_COLUMNS[
                viewName
                ] ?? [];


        for (
            const column
            of orderColumns
            ) {

            query = query.order(
                column,
                {
                    ascending: true
                }
            );
        }


        query = query.range(
            from,
            from
            + ANALYTICS_PAGE_SIZE
            - 1
        );


        const {
            data,
            error
        } = await query;


        if (error) {

            return {
                data: null,
                error
            };
        }


        allRows.push(
            ...(data ?? [])
        );


        if (
            !data ||
            data.length <
            ANALYTICS_PAGE_SIZE
        ) {
            break;
        }


        from +=
            ANALYTICS_PAGE_SIZE;
    }


    return {
        data: allRows,
        error: null
    };
}


async function publicRunsQuery(
    selectedVersions
) {

    const pageSize = 1000;

    const allRows = [];

    let from = 0;


    while (true) {

        let query = db
            .from(
                "analytics_runs_public"
            )
            .select("*")
            .in(
                "mod_version",
                selectedVersions
            )
            .order(
                "received_at",
                {
                    ascending: false
                }
            )
            .order(
                "id",
                {
                    ascending: true
                }
            )
            .range(
                from,
                from
                + pageSize
                - 1
            );


        if (
            !includeForeignMods
                ?.checked
        ) {

            query = query.eq(
                "has_foreign_content",
                false
            );
        }


        const {
            data,
            error
        } = await query;


        if (error) {

            return {
                data: null,
                error
            };
        }


        allRows.push(
            ...(data ?? [])
        );


        if (
            !data ||
            data.length <
            pageSize
        ) {
            break;
        }


        from += pageSize;
    }


    return {
        data: allRows,
        error: null
    };
}


// ============================================================
// PAGE REFRESH
// ============================================================

async function refreshCurrentPage() {

    const selectedVersions =
        getSelectedVersions();


    if (
        selectedVersions.length === 0
    ) {
        return;
    }


    filterRunCount.textContent =
        "Loading...";


    if (page === "overview") {

        await refreshOverview(
            selectedVersions
        );
    }

    if (page === "cards") {

        await refreshCardPage(
            selectedVersions
        );
    }

    if (page === "enemies") {

        await refreshEnemyPage(
            selectedVersions
        );
    }
}


// ============================================================
// OVERVIEW PAGE
// ============================================================

async function refreshOverview(
    selectedVersions
) {

    visibleRunCount = 5;


    const [
        overviewResult,
        ascensionResult,
        relicResult,
        runsResult
    ] = await Promise.all([

        analyticsQuery(
            "analytics_overview",
            selectedVersions
        ),

        analyticsQuery(
            "analytics_ascensions",
            selectedVersions
        ),

        analyticsQuery(
            "analytics_relics",
            selectedVersions
        ),

        publicRunsQuery(
            selectedVersions
        )
    ]);


    checkError(
        overviewResult
    );

    checkError(
        ascensionResult
    );

    checkError(
        relicResult
    );

    checkError(
        runsResult
    );


    renderOverview(
        overviewResult.data,
        selectedVersions
    );

    renderAscensions(
        ascensionResult.data
    );

    renderRelics(
        relicResult.data
    );


    recentRuns =
        runsResult.data ?? [];


    renderWinRateTimeline(
        recentRuns
    );

    renderRecentRuns();

    applyAllTableSearches();
}


// ============================================================
// CARD PAGE
// ============================================================

async function refreshCardPage(
    selectedVersions
) {

    const [
        overviewResult,
        cardsResult,
        matchupsResult
    ] = await Promise.all([

        analyticsQuery(
            "analytics_overview",
            selectedVersions
        ),

        analyticsQuery(
            "analytics_cards",
            selectedVersions
        ),

        analyticsQuery(
            "analytics_card_matchups",
            selectedVersions
        )
    ]);


    checkError(
        overviewResult
    );

    checkError(
        cardsResult
    );

    checkError(
        matchupsResult
    );


    renderFilterSummary(
        overviewResult.data,
        selectedVersions
    );


    cardData =
        aggregateCards(
            cardsResult.data
        );


    cardMatchups =
        aggregateCardMatchups(
            matchupsResult.data
        );


    renderCards();
}


// ============================================================
// ENEMY PAGE
// ============================================================

async function refreshEnemyPage(
    selectedVersions
) {

    const [
        overviewResult,
        enemyResult
    ] = await Promise.all([

        analyticsQuery(
            "analytics_overview",
            selectedVersions
        ),

        analyticsQuery(
            "analytics_enemies",
            selectedVersions
        )
    ]);


    checkError(
        overviewResult
    );

    checkError(
        enemyResult
    );


    renderFilterSummary(
        overviewResult.data,
        selectedVersions
    );


    renderEnemies(
        enemyResult.data
    );

    applyAllTableSearches();
}


// ============================================================
// FILTER SUMMARY
// ============================================================

function renderFilterSummary(
    rows,
    selectedVersions
) {

    const runs =
        sum(
            rows,
            "runs"
        );


    const versionText =
        selectedVersions.length === 1
            ? "1 version"
            : `${selectedVersions.length} versions`;


    const modText =
        includeForeignMods?.checked
            ? " · other mods included"
            : "";


    filterRunCount.textContent =
        `${formatNumber(runs)} runs across ${versionText}${modText}`;
}


// ============================================================
// OVERVIEW STATS
// ============================================================

function renderOverview(
    rows,
    selectedVersions
) {

    const runs =
        sum(
            rows,
            "runs"
        );

    const wins =
        sum(
            rows,
            "wins"
        );


    const winRate =
        runs > 0
            ? wins / runs * 100
            : 0;


    const avgFloor =
        weightedAverage(
            rows,
            "avg_floor",
            "runs"
        );

    const avgDeck =
        weightedAverage(
            rows,
            "avg_deck_size",
            "runs"
        );

    const avgRelics =
        weightedAverage(
            rows,
            "avg_relics",
            "runs"
        );


    document
        .getElementById(
            "statRuns"
        )
        .textContent =
        formatNumber(
            runs
        );


    document
        .getElementById(
            "statWins"
        )
        .textContent =
        formatNumber(
            wins
        );


    document
        .getElementById(
            "statWinRate"
        )
        .textContent =
        formatPercent(
            winRate
        );


    document
        .getElementById(
            "statAvgFloor"
        )
        .textContent =
        formatDecimal(
            avgFloor
        );


    document
        .getElementById(
            "statAvgDeck"
        )
        .textContent =
        formatDecimal(
            avgDeck
        );


    document
        .getElementById(
            "statAvgRelics"
        )
        .textContent =
        formatDecimal(
            avgRelics
        );


    renderFilterSummary(
        rows,
        selectedVersions
    );
}


// ============================================================
// ASCENSION GRAPH
// ============================================================

function renderAscensions(
    rows
) {

    const grouped =
        new Map();


    for (const row of rows) {

        const ascension =
            Number(
                row.ascension
            );


        if (
            !grouped.has(
                ascension
            )
        ) {

            grouped.set(
                ascension,
                {
                    ascension,
                    runs: 0,
                    wins: 0
                }
            );
        }


        const item =
            grouped.get(
                ascension
            );


        item.runs +=
            Number(
                row.runs ?? 0
            );

        item.wins +=
            Number(
                row.wins ?? 0
            );
    }


    const results =
        [...grouped.values()]
            .sort(
                (a, b) =>
                    a.ascension -
                    b.ascension
            );


    const labels =
        results.map(
            value =>
                `A${value.ascension}`
        );


    const winRates =
        results.map(
            value =>
                value.runs > 0
                    ? value.wins /
                    value.runs *
                    100
                    : 0
        );


    const runCounts =
        results.map(
            value =>
                value.runs
        );


    if (ascensionChart) {
        ascensionChart.destroy();
    }


    const canvas =
        document.getElementById(
            "ascensionChart"
        );


    ascensionChart =
        new Chart(
            canvas,
            {
                type: "bar",

                data: {
                    labels,

                    datasets: [
                        {
                            data:
                            winRates,

                            backgroundColor:
                                cssVariable(
                                    "--accent"
                                ),

                            borderRadius:
                                4
                        }
                    ]
                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display:
                                false
                        },

                        tooltip: {

                            callbacks: {

                                label(
                                    context
                                ) {

                                    const index =
                                        context
                                            .dataIndex;

                                    return [
                                        `Win Rate: ${context.raw.toFixed(1)}%`,
                                        `Runs: ${formatNumber(runCounts[index])}`
                                    ];
                                }
                            }
                        }
                    },

                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            max:
                                100,

                            ticks: {

                                color:
                                    cssVariable(
                                        "--text-muted"
                                    ),

                                callback(
                                    value
                                ) {

                                    return (
                                        value +
                                        "%"
                                    );
                                }
                            },

                            grid: {

                                color:
                                    cssVariable(
                                        "--border"
                                    )
                            }
                        },

                        x: {

                            ticks: {

                                color:
                                    cssVariable(
                                        "--text-muted"
                                    )
                            },

                            grid: {
                                display:
                                    false
                            }
                        }
                    }
                }
            }
        );
}


// ============================================================
// WIN RATE OVER TIME
// ============================================================

function renderWinRateTimeline(
    rows
) {

    const canvas =
        document.getElementById(
            "winRateTimelineChart"
        );


    if (!canvas) {
        return;
    }


    const ordered =
        [...rows]
            .sort(
                (a, b) =>
                    new Date(
                        a.received_at
                    ) -
                    new Date(
                        b.received_at
                    )
            );


    const labels = [];
    const values = [];


    for (
        let i = 0;
        i < ordered.length;
        i++
    ) {

        const start =
            Math.max(
                0,
                i -
                ROLLING_WINDOW +
                1
            );


        const windowRuns =
            ordered.slice(
                start,
                i + 1
            );


        const wins =
            windowRuns.filter(
                run =>
                    run.win
            ).length;


        labels.push(
            ordered[i]
                .received_at
        );


        values.push(
            windowRuns.length > 0
                ? wins /
                windowRuns.length *
                100
                : 0
        );
    }


    const annotations =
        buildPatchAnnotations(
            ordered
        );


    if (
        winRateTimelineChart
    ) {

        winRateTimelineChart
            .destroy();
    }


    winRateTimelineChart =
        new Chart(
            canvas,
            {
                type:
                    "line",

                data: {

                    labels,

                    datasets: [
                        {
                            label:
                                `${ROLLING_WINDOW}-run rolling win rate`,

                            data:
                            values,

                            borderColor:
                                cssVariable(
                                    "--accent"
                                ),

                            backgroundColor:
                                cssVariable(
                                    "--accent"
                                ),

                            borderWidth:
                                2,

                            pointRadius:
                                1,

                            pointHoverRadius:
                                4,

                            tension:
                                0.25
                        }
                    ]
                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    interaction: {
                        intersect:
                            false,

                        mode:
                            "index"
                    },

                    plugins: {

                        legend: {
                            display:
                                false
                        },

                        annotation: {
                            annotations
                        },

                        tooltip: {

                            callbacks: {

                                title(
                                    items
                                ) {

                                    if (
                                        !items.length
                                    ) {
                                        return "";
                                    }


                                    return formatDateTime(
                                        labels[
                                            items[0]
                                                .dataIndex
                                            ]
                                    );
                                },

                                label(
                                    context
                                ) {

                                    return (
                                        `Rolling Win Rate: ` +
                                        `${context.raw.toFixed(1)}%`
                                    );
                                }
                            }
                        }
                    },

                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            max:
                                100,

                            ticks: {

                                color:
                                    cssVariable(
                                        "--text-muted"
                                    ),

                                callback(
                                    value
                                ) {

                                    return (
                                        value +
                                        "%"
                                    );
                                }
                            },

                            grid: {

                                color:
                                    cssVariable(
                                        "--border"
                                    )
                            }
                        },

                        x: {

                            ticks: {

                                color:
                                    cssVariable(
                                        "--text-muted"
                                    ),

                                maxTicksLimit:
                                    10,

                                callback(
                                    value
                                ) {

                                    const iso =
                                        this
                                            .getLabelForValue(
                                                value
                                            );

                                    return formatShortDate(
                                        iso
                                    );
                                }
                            },

                            grid: {
                                display:
                                    false
                            }
                        }
                    }
                }
            }
        );
}


// ============================================================
// PATCH MARKERS
// ============================================================

function buildPatchAnnotations(
    rows
) {

    const firstRunByVersion =
        new Map();


    for (const row of rows) {

        if (
            !firstRunByVersion.has(
                row.mod_version
            )
        ) {

            firstRunByVersion.set(
                row.mod_version,
                row
            );
        }
    }


    const orderedVersions =
        [...firstRunByVersion.keys()]
            .sort(
                compareVersions
            );


    const annotations =
        {};


    for (
        let i = 1;
        i <
        orderedVersions.length;
        i++
    ) {

        const previous =
            orderedVersions[
            i - 1
                ];

        const current =
            orderedVersions[i];


        if (
            !isMajorPatch(
                previous,
                current
            )
        ) {
            continue;
        }


        const run =
            firstRunByVersion.get(
                current
            );


        annotations[
            `patch-${current}`
            ] = {

            type:
                "line",

            xMin:
            run.received_at,

            xMax:
            run.received_at,

            borderColor:
                cssVariable(
                    "--text-subtle"
                ),

            borderWidth:
                1,

            borderDash:
                [6, 5],

            label: {

                display:
                    true,

                content:
                    `v${current}`,

                position:
                    "start",

                color:
                    cssVariable(
                        "--text-muted"
                    ),

                backgroundColor:
                    cssVariable(
                        "--panel-alt"
                    ),

                padding:
                    4
            }
        };
    }


    return annotations;
}


function isMajorPatch(
    previous,
    current
) {

    const a =
        previous
            .split(".")
            .map(Number);

    const b =
        current
            .split(".")
            .map(Number);


    return (
        a[0] !== b[0] ||
        a[1] !== b[1]
    );
}


// ============================================================
// RECENT RUNS
// ============================================================

function renderRecentRuns() {

    const container =
        document.getElementById(
            "recentRuns"
        );

    const button =
        document.getElementById(
            "showMoreRuns"
        );


    if (!container) {
        return;
    }


    const visible =
        recentRuns.slice(
            0,
            visibleRunCount
        );


    container.innerHTML =
        "";


    for (
        const run of visible
        ) {

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "run-row";


        const resultClass =
            run.win
                ? "win"
                : "loss";


        const resultText =
            run.win
                ? "WIN"
                : "LOSS";


        const ascension =
            run.ascension === null
                ? "-"
                : `A${run.ascension}`;


        const killedBy =
            run.win
                ? "Completed run"
                : (
                    run.killed_by
                        ? `Killed by ${cleanName(run.killed_by)}`
                        : "Run ended"
                );


        row.innerHTML = `

            <div>
                <span class="run-result ${resultClass}">
                    ${resultText}
                </span>
            </div>

            <div class="run-primary">
                ${ascension}
                · Floor ${run.floor_reached ?? "-"}
            </div>

            <div class="run-secondary">
                ${run.deck_size} cards
                · ${run.relic_count} relics
            </div>

            <div class="run-secondary">
                v${run.mod_version}
            </div>

            <div class="run-time">
                ${killedBy}
                · ${formatRelativeTime(run.received_at)}
            </div>
        `;


        container.appendChild(
            row
        );
    }


    if (button) {

        button.style.display =
            visibleRunCount <
            recentRuns.length
                ? ""
                : "none";
    }
}


// ============================================================
// RELICS
// ============================================================

function renderRelics(
    rows
) {

    const body =
        document.getElementById(
            "relicTableBody"
        );


    if (!body) {
        return;
    }


    const grouped =
        new Map();


    for (const row of rows) {

        const id =
            row.relic_id;


        if (
            !grouped.has(id)
        ) {

            grouped.set(
                id,
                {
                    relicId:
                    id,

                    runs:
                        0,

                    wins:
                        0
                }
            );
        }


        const item =
            grouped.get(id);


        item.runs +=
            Number(
                row.runs_with_relic ??
                0
            );


        item.wins +=
            Number(
                row.wins_with_relic ??
                0
            );
    }


    const results =
        [...grouped.values()]
            .sort(
                (a, b) =>
                    b.runs -
                    a.runs
            );


    body.innerHTML =
        "";


    for (
        const item of results
        ) {

        const winRate =
            item.runs > 0
                ? item.wins /
                item.runs *
                100
                : 0;


        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML = `
            <td>${cleanName(item.relicId)}</td>
            <td>${formatNumber(item.runs)}</td>
            <td>${formatPercent(winRate)}</td>
        `;


        body.appendChild(
            row
        );
    }
}


// ============================================================
// CARDS
// ============================================================

function aggregateCards(
    rows
) {

    const grouped =
        new Map();


    for (const row of rows) {

        const id =
            row.card_id;


        if (!grouped.has(id)) {

            grouped.set(
                id,
                {
                    id,
                    name:
                        cleanName(id),

                    offers:
                        0,

                    picks:
                        0,

                    runs:
                        0,

                    copies:
                        0,

                    wins:
                        0,

                    runsUpgraded:
                        0,

                    campfireUpgrades:
                        0
                }
            );
        }


        const item =
            grouped.get(id);


        item.offers +=
            Number(
                row.offers ?? 0
            );

        item.picks +=
            Number(
                row.picks ?? 0
            );

        item.runs +=
            Number(
                row.runs_with_card ??
                0
            );

        item.copies +=
            Number(
                row.total_copies ??
                0
            );

        item.wins +=
            Number(
                row.wins_with_card ??
                0
            );

        item.runsUpgraded +=
            Number(
                row.runs_upgraded ??
                0
            );

        item.campfireUpgrades +=
            Number(
                row.campfire_upgrades ??
                0
            );
    }


    return [...grouped.values()]
        .map(
            item => ({

                ...item,

                pickRate:
                    item.offers > 0
                        ? item.picks /
                        item.offers *
                        100
                        : null,

                avgCopies:
                    item.runs > 0
                        ? item.copies /
                        item.runs
                        : null,

                winRate:
                    item.runs > 0
                        ? item.wins /
                        item.runs *
                        100
                        : null,

                upgradeRate:
                    item.runs > 0
                        ? item.runsUpgraded /
                        item.runs *
                        100
                        : null
            })
        );
}

function aggregateCardMatchups(
    rows
) {

    const grouped =
        new Map();


    for (const row of rows) {

        const pickedId =
            row.picked_card_id;

        const skippedId =
            row.skipped_card_id;


        if (!grouped.has(pickedId)) {

            grouped.set(
                pickedId,
                new Map()
            );
        }


        const matchupMap =
            grouped.get(
                pickedId
            );


        matchupMap.set(
            skippedId,
            (
                matchupMap.get(
                    skippedId
                ) ?? 0
            )
            +
            Number(
                row.times_picked_over ??
                0
            )
        );
    }


    return grouped;
}

function getTopPickedOver(
    cardId
) {

    const matchupMap =
        cardMatchups.get(
            cardId
        );


    if (!matchupMap) {
        return [];
    }


    const cardById =
        new Map(
            cardData.map(
                card => [
                    card.id,
                    card
                ]
            )
        );


    return [...matchupMap.entries()]
        .map(
            ([otherId, count]) => {

                const otherCard =
                    cardById.get(
                        otherId
                    );


                return {
                    id:
                    otherId,

                    name:
                        cleanName(
                            otherId
                        ),

                    count,

                    pickRate:
                        otherCard
                            ?.pickRate ??
                        null
                };
            }
        )
        .sort(
            (a, b) => {

                if (
                    b.count !==
                    a.count
                ) {

                    return (
                        b.count -
                        a.count
                    );
                }


                const aPick =
                    a.pickRate ??
                    -1;

                const bPick =
                    b.pickRate ??
                    -1;


                return (
                    bPick -
                    aPick
                );
            }
        )
        .slice(
            0,
            5
        );
}

function renderCards() {

    const grid =
        document.getElementById(
            "cardGrid"
        );


    if (!grid) {
        return;
    }


    const search =
        document
            .getElementById(
                "cardSearch"
            )
            .value
            .trim()
            .toLowerCase();


    const sortBy =
        document
            .getElementById(
                "cardSortBy"
            )
            .value;


    const direction =
        document
            .getElementById(
                "cardSortDirection"
            )
            .value;


    const engineerOnly =
        document
            .getElementById(
                "engineerCardsOnly"
            )
            ?.checked ??
        false;


    let filtered =
        cardData.filter(
            card => {

                if (
                    engineerOnly &&
                    !card.id.startsWith(
                        "THEENGINEER-"
                    )
                ) {
                    return false;
                }


                return card.name
                    .toLowerCase()
                    .includes(
                        search
                    );
            }
        );


    filtered =
        [...filtered].sort(
            (a, b) =>
                compareCardValues(
                    a,
                    b,
                    sortBy,
                    direction
                )
        );


    grid.innerHTML =
        "";


    for (
        const card of filtered
        ) {

        const topPickedOver =
            getTopPickedOver(
                card.id
            );


        const tile =
            document.createElement(
                "article"
            );


        tile.className =
            "card-tile";


        tile.tabIndex =
            0;


        tile.setAttribute(
            "aria-expanded",
            "false"
        );


        tile.innerHTML = `

            <div class="card-main">

                <h3 class="card-title">
                    ${card.name}
                </h3>

                <div class="card-metrics card-main-metrics">

                    ${cardMetric(
            "Win Rate",
            nullablePercent(
                card.winRate
            )
        )}

                    ${cardMetric(
            "Pick Rate",
            nullablePercent(
                card.pickRate
            )
        )}

                    ${cardMetric(
            "Upgrade Rate",
            nullablePercent(
                card.upgradeRate
            )
        )}

                </div>

                <div class="card-expand-hint">
                    Click for details
                </div>

            </div>


            <div class="card-details">

                <div class="card-details-grid">

                    <div>

                        <h4>
                            Full Breakdown
                        </h4>

                        <div class="card-extra-grid">

                            ${extraMetric(
            "Offers",
            formatNumber(
                card.offers
            )
        )}

                            ${extraMetric(
            "Picks",
            formatNumber(
                card.picks
            )
        )}

                            ${extraMetric(
            "Pick Rate",
            nullablePercent(
                card.pickRate
            )
        )}

                            ${extraMetric(
            "Runs containing card",
            formatNumber(
                card.runs
            )
        )}

                            ${extraMetric(
            "Total copies",
            formatNumber(
                card.copies
            )
        )}

                            ${extraMetric(
            "Average copies",
            nullableDecimal(
                card.avgCopies,
                2
            )
        )}

                            ${extraMetric(
            "Wins",
            formatNumber(
                card.wins
            )
        )}

                            ${extraMetric(
            "Win Rate",
            nullablePercent(
                card.winRate
            )
        )}

                            ${extraMetric(
            "Runs upgraded",
            formatNumber(
                card.runsUpgraded
            )
        )}

                            ${extraMetric(
            "Campfire upgrades",
            formatNumber(
                card.campfireUpgrades
            )
        )}

                            ${extraMetric(
            "Upgrade Rate",
            nullablePercent(
                card.upgradeRate
            )
        )}

                        </div>

                    </div>


                    <div>

                        <h4>
                            Picked Over Most
                        </h4>

                        ${renderPickedOverList(
            topPickedOver
        )}

                    </div>

                </div>

            </div>
        `;


        tile.addEventListener(
            "click",
            () =>
                toggleCardTile(
                    tile
                )
        );


        tile.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter" ||
                    event.key ===
                    " "
                ) {

                    event
                        .preventDefault();


                    toggleCardTile(
                        tile
                    );
                }
            }
        );


        grid.appendChild(
            tile
        );
    }
}

function toggleCardTile(
    tile
) {

    const expanded =
        tile.classList.toggle(
            "expanded"
        );


    tile.setAttribute(
        "aria-expanded",
        expanded
            ? "true"
            : "false"
    );
}


function renderPickedOverList(
    rows
) {

    if (
        rows.length === 0
    ) {

        return `
            <p class="empty-state">
                No matchup data.
            </p>
        `;
    }


    return `
        <ol class="picked-over-list">

            ${
        rows.map(
            row => `
                        <li>

                            <span class="picked-over-name">
                                ${row.name}
                            </span>

                            <span class="picked-over-count">
                                ${formatNumber(row.count)}×
                            </span>

                            <span class="picked-over-rate">
                                ${
                row.pickRate === null
                    ? ""
                    : `${formatPercent(row.pickRate)} pick rate`
            }
                            </span>

                        </li>
                    `
        ).join("")
    }

        </ol>
    `;
}


function cardMetric(
    label,
    value
) {

    return `
        <div class="card-metric">

            <span>
                ${label}
            </span>

            <strong>
                ${value}
            </strong>

        </div>
    `;
}


function extraMetric(
    label,
    value
) {

    return `
        <span class="card-extra-label">
            ${label}
        </span>

        <strong>
            ${value}
        </strong>
    `;
}


function compareCardValues(
    a,
    b,
    property,
    direction
) {

    if (
        property === "name"
    ) {

        const result =
            a.name.localeCompare(
                b.name
            );


        return direction ===
        "asc"
            ? result
            : -result;
    }


    const av =
        a[property];

    const bv =
        b[property];


    if (
        av === null &&
        bv === null
    ) {
        return 0;
    }

    if (av === null) {
        return 1;
    }

    if (bv === null) {
        return -1;
    }


    const result =
        av - bv;


    return direction ===
    "asc"
        ? result
        : -result;
}


// ============================================================
// ENEMIES
// ============================================================

function renderEnemies(
    rows
) {

    const body =
        document.getElementById(
            "enemyTableBody"
        );


    if (!body) {
        return;
    }


    const grouped =
        new Map();


    for (const row of rows) {

        const id =
            row.encounter;


        if (
            !grouped.has(id)
        ) {

            grouped.set(
                id,
                {
                    encounter:
                    id,

                    fights:
                        0,

                    deaths:
                        0,

                    survived:
                        0,

                    totalTurns:
                        0,

                    totalDamage:
                        0
                }
            );
        }


        const item =
            grouped.get(id);

        const fights =
            Number(
                row.fights ?? 0
            );


        item.fights +=
            fights;

        item.deaths +=
            Number(
                row.deaths ?? 0
            );

        item.survived +=
            Number(
                row.survived ?? 0
            );


        item.totalTurns +=
            Number(
                row.avg_turns ?? 0
            ) *
            fights;


        item.totalDamage +=
            Number(
                row.avg_damage ?? 0
            ) *
            fights;
    }


    const results =
        [...grouped.values()]
            .sort(
                (a, b) =>
                    b.fights -
                    a.fights
            );


    body.innerHTML =
        "";


    for (
        const item of results
        ) {

        const survivalRate =
            item.fights > 0
                ? item.survived /
                item.fights *
                100
                : 0;


        const avgTurns =
            item.fights > 0
                ? item.totalTurns /
                item.fights
                : 0;


        const avgDamage =
            item.fights > 0
                ? item.totalDamage /
                item.fights
                : 0;


        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML = `
            <td>${cleanName(item.encounter)}</td>
            <td>${formatNumber(item.fights)}</td>
            <td>${formatNumber(item.deaths)}</td>
            <td>${formatPercent(survivalRate)}</td>
            <td>${formatDecimal(avgTurns)}</td>
            <td>${formatDecimal(avgDamage)}</td>
        `;


        body.appendChild(
            row
        );
    }
}


// ============================================================
// SORTABLE TABLES
// ============================================================

function enableTableSorting() {

    document
        .querySelectorAll(
            "table.sortable th[data-sort]"
        )
        .forEach(
            header => {

                header.addEventListener(
                    "click",
                    () => {

                        const table =
                            header.closest(
                                "table"
                            );

                        const body =
                            table.querySelector(
                                "tbody"
                            );


                        const headers =
                            [...table.querySelectorAll(
                                "th"
                            )];


                        const index =
                            headers.indexOf(
                                header
                            );


                        const type =
                            header.dataset.sort;


                        const direction =
                            header.dataset
                                .direction ===
                            "asc"
                                ? "desc"
                                : "asc";


                        headers.forEach(
                            other => {

                                if (
                                    other !==
                                    header
                                ) {

                                    delete other
                                        .dataset
                                        .direction;
                                }
                            }
                        );


                        header.dataset
                            .direction =
                            direction;


                        const rows =
                            [...body.querySelectorAll(
                                "tr"
                            )];


                        rows.sort(
                            (a, b) =>
                                compareTableRows(
                                    a,
                                    b,
                                    index,
                                    type,
                                    direction
                                )
                        );


                        body.replaceChildren(
                            ...rows
                        );
                    }
                );
            }
        );
}


function compareTableRows(
    a,
    b,
    index,
    type,
    direction
) {

    const aText =
        a.children[index]
            ?.textContent
            ?.trim() ?? "";

    const bText =
        b.children[index]
            ?.textContent
            ?.trim() ?? "";


    if (
        type === "number"
    ) {

        const av =
            parseSortableNumber(
                aText
            );

        const bv =
            parseSortableNumber(
                bText
            );


        const aMissing =
            Number.isNaN(av);

        const bMissing =
            Number.isNaN(bv);


        if (
            aMissing &&
            bMissing
        ) {
            return 0;
        }

        if (aMissing) {
            return 1;
        }

        if (bMissing) {
            return -1;
        }


        const result =
            av - bv;


        return direction ===
        "asc"
            ? result
            : -result;
    }


    const result =
        aText.localeCompare(
            bText,
            undefined,
            {
                numeric:
                    true,

                sensitivity:
                    "base"
            }
        );


    return direction ===
    "asc"
        ? result
        : -result;
}


function parseSortableNumber(
    text
) {

    if (
        !text ||
        text === "-"
    ) {
        return NaN;
    }


    return Number.parseFloat(
        text
            .replaceAll(
                ",",
                ""
            )
            .replace(
                "%",
                ""
            )
    );
}


// ============================================================
// TABLE SEARCH
// ============================================================

function enableTableSearch() {

    document
        .querySelectorAll(
            ".table-search"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    () =>
                        applyTableSearch(
                            input
                        )
                );
            }
        );
}


function applyTableSearch(
    input
) {

    const table =
        document.getElementById(
            input.dataset.table
        );


    if (!table) {
        return;
    }


    const search =
        input.value
            .trim()
            .toLowerCase();


    table
        .querySelectorAll(
            "tbody tr"
        )
        .forEach(
            row => {

                row.style.display =
                    row.textContent
                        .toLowerCase()
                        .includes(
                            search
                        )
                        ? ""
                        : "none";
            }
        );
}


function applyAllTableSearches() {

    document
        .querySelectorAll(
            ".table-search"
        )
        .forEach(
            applyTableSearch
        );
}


// ============================================================
// HELPERS
// ============================================================

function checkError(
    result
) {

    if (result.error) {
        throw result.error;
    }
}


function sum(
    rows,
    field
) {

    return rows.reduce(
        (total, row) =>
            total +
            Number(
                row[field] ?? 0
            ),
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
            Number(
                row[valueField]
            );

        const rowWeight =
            Number(
                row[weightField] ??
                0
            );


        if (
            !Number.isFinite(
                value
            ) ||
            rowWeight <= 0
        ) {
            continue;
        }


        total +=
            value *
            rowWeight;

        weight +=
            rowWeight;
    }


    return weight > 0
        ? total / weight
        : null;
}


function cleanName(
    value
) {

    if (!value) {
        return "-";
    }


    return value
        .replace(
            /^THEENGINEER-/,
            ""
        )
        .replaceAll(
            "_",
            " "
        )
        .toLowerCase()
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );
}


function formatNumber(
    value
) {

    return Number(
        value ?? 0
    ).toLocaleString();
}


function formatPercent(
    value
) {

    return (
        Number(
            value ?? 0
        ).toFixed(1) +
        "%"
    );
}


function nullablePercent(
    value
) {

    return value === null
        ? "-"
        : formatPercent(
            value
        );
}


function formatDecimal(
    value
) {

    if (
        value === null ||
        !Number.isFinite(
            value
        )
    ) {
        return "-";
    }


    return value.toFixed(1);
}


function nullableDecimal(
    value,
    decimals
) {

    return value === null
        ? "-"
        : value.toFixed(
            decimals
        );
}


function formatShortDate(
    value
) {

    return new Date(
        value
    ).toLocaleDateString(
        undefined,
        {
            month:
                "short",

            day:
                "numeric"
        }
    );
}


function formatDateTime(
    value
) {

    return new Date(
        value
    ).toLocaleString();
}


function formatRelativeTime(
    value
) {

    const date =
        new Date(value);

    const seconds =
        Math.round(
            (
                date -
                new Date()
            ) /
            1000
        );


    const formatter =
        new Intl.RelativeTimeFormat(
            undefined,
            {
                numeric:
                    "auto"
            }
        );


    if (
        Math.abs(seconds) <
        60
    ) {

        return formatter.format(
            seconds,
            "second"
        );
    }


    const minutes =
        Math.round(
            seconds / 60
        );


    if (
        Math.abs(minutes) <
        60
    ) {

        return formatter.format(
            minutes,
            "minute"
        );
    }


    const hours =
        Math.round(
            minutes / 60
        );


    if (
        Math.abs(hours) <
        24
    ) {

        return formatter.format(
            hours,
            "hour"
        );
    }


    const days =
        Math.round(
            hours / 24
        );


    return formatter.format(
        days,
        "day"
    );
}


function cssVariable(
    name
) {

    return getComputedStyle(
        document.documentElement
    )
        .getPropertyValue(
            name
        )
        .trim();
}