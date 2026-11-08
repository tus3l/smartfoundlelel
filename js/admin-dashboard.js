"use strict";


const reports = [];


/* ======================================================
   STATE
====================================================== */

let currentTypeFilter =
    "all";


let currentStatusFilter =
    "all";


let searchValue =
    "";


/* ======================================================
   STATUS LABELS
====================================================== */

const statusLabels = {

    "new":
        "جديد",

    "review":
        "قيد المراجعة",

    "strong-match":
        "تطابق قوي",

    "contact":
        "بانتظار التواصل",

    "verification":
        "جاري التحقق",

    "completed":
        "تم التسليم",

    "rejected":
        "مرفوض"

};


/* ======================================================
   LOST ITEMS MAP CONFIG
====================================================== */

const YANBU_CENTER = [24.06, 38.11];

const YANBU_DEFAULT_ZOOM = 11;


/* Approximate centres used when a report has no GPS coordinates. */
const yanbuNeighborhoodCoordinates = {

    "البندر":
        [24.0957861, 38.0278230],

    "الصريف":
        [24.0810215, 38.0452220],

    "الشاطئ":
        [24.0843796, 38.0244849],

    "الفيصل":
        [24.0271149, 38.2045363],

    "خالد":
        [24.0033482, 38.1751567],

    "الخالد":
        [24.0033482, 38.1751567]

};


const yanbuRegionCoordinates = {

    "ينبع البحر":
        [24.0895, 38.0618],

    "ينبع الصناعية":
        [23.9988327, 38.2028069]

};


const categoryMapIcons = {

    "إلكترونيات": "📱",

    "حيوانات": "🐾",

    "محافظ وحقائب": "👛",

    "مفاتيح": "🔑",

    "أوراق ومستندات": "📄"

};


let lostItemsMap = null;

let lostItemsLayer = null;

const lostItemMarkers = new Map();


/* ======================================================
   INITIALIZE
====================================================== */

let reportsRequest = null;


void loadReports();


async function loadReports(announce = false) {
    if (reportsRequest) return reportsRequest;

    const task = (async () => {
        const errorBox = document.getElementById("adminLoadError");
        try {
            const { response, data } = await SFLoader.request(
                "../backend/api/admin/reports.php",
                { credentials: "include", cache: "no-store" }
            );

            if (response.status === 401) {
                void SFLoader.navigate("login.html", { replace: true });
                return false;
            }
            if (response.status === 403) {
                void SFLoader.navigate("home.html", { replace: true });
                return false;
            }
            if (!response.ok || !data.success || !Array.isArray(data.reports)) {
                throw new Error(data.message || "تعذر تحميل البلاغات.");
            }

            reports.splice(0, reports.length, ...data.reports);
            errorBox.hidden = true;
            renderDashboard();
            if (announce) showToast("تم تحديث البيانات.");
            return true;
        } catch (error) {
            console.error("Unable to load admin reports:", error);
            errorBox.textContent = error instanceof Error
                ? `${error.message} استخدم زر التحديث للمحاولة مجددًا.`
                : "تعذر تحميل البلاغات. استخدم زر التحديث للمحاولة مجددًا.";
            errorBox.hidden = false;
            return false;
        }
    })();

    reportsRequest = task;
    try {
        return await task;
    } finally {
        if (reportsRequest === task) reportsRequest = null;
    }
}


/* ======================================================
   MAIN RENDER
====================================================== */

function renderDashboard() {

    renderStatistics();

    renderTopMatches();

    renderReports();

    renderSidebarCounts();

    renderAnalytics();

}


/* ======================================================
   VIEWS
====================================================== */

const adminViewTitles = {

    analytics:
        "تحليلات الموقع",

    reports:
        "متابعة البلاغات"

};


function showAdminView(
    view
) {

    document
        .getElementById(
            "analyticsView"
        )
        .hidden =
        view !== "analytics";


    document
        .getElementById(
            "reportsView"
        )
        .hidden =
        view !== "reports";


    document
        .getElementById(
            "adminPageTitle"
        )
        .textContent =
        adminViewTitles[view];

}


/* ======================================================
   STATISTICS
====================================================== */

function renderStatistics() {

    const lost =
        reports.filter(
            report =>
                report.type === "lost"
        ).length;


    const found =
        reports.filter(
            report =>
                report.type === "found"
        ).length;


    const strong =
        reports.filter(
            report =>
                report.bestMatch >= 85 &&
                report.status !== "completed"
        ).length;


    const completed =
        reports.filter(
            report =>
                report.status === "completed"
        ).length;


    document
        .getElementById(
            "lostCount"
        )
        .textContent =
        lost;


    document
        .getElementById(
            "foundCount"
        )
        .textContent =
        found;


    document
        .getElementById(
            "strongMatchCount"
        )
        .textContent =
        strong;


    document
        .getElementById(
            "completedCount"
        )
        .textContent =
        completed;

}


/* ======================================================
   SIDEBAR COUNTS
====================================================== */

function renderSidebarCounts() {

    const strong =
        reports.filter(
            report =>
                report.bestMatch >= 85 &&
                report.status !== "completed"
        ).length;


    const newReports =
        reports.filter(
            report =>
                report.status === "new"
        ).length;


    document
        .getElementById(
            "strongMatchNavCount"
        )
        .textContent =
        strong;


    document
        .getElementById(
            "newReportsNavCount"
        )
        .textContent =
        newReports;

}


/* ======================================================
   TOP MATCHES
====================================================== */

function renderTopMatches() {

    const container =
        document.getElementById(
            "topMatchesGrid"
        );


    const topReports =
        [...reports]

            .filter(
                report =>
                    report.bestMatch >= 70 &&
                    report.matches.length > 0 &&
                    report.status !== "completed"
            )

            .sort(
                (a, b) =>
                    b.bestMatch -
                    a.bestMatch
            )

            .slice(
                0,
                3
            );


    container.innerHTML =
        topReports.map(
            report => {

                const match =
                    report.matches[0];


                return `

                    <article
                        class="top-match-card"
                        data-report-key="${report.key}"
                    >

                        <div class="match-card-top">

                            <span class="match-percent">
                                ${report.bestMatch}%
                            </span>

                            <span class="match-strength">
                                ${getMatchStrength(report.bestMatch)}
                            </span>

                        </div>


                        <h3>
                            ${escapeHTML(report.itemType)}
                            -
                            ${escapeHTML(report.primaryColor)}
                        </h3>


                        <p>
                            بلاغ #${report.id}
                            يتطابق مع بلاغ
                            #${match.reportId}
                            الخاص بـ
                            ${escapeHTML(match.name)}
                        </p>


                        <div class="match-progress">

                            <div
                                style="width:${report.bestMatch}%"
                            ></div>

                        </div>

                    </article>

                `;

            }
        ).join("");


    container
        .querySelectorAll(
            ".top-match-card"
        )
        .forEach(
            card => {

                card.addEventListener(
                    "click",
                    () => {

                        openReportDetails(
                            card.dataset.reportKey
                        );

                    }
                );

            }
        );

}


