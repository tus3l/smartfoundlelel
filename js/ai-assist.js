"use strict";

/*
 * AI helpers for lost-report.html and found-report.html.
 * Relies on globals from the page script: reportData, currentStep, itemTypes,
 * selectCategory, renderDynamicFields, updateStepUI, handleImageSelected, showToast.
 */
(() => {

    const API = "../backend/api/ai/";
    const isFound = document.body.classList.contains("found-report-page") ||
        reportData.reportType === "found";
    const reportType = isFound ? "found" : "lost";

    // Gemini/OpenAI downscale images anyway; sending ≤768px keeps upload and token cost low.
    const MAX_IMAGE_SIDE = 768;
    const REPORT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

    const brandSelectId = isFound ? "phoneBrand" : "deviceBrand";
    const customBrandId = isFound ? "customBrandInput" : "customBrand";


    /* ---------- helpers ---------- */

    async function postAI(endpoint, body) {
        const isForm = body instanceof FormData;

        let response;

        try {
            response = await fetch(API + endpoint, {
                method: "POST",
                credentials: "include",
                headers: isForm ? undefined : { "Content-Type": "application/json" },
                body: isForm ? body : JSON.stringify(body)
            });
        } catch {
            throw new Error("تعذر الاتصال، تأكد من الإنترنت وحاول مرة أخرى.");
        }

        let data = {};

        try {
            data = await response.json();
        } catch {
            // Non-JSON error page.
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "تعذر الوصول لخدمة الذكاء الاصطناعي.");
        }

        return data;
    }


    async function shrinkImage(file) {
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
            const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement("canvas");

            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close?.();

            const blob = await new Promise((resolve) =>
                canvas.toBlob(resolve, "image/jpeg", 0.82)
            );

            return blob || file;
        } catch {
            return file;
        }
    }


    function setFieldValue(id, value) {
        const field = document.getElementById(id);

        if (field && value) {
            field.value = value;
        }

        return field;
    }


    function pickColor(containerId, name) {
        if (!name) {
            return;
        }

        const option = [...document.querySelectorAll(`#${containerId} .color-option`)]
            .find((button) => button.textContent.trim() === name);

        option?.click();
    }


    // Non-phone items have no brand/model inputs, so add them when the AI detected one.
    function ensureBrandModelFields() {
        if (document.getElementById("deviceModel")) {
            return;
        }

        const extra = document.createElement("div");

        extra.className = "extra-dynamic";
        extra.innerHTML = `
            <div class="dynamic-field">
                <label for="${customBrandId}">الشركة / الماركة</label>
                <input id="${customBrandId}" type="text" placeholder="مثال: Samsung">
            </div>
            <div class="dynamic-field">
                <label for="deviceModel">الموديل</label>
                <input id="deviceModel" type="text" placeholder="مثال: Galaxy Buds2">
            </div>
        `;

        document.getElementById("dynamicFields").appendChild(extra);
    }


    function fillBrandModel(brand, model) {
        if (!brand && !model) {
            return;
        }

        const select = document.getElementById(brandSelectId);

        if (select && brand) {
            const option = [...select.options]
                .find((item) => item.value.toLowerCase() === brand.toLowerCase());

            select.value = option ? option.value : "other";
            select.dispatchEvent(new Event("change"));

            if (!option) {
                setFieldValue(customBrandId, brand);
                reportData.customBrand = brand;
            }
        } else if (!select) {
            ensureBrandModelFields();
            setFieldValue(customBrandId, brand);
            reportData.customBrand = brand || null;
        }

        setFieldValue("deviceModel", model);
        reportData.model = model || null;
    }


    // Re-rendering step 2 recreates the inputs, so put back brand/model the user (or AI) already gave.
    const originalRenderDynamicFields = renderDynamicFields;

    renderDynamicFields = function () {
        originalRenderDynamicFields();

        const brand = reportData.customBrand ||
            (reportData.brand && reportData.brand !== "other" ? reportData.brand : null);

        if (brand || reportData.model) {
            fillBrandModel(brand, reportData.model);
        }
    };


    /* ---------- 1) Photo → auto-fill ---------- */

    const snap = document.createElement("div");

    snap.className = "ai-snap";
    snap.innerHTML = `
        <div class="ai-snap-text">
            <span class="ai-badge">✨ ذكاء اصطناعي</span>
            <strong>${isFound ? "صوّر الغرض اللي لقيته ونعبّي البيانات عنك" : "عندك صورة للغرض؟ ارفعها ونعبّي البيانات عنك"}</strong>
            <small>نتعرّف على القسم والنوع والشركة والموديل واللون، ونكتب لك وصفاً دقيقاً تراجعه قبل الإرسال.</small>
        </div>
        <div class="ai-snap-actions">
            <button type="button" class="ai-snap-button" data-ai-source="camera">📷 تصوير الغرض</button>
            <button type="button" class="ai-snap-button secondary" data-ai-source="gallery">🖼️ من المعرض</button>
        </div>
        <input type="file" accept="image/*" capture="environment" hidden data-ai-input="camera">
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-ai-input="gallery">
        <div class="ai-snap-status" role="status" aria-live="polite"></div>
    `;

    const stepOne = document.querySelector('.form-step[data-step="1"]');

    stepOne.querySelector(".category-finder").before(snap);

    const snapStatus = snap.querySelector(".ai-snap-status");
    const snapButtons = snap.querySelectorAll(".ai-snap-button");


    function setSnapState(state, message = "") {
        snap.dataset.state = state;
        snapStatus.textContent = message;
        snapButtons.forEach((button) => {
            button.disabled = state === "loading";
        });
    }


    snapButtons.forEach((button) => {
        button.addEventListener("click", () => {
            snap.querySelector(`[data-ai-input="${button.dataset.aiSource}"]`).click();
        });
    });


    snap.querySelectorAll("[data-ai-input]").forEach((input) => {
        input.addEventListener("change", async () => {
            const file = input.files[0];

            input.value = "";

            if (!file) {
                return;
            }

            setSnapState("loading", "جاري التعرف على الغرض...");

            try {
                const image = await shrinkImage(file);
                const form = new FormData();

                form.append("image", image, "item.jpg");
                form.append("reportType", reportType);

                const { result } = await postAI("identify.php", form);

                applyIdentification(result, file, image, input.dataset.aiInput);
                setSnapState("done", "تم التعرف على الغرض ✓");
            } catch (error) {
                setSnapState("error", error.message);
            }
        });
    });


    function attachReportImage(originalFile, shrunkImage, source) {
        const usable = ["image/jpeg", "image/png", "image/webp"].includes(originalFile.type) &&
            originalFile.size <= REPORT_IMAGE_MAX_BYTES;

        const file = usable
            ? originalFile
            : new File([shrunkImage], "item.jpg", { type: "image/jpeg" });

        handleImageSelected({ target: { files: [file] } });

        reportData.photoMethod = source;

        document.querySelectorAll(".photo-option").forEach((option) => {
            option.classList.toggle("selected", option.dataset.photo === source);
        });
    }


    function applyIdentification(result, originalFile, shrunkImage, source) {
        const card = document.querySelector(`.category-card[data-category="${result.category}"]`);
        const categoryName = card?.dataset.name || "غير ذلك";
        const type = (itemTypes[result.category] || []).find(([value]) => value === result.itemType);

        reportData.brand = null;
        reportData.customBrand = null;
        reportData.model = null;

        selectCategory(result.category, categoryName, type?.[0] ?? null, type?.[1] ?? null);

        attachReportImage(originalFile, shrunkImage, source);

        currentStep = 2;
        renderDynamicFields();
        fillBrandModel(result.brand, result.model);

        pickColor("primaryColors", result.primaryColor);
        pickColor("secondaryColors", result.secondaryColor);

        const marks = document.getElementById("distinctiveMarks");

        if (result.privateMarks && marks && !marks.value.trim()) {
            marks.value = result.privateMarks;
        }

        const description = document.getElementById("itemDescription");

        if (result.description && description) {
            description.value = result.description;
            reportData.description = result.description;
        }

        showFilledNotice(result.confidence);
        updateStepUI();
    }


    function showFilledNotice(confidence) {
        document.querySelector(".ai-filled-notice")?.remove();

        const percent = Math.round((confidence ?? 0) * 100);
        const notice = document.createElement("div");

        notice.className = "ai-filled-notice" + (percent < 60 ? " low" : "");
        notice.setAttribute("role", "status");
        notice.innerHTML = `
            <span aria-hidden="true">✨</span>
            <div>
                <strong>عبّينا البيانات تلقائياً من الصورة${percent ? ` (ثقة ${percent}%)` : ""}</strong>
                <small>${percent < 60
                    ? "التعرف غير مؤكد، راجع القسم والنوع جيداً وعدّل اللازم."
                    : "راجع البيانات وعدّل أي شيء قبل المتابعة. الوصف والصورة جاهزة في الخطوة 3."}</small>
            </div>
        `;

        document
            .querySelector('.form-step[data-step="2"] .step-heading')
            .after(notice);
    }


    /* ---------- 2) Improve description (text only) ---------- */

    const descriptionField = document.getElementById("itemDescription");

    const describeBar = document.createElement("div");

    describeBar.className = "ai-describe";
    describeBar.innerHTML = `
        <button type="button" class="ai-describe-button">✨ حسّن الوصف بالذكاء الاصطناعي</button>
        <button type="button" class="ai-undo-button" hidden>↩ تراجع</button>
        <small class="ai-describe-hint">يقرأ اختياراتك ووصفك فقط ويكتب وصفاً أوضح وأدق.</small>
    `;

    descriptionField.after(describeBar);

    const describeButton = describeBar.querySelector(".ai-describe-button");
    const undoButton = describeBar.querySelector(".ai-undo-button");
    const describeHint = describeBar.querySelector(".ai-describe-hint");
    let previousDescription = null;


    describeButton.addEventListener("click", async () => {
        const text = descriptionField.value.trim();

        if (!reportData.category && !text) {
            showToast("اختر الغرض أو اكتب وصفاً مختصراً أولاً.");
            return;
        }

        describeButton.disabled = true;
        describeButton.classList.add("loading");
        describeButton.textContent = "جاري تحسين الوصف...";

        try {
            const { description } = await postAI("describe.php", {
                reportType,
                categoryName: reportData.categoryName,
                itemTypeName: reportData.itemType === "other" ? null : reportData.itemTypeName,
                breed: reportData.customBreed || reportData.breed,
                brand: reportData.customBrand ||
                    (reportData.brand && reportData.brand !== "other" ? reportData.brand : null),
                model: reportData.model,
                primaryColor: reportData.primaryColor,
                secondaryColor: reportData.secondaryColor,
                description: text
            });

            previousDescription = descriptionField.value;
            descriptionField.value = description;
            reportData.description = description;
            undoButton.hidden = false;
            describeHint.textContent = "تم تحسين الوصف ✓ راجعه وعدّله إذا احتجت.";
        } catch (error) {
            showToast(error.message);
        } finally {
            describeButton.disabled = false;
            describeButton.classList.remove("loading");
            describeButton.textContent = "✨ حسّن الوصف بالذكاء الاصطناعي";
        }
    });


    undoButton.addEventListener("click", () => {
        if (previousDescription === null) {
            return;
        }

        descriptionField.value = previousDescription;
        reportData.description = previousDescription;
        previousDescription = null;
        undoButton.hidden = true;
        describeHint.textContent = "يقرأ اختياراتك ووصفك فقط ويكتب وصفاً أوضح وأدق.";
    });

})();
