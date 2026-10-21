// LocalStorage Wrapper to mimic chrome.storage.local for Web
const storage = {
    get: (keys, callback) => {
        let result = {};
        if (Array.isArray(keys)) {
            keys.forEach(key => {
                let val = localStorage.getItem(key);
                result[key] = val ? JSON.parse(val) : (key === 'companies' || key === 'parties' || key === 'items' || key === 'invoices' ? [] : undefined);
            });
        } else if (typeof keys === 'object') {
            Object.keys(keys).forEach(key => {
                let val = localStorage.getItem(key);
                result[key] = val ? JSON.parse(val) : keys[key];
            });
        }
        callback(result);
    },
    set: (obj, callback) => {
        Object.keys(obj).forEach(key => {
            localStorage.setItem(key, JSON.stringify(obj[key]));
        });
        if (callback) callback();
    }
};

// 1. Tab Switching
function switchTab(tabId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const targetView = document.getElementById(tabId);
    if (targetView) targetView.classList.add('active');

    const targetNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (targetNav) targetNav.classList.add('active');

    if(tabId === 'company') { renderCompanies(); resetCompanyForm(); }
    if(tabId === 'party') { renderParties(); resetPartyForm(); }
    if(tabId === 'item') { renderItems(); resetItemForm(); }
    if(tabId === 'voucher') { 
        if(!window.isAlteringInvoice) {
            document.getElementById('vInvoiceNo').value = 'AP-' + Math.floor(100 + Math.random() * 900) + '/26-27';
            document.getElementById('vDispatch').value = '';
            populateVoucherDropdowns();
        }
    }
    if(tabId === 'reports') renderReports();
    refreshAllData();
}

window.isAlteringInvoice = false;

// 2. Multi-Item Voucher Row Management
function addVoucherRow(selectedItemId = '', qtyVal = 134, rateVal = 140) {
    storage.get({ items: [] }, (res) => {
        const itemsList = res.items;
        const tbody = document.getElementById('voucherItemRows');
        if(!tbody) return;

        if(itemsList.length === 0) {
            alert('Please create at least one Stock Item first.');
            switchTab('item');
            return;
        }

        const tr = document.createElement('tr');
        tr.className = 'voucher-item-row';
        tr.innerHTML = `
            <td>
                <select class="item-select">
                    ${itemsList.map(i => `<option value="${i.id}" ${i.name === selectedItemId \vert{}\vert{} i.id == selectedItemId ? 'selected' : ''}>${i.name} [HSN: ${i.hsn}, GST:${i.gst}%]</option>`).join('')}
                </select>
            </td>
            <td><input type="number" class="item-qty" value="${qtyVal}" min="0.01" step="0.01"></td>
            <td><input type="number" class="item-rate" value="${rateVal}" min="0" step="0.01"></td>
            <td><input type="text" class="item-amount" readonly value="${(qtyVal * rateVal).toFixed(2)}" style="background:#edf2f7; font-weight:600;"></td>
            <td style="text-align:center;"><button type="button" class="btn btn-danger remove-row-btn" style="padding:4px 8px; margin:0; font-size:11px;">X</button></td>
        `;

        const qtyInput = tr.querySelector('.item-qty');
        const rateInput = tr.querySelector('.item-rate');
        const amtInput = tr.querySelector('.item-amount');

        const updateAmt = () => {
            const q = parseFloat(qtyInput.value) || 0;
            const r = parseFloat(rateInput.value) || 0;
            amtInput.value = (q * r).toFixed(2);
        };

        qtyInput.addEventListener('input', updateAmt);
        rateInput.addEventListener('input', updateAmt);

        tbody.appendChild(tr);
    });
}

// 3. Number to Words Helper (Indian Format with Rupees & Paise)
function numberToWords(num) {
    if (isNaN(num) || num === 0) return 'Zero Rupees Only';
    
    let n = parseFloat(num).toFixed(2).split('.');
    let whole = parseInt(n[0]);
    let fraction = parseInt(n[1]);

    if (whole === 0 && fraction === 0) return 'Zero Rupees Only';

    let words = '';
    
    function convertLessThanThousand(n) {
        if (n === 0) return '';
        let a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        let b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        
        let str = '';
        if (n >= 100) {
            str += a[Math.floor(n / 100)] + ' Hundred ';
            n %= 100;
        }
        if (n >= 20) {
            str += b[Math.floor(n / 10)] + ' ';
            n %= 10;
        }
        if (n > 0) {
            str += a[n] + ' ';
        }
        return str;
    }

    if (whole >= 10000000) {
        words += convertLessThanThousand(Math.floor(whole / 10000000)) + 'Crore ';
        whole %= 10000000;
    }
    if (whole >= 100000) {
        words += convertLessThanThousand(Math.floor(whole / 100000)) + 'Lakh ';
        whole %= 100000;
    }
    if (whole >= 1000) {
        words += convertLessThanThousand(Math.floor(whole / 1000)) + 'Thousand ';
        whole %= 1000;
    }
    if (whole > 0) {
        words += convertLessThanThousand(whole);
    }

    words = words.trim();
    return words;
}

function getAmountWords(num) {
    let n = parseFloat(num).toFixed(2).split('.');
    let whole = parseInt(n[0]);
    let fraction = parseInt(n[1]);
    let str = numberToWords(whole) + ' Rupees';
    if(fraction > 0) {
        str += ' and ' + numberToWords(fraction) + ' Paise';
    }
    return str + ' Only';
}