/* ======================================================
   REPORT FILTER
====================================================== */

function getFilteredReports() {

    return reports.filter(
        report => {

            const matchesType =
                currentTypeFilter === "all" ||
                report.type === currentTypeFilter;


            const matchesStatus =
                currentStatusFilter === "all" ||

                report.status ===
                    currentStatusFilter ||

                (
                    currentStatusFilter ===
                    "strong-match" &&
                    report.bestMatch >= 85
                );


            const haystack = `

                ${report.id}
                ${report.userName}
                ${report.phone}
                ${report.email}
                ${report.category}
                ${report.itemType}
                ${report.brand}
                ${report.model}
                ${report.primaryColor}
                ${report.region}
                ${report.neighborhood}

            `
                .toLowerCase();


            const matchesSearch =
                haystack.includes(
                    searchValue.toLowerCase()
                );


            return (
                matchesType &&
                matchesStatus &&
                matchesSearch
            );

        }
    );

}


/* ======================================================
   REPORTS
====================================================== */

function renderReports() {

    const filtered =
        getFilteredReports();


    renderDesktopReports(
        filtered
    );


    renderMobileReports(
        filtered
    );


    syncLostMapSection();

}


/* ======================================================
   DESKTOP REPORTS
====================================================== */

function renderDesktopReports(
    data
) {

    const body =
        document.getElementById(
            "reportsTableBody"
        );


    const empty =
        document.getElementById(
            "emptyReports"
        );


    if (
        data.length === 0
    ) {

        body.innerHTML =
            "";


        empty.style.display =
            "block";


        return;

    }


    empty.style.display =
        "none";


    body.innerHTML =
        data.map(
            report => `

                <tr class="report-row">

                    <td class="report-number">
                        #${report.id}
                    </td>


                    <td>

                        <span
                            class="
                                report-type-badge
                                ${report.type}
                            "
                        >
                            ${
                                report.type ===
                                "lost"

                                    ? "فاقد"

                                    : "عاثر"
                            }
                        </span>

                    </td>


                    <td class="person-cell">

                        <strong>
                            ${escapeHTML(report.userName)}
                        </strong>

                        <span>
                            ${escapeHTML(report.phone)}
                        </span>

                    </td>


                    <td>
                        ${escapeHTML(report.category)}
                    </td>


                    <td>
                        ${escapeHTML(report.itemType)}
                    </td>


                    <td>
                        ${escapeHTML(report.brand || "-")}
                    </td>


                    <td>

                        ${escapeHTML(report.region)}

                        <br>

                        <small>
                            ${escapeHTML(report.neighborhood || "")}
                        </small>

                    </td>


                    <td>

                        ${renderMatchScore(
                            report.bestMatch
                        )}

                    </td>


                    <td>

                        <span
                            class="
                                status-badge
                                status-${report.status}
                            "
                        >
                            ${
                                statusLabels[
                                    report.status
                                ] || report.status
                            }
                        </span>

                    </td>


                    <td>
                        ${formatDate(report.date)}
                    </td>


                    <td>

                        <button
                            type="button"
                            class="open-report-button"
                            data-report-key="${report.key}"
                        >
                            فتح
                        </button>

                    </td>

                </tr>

            `
        ).join("");


    body
        .querySelectorAll(
            ".open-report-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openReportDetails(
                            button.dataset.reportKey
                        );

                    }
                );

            }
        );

}


/* ======================================================
   MOBILE REPORTS
====================================================== */

