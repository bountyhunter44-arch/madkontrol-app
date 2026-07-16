/**
 * Cooling Control UI Module for Rutiner
 * Handles cooling task rendering, state management, and submission
 */

/**
 * Render cooling control UI for a task
 * @param {Object} task - Task instance
 * @returns {string} HTML for cooling control
 */
function renderCoolingControlUI(task) {
    const coolingState = task.coolingState || {};
    const isInProgress = coolingState.status === "cooling";
    const instanceId = task.id;

    return `
        <div class="cooling-control-container" data-cooling-task="${instanceId}">
            ${isInProgress ? renderCoolingInProgress(task, coolingState) : renderCoolingStart(task)}
        </div>
    `;
}

/**
 * Render start cooling UI
 */
function renderCoolingStart(task) {
    const instanceId = task.id;
    
    return `
        <div class="cooling-start-form">
            <div class="routine-form-grid">
                <div>
                    <label class="form-label">Produktnavn</label>
                    <input
                        type="text"
                        class="task-input"
                        data-field="productName"
                        data-instance-id="${escapeHtml(instanceId)}"
                        placeholder="fx Lasagne, Kødsovs"
                        required
                    >
                </div>

                <div>
                    <label class="form-label">Produktkategori</label>
                    <select
                        class="task-input"
                        data-field="productCategory"
                        data-instance-id="${escapeHtml(instanceId)}"
                        required
                    >
                        <option value="">Vælg kategori</option>
                        <option value="hot_dish">Varm ret</option>
                        <option value="sauce">Sovs</option>
                        <option value="soup">Suppe</option>
                        <option value="stew">Gryderet</option>
                        <option value="meat">Kød</option>
                        <option value="poultry">Fjerkræ</option>
                        <option value="fish">Fisk</option>
                        <option value="vegetables">Grøntsager</option>
                        <option value="rice_pasta">Ris/Pasta</option>
                        <option value="other">Andet</option>
                    </select>
                </div>

                <div>
                    <label class="form-label">Starttemperatur (°C)</label>
                    <input
                        type="number"
                        step="0.5"
                        class="task-input"
                        data-field="startTemp"
                        data-instance-id="${escapeHtml(instanceId)}"
                        placeholder="fx 72"
                        required
                    >
                    <small style="color:#666;font-size:11px;">Skal være minimum 65°C</small>
                </div>

                <div>
                    <label class="form-label">Beholder type</label>
                    <select
                        class="task-input"
                        data-field="containerType"
                        data-instance-id="${escapeHtml(instanceId)}"
                    >
                        <option value="">Vælg beholder</option>
                        <option value="shallow_pan">Flad pande</option>
                        <option value="deep_pot">Dyb gryde</option>
                        <option value="gastronorm_half">Gastronorm 1/2</option>
                        <option value="gastronorm_full">Gastronorm 1/1</option>
                        <option value="plastic_container">Plastbeholder</option>
                        <option value="metal_container">Metalbeholder</option>
                        <option value="individual_portions">Individuelle portioner</option>
                        <option value="other">Andet</option>
                    </select>
                </div>

                <div>
                    <label class="form-label">Nedkølingsmetode</label>
                    <select
                        class="task-input"
                        data-field="coolingMethod"
                        data-instance-id="${escapeHtml(instanceId)}"
                        required
                    >
                        <option value="">Vælg metode</option>
                        <option value="small_containers">Små beholdere</option>
                        <option value="ice_bath">Isbad</option>
                        <option value="blast_chiller">Blast chiller</option>
                        <option value="cold_running_water">Rindende koldt vand</option>
                        <option value="fridge">Køleskab</option>
                        <option value="walk_in_cooler">Walk-in køler</option>
                        <option value="stirring">Omrøring</option>
                        <option value="ice_wand">Ice wand</option>
                        <option value="combination">Kombination</option>
                        <option value="other">Andet</option>
                    </select>
                </div>

                <div>
                    <label class="form-label">Batchstørrelse</label>
                    <select
                        class="task-input"
                        data-field="batchSize"
                        data-instance-id="${escapeHtml(instanceId)}"
                        required
                    >
                        <option value="">Vælg størrelse</option>
                        <option value="lt_1kg">Under 1 kg</option>
                        <option value="kg_1_3">1-3 kg</option>
                        <option value="kg_3_5">3-5 kg</option>
                        <option value="kg_5_10">5-10 kg</option>
                        <option value="gt_10kg">Over 10 kg</option>
                    </select>
                </div>
            </div>

            <div style="margin-top:16px;padding:12px;background:#e8f4f8;border:1px solid #b3d9e6;border-radius:8px;">
                <div style="font-weight:700;font-size:13px;color:#0c5460;margin-bottom:6px;">ℹ️ 4-timers regel</div>
                <div style="font-size:12px;color:#0c5460;line-height:1.5;">
                    Fødevaren skal nedkøles fra minimum <strong>65°C til maksimum 10°C</strong> inden for <strong>4 timer (240 minutter)</strong>.
                    Brug aktive nedkølingsmetoder for store portioner.
                </div>
            </div>

            <button
                type="button"
                class="btn btn-primary"
                data-action="start_cooling"
                data-instance-id="${escapeHtml(instanceId)}"
                style="width:100%;margin-top:16px;"
            >
                Start nedkøling
            </button>
        </div>
    `;
}