function getTaxWords(num) {
    let n = parseFloat(num).toFixed(2).split('.');
    let whole = parseInt(n[0]);
    let fraction = parseInt(n[1]);
    let str = numberToWords(whole);
    if(fraction > 0) {
        str += ' and ' + numberToWords(fraction) + ' paise';
    }
    return str + ' Only';
}

// 4. Form Resets
function resetCompanyForm() {
    document.getElementById('cEditId').value = '';
    document.getElementById('cName').value = '';
    document.getElementById('cState').value = '';
    document.getElementById('cGstin').value = '';
    document.getElementById('cEmail').value = '';
    document.getElementById('cStateName').value = '';
    document.getElementById('cAddress').value = '';
    document.getElementById('compFormTitle').innerText = 'Company Creation & Alteration';
    document.getElementById('saveCompBtn').innerText = 'Save Company Master';
    document.getElementById('cancelCompEditBtn').style.display = 'none';
}

function resetPartyForm() {
    document.getElementById('pEditId').value = '';
    document.getElementById('pName').value = '';
    document.getElementById('pGroup').value = 'Sundry Debtor';
    document.getElementById('pState').value = '';
    document.getElementById('pGstin').value = '';
    document.getElementById('pStateName').value = '';
    document.getElementById('pAddress').value = '';
    document.getElementById('partyFormTitle').innerText = 'Party Ledger Creation & Alteration';
    document.getElementById('savePartyBtn').innerText = 'Save Party Ledger';
    document.getElementById('cancelPartyEditBtn').style.display = 'none';
}

function resetItemForm() {
    document.getElementById('iEditId').value = '';
    document.getElementById('iName').value = '';
    document.getElementById('iHsn').value = '';
    document.getElementById('iUnit').value = 'Kg';
    document.getElementById('iGst').value = '18';
    document.getElementById('itemFormTitle').innerText = 'Stock Item Creation & Alteration';
    document.getElementById('saveItemBtn').innerText = 'Save Stock Item';
    document.getElementById('cancelItemEditBtn').style.display = 'none';
}

// 5. Render Masters Tables
function renderCompanies() {
    storage.get({ companies: [] }, (res) => {
        const container = document.getElementById('companyTableContainer');
        if(!container) return;
        if(res.companies.length === 0) {
            container.innerHTML = '<p style="color:#718096; font-size:13px;">No companies created yet.</p>';
            return;
        }
        let html = `
            <table>
                <tr><th>Company Name</th><th>State Code</th><th>GSTIN</th><th>Email</th><th>Action</th></tr>
        `;
        res.companies.forEach(c => {
            html += `
                <tr>
                    <td><b>${c.name}</b></td>
                    <td>${c.state} (${c.stateName || ''})</td>
                    <td>${c.gstin}</td>
                    <td>${c.email || '-'}</td>
                    <td>
                        <button class="btn edit-comp-btn" data-id="${c.id}" style="padding:4px 8px; margin:0; font-size:11px;">Alter</button>
                        <button class="btn btn-danger del-comp-btn" data-id="${c.id}" style="padding:4px 8px; margin:0; font-size:11px;">Delete</button>
                    </td>
                </tr>
            `;
        });
        html += `</table>`;
        container.innerHTML = html;

        container.querySelectorAll('.edit-comp-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                storage.get({ companies: [] }, (sRes) => {
                    const comp = sRes.companies.find(c => c.id == id);
                    if(comp) {
                        switchTab('company');
                        document.getElementById('cEditId').value = comp.id;
                        document.getElementById('cName').value = comp.name;
                        document.getElementById('cState').value = comp.state;
                        document.getElementById('cGstin').value = comp.gstin;
                        document.getElementById('cEmail').value = comp.email || '';
                        document.getElementById('cStateName').value = comp.stateName || '';
                        document.getElementById('cAddress').value = comp.address || '';
                        document.getElementById('compFormTitle').innerText = 'Alter Company: ' + comp.name;
                        document.getElementById('saveCompBtn').innerText = 'Update Company Master';
                        document.getElementById('cancelCompEditBtn').style.display = 'inline-block';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            });
        });

        container.querySelectorAll('.del-comp-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                if(confirm('Are you sure you want to delete this company?')) {
                    storage.get({ companies: [] }, (sRes) => {
                        const comps = sRes.companies.filter(c => c.id != id);
                        storage.set({ companies: comps }, () => {
                            renderCompanies();
                            refreshAllData();
                        });
                    });
                }
            });
        });
    });
}