function renderMobileReports(
    data
) {

    const container =
        document.getElementById(
            "mobileReportList"
        );


    if (
        data.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-table"
                 style="display:block;">

                لا توجد بلاغات.

            </div>

        `;

        return;

    }


    container.innerHTML =
        data.map(
            report => `

                <article
                    class="mobile-report-card"
                    data-report-key="${report.key}"
                >

                    <div class="mobile-report-top">

                        <span
                            class="
                                report-type-badge
                                ${report.type}
                            "
                        >
                            ${
                                report.type ===
                                "lost"

                                    ? "فاقد"

                                    : "عاثر"
                            }
                        </span>


                        ${
                            renderMatchScore(
                                report.bestMatch
                            )
                        }

                    </div>


                    <h3>
                        ${escapeHTML(report.userName)}
                    </h3>


                    <div class="mobile-report-meta">

                        ${escapeHTML(report.category)}
                        •
                        ${escapeHTML(report.itemType)}
                        •
                        ${escapeHTML(report.brand)}

                        <br>

                        ${escapeHTML(report.region)}
                        -
                        ${escapeHTML(report.neighborhood)}

                    </div>

                </article>

            `
        ).join("");


    container
        .querySelectorAll(
            ".mobile-report-card"
        )
        .forEach(
            card => {

                card.addEventListener(
                    "click",
                    () => {

                        openReportDetails(
                            card.dataset.reportKey
                        );

                    }
                );

            }
        );

}


/* ======================================================
   MATCH SCORE
====================================================== */

function renderMatchScore(
    score
) {

    if (
        !score
    ) {

        return `

            <span class="table-match none">
                لا يوجد
            </span>

        `;

    }


    const className =
        score >= 85

            ? "high"

            : score >= 65

                ? "medium"

                : "none";


    return `

        <span class="table-match ${className}">
            ${score}%
        </span>

    `;

}


/* ======================================================
   OPEN REPORT
====================================================== */

function openReportDetails(
    reportKey
) {

    const report =
        reports.find(
            item =>
                item.key ===
                reportKey
        );


    if (!report) {
        return;
    }


    document
        .getElementById(
            "detailsReportId"
        )
        .textContent =
        `بلاغ #${report.id}`;


    document
        .getElementById(
            "detailsTitle"
        )
        .textContent =

        report.type ===
        "lost"

            ? "تفاصيل بلاغ فاقد"

            : "تفاصيل بلاغ عاثر";


    const detailsBody =
        document.getElementById(
            "detailsBody"
        );


    detailsBody.innerHTML = `

        <div class="report-update-error" id="reportUpdateError" role="alert" hidden></div>

        ${renderSmartMatchesSection(report)}

        ${renderOwnerSection(report)}

        ${renderItemSection(report)}

        ${renderLocationSection(report)}

        ${renderStatusSection(report)}

        ${renderAdminNotesSection(report)}

    `;


    bindReportDetailActions(
        report
    );


    document
        .getElementById(
            "reportOverlay"
        )
        .classList.add(
            "open"
        );


    document
        .getElementById(
            "reportDetailsPanel"
        )
        .classList.add(
            "open"
        );

}


/* ======================================================
   TOP 3 SMART MATCHES
====================================================== */

function renderSmartMatchesSection(
    report
) {

    let oppositeWord =
        report.type === "found"

            ? "مفقودات"

            : "معثورات";


    let html = `

        <section class="details-section">

            <div class="details-section-title">

                <h3>
                    🧠 أفضل 3 ${oppositeWord} مطابقة
                </h3>

                ${
                    report.bestMatch

                        ? `
                            <span class="match-strength">
                                أقوى تطابق ${report.bestMatch}%
                            </span>
                        `

                        : ""
                }

            </div>

            <div class="smart-match-list">

    `;


    if (
        !report.matches ||
        report.matches.length === 0
    ) {

        html += `

            <div class="detail-box full-detail">

                <span>
                    النظام
                </span>

                <strong>
                    لا يوجد تطابق مناسب حتى الآن.
                </strong>

            </div>

        `;

    } else {

        report.matches
            .slice(
                0,
                3
            )
            .forEach(
                (match, index) => {

                    html += `

                        <article class="smart-match-item">

                            <div class="smart-match-header">

                                <div>

                                    <strong>
                                        #${index + 1}
                                        ${escapeHTML(match.name)}
                                    </strong>

                                    <div class="smart-match-meta">
                                        بلاغ #${match.reportId}
                                        •
                                        ${escapeHTML(match.title)}
                                        •
                                        ${escapeHTML(match.region)}
                                    </div>

                                </div>


                                <span class="smart-match-score">
                                    ${match.score}%
                                </span>

                            </div>


                            <div class="smart-match-analysis">

                                ${analysisBox(
                                    "القسم",
                                    match.analysis.category
                                )}

                                ${analysisBox(
                                    "النوع",
                                    match.analysis.type
                                )}

                                ${analysisBox(
                                    "الماركة",
                                    match.analysis.brand
                                )}

                                ${analysisBox(
                                    "اللون",
                                    match.analysis.color
                                )}

                                ${analysisBox(
                                    "الموقع",
                                    match.analysis.location
                                )}

                                ${analysisBox(
                                    "التاريخ",
                                    match.analysis.date
                                )}

                                ${analysisBox(
                                    "الوصف",
                                    match.analysis.description
                                )}

                                ${analysisBox(
                                    "الصورة",
                                    match.analysis.image
                                )}

                            </div>


                            <button
                                type="button"
                                class="match-open-button"
                                data-match-report="${match.reportKey}"
                            >
                                فتح البلاغ المطابق
                            </button>

                        </article>

                    `;

                }
            );

    }


    html += `

            </div>

        </section>

    `;


    return html;

}


/* ======================================================
   OWNER
====================================================== */

function renderOwnerSection(
    report
) {

    return `

        <section class="details-section">

            <div class="details-section-title">

                <h3>
                    👤 صاحب البلاغ
                </h3>


                <span
                    class="
                        report-type-badge
                        ${report.type}
                    "
                >
                    ${
                        report.type ===
                        "lost"

                            ? "فاقد"

                            : "عاثر"
                    }
                </span>

            </div>


            <div class="details-grid">


                ${detailBox(
                    "الاسم",
                    report.userName
                )}


                ${detailBox(
                    "رقم الجوال",
                    report.phone
                )}


                ${detailBox(
                    "البريد الإلكتروني",
                    report.email ||
                    "غير مسجل"
                )}


                ${detailBox(
                    "رقم البلاغ",
                    `#${report.id}`
                )}


            </div>


            <div class="contact-actions">

                <button
                    type="button"
                    class="contact-button call-button"
                    id="callUserButton"
                    ${report.phone ? "" : "disabled"}
                >
                    📞 اتصال
                </button>


                <button
                    type="button"
                    class="contact-button whatsapp-button"
                    id="whatsappUserButton"
                    ${report.phone ? "" : "disabled"}
                >
                    💬 واتساب
                </button>

            </div>

        </section>

    `;

}


/* ======================================================
   ITEM
====================================================== */

function renderItemSection(
    report
) {

    return `

        <section class="details-section">

            <div class="details-section-title">

                <h3>
                    📦 معلومات الغرض
                </h3>

            </div>


            <div class="details-grid">


                ${detailBox(
                    "القسم",
                    report.category
                )}


                ${detailBox(
                    "النوع",
                    report.itemType
                )}


                ${detailBox(
                    "الماركة / النوع",
                    report.brand ||
                    "غير محدد"
                )}


                ${detailBox(
                    "الموديل",
                    report.model ||
                    "غير محدد"
                )}


                ${detailBox(
                    "اللون الأساسي",
                    report.primaryColor ||
                    "-"
                )}


                ${detailBox(
                    "اللون الثانوي",
                    report.secondaryColor ||
                    "لا يوجد"
                )}


                ${detailBox(
                    "الوصف",
                    report.description ||
                    "لا يوجد",
                    true
                )}


                ${detailBox(
                    "علامة مميزة 🔒",
                    report.distinctiveMarks ||
                    "لا يوجد",
                    true
                )}


            </div>

        </section>

    `;

}


/* ======================================================
   LOCATION
====================================================== */

function renderLocationSection(
    report
) {

    return `

        <section class="details-section">

            <div class="details-section-title">

                <h3>
                    📍 الموقع والتاريخ
                </h3>

            </div>


            <div class="details-grid">


                ${detailBox(
                    "المنطقة",
                    report.region
                )}


                ${detailBox(
                    "الحي",
                    report.neighborhood ||
                    "-"
                )}


                ${detailBox(
                    "التاريخ",
                    formatDate(
                        report.date
                    )
                )}


                ${detailBox(
                    "الوقت",
                    report.time ||
                    "-"
                )}


                ${detailBox(
                    "Latitude",
                    report.latitude ||
                    "غير محدد"
                )}


                ${detailBox(
                    "Longitude",
                    report.longitude ||
                    "غير محدد"
                )}


                ${detailBox(
                    "دقة GPS",
                    report.accuracy

                        ? `±${report.accuracy} متر`

                        : "لم يستخدم GPS"
                )}


                ${detailBox(
                    "وصف الموقع",
                    report.locationDescription ||
                    "-",
                    true
                )}


            </div>

        </section>

    `;

}


/* ======================================================
   STATUS
====================================================== */

function renderStatusSection(
    report
) {

    const statuses = [

        [
            "new",
            "جديد"
        ],

        [
            "review",
            "قيد المراجعة"
        ],

        [
            "strong-match",
            "تطابق قوي"
        ],

        [
            "contact",
            "بانتظار التواصل"
        ],

        [
            "verification",
            "جاري التحقق"
        ],

        [
            "completed",
            "تم التسليم"
        ]

    ];


    return `

        <section class="details-section">

            <div class="details-section-title">

                <h3>
                    ⚙️ حالة البلاغ
                </h3>


                <span
                    class="
                        status-badge
                        status-${report.status}
                    "
                >
                    ${
                        statusLabels[
                            report.status
                        ]
                    }
                </span>

            </div>


            <div class="status-control-grid">

                ${
                    statuses.map(
                        ([value, label]) => `

                            <button
                                type="button"
                                class="status-action"
                                data-status="${value}"
                            >
                                ${label}
                            </button>

                        `
                    ).join("")
                }

            </div>

        </section>

    `;

}


/* ======================================================
   NOTES
====================================================== */

function renderAdminNotesSection(
    report
) {

    return `

        <section class="details-section">

            <div class="details-section-title">

                <h3>
                    📝 ملاحظات الإدارة
                </h3>

            </div>


            <textarea
                class="admin-note-area"
                id="adminNoteArea"
                maxlength="5000"
                placeholder="اكتب ملاحظة داخلية لا يراها المستخدم..."
            >${escapeHTML(report.adminNote || "")}</textarea>


            <button
                type="button"
                class="admin-note-save"
                id="saveAdminNoteButton"
            >
                حفظ الملاحظة
            </button>

        </section>

    `;

}


/* ======================================================
   BIND DETAILS
====================================================== */

let reportUpdatePending = false;


async function saveReportChange(report, action, values) {
    if (reportUpdatePending) return;
    reportUpdatePending = true;
    document.querySelectorAll(".status-action, #saveAdminNoteButton")
        .forEach(button => { button.disabled = true; });
    const previousError = document.getElementById("reportUpdateError");
    if (previousError) previousError.hidden = true;

    try {
        const { response, data } = await SFLoader.request(
            "../backend/api/admin/update-report.php",
            {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: report.type,
                    id: report.id,
                    action,
                    ...values
                })
            }
        );

        if (response.status === 401) {
            void SFLoader.navigate("login.html", { replace: true });
            return;
        }
        if (response.status === 403) {
            void SFLoader.navigate("home.html", { replace: true });
            return;
        }
        if (!response.ok || !data.success) {
            throw new Error(data.message || "تعذر حفظ تحديث البلاغ.");
        }

        if (action === "status") {
            if (!Object.hasOwn(statusLabels, data.status)) {
                throw new Error("استجابة حالة البلاغ غير صحيحة.");
            }
            report.status = data.status;
            renderDashboard();
            openReportDetails(report.key);
            showToast(data.changed
                ? `تم تغيير حالة البلاغ إلى: ${statusLabels[data.status]}`
                : "حالة البلاغ لم تتغير.");
        } else {
            if (typeof data.note !== "string") {
                throw new Error("استجابة الملاحظة غير صحيحة.");
            }
            report.adminNote = data.note;
            showToast("تم حفظ الملاحظة.");
        }
    } catch (error) {
        console.error("Unable to update report:", error);
        if (error instanceof SFLoader.ConnectionError && await loadReports()) {
            openReportDetails(report.key);
        }
        const errorBox = document.getElementById("reportUpdateError");
        if (errorBox) {
            errorBox.textContent = error instanceof Error
                ? error.message
                : "تعذر حفظ تحديث البلاغ.";
            errorBox.hidden = false;
        }
    } finally {
        reportUpdatePending = false;
        document.querySelectorAll(".status-action, #saveAdminNoteButton")
            .forEach(button => { button.disabled = false; });
    }
}


function bindReportDetailActions(
    report
) {

    const callButton =
        document.getElementById(
            "callUserButton"
        );


    if (callButton && report.phone) {

        callButton.addEventListener(
            "click",
            () => {

                window.location.href =
                    `tel:${normalizeSaudiPhone(report.phone)}`;

            }
        );

    }


    const whatsappButton =
        document.getElementById(
            "whatsappUserButton"
        );


    if (whatsappButton && report.phone) {

        whatsappButton.addEventListener(
            "click",
            () => {

                const phone =
                    normalizeSaudiPhone(
                        report.phone
                    );


                window.open(
                    `https://wa.me/${phone}`,
                    "_blank",
                    "noopener,noreferrer"
                );

            }
        );

    }


    document
        .querySelectorAll(
            ".status-action"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        void saveReportChange(
                            report,
                            "status",
                            { status: button.dataset.status }
                        );

                    }
                );

            }
        );


    const saveNote =
        document.getElementById(
            "saveAdminNoteButton"
        );


    if (saveNote) {

        saveNote.addEventListener(
            "click",
            () => {

                void saveReportChange(
                    report,
                    "note",
                    {
                        note: document.getElementById("adminNoteArea").value.trim()
                    }
                );

            }
        );

    }


    document
        .querySelectorAll(
            ".match-open-button"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const targetId =
                            button.dataset.matchReport;


                        const exists =
                            reports.some(
                                item =>
                                    item.key ===
                                    targetId
                            );


                        if (exists) {

                            openReportDetails(
                                targetId
                            );

                        } else {

                            showToast(
                                "البلاغ المطابق غير موجود في القائمة الحالية."
                            );

                        }

                    }
                );

            }
        );

}


