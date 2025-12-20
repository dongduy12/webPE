// Hàm để ẩn tất cả các form và khu vực kết quả
function hideAllElements() {
    const forms = ["input-sn-1-form", "custom-form"];
    const results = ["input-sn-1-result", "sn-wait-approve-result"];

    forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            form.classList.add("hidden");
        } else {
            console.warn(`Form with ID ${formId} not found.`);
        }
    });

    results.forEach(resultId => {
        const result = document.getElementById(resultId);
        if (result) {
            result.classList.add("hidden");
        } else {
            console.warn(`Result with ID ${resultId} not found.`);
        }
    });

    // Xóa giá trị của các trường nhập liệu khi ẩn form
    const snInput = document.getElementById("sn-input-1");
    const descriptionInput = document.getElementById("description-input-1");

    if (snInput) snInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
}

// Ẩn tất cả các form và khu vực kết quả ngay lập tức khi trang tải
hideAllElements();

// Hàm hiển thị bảng bằng DataTable
function displayTableWithPagination(data, resultDiv) {

    if (!data || data.length === 0) {
        resultDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>Cảnh báo:</strong> Không tìm thấy dữ liệu với ApplyTaskStatus = 8.
            </div>
        `;
        return;
    }

    // Clear bảng cũ để tránh lỗi DataTable reinitialization
    resultDiv.innerHTML = `
        <table id="scrapTable" class="display nowrap compact" style="width:100%">
            <thead>
                <tr>
                    <th>SERIAL_NUMBER</th>
                    <th>DESCRIPTION</th>
                    <th>CREATE_TIME</th>
                    <th>APPLY_TASK_STATUS</th>
                    <th>TYPE_BONEPILE</th>
                    <th>CREATE_BY</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    // Chuẩn bị dữ liệu
    const tableData = data.map(item => ({
        SERIAL_NUMBER: item.sn || "N/A",
        DESCRIPTION: item.description || "N/A",
        CREATE_TIME: item.createTime || "N/A",
        APPLY_TASK_STATUS: item.applyTaskStatus,
        TYPE_BONEPILE: item.remark || "N/A",
        CREATE_BY: item.createBy || "N/A"
    }));

    // Khởi tạo DataTable
    setTimeout(() => {
        if ($.fn.DataTable.isDataTable("#scrapTable")) {
            $("#scrapTable").DataTable().destroy();
        }

        $("#scrapTable").DataTable({
            data: tableData,
            columns: [
                { data: "SERIAL_NUMBER" },
                { data: "DESCRIPTION" },
                { data: "CREATE_TIME" },
                { data: "APPLY_TASK_STATUS" },
                { data: "TYPE_BONEPILE" },
                { data: "CREATE_BY" }
            ],
            paging: true,
            searching: true,
            ordering: true,
            pageLength: 10,
            autoWidth: false,
            scrollX: true,
            responsive: true,
            language: {
                lengthMenu: "Hiển thị _MENU_ dòng",
                search: "Tìm kiếm:",
                info: "Trang _PAGE_ / _PAGES_",
                paginate: {
                    previous: "Trước",
                    next: "Sau"
                }
            }
        });
    }, 200);
}


// Hàm tải dữ liệu từ API và hiển thị
async function loadScrapStatusTwo(resultDiv) {
    resultDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>Thông báo:</strong> Đang tải danh sách SN chờ SPE approve...
        </div>
    `;

    try {
        const response = await fetch("https://pe-vnmbd-nvidia-cns.myfiinet.com/api/Scrap/get-scrap-status-two-and-four", {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();

        if (response.ok) {
            displayTableWithPagination(result, resultDiv);
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Lỗi:</strong> ${result.message}
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                <strong>Lỗi:</strong> Không thể kết nối đến API. Vui lòng kiểm tra lại.
            </div>
        `;
        console.error("Error:", error);
    }
}