function renderParties() {
    storage.get({ parties: [] }, (res) => {
        const container = document.getElementById('partyTableContainer');
        if(!container) return;
        if(res.parties.length === 0) {
            container.innerHTML = '<p style="color:#718096; font-size:13px;">No parties created yet.</p>';
            return;
        }
        let html = `
            <table>
                <tr><th>Party Name</th><th>State Code</th><th>GSTIN</th><th>Address</th><th>Action</th></tr>
        `;
        res.parties.forEach(p => {
            html += `
                <tr>
                    <td><b>${p.name}</b></td>
                    <td>${p.state} (${p.stateName || ''})</td>
                    <td>${p.gstin || 'Unregistered'}</td>
                    <td>${p.address || '-'}</td>
                    <td>
                        <button class="btn edit-party-btn" data-id="${p.id}" style="padding:4px 8px; margin:0; font-size:11px;">Alter</button>
                        <button class="btn btn-danger del-party-btn" data-id="${p.id}" style="padding:4px 8px; margin:0; font-size:11px;">Delete</button>
                    </td>
                </tr>
            `;
        });
        html += `</table>`;
        container.innerHTML = html;

        container.querySelectorAll('.edit-party-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                storage.get({ parties: [] }, (sRes) => {
                    const party = sRes.parties.find(p => p.id == id);
                    if(party) {
                        switchTab('party');
                        document.getElementById('pEditId').value = party.id;
                        document.getElementById('pName').value = party.name;
                        document.getElementById('pGroup').value = party.group;
                        document.getElementById('pState').value = party.state;
                        document.getElementById('pGstin').value = party.gstin || '';
                        document.getElementById('pStateName').value = party.stateName || '';
                        document.getElementById('pAddress').value = party.address || '';
                        document.getElementById('partyFormTitle').innerText = 'Alter Party: ' + party.name;
                        document.getElementById('savePartyBtn').innerText = 'Update Party Ledger';
                        document.getElementById('cancelPartyEditBtn').style.display = 'inline-block';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            });
        });

        container.querySelectorAll('.del-party-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                if(confirm('Are you sure you want to delete this party?')) {
                    storage.get({ parties: [] }, (sRes) => {
                        const parties = sRes.parties.filter(p => p.id != id);
                        storage.set({ parties }, () => {
                            renderParties();
                            refreshAllData();
                        });
                    });
                }
            });
        });
    });
}

function renderItems() {
    storage.get({ items: [] }, (res) => {
        const container = document.getElementById('itemTableContainer');
        if(!container) return;
        if(res.items.length === 0) {
            container.innerHTML = '<p style="color:#718096; font-size:13px;">No stock items created yet.</p>';
            return;
        }
        let html = `
            <table>
                <tr><th>Item Name</th><th>HSN / SAC</th><th>Unit</th><th>GST Rate</th><th>Action</th></tr>
        `;
        res.items.forEach(i => {
            html += `
                <tr>
                    <td><b>${i.name}</b></td>
                    <td>${i.hsn || '-'}</td>
                    <td>${i.unit}</td>
                    <td>${i.gst}%</td>
                    <td>
                        <button class="btn edit-item-btn" data-id="${i.id}" style="padding:4px 8px; margin:0; font-size:11px;">Alter</button>
                        <button class="btn btn-danger del-item-btn" data-id="${i.id}" style="padding:4px 8px; margin:0; font-size:11px;">Delete</button>
                    </td>
                </tr>
            `;
        });
        html += `</table>`;
        container.innerHTML = html;

        container.querySelectorAll('.edit-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                storage.get({ items: [] }, (sRes) => {
                    const item = sRes.items.find(i => i.id == id);
                    if(item) {
                        switchTab('item');
                        document.getElementById('iEditId').value = item.id;
                        document.getElementById('iName').value = item.name;
                        document.getElementById('iHsn').value = item.hsn;
                        document.getElementById('iUnit').value = item.unit;
                        document.getElementById('iGst').value = item.gst;
                        document.getElementById('itemFormTitle').innerText = 'Alter Stock Item: ' + item.name;
                        document.getElementById('saveItemBtn').innerText = 'Update Stock Item';
                        document.getElementById('cancelItemEditBtn').style.display = 'inline-block';
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            });
        });

        container.querySelectorAll('.del-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                if(confirm('Are you sure you want to delete this stock item?')) {
                    storage.get({ items: [] }, (sRes) => {
                        const items = sRes.items.filter(i => i.id != id);
                        storage.set({ items }, () => {
                            renderItems();
                            refreshAllData();
                        });
                    });
                }
            });
        });
    });
}

function populateVoucherDropdowns() {
    storage.get({ companies: [], parties: [], items: [] }, (res) => {
        const cSel = document.getElementById('vCompSelect');
        const pSel = document.getElementById('vPartySelect');

        if(cSel) cSel.innerHTML = res.companies.map(c => `<option value="${c.id}">${c.name} (${c.gstin})</option>`).join('');
        if(pSel) pSel.innerHTML = res.parties.map(p => `<option value="${p.id}">${p.name} [${p.group}]</option>`).join('');

        const tbody = document.getElementById('voucherItemRows');
        if(tbody && !window.isAlteringInvoice) {
            tbody.innerHTML = '';
            if(res.items.length > 0) {
                addVoucherRow(res.items[0].name, 134, 140);
            }
        }
    });
}