/* ======================================================
   CLOSE DETAILS
====================================================== */

function closeDetails() {

    document
        .getElementById(
            "reportOverlay"
        )
        .classList.remove(
            "open"
        );


    document
        .getElementById(
            "reportDetailsPanel"
        )
        .classList.remove(
            "open"
        );

}


document
    .getElementById(
        "closeReportDetails"
    )
    .addEventListener(
        "click",
        closeDetails
    );


document
    .getElementById(
        "reportOverlay"
    )
    .addEventListener(
        "click",
        closeDetails
    );


/* ======================================================
   FILTER EVENTS
====================================================== */

document
    .getElementById(
        "reportsSearch"
    )
    .addEventListener(
        "input",
        event => {

            searchValue =
                event.target.value.trim();


            renderReports();

        }
    );


document
    .getElementById(
        "reportTypeFilter"
    )
    .addEventListener(
        "change",
        event => {

            currentTypeFilter =
                event.target.value;


            renderReports();

        }
    );


document
    .getElementById(
        "reportStatusFilter"
    )
    .addEventListener(
        "change",
        event => {

            currentStatusFilter =
                event.target.value;


            renderReports();

        }
    );


/* ======================================================
   SIDEBAR FILTERS
====================================================== */

document
    .querySelectorAll(
        ".admin-nav-item"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".admin-nav-item"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button.classList.add(
                        "active"
                    );


                    if (
                        button.dataset.filterType
                    ) {

                        currentTypeFilter =
                            button.dataset.filterType;


                        currentStatusFilter =
                            "all";


                        document
                            .getElementById(
                                "reportTypeFilter"
                            )
                            .value =
                            currentTypeFilter;


                        document
                            .getElementById(
                                "reportStatusFilter"
                            )
                            .value =
                            "all";

                    }


                    if (
                        button.dataset.filterStatus
                    ) {

                        currentStatusFilter =
                            button.dataset.filterStatus;


                        currentTypeFilter =
                            "all";


                        document
                            .getElementById(
                                "reportTypeFilter"
                            )
                            .value =
                            "all";


                        document
                            .getElementById(
                                "reportStatusFilter"
                            )
                            .value =
                            currentStatusFilter;

                    }


                    if (
                        button.dataset.section ===
                        "dashboard"
                    ) {

                        currentTypeFilter =
                            "all";


                        currentStatusFilter =
                            "all";


                        document
                            .getElementById(
                                "reportTypeFilter"
                            )
                            .value =
                            "all";


                        document
                            .getElementById(
                                "reportStatusFilter"
                            )
                            .value =
                            "all";

                    }


                    showAdminView(
                        button.dataset.section ===
                        "dashboard"
                            ? "analytics"
                            : "reports"
                    );


                    renderReports();


                    closeSidebarMobile();


                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });

                }
            );

        }
    );