/**
 * Render in-progress cooling UI
 */
function renderCoolingInProgress(task, coolingState) {
    const instanceId = task.id;
    const startTime = new Date(coolingState.startTime);
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 60000);
    const remaining = Math.max(0, 180 - elapsed);
    
    const progressPercent = Math.min(100, (elapsed / 180) * 100);
    const isOverdue = elapsed > 180;

    return `
        <div class="cooling-in-progress">
            <div style="padding:16px;background:#fff3cd;border:1px solid #ffc107;border-radius:8px;margin-bottom:16px;">
                <div style="font-weight:700;font-size:14px;color:#856404;margin-bottom:8px;">
                    ⏱️ Nedkøling i gang: ${escapeHtml(coolingState.productName || "Produkt")}
                </div>
                <div style="font-size:12px;color:#856404;margin-bottom:12px;">
                    Starttemperatur: <strong>${coolingState.startTemp}°C</strong> kl. ${startTime.toLocaleTimeString('da-DK', {hour: '2-digit', minute: '2-digit'})}
                </div>
                
                <div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:#856404;margin-bottom:4px;">
                        <span>Forløbet tid: ${elapsed} min</span>
                        <span>${isOverdue ? 'OVERSKREDET!' : `${remaining} min tilbage`}</span>
                    </div>
                    <div style="height:8px;background:#f0e5c9;border-radius:4px;overflow:hidden;">
                        <div style="height:100%;background:${isOverdue ? '#dc3545' : '#28a745'};width:${progressPercent}%;transition:width 0.3s;"></div>
                    </div>
                </div>
            </div>

            <div class="routine-form-grid">
                <div>
                    <label class="form-label">Sluttemperatur (°C)</label>
                    <input
                        type="number"
                        step="0.5"
                        class="task-input"
                        data-field="endTemp"
                        data-instance-id="${escapeHtml(instanceId)}"
                        placeholder="fx 8"
                        required
                    >
                    <small style="color:#666;font-size:11px;">Skal være maksimum 10°C</small>
                </div>

                <div style="grid-column:1 / -1;">
                    <label class="form-label">Kommentar (valgfrit)</label>
                    <textarea
                        class="task-input"
                        data-field="coolingNote"
                        data-instance-id="${escapeHtml(instanceId)}"
                        placeholder="Evt. bemærkninger om nedkølingsprocessen"
                        rows="2"
                    ></textarea>
                </div>
            </div>

            <button
                type="button"
                class="btn btn-primary"
                data-action="complete_cooling"
                data-instance-id="${escapeHtml(instanceId)}"
                style="width:100%;margin-top:16px;"
            >
                Afslut nedkøling
            </button>
        </div>
    `;
}

