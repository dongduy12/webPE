// ==============================
// SweetAlert Helpers
// ==============================
function showLoading(msg = "Processing...") {
    Swal.fire({
        title: msg,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });
}

function showSuccess(msg) {
    Swal.fire({ icon: "success", title: "Success", html: msg });
}

function showError(msg) {
    Swal.fire({ icon: "error", title: "Error", html: msg });
}

function showWarning(msg) {
    Swal.fire({ icon: "warning", title: "Warning", html: msg });
}

const SCRAP_API_BASE = "https://pe-vnmbd-nvidia-cns.myfiinet.com/api/Scrap";

function parseSerialInput(textareaId) {
    return document.getElementById(textareaId).value.trim()
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean);
}

// ==============================
// CALL SMARTREPAIR API - PHIÊN BẢN CHẮN CHẮN 100% (2025)
// ==============================
async function callSmartRepair(snList, status, task = "") {
    const payload = {
        type: "update",
        sn_list: snList.join(","),
        type_bp: "",
        status,
        task
    };

    try {
        const res = await fetch("https://sfc-portal.cns.myfiinet.com/SfcSmartRepair/api/repair_scrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const text = await res.text();

        // CHỈ CHẤP NHẬN DUY NHẤT CHUỖI '"OK"' (có dấu nháy kép) LÀ THÀNH CÔNG
        if (text === '"OK"') {
            return { success: true, raw: text };
        }

        // MỌI TRƯỜNG HỢP KHÁC (kể cả HTTP 200) ĐỀU LÀ LỖI
        let cleanMsg = text
            .replace(/^"|"$/g, '')   // bỏ dấu " ở đầu/cuối
            .trim();
        if (!cleanMsg) cleanMsg = "SmartRepair rejected the request";

        return { success: false, message: cleanMsg, raw: text };

    } catch (err) {
        return { success: false, message: "Không kết nối được SmartRepair system!" };
    }
}


// ==============================
// INPUT SN
// ==============================
async function handleInputSN() {

    const snLines = document.getElementById("sn-input").value.trim().split(/\r?\n/);
    const sNs = snLines.map(x => x.trim()).filter(Boolean);

    const description = document.getElementById("description-input").value.trim();
    const approveScrapPerson = document.getElementById("NVmember-input").value.trim();
    const purpose = document.getElementById("Scrap-options").value;
    const speApproveTime = document.getElementById("speApproveTime-input").value;
    const createdBy = document.getElementById("analysisPerson").value;
    const reasonRemove = document.getElementById("reason-remove").value;

    // =======================
    // VALIDATION
    // =======================
    if (!sNs.length) return showWarning("Please enter SN!");
    if (!description) return showWarning("Please enter description!");
    if (!approveScrapPerson) return showWarning("Please enter the approver!");
    if (!["0", "1", "2", "3", "4"].includes(purpose)) return showWarning("Please select the scrap type!");
    if (!speApproveTime) return showWarning("Please enter the approval time!");
    if (!reasonRemove) return showWarning("Please enter the reason remove!");

    // =======================
    // CALL SMARTREPAIR FIRST
    // =======================
    showLoading("Synchronizing SmartRepair...");

    const smart = await callSmartRepair(sNs, "0");

    if (!smart.success) {
        return showError("SmartRepair error:<br>" + smart.message);
    }

    // =======================
    // CALL INPUT-SN SQL SERVER
    // =======================
    showLoading("Saving information to SQL Server...");

    const payload = {
        sNs,
        createdBy,
        description,
        approveScrapPerson,
        purpose,
        speApproveTime
    };

    try {
        const res = await fetch("https://pe-vnmbd-nvidia-cns.myfiinet.com/api/Scrap/input-sn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!res.ok) {
            return showError("Input-SN error:<br>" + result.message);
        }

        // =======================
        // DONE — NO UPDATE PRODUCT CALL
        // =======================
        showSuccess(`
            <b>Input SN success!</b><br>
            SmartRepair: OK<br>
            SQL Input-SN: ${result.message}
        `);

    } catch (err) {
        showError("Cannot connect to SQL Server!");
    }
}

// ==============================
// UPDATE TASK PO
// ==============================
async function handleUpdateTaskPO() {

    const snList = document.getElementById("sn-input-update").value.trim().split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const task = document.getElementById("task-input").value.trim();
    const po = document.getElementById("po-input").value.trim();

    if (!snList.length) return showWarning("Please enter SN.");
    if (!task) return showWarning("Please enter Task.");
    if (!po) return showWarning("Please enter PO");

    // =======================
    // CALL SMARTREPAIR FIRST
    // =======================
    showLoading("Checking ApplyTaskStatus...");
    try {
        const statusRes = await fetch(`${SCRAP_API_BASE}/detail-task-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ SNs: snList })
        });

        const statusResult = await statusRes.json();

        if (!statusRes.ok) {
            return showError("Error:<br>" + (statusResult.message || ""));
        }

        const invalidSNs = (statusResult.data || [])
            .filter(item => item.applyTaskStatus !== 20)
            .map(item => item.sn || item.SN)
            .filter(Boolean);

        if (invalidSNs.length) {
            return showError(`Only update when Task/PO khi Cost approved (ApplyTaskStatus = 20)<br>Invalid SN: ${invalidSNs.join(", ")}`);
        }
    } catch (err) {
        return showError("Cannot check ApplyTaskStatus");
    }

    const smart = await callSmartRepair(snList, "5", task);

    if (!smart.success) {
        return showError("SmartRepair error:<br>" + smart.message);
    }

    // =======================
    // CALL SQL UPDATE TASK PO
    // =======================
    showLoading("Đang cập nhật Task/PO...");

    try {
        const payload = { snList, task, po };

        const res = await fetch("https://pe-vnmbd-nvidia-cns.myfiinet.com/api/Switch/update-task-po-switch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!res.ok) {
            return showError("SQL UpdateTaskPO error:<br>" + result.message);
        }

        showSuccess(`
            <b>Update Task PO success!</b><br>
            SmartRepair: OK<br>
            SQL Update: ${result.message}
        `);

    } catch (err) {
        showError("Cannot connect to SQL Server!");
    }
}

// ==============================
// UPDATE APPLY TASK STATUS (PM/COST)
// ==============================
async function callUpdateApplyStatus(snList, targetStatus, successTitle) {
    // =======================
    // CALL SMARTREPAIR FIRST
    // =======================
    showLoading("Synchronizing SmartRepair...");

    const smart = await callSmartRepair(snList, String(targetStatus));

    if (!smart.success) {
        return showError("SmartRepair error:<br>" + smart.message);
    }

    // =======================
    // CALL UPDATE-APPLY-STATUS SQL SERVER
    // =======================
    showLoading("Updating status...");

    let result = {};

    try {
        const payload = { sNs: snList, targetStatus };

        const res = await fetch(`${SCRAP_API_BASE}/update-apply-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        try {
            result = await res.json();
        } catch {
            result = {};
        }

        if (!res.ok) {
            return showError("Failed to update status:<br>" + (result.message || ""));
        }

        showSuccess(`
            <b>${successTitle}</b><br>
            SmartRepair: OK<br>
            ${result.message}
        `);
    } catch (err) {
        showError("Cannot connect to SQL Server!");
    }
}

async function callSmartRepairDelete(snList) {
    const payload = {
        type: "delete",
        sn_list: snList.join(","),
        type_bp: "",
        status: "",
        task: ""
    };

    try {
        const res = await fetch("https://sfc-portal.cns.myfiinet.com/SfcSmartRepair/api/repair_scrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        const cleanText = text.replace(/^"|"$/g, '').trim();

        // Delete thành công thường trả về "Ok delete ..." hoặc "OK"
        if (cleanText.toLowerCase().includes("ok delete") || text === '"OK"') {
            return { success: true, message: cleanText || "OK" };
        }

        return {
            success: false,
            message: cleanText || "SmartRepair delete failed"
        };

    } catch (err) {
        return { success: false, message: "Không kết nối được SmartRepair system!" };
    }
}

async function callSmartRepairUnblock(snList) {

    const createdBy = document.getElementById("analysisPerson").value;
    const reasonRemove = document.getElementById("reason-remove").value;

    const payload = {
        type: "unblock",
        sn_list: snList.join(","),
        type_bp: "",
        status: "",
        task: "",
        emp_no: createdBy,
        reason: reasonRemove
    };

    try {
        const res = await fetch("https://sfc-portal.cns.myfiinet.com/SfcSmartRepair/api/repair_scrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        //const cleanText = text.replace(/^"|"$/g, '').trim();

        // Delete thành công thường trả về "Ok delete ..." hoặc "OK"
        if (text === '"OK"') {
            return { success: true, message:"OK" };
        }

        return {
            success: false,
            message: "SmartRepair unblock failed!"
        };

    } catch (err) {
        return { success: false, message: "Không kết nối được SmartRepair system!" };
    }
}


async function handlePmUpdate() {
    const snList = parseSerialInput("sn-input-pm");

    if (!snList.length) return showWarning("Please enter SN!");
    try {
        const statusRes = await fetch(`${SCRAP_API_BASE}/detail-task-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ SNs: snList })
        });

        const statusResult = await statusRes.json();

        if (!statusRes.ok) {
            return showError("Check status error:<br>" + (statusResult.message || ""));
        }

        const invalidSNs = (statusResult.data || [])
            .filter(item => item.applyTaskStatus !== 0)
            .map(item => item.sn || item.SN)
            .filter(Boolean);

        if (invalidSNs.length) {
            return showError(`Only update when ApplyTaskStatus = 0.<br>Invalid SN: ${invalidSNs.join(", ")}`);
        }
    } catch (err) {
        return showError("Cannot check ApplyTaskStatus!");
    }
    await callUpdateApplyStatus(snList, 9, "PM Update success!");
}

async function handleCostUpdate() {
    const snList = parseSerialInput("sn-input-cost");

    if (!snList.length) return showWarning("Please enter SN!");
    try {
        const statusRes = await fetch(`${SCRAP_API_BASE}/detail-task-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ SNs: snList })
        });

        const statusResult = await statusRes.json();

        if (!statusRes.ok) {
            return showError("Check status error:<br>" + (statusResult.message || ""));
        }

        const invalidSNs = (statusResult.data || [])
            .filter(item => item.applyTaskStatus !== 9)
            .map(item => item.sn || item.SN)
            .filter(Boolean);

        if (invalidSNs.length) {
            return showError(`Only update when ApplyTaskStatus = 9.<br>Invalid SN: ${invalidSNs.join(", ")}`);
        }
    } catch (err) {
        return showError("Cannot check ApplyTaskStatus!");
    }
    await callUpdateApplyStatus(snList, 20, "Cost Update success!");
}

// ==============================
// REMOVE APPROVED SN
// ==============================
// ==============================
// REMOVE APPROVED SN (SQL OK -> SmartRepair delete + unblock)
// ==============================
async function handleRemoveSN() {
    const snList = parseSerialInput("sn-input-remove");
    if (!snList.length) return showWarning("Please enter SN!");

    // =======================
    // 1) CALL REMOVE SQL SERVER FIRST
    // =======================
    showLoading("Deleting SN on SQL Server...");

    let result = {};
    try {
        const payload = { snList };

        const res = await fetch("https://pe-vnmbd-nvidia-cns.myfiinet.com/api/Switch/remove-switch-sn-list", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        // parse JSON safe
        try {
            result = await res.json();
        } catch {
            result = {};
        }

        if (!res.ok) {
            return showError("Delete SN failed:<br>" + (result.message || ""));
        }
    } catch (err) {
        return showError("Cannot connect to SQL Server!");
    }

    // ✅ SQL success -> mới gọi SmartRepair
    showLoading("Synchronizing SmartRepair (delete + unblock)...");

    // =======================
    // 2) CALL SMARTREPAIR DELETE + UNBLOCK
    // =======================
    const smartDelete = await callSmartRepairDelete(snList);
    if (!smartDelete.success) {
        return showError("SmartRepair DELETE error:<br>" + (smartDelete.message || "") + "<br>Contact PE/IT");
    }

    const smartUnblock = await callSmartRepairUnblock(snList);
    if (!smartUnblock.success) {
        return showError("SmartRepair UNBLOCK error:<br>" + (smartUnblock.message || "") + "<br>Contact PE/IT");
    }

    // =======================
    // DONE
    // =======================
    showSuccess(`
        <b>Remove SN success!</b><br>
        SQL Remove: ${result.message || "OK"}<br>
        SmartRepair Delete: ${smartDelete.message || "OK"}<br>
        SmartRepair Unblock: ${smartUnblock.message || "OK"}
    `);
}

// ==============================
// EVENT LISTENERS
// ==============================
document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#input-sn-form button")?.addEventListener("click", handleInputSN);
    document.getElementById("update-task-btn")?.addEventListener("click", handleUpdateTaskPO);
    document.getElementById("pm-update-btn")?.addEventListener("click", handlePmUpdate);
    document.getElementById("cost-update-btn")?.addEventListener("click", handleCostUpdate);
    document.getElementById("remove-btn")?.addEventListener("click", handleRemoveSN);
});