document
    .getElementById(
        "analyticsShowAllReports"
    )
    .addEventListener(
        "click",
        () => {

            document
                .querySelector(
                    ".admin-nav-item[data-filter-type=\"all\"]"
                )
                .click();

        }
    );


/* ======================================================
   SHOW STRONG MATCHES
====================================================== */

document
    .getElementById(
        "showStrongMatchesButton"
    )
    .addEventListener(
        "click",
        () => {

            currentTypeFilter =
                "all";


            currentStatusFilter =
                "strong-match";


            document
                .getElementById(
                    "reportTypeFilter"
                )
                .value =
                "all";


            document
                .getElementById(
                    "reportStatusFilter"
                )
                .value =
                "strong-match";


            renderReports();


            document
                .querySelector(
                    ".reports-section"
                )
                .scrollIntoView({
                    behavior: "smooth"
                });

        }
    );


/* ======================================================
   REFRESH
====================================================== */

document
    .getElementById(
        "refreshButton"
    )
    .addEventListener(
        "click",
        () => {

            void loadReports(true);

        }
    );


/* ======================================================
   MOBILE SIDEBAR
====================================================== */

const sidebar =
    document.getElementById(
        "adminSidebar"
    );


document
    .getElementById(
        "sidebarToggle"
    )
    .addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );

        }
    );


function closeSidebarMobile() {

    sidebar.classList.remove(
        "open"
    );

}


/* ======================================================
   LOST ITEMS MAP
====================================================== */

function normalizeNeighborhoodName(
    name
) {

    return String(name || "")
        .replace(/^\s*حي\s+/, "")
        .trim();

}


function getReportMapPosition(
    report
) {

    const latitude =
        parseFloat(report.latitude);

    const longitude =
        parseFloat(report.longitude);


    if (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
    ) {

        return {
            coordinates: [latitude, longitude],
            exact: true
        };

    }


    const neighborhood =
        normalizeNeighborhoodName(
            report.neighborhood
        );


    const base =
        yanbuNeighborhoodCoordinates[neighborhood] ||
        yanbuNeighborhoodCoordinates[`ال${neighborhood}`] ||
        yanbuRegionCoordinates[report.region];


    if (!base) {
        return null;
    }


    // Small deterministic offset so reports in the same neighbourhood don't overlap.
    const angle =
        (report.id * 137.5) * Math.PI / 180;

    const offset =
        0.0012;


    return {
        coordinates: [
            base[0] + Math.sin(angle) * offset,
            base[1] + Math.cos(angle) * offset
        ],
        exact: false
    };

}


function initLostItemsMap() {

    if (lostItemsMap) {
        return true;
    }


    const mapElement =
        document.getElementById(
            "lostItemsMap"
        );


    if (
        !mapElement ||
        typeof L === "undefined"
    ) {

        const fallback =
            document.getElementById(
                "lostMapFallback"
            );


        if (fallback) {
            fallback.hidden = false;
        }


        return false;

    }


    lostItemsMap =
        L.map(
            mapElement,
            {
                center: YANBU_CENTER,
                zoom: YANBU_DEFAULT_ZOOM,
                scrollWheelZoom: false,
                attributionControl: true
            }
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
        }
    ).addTo(
        lostItemsMap
    );


    lostItemsLayer =
        L.featureGroup().addTo(
            lostItemsMap
        );


    lostItemsMap.on(
        "popupopen",
        event => {

            const button =
                event.popup
                    .getElement()
                    .querySelector(
                        ".lost-popup-button"
                    );


            if (!button) {
                return;
            }


            button.addEventListener(
                "click",
                () => {

                    lostItemsMap.closePopup();

                    openReportDetails(
                        button.dataset.reportKey
                    );

                }
            );

        }
    );


    if (
        "IntersectionObserver" in window
    ) {

        // Leaflet needs a size recalculation once the section becomes visible.
        new IntersectionObserver(
            entries => {

                if (
                    entries.some(
                        entry => entry.isIntersecting
                    )
                ) {

                    lostItemsMap.invalidateSize();

                }

            }
        ).observe(
            mapElement
        );

    }


    return true;

}


function createLostItemIcon(
    report,
    exact
) {

    const icon =
        categoryMapIcons[report.category] ||
        "📍";


    return L.divIcon({

        className: "lost-pin-wrapper",

        html: `
            <span
                class="
                    lost-pin
                    ${exact ? "exact" : "approx"}
                    ${report.status === "completed" ? "completed" : ""}
                "
            >
                <span class="lost-pin-icon">${icon}</span>
            </span>
        `,

        iconSize: [38, 48],

        iconAnchor: [19, 46],

        popupAnchor: [0, -42]

    });

}


function renderLostItemPopup(
    report,
    exact
) {

    const title =
        [
            report.itemType,
            report.brand &&
            report.brand !== "غير محدد"
                ? report.brand
                : ""
        ]
            .filter(Boolean)
            .join(" - ");


    const colors =
        [
            report.primaryColor,
            report.secondaryColor &&
            report.secondaryColor !== "لا يوجد"
                ? report.secondaryColor
                : ""
        ]
            .filter(Boolean)
            .join(" / ");


    const location =
        [
            report.region,
            report.neighborhood
        ]
            .filter(Boolean)
            .join(" - ");


    const accuracy =
        exact

            ? (
                report.accuracy
                    ? `دقيق (بهامش ${report.accuracy} متر)`
                    : "دقيق"
            )

            : "تقريبي حسب الحي";


    const row =
        (label, value) => `
            <div class="lost-popup-row">
                <dt>${escapeHTML(label)}</dt>
                <dd>${escapeHTML(String(value || "-"))}</dd>
            </div>
        `;


    return `

        <div class="lost-popup" dir="rtl">

            <div class="lost-popup-top">

                <span class="lost-popup-id">
                    بلاغ فاقد #${report.id}
                </span>

                <span
                    class="
                        status-badge
                        status-${escapeHTML(report.status)}
                    "
                >
                    ${escapeHTML(statusLabels[report.status] || report.status)}
                </span>

            </div>


            <h3>
                ${escapeHTML(title || "غرض مفقود")}
            </h3>


            <p class="lost-popup-description">
                ${escapeHTML(report.description || "")}
            </p>


            <dl class="lost-popup-details">

                ${row("القسم", report.category)}

                ${row("الموديل", report.model)}

                ${row("اللون", colors)}

                ${row("علامات مميزة", report.distinctiveMarks)}

                ${row("المكان", location)}

                ${row("وصف الموقع", report.locationDescription)}

                ${row("تاريخ الفقد", `${formatDate(report.date)}${report.time ? ` - ${report.time}` : ""}`)}

                ${row("دقة الموقع", accuracy)}

                ${row("صاحب البلاغ", report.userName)}

            </dl>


            <button
                type="button"
                class="lost-popup-button"
                data-report-key="${report.key}"
            >
                عرض التفاصيل الكاملة
            </button>

        </div>

    `;

}