/**
 * Handle start cooling action
 */
async function handleStartCooling(instanceId) {
    const productName = getInputValue(instanceId, "productName");
    const productCategory = getInputValue(instanceId, "productCategory");
    const startTemp = parseFloat(getInputValue(instanceId, "startTemp"));
    const containerType = getInputValue(instanceId, "containerType");
    const coolingMethod = getInputValue(instanceId, "coolingMethod");
    const batchSize = getInputValue(instanceId, "batchSize");

    // Validation
    if (!productName || !productName.trim()) {
        throw new Error("Produktnavn er påkrævet");
    }
    if (!startTemp || isNaN(startTemp)) {
        throw new Error("Starttemperatur er påkrævet");
    }
    if (startTemp < 65) {
        throw new Error("Starttemperatur skal være minimum 65°C");
    }
    if (!productCategory) {
        throw new Error("Produktkategori er påkrævet");
    }
    if (!coolingMethod) {
        throw new Error("Nedkølingsmetode er påkrævet");
    }
    if (!batchSize) {
        throw new Error("Batchstørrelse er påkrævet");
    }

    const startTime = new Date().toISOString();

    // Update task instance with cooling state
    await updateDoc(doc(db, "task_instances", instanceId), {
        status: "in_progress",
        coolingState: {
            productName: productName.trim(),
            productCategory,
            startTemp,
            startTime,
            containerType: containerType || null,
            coolingMethod,
            batchSize,
            status: "cooling"
        },
        updatedAt: serverTimestamp()
    });

    // Reload tasks to show updated UI
    await loadTasks();
    renderTasks();
}

/**
 * Handle complete cooling action
 */
async function handleCompleteCooling(instanceId) {
    const task = allTasks.find(t => t.id === instanceId);
    if (!task || !task.coolingState) {
        throw new Error("Nedkølingsdata ikke fundet");
    }

    const endTemp = parseFloat(getInputValue(instanceId, "endTemp"));
    const coolingNote = getInputValue(instanceId, "coolingNote") || "";

    // Validation
    if (!endTemp || isNaN(endTemp)) {
        throw new Error("Sluttemperatur er påkrævet");
    }

    const endTime = new Date().toISOString();

    // Call backend to complete with evaluation
    const completeTaskEntry = httpsCallable(functions, "completeTaskEntryWithCooling");
    
    const result = await completeTaskEntry({
        taskInstanceId: instanceId,
        companyId: SETTINGS.companyId,
        locationId: SETTINGS.locationId,
        employeeId: SETTINGS.employeeId,
        employeeName: SETTINGS.employeeName,
        startTemp: task.coolingState.startTemp,
        endTemp,
        startTime: task.coolingState.startTime,
        endTime,
        productName: task.coolingState.productName,
        productCategory: task.coolingState.productCategory,
        batchSize: task.coolingState.batchSize,
        containerType: task.coolingState.containerType,
        coolingMethod: task.coolingState.coolingMethod,
        dateKey: task.dateKey,
        note: coolingNote,
        photoUrls: task.photoUrls || [],
        cloudinaryAssets: task.cloudinaryAssets || []
    });

    const entry = result.data;

    // Show result
    if (entry.evaluation.passed) {
        alert(`✅ Nedkøling godkendt!\n\n${entry.evaluation.summary}`);
    } else {
        alert(`❌ Nedkøling ikke godkendt\n\n${entry.evaluation.summary}\n\nAfvigelse er oprettet automatisk.`);
    }

    // Reload tasks
    await loadTasks();
    renderTasks();
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderCoolingControlUI,
        handleStartCooling,
        handleCompleteCooling
    };
}