function renderTallyInvoice(inv) {
    const container = document.getElementById('voucherResultContainer');
    if(!container) return;

    let itemsHtml = '';
    let slNo = 1;
    inv.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td style="text-align:center; border: 1px solid #000;">${slNo++}</td>
                <td colspan="3" style="border: 1px solid #000;"><b>${item.itemName}</b></td>
                <td style="text-align:center; border: 1px solid #000;">${item.hsn || '-'}</td>
                <td style="text-align:right; border: 1px solid #000;">${item.qty.toFixed(2)} ${item.unit}</td>
                <td style="text-align:right; border: 1px solid #000;">${item.rate.toFixed(2)}</td>
                <td style="text-align:center; border: 1px solid #000;">${item.unit}</td>
                <td colspan="2" style="text-align:right; border: 1px solid #000;">${item.taxableValue}</td>
            </tr>
        `;
    });

    let hsnMap = {};
    inv.items.forEach(item => {
        let hsnKey = (item.hsn || '7318') + '_' + item.gstRate;
        if (!hsnMap[hsnKey]) {
            hsnMap[hsnKey] = {
                hsn: item.hsn || '7318',
                gstRate: item.gstRate,
                taxableValue: 0
            };
        }
        hsnMap[hsnKey].taxableValue += parseFloat(item.taxableValue);
    });

    let hsnSummaryRows = '';
    let totalTaxVal = 0;
    let totalTaxAmt = 0;
    let calculatedCgst = 0;
    let calculatedSgst = 0;
    let calculatedIgst = 0;

    Object.values(hsnMap).forEach(h => {
        let hsnTaxAmt = h.taxableValue * (h.gstRate / 100);
        totalTaxVal += h.taxableValue;
        totalTaxAmt += hsnTaxAmt;

        if (inv.companyStateCode === inv.partyStateCode) {
            calculatedCgst += hsnTaxAmt / 2;
            calculatedSgst += hsnTaxAmt / 2;
        } else {
            calculatedIgst += hsnTaxAmt;
        }

        hsnSummaryRows += `
            <tr>
                <td style="text-align:center; border: 1px solid #000;">${h.hsn}</td>
                <td style="text-align:right; border: 1px solid #000;">${h.taxableValue.toFixed(2)}</td>
                <td style="text-align:center; border: 1px solid #000;">${h.gstRate}%</td>
                <td style="text-align:right; border: 1px solid #000;">${hsnTaxAmt.toFixed(2)}</td>
                <td style="text-align:right; border: 1px solid #000;">${hsnTaxAmt.toFixed(2)}</td>
            </tr>
        `;
    });

    let taxSummaryRows = '';
    if(calculatedCgst > 0) {
        taxSummaryRows += `
            <tr>
                <td colspan="8" style="text-align:right; border: 1px solid #000;"><b>Output CGST</b></td>
                <td colspan="2" style="text-align:right; border: 1px solid #000;">${calculatedCgst.toFixed(2)}</td>
            </tr>
            <tr>
                <td colspan="8" style="text-align:right; border: 1px solid #000;"><b>Output SGST</b></td>
                <td colspan="2" style="text-align:right; border: 1px solid #000;">${calculatedSgst.toFixed(2)}</td>
            </tr>
        `;
    } else {
        taxSummaryRows += `
            <tr>
                <td colspan="8" style="text-align:right; border: 1px solid #000;"><b>Igst</b></td>
                <td colspan="2" style="text-align:right; border: 1px solid #000;">${calculatedIgst.toFixed(2)}</td>
            </tr>
        `;
    }

    const exactGrandTotal = totalTaxVal + totalTaxAmt + 0.20;

    container.innerHTML = `
        <button class="print-btn" id="printInvoiceBtn">🖨️ Print Full A4 Tax Invoice</button>
        <div class="tally-invoice-wrapper">
            <div style="text-align:right; font-size:10px; margin-bottom:2px;">Original for Recipient</div>
            
            <div class="tally-invoice-container">
                <table class="tally-table">
                    <tr>
                        <td colspan="6" style="text-align:center; border: 1px solid #000;">
                            <h2 style="margin:0; font-size:15px; font-weight:bold;">${inv.companyName}</h2>
                            <div style="font-size:9.5px; line-height:1.2;">
                                ${inv.companyAddress}<br>
                                <b>GSTIN/UIN:</b> ${inv.companyGstin} | <b>State Name:</b> ${inv.companyStateName || 'West Bengal'}, <b>Code:</b> ${inv.companyStateCode || '19'}<br>
                                <b>E-Mail:</b> ${inv.companyEmail || 'tradersajoyprasad@gmail.com'}
                            </div>
                        </td>
                        <td colspan="4" style="text-align:center; background:#fff; border: 1px solid #000;">
                            <h3 style="margin:0; font-size:13px; font-weight:bold;">Tax Invoice</h3>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="6" rowspan="4" style="border: 1px solid #000;">
                            <b>Consignee (Ship to)</b><br>
                            <b>${inv.partyName}</b><br>
                            ${inv.partyAddress}<br>
                            <b>GSTIN/UIN</b> : ${inv.partyGstin}<br>
                            <b>State Name</b> : ${inv.partyStateName || 'West Bengal'}, <b>Code</b> : ${inv.partyStateCode || '19'}
                        </td>
                        <td colspan="2" style="border: 1px solid #000;"><b>Invoice No.</b><br>${inv.invoiceNo}</td>
                        <td colspan="2" style="border: 1px solid #000;"><b>Dated</b><br>${inv.date}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border: 1px solid #000;"><b>Delivery Note</b><br>${inv.dispatchThrough || '-'}</td>
                        <td colspan="2" style="border: 1px solid #000;"><b>Mode/Terms of Payment</b><br>Immediate</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border: 1px solid #000;"><b>Reference No. & Date.</b><br>-</td>
                        <td colspan="2" style="border: 1px solid #000;"><b>Other References</b><br>-</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border: 1px solid #000;"><b>Buyer's Order No.</b><br>-</td>
                        <td colspan="2" style="border: 1px solid #000;"><b>Dated</b><br>-</td>
                    </tr>
                    <tr>
                        <td colspan="6" rowspan="4" style="border: 1px solid #000;">
                            <b>Buyer (Bill to)</b><br>
                            <b>${inv.partyName}</b><br>
                            ${inv.partyAddress}<br>
                            <b>GSTIN/UIN</b> : ${inv.partyGstin}<br>
                            <b>State Name</b> : ${inv.partyStateName || 'Bihar'}, <b>Code</b> : ${inv.partyStateCode || '10'}
                        </td>
                        <td colspan="2" style="border: 1px solid #000;"><b>Dispatch Doc No.</b><br>-</td>
                        <td colspan="2" style="border: 1px solid #000;"><b>Delivery Note Date</b><br>-</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border: 1px solid #000;"><b>Dispatched through</b><br>${inv.dispatchThrough || '-'}</td>
                        <td colspan="2" style="border: 1px solid #000;"><b>Destination</b><br>${inv.destination || 'Rampurhat'}</td>
                    </tr>
                    <tr>
                        <td colspan="4" rowspan="2" style="border: 1px solid #000;"><b>Terms of Delivery</b><br>-</td>
                    </tr>
                    <tr></tr>

                    <tr style="background:#fff; text-align:center; font-weight:bold;">
                        <td style="width:30px; border: 1px solid #000;">SI<br>No.</td>
                        <td colspan="3" style="border: 1px solid #000;">Description of Goods / Services</td>
                        <td style="border: 1px solid #000;">HSN/SAC</td>
                        <td style="border: 1px solid #000;">Quantity</td>
                        <td style="border: 1px solid #000;">Rate</td>
                        <td style="border: 1px solid #000;">per</td>
                        <td colspan="2" style="text-align:right; border: 1px solid #000;">Amount</td>
                    </tr>

                    ${itemsHtml}

                    ${taxSummaryRows}
                    <tr>
                        <td colspan="8" style="text-align:right; border: 1px solid #000;"><b>Round Off</b></td>
                        <td colspan="2" style="text-align:right; border: 1px solid #000;">0.20</td>
                    </tr>
                    <tr style="border: 1px solid #000; font-weight:bold;">
                        <td colspan="5" style="border: 1px solid #000;"></td>
                        <td colspan="2" style="text-align:right; border: 1px solid #000;">Total</td>
                        <td style="text-align:right; border: 1px solid #000;">${inv.items[0] ? inv.items[0].qty.toFixed(2) + ' ' + inv.items[0].unit : ''}</td>
                        <td colspan="2" style="text-align:right; border: 1px solid #000;">₹${exactGrandTotal.toFixed(2)}</td>
                    </tr>
                </table>

                <div>
                    <table class="tally-table" style="border-top:none;">
                        <tr>
                            <td style="border: 1px solid #000; width:85%;">
                                <b>Amount Chargeable (in words)</b><br>
                                <b>INR ${getAmountWords(exactGrandTotal)}</b>
                            </td>
                            <td style="text-align:right; font-size:10px; border: 1px solid #000; vertical-align:bottom;">E. & O.E</td>
                        </tr>
                    </table>

                    <table class="tally-table" style="border-top:none; text-align:center;">
                        <tr style="background:#fff; font-weight:bold;">
                            <td rowspan="2" style="border: 1px solid #000; vertical-align:middle;">HSN/SAC</td>
                            <td rowspan="2" style="border: 1px solid #000; vertical-align:middle;">Taxable Value</td>
                            <td colspan="2" style="border: 1px solid #000;">Integrated Tax</td>
                            <td rowspan="2" style="border: 1px solid #000; vertical-align:middle;">Total Tax Amount</td>
                        </tr>
                        <tr style="background:#fff; font-weight:bold;">
                            <td style="border: 1px solid #000;">Rate</td>
                            <td style="border: 1px solid #000;">Amount</td>
                        </tr>
                        ${hsnSummaryRows}
                        <tr style="font-weight:bold;">
                            <td style="border: 1px solid #000;">Total</td>
                            <td style="text-align:right; border: 1px solid #000;">${totalTaxVal.toFixed(2)}</td>
                            <td style="border: 1px solid #000;"></td>
                            <td style="text-align:right; border: 1px solid #000;">${totalTaxAmt.toFixed(2)}</td>
                            <td style="text-align:right; border: 1px solid #000;">${totalTaxAmt.toFixed(2)}</td>
                        </tr>
                    </table>

                    <table class="tally-table" style="border-top:none;">
                        <tr>
                            <td style="border: 1px solid #000;">
                                <b>Tax Amount (in words): INR ${getTaxWords(totalTaxAmt)}</b>
                            </td>
                        </tr>
                    </table>

                    <table class="tally-table" style="border-top:none;">
                        <tr>
                            <td style="width:60%; border: 1px solid #000;">
                                <b>Declaration</b><br>
                                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                            </td>
                            <td style="text-align:right; vertical-align:bottom; border: 1px solid #000; height:60px;">
                                <b>for ${inv.companyName}</b><br><br><br>
                                <b>Authorised Signatory</b>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
            <div style="text-align:center; font-size:9px; margin-top:5px; color:#555;">This is a Computer Generated Invoice</div>
        </div>
    `;

    const printBtn = container.querySelector('#printInvoiceBtn');
    if(printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

function renderReports() {
    storage.get({ invoices: [] }, (res) => {
        const container = document.getElementById('reportsContainer');
        if(!container) return;
        if(res.invoices.length === 0) {
            container.innerHTML = '<p style="color:#718096; font-size:13px;">No saved invoices found in Day Book.</p>';
            return;
        }
        let html = `
            <table>
                <tr><th>Invoice No</th><th>Date</th><th>Customer</th><th>Items Count</th><th>Taxable</th><th>GST Tax</th><th>Grand Total</th><th>Action</th></tr>
        `;
        res.invoices.forEach(inv => {
            html += `
                <tr>
                    <td><b>${inv.invoiceNo}</b></td>
                    <td>${inv.date}</td>
                    <td>${inv.partyName}</td>
                    <td>${inv.items.length} Item(s)</td>
                    <td>₹${inv.taxableValue}</td>
                    <td>₹${inv.totalTax}</td>
                    <td><b style="color:#276749;">₹${inv.grandTotal}</b></td>
                    <td>
                        <button class="btn alter-inv-btn" data-no="${inv.invoiceNo}" style="padding:4px 8px; margin:0 4px 0 0; font-size:11px; background:#27ae60;">Alter</button>
                        <button class="btn reprint-inv-btn" data-no="${inv.invoiceNo}" style="padding:4px 8px; margin:0 4px 0 0; font-size:11px; background:#2b6cb0;">Reprint</button>
                        <button class="btn btn-danger del-inv-btn" data-no="${inv.invoiceNo}" style="padding:4px 8px; margin:0; font-size:11px;">Delete</button>
                    </td>
                </tr>
            `;
        });
        html += `</table><p style="font-size:12px; color:#4a5568; margin-top:12px;">💡 <b>Tip:</b> Click <b>Alter</b> to modify, <b>Reprint</b> to view/print, or <b>Delete</b> to remove an invoice from the Day Book.</p>`;
        container.innerHTML = html;

        container.querySelectorAll('.alter-inv-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const invNo = btn.getAttribute('data-no');
                const invoice = res.invoices.find(i => i.invoiceNo === invNo);
                if(invoice) {
                    window.isAlteringInvoice = true;
                    switchTab('voucher');

                    document.getElementById('vInvoiceNo').value = invoice.invoiceNo;
                    if(invoice.destination) document.getElementById('vDestination').value = invoice.destination;
                    if(invoice.dispatchThrough) document.getElementById('vDispatch').value = invoice.dispatchThrough;

                    const parts = invoice.date.split('-');
                    if(parts.length === 3) {
                        const months = {Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12'};
                        let m = months[parts[1]] || '07';
                        let y = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                        document.getElementById('vInvoiceDate').value = `${y}-${m}-${parts[0].padStart(2,'0')}`;
                    }

                    storage.get({ companies: [], parties: [], items: [] }, (store) => {
                        const cSel = document.getElementById('vCompSelect');
                        const pSel = document.getElementById('vPartySelect');

                        if(cSel) cSel.innerHTML = store.companies.map(c => `<option value="${c.id}" ${c.name === invoice.companyName ? 'selected' : ''}>${c.name} (${c.gstin})</option>`).join('');
                        if(pSel) pSel.innerHTML = store.parties.map(p => `<option value="${p.id}" ${p.name === invoice.partyName ? 'selected' : ''}>${p.name} [${p.group}]</option>`).join('');

                        const tbody = document.getElementById('voucherItemRows');
                        if(tbody) {
                            tbody.innerHTML = '';
                            invoice.items.forEach(item => {
                                addVoucherRow(item.itemName, item.qty, item.rate);
                            });
                        }
                    });

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    alert('Invoice ' + invNo + ' loaded into voucher form for Alteration.');
                }
            });
        });

        container.querySelectorAll('.reprint-inv-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const invNo = btn.getAttribute('data-no');
                const invoice = res.invoices.find(i => i.invoiceNo === invNo);
                if(invoice) {
                    window.isAlteringInvoice = false;
                    switchTab('voucher');
                    renderTallyInvoice(invoice);
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
            });
        });

        container.querySelectorAll('.del-inv-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const invNo = btn.getAttribute('data-no');
                if(confirm(`Are you sure you want to delete invoice ${invNo} from the Day Book?`)) {
                    storage.get({ invoices: [] }, (sRes) => {
                        const invoices = sRes.invoices.filter(i => i.invoiceNo !== invNo);
                        storage.set({ invoices }, () => {
                            renderReports();
                            refreshAllData();
                            document.getElementById('voucherResultContainer').innerHTML = '';
                            alert(`Invoice ${invNo} deleted successfully.`);
                        });
                    });
                }
            });
        });
    });
}

function refreshAllData() {
    storage.get({ companies: [], parties: [], items: [], invoices: [] }, (res) => {
        const cb = document.getElementById('compBadge');
        const pb = document.getElementById('partyBadge');
        const ib = document.getElementById('itemBadge');
        const rb = document.getElementById('reportBadge');
        const ach = document.getElementById('activeCompanyHeader');

        if(cb) cb.innerText = res.companies.length;
        if(pb) pb.innerText = res.parties.length;
        if(ib) ib.innerText = res.items.length;
        if(rb) rb.innerText = res.invoices.length;

        if(ach) {
            if(res.companies.length > 0) {
                ach.innerText = `Active Company: ${res.companies[0].name} (${res.companies[0].gstin})`;
            } else {
                ach.innerText = `Active Company: None Selected`;
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    refreshAllData();

    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('vInvoiceDate');
    if(dateInput) dateInput.value = todayStr;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            window.isAlteringInvoice = false;
            const tabId = item.getAttribute('data-tab');
            if (tabId) switchTab(tabId);
        });
    });

    document.querySelectorAll('#dashboardNavButtons button').forEach(btn => {
        btn.addEventListener('click', () => {
            window.isAlteringInvoice = false;
            const nav = btn.getAttribute('data-nav');
            if(nav) switchTab(nav);
        });
    });

    const addRowBtn = document.getElementById('addRowBtn');
    if(addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            addVoucherRow();
        });
    }

    document.addEventListener('click', (e) => {
        if(e.target.classList.contains('remove-row-btn')) {
            const tr = e.target.closest('tr');
            const tbody = document.getElementById('voucherItemRows');
            if(tbody && tbody.rows.length > 1) {
                tr.remove();
            } else {
                alert('Invoice must contain at least one stock item.');
            }
        }
    });

    const cancelCompEditBtn = document.getElementById('cancelCompEditBtn');
    if(cancelCompEditBtn) cancelCompEditBtn.addEventListener('click', resetCompanyForm);

    const cancelPartyEditBtn = document.getElementById('cancelPartyEditBtn');
    if(cancelPartyEditBtn) cancelPartyEditBtn.addEventListener('click', resetPartyForm);

    const cancelItemEditBtn = document.getElementById('cancelItemEditBtn');
    if(cancelItemEditBtn) cancelItemEditBtn.addEventListener('click', resetItemForm);

    const saveCompBtn = document.getElementById('saveCompBtn');
    if (saveCompBtn) {
        saveCompBtn.addEventListener('click', () => {
            const editId = document.getElementById('cEditId').value;
            const name = document.getElementById('cName').value.trim();
            const state = document.getElementById('cState').value.trim();
            const gstin = document.getElementById('cGstin').value.trim();
            const email = document.getElementById('cEmail').value.trim();
            const stateName = document.getElementById('cStateName').value.trim();
            const address = document.getElementById('cAddress').value.trim();

            if(!name || !gstin) {
                alert('Company Name and GSTIN are required.');
                return;
            }

            storage.get({ companies: [] }, (res) => {
                let comps = res.companies;
                const compObj = { id: editId ? Number(editId) : Date.now(), name, state: state || gstin.substring(0,2), gstin, email, stateName, address };
                if(editId) {
                    comps = comps.map(c => c.id == editId ? compObj : c);
                } else {
                    comps.push(compObj);
                }
                storage.set({ companies: comps }, () => {
                    alert(editId ? 'Company altered successfully!' : 'Company saved successfully!');
                    resetCompanyForm();
                    renderCompanies();
                    refreshAllData();
                });
            });
        });
    }

    const savePartyBtn = document.getElementById('savePartyBtn');
    if (savePartyBtn) {
        savePartyBtn.addEventListener('click', () => {
            const editId = document.getElementById('pEditId').value;
            const name = document.getElementById('pName').value.trim();
            const group = document.getElementById('pGroup').value;
            const state = document.getElementById('pState').value.trim();
            const gstin = document.getElementById('pGstin').value.trim();
            const stateName = document.getElementById('pStateName').value.trim();
            const address = document.getElementById('pAddress').value.trim();

            if(!name) {
                alert('Party Name is required.');
                return;
            }
            if(!address) {
                alert('Party Address is required for GST Tax Invoices.');
                return;
            }

            storage.get({ parties: [] }, (res) => {
                let parties = res.parties;
                const partyObj = { id: editId ? Number(editId) : Date.now(), name, group, state: state || (gstin ? gstin.substring(0,2) : ''), gstin, stateName, address };
                if(editId) {
                    parties = parties.map(p => p.id == editId ? partyObj : p);
                } else {
                    parties.push(partyObj);
                }
                storage.set({ parties }, () => {
                    alert(editId ? 'Party ledger altered successfully!' : 'Party ledger saved successfully!');
                    resetPartyForm();
                    renderParties();
                    refreshAllData();
                });
            });
        });
    }

    const saveItemBtn = document.getElementById('saveItemBtn');
    if (saveItemBtn) {
        saveItemBtn.addEventListener('click', () => {
            const editId = document.getElementById('iEditId').value;
            const name = document.getElementById('iName').value.trim();
            const hsn = document.getElementById('iHsn').value.trim();
            const unit = document.getElementById('iUnit').value;
            const gst = parseFloat(document.getElementById('iGst').value) || 18;

            if(!name) {
                alert('Stock Item Name is required.');
                return;
            }

            storage.get({ items: [] }, (res) => {
                let items = res.items;
                const itemObj = { id: editId ? Number(editId) : Date.now(), name, hsn, unit, gst };
                if(editId) {
                    items = items.map(i => i.id == editId ? itemObj : i);
                } else {
                    items.push(itemObj);
                }
                storage.set({ items }, () => {
                    alert(editId ? 'Stock item altered successfully!' : 'Stock item saved successfully!');
                    resetItemForm();
                    renderItems();
                    refreshAllData();
                });
            });
        });
    }

    const generateInvoiceBtn = document.getElementById('generateInvoiceBtn');
    if (generateInvoiceBtn) {
        generateInvoiceBtn.addEventListener('click', () => {
            const customInvoiceNo = document.getElementById('vInvoiceNo').value.trim();
            const customInvoiceDate = document.getElementById('vInvoiceDate').value;
            const destination = document.getElementById('vDestination').value.trim();
            const dispatchThrough = document.getElementById('vDispatch').value.trim();

            if(!customInvoiceNo) {
                alert('Please enter a valid Invoice Number.');
                return;
            }
            if(!customInvoiceDate) {
                alert('Please select an Invoice Date.');
                return;
            }

            const dObj = new Date(customInvoiceDate);
            const day = String(dObj.getDate()).padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const mon = months[dObj.getMonth()];
            const yr = String(dObj.getFullYear()).slice(-2);
            const formattedDate = `${day}-${mon}-${yr}`;

            storage.get({ companies: [], parties: [], items: [] }, (res) => {
                const compId = document.getElementById('vCompSelect').value;
                const partyId = document.getElementById('vPartySelect').value;

                const company = res.companies.find(c => c.id == compId);
                const party = res.parties.find(p => p.id == partyId);

                if(!company || !party) {
                    alert('Please ensure you have created at least one Company and Party first.');
                    return;
                }

                const rowElements = document.querySelectorAll('.voucher-item-row');
                if(rowElements.length === 0) {
                    alert('Please add at least one stock item to the invoice.');
                    return;
                }

                let lineItems = [];
                let totalTaxable = 0;
                let totalCgst = 0;
                let totalSgst = 0;
                let totalIgst = 0;

                const compState = company.gstin.substring(0,2);
                const partyState = party.gstin ? party.gstin.substring(0,2) : compState;

                for(let row of rowElements) {
                    const itemId = row.querySelector('.item-select').value;
                    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
                    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;

                    const item = res.items.find(i => i.id == itemId || i.name === itemId);
                    if(!item) {
                        alert('Selected stock item is invalid.');
                        return;
                    }
                    if(qty <= 0) {
                        alert('Quantity must be greater than 0 for item: ' + item.name);
                        return;
                    }

                    const taxableValue = qty * rate;
                    const gstRate = item.gst;

                    let cgst = 0, sgst = 0, igst = 0;
                    if(party.gstin && compState !== partyState) {
                        igst = taxableValue * (gstRate / 100);
                    } else {
                        cgst = taxableValue * (gstRate / 200);
                        sgst = taxableValue * (gstRate / 200);
                    }

                    totalTaxable += taxableValue;
                    totalCgst += cgst;
                    totalSgst += sgst;
                    totalIgst += igst;

                    lineItems.push({
                        itemName: item.name,
                        hsn: item.hsn,
                        unit: item.unit,
                        qty,
                        rate,
                        taxableValue: taxableValue.toFixed(2),
                        gstRate,
                        cgst: cgst.toFixed(2),
                        sgst: sgst.toFixed(2),
                        igst: igst.toFixed(2)
                    });
                }

                let hsnGroupMap = {};
                lineItems.forEach(item => {
                    let key = (item.hsn || '7318') + '_' + item.gstRate;
                    if(!hsnGroupMap[key]) {
                        hsnGroupMap[key] = { hsn: item.hsn || '7318', gstRate: item.gstRate, taxableValue: 0 };
                    }
                    hsnGroupMap[key].taxableValue += parseFloat(item.taxableValue);
                });

                let aggregatedCgst = 0;
                let aggregatedSgst = 0;
                let aggregatedIgst = 0;
                let aggregatedTaxTotal = 0;

                Object.values(hsnGroupMap).forEach(h => {
                    let hsnTax = h.taxableValue * (h.gstRate / 100);
                    aggregatedTaxTotal += hsnTax;
                    if(compState === partyState) {
                        aggregatedCgst += hsnTax / 2;
                        aggregatedSgst += hsnTax / 2;
                    } else {
                        aggregatedIgst += hsnTax;
                    }
                });

                const exactGrandTotal = totalTaxable + aggregatedTaxTotal + 0.20;

                const invoice = {
                    invoiceNo: customInvoiceNo,
                    date: formattedDate,
                    destination,
                    dispatchThrough,
                    companyName: company.name,
                    companyGstin: company.gstin,
                    companyEmail: company.email || '',
                    companyStateCode: compState,
                    companyStateName: company.stateName || 'West Bengal',
                    companyAddress: company.address || '',
                    partyName: party.name,
                    partyGstin: party.gstin || 'Unregistered Consumer',
                    partyStateCode: partyState,
                    partyStateName: party.stateName || 'Bihar',
                    partyAddress: party.address || '',
                    items: lineItems,
                    taxableValue: totalTaxable.toFixed(2),
                    cgst: aggregatedCgst.toFixed(2),
                    sgst: aggregatedSgst.toFixed(2),
                    igst: aggregatedIgst.toFixed(2),
                    totalTax: aggregatedTaxTotal.toFixed(2),
                    totalTaxWords: getTaxWords(aggregatedTaxTotal),
                    grandTotal: exactGrandTotal.toFixed(2),
                    grandTotalWords: getAmountWords(exactGrandTotal)
                };

                storage.get({ invoices: [] }, (invRes) => {
                    const invoices = invRes.invoices;
                    const existingIndex = invoices.findIndex(i => i.invoiceNo === customInvoiceNo);
                    if(existingIndex >= 0) {
                        invoices[existingIndex] = invoice;
                    } else {
                        invoices.push(invoice);
                    }

                    storage.set({ invoices }, () => {
                        window.isAlteringInvoice = false;
                        renderTallyInvoice(invoice);
                        refreshAllData();
                        alert('Tax Invoice generated & saved in Day Book successfully!');
                    });
                });
            });
        });
    }
});