/* The GPS map is only shown while viewing the lost-items section. */
function syncLostMapSection() {

    const section =
        document.getElementById(
            "lostMapSection"
        );


    if (!section) {
        return;
    }


    const visible =
        currentTypeFilter === "lost";


    section.hidden =
        !visible;


    if (visible) {

        renderLostItemsMap();

    }

}


function renderLostItemsMap() {

    const lostReports =
        reports.filter(
            report =>
                report.type === "lost"
        );


    const plotted =
        lostReports
            .map(
                report => ({
                    report,
                    position:
                        getReportMapPosition(
                            report
                        )
                })
            );


    renderLostMapList(
        plotted
    );


    if (
        !initLostItemsMap()
    ) {
        return;
    }


    lostItemsMap.invalidateSize();


    lostItemsLayer.clearLayers();

    lostItemMarkers.clear();


    plotted.forEach(
        ({ report, position }) => {

            if (!position) {
                return;
            }


            const marker =
                L.marker(
                    position.coordinates,
                    {
                        icon:
                            createLostItemIcon(
                                report,
                                position.exact
                            ),
                        title:
                            `${report.itemType} - بلاغ #${report.id}`,
                        riseOnHover: true
                    }
                )
                    .bindPopup(
                        renderLostItemPopup(
                            report,
                            position.exact
                        ),
                        {
                            maxWidth: 300,
                            minWidth: 250,
                            className: "lost-popup-container"
                        }
                    )
                    .addTo(
                        lostItemsLayer
                    );


            lostItemMarkers.set(
                report.key,
                marker
            );

        }
    );


    if (
        lostItemMarkers.size > 0
    ) {

        lostItemsMap.fitBounds(
            lostItemsLayer.getBounds(),
            {
                padding: [40, 40],
                maxZoom: 14
            }
        );

    } else {

        lostItemsMap.setView(
            YANBU_CENTER,
            YANBU_DEFAULT_ZOOM
        );

    }

}


function renderLostMapList(
    plotted
) {

    const list =
        document.getElementById(
            "lostMapList"
        );


    const count =
        document.getElementById(
            "lostMapCount"
        );


    if (
        !list ||
        !count
    ) {
        return;
    }


    count.textContent =
        plotted.length;


    if (
        plotted.length === 0
    ) {

        list.innerHTML = `
            <li class="lost-map-empty">
                لا توجد بلاغات فاقد حالياً.
            </li>
        `;

        return;

    }


    list.innerHTML =
        plotted.map(
            ({ report, position }) => `

                <li>

                    <button
                        type="button"
                        class="lost-map-list-item"
                        data-report-key="${report.key}"
                        ${position ? "" : "data-unmapped=\"true\""}
                    >

                        <span class="lost-map-list-icon">
                            ${categoryMapIcons[report.category] || "📍"}
                        </span>


                        <span class="lost-map-list-text">

                            <strong>
                                ${escapeHTML(report.itemType)}
                                -
                                ${escapeHTML(report.primaryColor || "")}
                            </strong>

                            <small>
                                #${report.id}
                                ·
                                ${escapeHTML(report.neighborhood || report.region || "بدون موقع")}
                            </small>

                        </span>


                        <span
                            class="
                                lost-map-precision
                                ${position ? (position.exact ? "exact" : "approx") : "none"}
                            "
                        >
                            ${position ? (position.exact ? "GPS" : "تقريبي") : "بدون موقع"}
                        </span>

                    </button>

                </li>

            `
        ).join("");


    list
        .querySelectorAll(
            ".lost-map-list-item"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const reportId =
                            button.dataset.reportKey;


                        const marker =
                            lostItemMarkers.get(
                                reportId
                            );


                        if (
                            !marker ||
                            !lostItemsMap
                        ) {

                            openReportDetails(
                                reportId
                            );

                            return;

                        }


                        const target =
                            marker.getLatLng();


                        const alreadyThere =
                            lostItemsMap.getZoom() === 15 &&
                            lostItemsMap
                                .getCenter()
                                .distanceTo(target) < 5;


                        document
                            .getElementById(
                                "lostItemsMap"
                            )
                            .scrollIntoView({
                                behavior: "smooth",
                                block: "nearest"
                            });


                        if (alreadyThere) {

                            marker.openPopup();

                            return;

                        }


                        lostItemsMap.once(
                            "moveend",
                            () => marker.openPopup()
                        );


                        lostItemsMap.flyTo(
                            target,
                            15,
                            {
                                duration: 0.6
                            }
                        );

                    }
                );

            }
        );

}


/* ======================================================
   SITE ANALYTICS (HOME)
====================================================== */

function renderAnalytics() {

    const total =
        reports.length;


    const lost =
        reports.filter(
            report =>
                report.type === "lost"
        );


    const found =
        reports.filter(
            report =>
                report.type === "found"
        );


    const completed =
        reports.filter(
            report =>
                report.status === "completed"
        ).length;


    const matched =
        reports.filter(
            report =>
                Number(report.bestMatch) > 0
        );


    const avgMatch =
        matched.length

            ? Math.round(
                matched.reduce(
                    (sum, report) =>
                        sum + Number(report.bestMatch),
                    0
                ) / matched.length
            )

            : 0;


    const strong =
        matched.filter(
            report =>
                report.bestMatch >= 85
        ).length;


    const pending =
        reports.filter(
            report =>
                report.status !== "completed" &&
                report.status !== "rejected"
        );


    const countStatus =
        status =>
            reports.filter(
                report =>
                    report.status === status
            ).length;


    setAnalyticsText(
        "kpiTotalReports",
        total
    );

    setAnalyticsText(
        "kpiTotalBreakdown",
        `${lost.length} فاقد · ${found.length} عاثر`
    );

    setAnalyticsText(
        "kpiReturnRate",
        `${percentOf(completed, total)}%`
    );

    setAnalyticsText(
        "kpiReturnBreakdown",
        `${completed} من ${total} بلاغ تم تسليمها`
    );

    setAnalyticsText(
        "kpiAvgMatch",
        `${avgMatch}%`
    );

    setAnalyticsText(
        "kpiAvgMatchNote",
        `${strong} تطابق قوي (85% فأكثر)`
    );

    setAnalyticsText(
        "kpiPending",
        pending.length
    );

    setAnalyticsText(
        "kpiPendingNote",
        `${countStatus("new")} جديد · ${countStatus("contact")} بانتظار التواصل`
    );


    renderActivityChart();

    renderStatusDonut();

    renderCategoryBars();

    renderNeighborhoodBars();

    renderMatchQualityBars();

    renderTypeSplit(
        lost.length,
        found.length
    );

    renderRegionSplit();

    renderRecentReports();

}


function setAnalyticsText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {
        element.textContent =
            value;
    }

}


function percentOf(
    value,
    total
) {

    return total

        ? Math.round(
            value / total * 100
        )

        : 0;

}


function toDateKey(
    date
) {

    return date
        .toISOString()
        .slice(0, 10);

}