// Hàm tải file Excel
function downloadExcel(data) {
    // Chuẩn bị dữ liệu cho file Excel
    const worksheetData = data.map(item => ({
        SN: item.sn || "N/A",
        Description: item.description || "N/A",
        "Create Time": item.createTime || "N/A",
        "Apply Task Status": item.applyTaskStatus,
        "Create By": item.createBy || "N/A"
    }));

    // Tạo worksheet
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SN_Wait_SPE_Approve");

    // Tải file Excel
    XLSX.writeFile(workbook, "SN_Wait_SPE_Approve.xlsx");
}

// Xử lý sự kiện khi trang tải lần đầu
document.addEventListener("DOMContentLoaded", function () {
    console.log("DOMContentLoaded triggered for Function1");
    hideAllElements();

    // Xử lý sự kiện thay đổi giá trị trong dropdown
    document.getElementById("search-options").addEventListener("change", function () {
        console.log("Dropdown changed to:", this.value);
        hideAllElements();

        const selectedValue = this.value;

        if (selectedValue === "INPUT_SN_1") {
            document.getElementById("input-sn-1-form").classList.remove("hidden");
            document.getElementById("input-sn-1-result").classList.remove("hidden");
        } else if (selectedValue === "SN_WAIT_SPE_APPROVE") {
            const resultDiv = document.getElementById("sn-wait-approve-result");
            document.getElementById("custom-form").classList.remove("hidden");
            document.getElementById("sn-wait-approve-result").classList.remove("hidden");

            // Tải dữ liệu ngay khi form được hiển thị
            loadScrapStatusTwo(resultDiv);
        }
    });

    // Xử lý sự kiện khi nhấn nút "INPUT SN" trong form INPUT_SN_1
    document.getElementById("input-sn-btn").addEventListener("click", async function () {
        const resultDiv = document.getElementById("input-sn-1-result");

        // Lấy danh sách SN từ textarea
        const snInput = document.getElementById("sn-input-1").value.trim();
        const sNs = snInput.split(/\r?\n/).map(sn => sn.trim()).filter(sn => sn);

        // Lấy mô tả từ input
        const description = document.getElementById("description-input-1").value.trim();

        // Lấy thông tin loại Bonepile
        const typeBonepile = document.getElementById("bp-options").value;

        // Lấy thông tin loại Approve
        const typeApprove = document.getElementById("approve-options").value;

        // Lấy thông tin người dùng hiện tại
        //const createdBy = getCurrentUsername();
        // Lấy thông tin người dùng hiện tại
        const createdBy = $('#analysisPerson').val();

        // Kiểm tra dữ liệu đầu vào
        if (!sNs.length) {
            resultDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>Cảnh báo:</strong> Vui lòng nhập ít nhất một Serial Number hợp lệ!
            </div>
        `;
            return;
        }

        if (!description) {
            resultDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>Cảnh báo:</strong> Vui lòng nhập mô tả!
            </div>
        `;
            return;
        }

        if (!["BP-10", "BP-20", "B36R"].includes(typeBonepile)) {
            resultDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>Cảnh báo:</strong> Vui lòng chọn loại BonePile!
            </div>
        `;
            return;
        }

        if (!["2", "4"].includes(typeApprove)) {
            resultDiv.innerHTML = `
            <div class="alert alert-warning">
                <strong>Cảnh báo:</strong> Vui lòng chọn loại Approve!
            </div>
        `;
            return;
        }

        // Hiển thị thông báo "đang xử lý"
        resultDiv.innerHTML = `
        <div class="alert alert-info">
            <strong>Thông báo:</strong> Đang lưu danh sách SN...
        </div>
    `;

        // Định dạng sn_list thành chuỗi cách nhau bởi dấu phẩy
        const snListString = sNs.join(",");

        try {
            // Gọi API input-sn-wait-spe-approve trước
            const requestData = {
                sNs: sNs,
                description: description,
                remark: typeBonepile,
                approve: typeApprove,
                createdBy: createdBy
            };

            const inputSnResponse = await fetch("https://pe-vnmbd-nvidia-cns.myfiinet.com/api/Scrap/input-sn-wait-spe-approve", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestData)
            });

            const inputSnResult = await inputSnResponse.json();

            if (inputSnResponse.ok) {
                let shouldCallRepairScrap = typeApprove !== "4";
                let repairScrapSucceeded = true;
                let repairScrapResult = "";

                if (shouldCallRepairScrap) {
                    // Gọi API repair_scrap sau khi input-sn-wait-spe-approve thành công
                    const repairScrapData = {
                        type: "insert",
                        sn_list: snListString,
                        type_bp: typeBonepile,
                        status: typeApprove,
                        task: null,
                        emp_no: createdBy,
                        reason: "Input Scrap"
                    };

                    const repairScrapResponse = await fetch("https://sfc-portal.cns.myfiinet.com/SfcSmartRepair/api/repair_scrap", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(repairScrapData)
                    });

                    repairScrapResult = await repairScrapResponse.text();
                    repairScrapSucceeded = repairScrapResponse.ok && repairScrapResult === "\"OK\"";
                    if (!repairScrapSucceeded) {
                        console.warn("repair_scrap API failed:", repairScrapResult);
                    }
                } else {
                    repairScrapResult = "Bỏ qua gọi repair_scrap cho trạng thái Waiting SPE Approve BGA";
                }

                if (repairScrapSucceeded) {
                    // Gọi API UpdateScrap sau khi repair_scrap thành công hoặc được bỏ qua
                    const updateResponse = await fetch("https://pe-vnmbd-nvidia-cns.myfiinet.com/api/Product/UpdateScrap", {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            serialNumbers: sNs,
                            scrapStatus: "Đã gửi NV xin báo phế"
                        })
                    });

                    const updateResult = await updateResponse.json();

                    if (updateResponse.ok) {
                        // Nếu cả hai bước đều thành công hoặc được bỏ qua theo yêu cầu
                        resultDiv.innerHTML = `
                        <div class="alert alert-success">
                            <strong>Thành công:</strong> ${inputSnResult.message}${shouldCallRepairScrap ? "" : "<br><small class=\"text-muted\">" + repairScrapResult + "</small>"}
                        </div>
                    `;
                    } else {
                        console.warn("UpdateProduct API failed:", updateResult.message);
                        resultDiv.innerHTML = `
                        <div class="alert alert-warning">
                            <strong>Cảnh báo:</strong> Lưu SN thành công nhưng cập nhật sản phẩm trong kho thất bại: ${updateResult.message}
                        </div>
                    `;
                    }
                } else {
                    resultDiv.innerHTML = `
                    <div class="alert alert-warning">
                        <strong>Cảnh báo:</strong> Gọi API repair_scrap thất bại: ${repairScrapResult}
                    </div>
                `;
                }
            } else {
                console.warn("input-sn-wait-spe-approve API failed:", inputSnResult.message);
                resultDiv.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Cảnh báo:</strong> Gọi API input-sn-wait-spe-approve thất bại: ${inputSnResult.message}
                </div>
            `;
            }
        } catch (error) {
            resultDiv.innerHTML = `
            <div class="alert alert-danger">
                <strong>Lỗi:</strong> Không thể kết nối đến API. Vui lòng kiểm tra lại.
            </div>
        `;
            console.error("Error:", error);
        }
    });

    // Xử lý sự kiện khi nhấn nút "Download Excel" trong form SN_WAIT_SPE_APPROVE
    document.getElementById("sn-wait-list-btn").addEventListener("click", async function () {
        try {
            // Gọi API để lấy toàn bộ dữ liệu
            const response = await fetch("https://pe-vnmbd-nvidia-cns.myfiinet.com/api/Scrap/get-scrap-status-two-and-four", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const result = await response.json();

            if (response.ok && result && result.length > 0) {
                // Tải file Excel
                downloadExcel(result);
            } else {
                const resultDiv = document.getElementById("sn-wait-approve-result");
                resultDiv.innerHTML = `
                    <div class="alert alert-warning">
                        <strong>Cảnh báo:</strong> Không có dữ liệu để tải xuống.
                    </div>
                `;
            }
        } catch (error) {
            const resultDiv = document.getElementById("sn-wait-approve-result");
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Lỗi:</strong> Không thể tải dữ liệu để tạo file Excel.
                </div>
            `;
            console.error("Error:", error);
        }
    });
});