function renderActivityChart() {

    const container =
        document.getElementById(
            "activityChart"
        );


    if (!container) {
        return;
    }


    const dates =
        reports
            .map(
                report =>
                    report.date
            )
            .filter(Boolean)
            .sort();


    if (
        dates.length === 0
    ) {

        container.innerHTML =
            `<p class="analytics-empty">لا توجد بيانات بعد.</p>`;

        return;

    }


    const daysCount =
        10;


    const latest =
        new Date(
            `${dates[dates.length - 1]}T00:00:00Z`
        );


    const days =
        Array.from(
            { length: daysCount },
            (_, index) => {

                const day =
                    new Date(latest);


                day.setUTCDate(
                    latest.getUTCDate() -
                    (daysCount - 1 - index)
                );


                const key =
                    toDateKey(day);


                const dayReports =
                    reports.filter(
                        report =>
                            report.date === key
                    );


                return {
                    key,
                    lost:
                        dayReports.filter(
                            report =>
                                report.type === "lost"
                        ).length,
                    found:
                        dayReports.filter(
                            report =>
                                report.type === "found"
                        ).length
                };

            }
        );


    const max =
        Math.max(
            1,
            ...days.map(
                day =>
                    Math.max(
                        day.lost,
                        day.found
                    )
            )
        );


    const labelFormatter =
        new Intl.DateTimeFormat(
            "ar-SA-u-ca-gregory",
            {
                day: "numeric",
                month: "short",
                timeZone: "UTC"
            }
        );


    const bar =
        (value, type) => `
            <span
                class="activity-bar ${type}"
                style="height:${Math.max(value / max * 100, value ? 8 : 0)}%"
            >
                ${value ? `<em>${value}</em>` : ""}
            </span>
        `;


    const periodTotal =
        days.reduce(
            (sum, day) =>
                sum + day.lost + day.found,
            0
        );


    container.innerHTML = `

        <div class="activity-bars">

            ${days.map(
                day => `

                    <div
                        class="activity-day"
                        title="${labelFormatter.format(new Date(`${day.key}T00:00:00Z`))}: ${day.lost} فاقد، ${day.found} عاثر"
                    >

                        <div class="activity-columns">
                            ${bar(day.lost, "lost")}
                            ${bar(day.found, "found")}
                        </div>

                        <small>
                            ${labelFormatter.format(new Date(`${day.key}T00:00:00Z`))}
                        </small>

                    </div>

                `
            ).join("")}

        </div>


        <p class="chart-footnote">
            آخر ${daysCount} أيام حتى
            ${formatDate(days[days.length - 1].key)}
            · ${periodTotal} بلاغ خلال الفترة
        </p>

    `;

}


function renderStatusDonut() {

    const container =
        document.getElementById(
            "statusDonut"
        );


    if (!container) {
        return;
    }


    const colors = {
        "new": "#3f78a0",
        "review": "#d4a24c",
        "strong-match": "#8a5cc2",
        "contact": "#e07b39",
        "verification": "#2f9e8f",
        "completed": "#176b59"
    };


    const total =
        reports.length;


    const segments =
        Object.keys(statusLabels)
            .map(
                status => ({
                    status,
                    count:
                        reports.filter(
                            report =>
                                report.status === status
                        ).length
                })
            )
            .filter(
                segment =>
                    segment.count > 0
            );


    let offset =
        0;


    const circles =
        segments.map(
            segment => {

                const share =
                    total
                        ? segment.count / total * 100
                        : 0;


                const circle = `
                    <circle
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="none"
                        stroke="${colors[segment.status] || "#9fa9b8"}"
                        stroke-width="6"
                        stroke-dasharray="${share} ${100 - share}"
                        stroke-dashoffset="${25 - offset}"
                    ></circle>
                `;


                offset +=
                    share;


                return circle;

            }
        ).join("");


    container.innerHTML = `

        <div class="donut-wrap">

            <svg
                viewBox="0 0 42 42"
                class="donut-svg"
                role="img"
                aria-label="توزيع حالات البلاغات"
            >

                <circle
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    stroke="#edf1f7"
                    stroke-width="6"
                ></circle>

                ${circles}

            </svg>


            <div class="donut-center">
                <strong>${total}</strong>
                <span>بلاغ</span>
            </div>

        </div>


        <ul class="donut-legend">

            ${segments.map(
                segment => `
                    <li>
                        <i style="background:${colors[segment.status] || "#9fa9b8"}"></i>
                        <span>${escapeHTML(statusLabels[segment.status])}</span>
                        <strong>${segment.count}</strong>
                        <small>${percentOf(segment.count, total)}%</small>
                    </li>
                `
            ).join("")}

        </ul>

    `;

}


function renderBarList(
    containerId,
    items,
    emptyText = "لا توجد بيانات بعد."
) {

    const container =
        document.getElementById(
            containerId
        );


    if (!container) {
        return;
    }


    if (
        items.length === 0
    ) {

        container.innerHTML =
            `<p class="analytics-empty">${escapeHTML(emptyText)}</p>`;

        return;

    }


    const max =
        Math.max(
            1,
            ...items.map(
                item =>
                    item.total
            )
        );


    container.innerHTML =
        items.map(
            item => `

                <div class="bar-row">

                    <div class="bar-row-head">

                        <span>
                            ${escapeHTML(item.label)}
                            ${item.note ? `<small>${escapeHTML(item.note)}</small>` : ""}
                        </span>

                        <strong>${item.total}</strong>

                    </div>


                    <div class="bar-track">

                        ${item.segments.map(
                            segment => `
                                <span
                                    class="bar-fill ${segment.className}"
                                    style="width:${segment.value / max * 100}%"
                                    title="${escapeHTML(segment.title || "")}"
                                ></span>
                            `
                        ).join("")}

                    </div>

                </div>

            `
        ).join("");

}


function groupReportsBy(
    getKey
) {

    const groups =
        new Map();


    reports.forEach(
        report => {

            const key =
                getKey(report);


            if (!key) {
                return;
            }


            if (
                !groups.has(key)
            ) {

                groups.set(
                    key,
                    []
                );

            }


            groups
                .get(key)
                .push(report);

        }
    );


    return [...groups.entries()]
        .map(
            ([key, items]) => ({
                key,
                items,
                lost:
                    items.filter(
                        report =>
                            report.type === "lost"
                    ).length,
                found:
                    items.filter(
                        report =>
                            report.type === "found"
                    ).length
            })
        )
        .sort(
            (a, b) =>
                b.items.length -
                a.items.length
        );

}


function lostFoundSegments(
    group
) {

    return [
        {
            value: group.lost,
            className: "lost",
            title: `${group.lost} فاقد`
        },
        {
            value: group.found,
            className: "found",
            title: `${group.found} عاثر`
        }
    ];

}


function renderCategoryBars() {

    renderBarList(
        "categoryBars",
        groupReportsBy(
            report =>
                report.category
        )
            .slice(0, 6)
            .map(
                group => ({
                    label: group.key,
                    total: group.items.length,
                    segments:
                        lostFoundSegments(group)
                })
            )
    );

}


function renderNeighborhoodBars() {

    renderBarList(
        "neighborhoodBars",
        groupReportsBy(
            report =>
                report.neighborhood
        )
            .slice(0, 6)
            .map(
                group => ({
                    label: group.key,
                    note: group.items[0].region,
                    total: group.items.length,
                    segments:
                        lostFoundSegments(group)
                })
            )
    );

}


function renderMatchQualityBars() {

    const buckets = [
        {
            label: "تطابق ممتاز",
            note: "90% فأكثر",
            className: "quality-excellent",
            test: score => score >= 90
        },
        {
            label: "تطابق قوي",
            note: "بين 80 و89%",
            className: "quality-strong",
            test: score => score >= 80 && score < 90
        },
        {
            label: "تطابق محتمل",
            note: "بين 65 و79%",
            className: "quality-possible",
            test: score => score >= 65 && score < 80
        },
        {
            label: "تطابق ضعيف",
            note: "أقل من 65%",
            className: "quality-weak",
            test: score => score > 0 && score < 65
        },
        {
            label: "بدون تطابق",
            note: "",
            className: "quality-none",
            test: score => !score
        }
    ];


    renderBarList(
        "matchQualityBars",
        buckets.map(
            bucket => {

                const count =
                    reports.filter(
                        report =>
                            bucket.test(
                                Number(report.bestMatch) || 0
                            )
                    ).length;


                return {
                    label: bucket.label,
                    note: bucket.note,
                    total: count,
                    segments: [
                        {
                            value: count,
                            className: bucket.className
                        }
                    ]
                };

            }
        )
    );

}


function renderSplitBar(
    containerId,
    parts,
    footer = ""
) {

    const container =
        document.getElementById(
            containerId
        );


    if (!container) {
        return;
    }


    const total =
        parts.reduce(
            (sum, part) =>
                sum + part.value,
            0
        );


    container.innerHTML = `

        <div class="split-bar">

            ${parts.map(
                part => `
                    <span
                        class="split-fill ${part.className}"
                        style="flex-grow:${part.value || 0.0001}"
                    ></span>
                `
            ).join("")}

        </div>


        <div class="split-legend">

            ${parts.map(
                part => `
                    <div>
                        <span>
                            <i class="legend-swatch ${part.className}"></i>
                            ${escapeHTML(part.label)}
                        </span>
                        <strong>${percentOf(part.value, total)}%</strong>
                        <small>${part.value} بلاغ</small>
                    </div>
                `
            ).join("")}

        </div>


        ${footer}

    `;

}


function renderTypeSplit(
    lostCount,
    foundCount
) {

    const lostOpen =
        reports.filter(
            report =>
                report.type === "lost" &&
                report.status !== "completed"
        ).length;


    renderSplitBar(
        "typeSplit",
        [
            {
                label: "فاقد",
                value: lostCount,
                className: "lost"
            },
            {
                label: "عاثر",
                value: foundCount,
                className: "found"
            }
        ],
        `
            <p class="chart-footnote">
                ${lostOpen} بلاغ فاقد لم يُسلَّم بعد
            </p>
        `
    );

}


function renderRegionSplit() {

    const groups =
        groupReportsBy(
            report =>
                report.region
        );


    const withGps =
        reports.filter(
            report =>
                report.latitude &&
                report.longitude
        ).length;


    renderSplitBar(
        "regionSplit",
        groups.map(
            (group, index) => ({
                label: group.key,
                value: group.items.length,
                className: `region-${index % 3}`
            })
        ),
        `
            <p class="chart-footnote">
                ${withGps} من ${reports.length} بلاغ بموقع GPS دقيق
            </p>
        `
    );

}


function renderRecentReports() {

    const list =
        document.getElementById(
            "recentReports"
        );


    if (!list) {
        return;
    }


    const recent =
        [...reports]
            .sort(
                (a, b) =>
                    `${b.date} ${b.time || ""}`
                        .localeCompare(
                            `${a.date} ${a.time || ""}`
                        )
            )
            .slice(0, 5);


    list.innerHTML =
        recent.map(
            report => `

                <li>

                    <button
                        type="button"
                        class="recent-report"
                        data-report-key="${report.key}"
                    >

                        <span
                            class="
                                report-type-badge
                                ${report.type}
                            "
                        >
                            ${report.type === "lost" ? "فاقد" : "عاثر"}
                        </span>


                        <span class="recent-report-text">

                            <strong>
                                ${escapeHTML(report.itemType)}
                                -
                                ${escapeHTML(report.primaryColor || "")}
                            </strong>

                            <small>
                                #${report.id}
                                ·
                                ${escapeHTML(report.neighborhood || report.region || "")}
                                ·
                                ${formatDate(report.date)}
                            </small>

                        </span>


                        <span
                            class="
                                status-badge
                                status-${escapeHTML(report.status)}
                            "
                        >
                            ${escapeHTML(statusLabels[report.status] || report.status)}
                        </span>

                    </button>

                </li>

            `
        ).join("");


    list
        .querySelectorAll(
            ".recent-report"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () =>
                        openReportDetails(
                            button.dataset.reportKey
                        )
                );

            }
        );

}


/* ======================================================
   HELPERS
====================================================== */

function analysisBox(
    label,
    value
) {

    return `

        <div class="analysis-item">

            <span>
                ${label}
            </span>

            <strong>
                ${value === null || value === undefined ? "—" : `${value}%`}
            </strong>

        </div>

    `;

}


function detailBox(
    label,
    value,
    full = false
) {

    return `

        <div
            class="
                detail-box
                ${full ? "full-detail" : ""}
            "
        >

            <span>
                ${escapeHTML(label)}
            </span>

            <strong>
                ${escapeHTML(
                    String(
                        value ?? "-"
                    )
                )}
            </strong>

        </div>

    `;

}


function getMatchStrength(
    score
) {

    if (
        score >= 90
    ) {

        return "تطابق ممتاز";

    }


    if (
        score >= 80
    ) {

        return "تطابق قوي";

    }


    if (
        score >= 65
    ) {

        return "تطابق محتمل";

    }


    return "تطابق ضعيف";

}


function formatDate(
    date
) {

    if (!date) {
        return "-";
    }


    const value =
        new Date(
            `${date}T00:00:00`
        );


    return value.toLocaleDateString(
        "ar-SA",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );

}


function normalizeSaudiPhone(
    phone
) {

    let clean =
        String(phone)
            .replace(/\D/g, "");


    if (
        clean.startsWith("05")
    ) {

        clean =
            "966" +
            clean.substring(1);

    }


    if (
        clean.startsWith("5") &&
        clean.length === 9
    ) {

        clean =
            "966" +
            clean;

    }


    return clean;

}


let toastTimeout;


function showToast(
    message
) {

    const toast =
        document.getElementById(
            "adminToast"
        );


    clearTimeout(
        toastTimeout
    );


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    toastTimeout =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2500
        );

}


function escapeHTML(
    value
) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}