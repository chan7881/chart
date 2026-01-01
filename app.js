// app.js: 논문용 차트 생성 및 축 전환 기능 포함

const fileInput = document.getElementById('fileInput');
const btnLoad = document.getElementById('btnLoad');
const columnsArea = document.getElementById('columnsArea');
const btnPlot = document.getElementById('btnPlot');
const previewArea = document.getElementById('previewArea');
const tabUpload = document.getElementById('tab-upload');
const tabEdit = document.getElementById('tab-edit');
const panelUpload = document.getElementById('panel-upload');
const panelEdit = document.getElementById('panel-edit');
const btnUpdate = document.getElementById('btnUpdatePreview');
const btnSwap = document.getElementById('btnSwapAxis');

let workbookData = null; 
let columns = [];
let isSwapped = false; // 축 교차 전환 상태

// 탭 전환 로직 (반응형 대응)
function switchTab(activeTab, activePanel, inactiveTab, inactivePanel) {
    activeTab.classList.replace('bg-slate-200', 'bg-blue-600');
    activeTab.classList.replace('text-slate-600', 'text-white');
    inactiveTab.classList.replace('bg-blue-600', 'bg-slate-200');
    inactiveTab.classList.replace('text-white', 'text-slate-600');
    activePanel.classList.remove('hidden');
    inactivePanel.classList.add('hidden');
}

tabUpload.addEventListener('click', () => switchTab(tabUpload, panelUpload, tabEdit, panelEdit));
tabEdit.addEventListener('click', () => switchTab(tabEdit, panelEdit, tabUpload, panelUpload));

// 축 교차 전환 버튼 토글
btnSwap.addEventListener('click', () => {
    isSwapped = !isSwapped;
    btnSwap.classList.toggle('bg-amber-100', isSwapped);
    btnSwap.classList.toggle('text-amber-900', isSwapped);
    document.getElementById('swapText').textContent = isSwapped ? "축 교차 전환 (Swap X-Y) On" : "축 교차 전환 (Swap X-Y) Off";
    alert(isSwapped ? "X축을 Y축으로, Y축을 X축으로 교차하여 출력합니다." : "표준 축 설정으로 돌아갑니다.");
});

// 파일 로드
btnLoad.addEventListener('click', () => {
    if (!fileInput.files.length) return alert('엑셀 파일을 선택하세요.');
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        workbookData = XLSX.utils.sheet_to_json(ws, { defval: null });
        if (workbookData.length === 0) return alert('데이터가 비어있습니다.');
        columns = Object.keys(workbookData[0]);
        renderColumnSelectors();
        alert(`총 ${workbookData.length}개의 데이터 행을 로드했습니다.`);
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
});

function renderColumnSelectors() {
    const selects = ['xAxisMain', 'xAxisSub', 'yAxisMain', 'yAxisSub'].map(id => document.getElementById(id));
    selects.forEach(sel => {
        sel.innerHTML = '<option value="">-- 선택 안함 --</option>';
        columns.forEach(c => sel.add(new Option(c, c)));
    });
    columnsArea.innerHTML = '';
    columns.forEach(c => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 p-2 bg-white rounded border border-slate-200 hover:border-blue-400 transition';
        div.innerHTML = `<input type="checkbox" name="displayField" value="${c}" id="chk_${c}" class="w-4 h-4 cursor-pointer" />
                         <label for="chk_${c}" class="text-[12px] truncate cursor-pointer font-semibold text-slate-700">${c}</label>`;
        columnsArea.appendChild(div);
    });
    document.querySelectorAll('input[name="displayField"]').forEach(cb => cb.addEventListener('change', renderSeriesControls));
}

// 차트 생성 및 갱신
btnPlot.addEventListener('click', () => {
    if (!workbookData) return alert('먼저 엑셀 데이터를 로드하세요.');
    const xAxisMain = document.getElementById('xAxisMain').value;
    const yAxisSub = document.getElementById('yAxisSub').value;
    const displayFields = Array.from(document.querySelectorAll('input[name="displayField"]:checked')).map(i => i.value);

    if (!xAxisMain || displayFields.length === 0) return alert('X축과 표시할 데이터 계열을 선택하세요.');

    const options = collectOptionsFromUI();
    updateAxisLabelUI(xAxisMain, displayFields);

    const traces = displayFields.map((ycol, idx) => {
        // [수정 사항]: 축 교차 전환 반영 로직
        let rawX = workbookData.map(row => row[xAxisMain]);
        let rawY = workbookData.map(row => row[ycol]);

        let mapped = rawX.map((x, i) => ({ x: x, y: rawY[i] }))
                         .filter(d => d.x !== null && d.y !== null);

        // 숫자형일 경우 X축 기준 정렬
        if (mapped.length > 0 && !isNaN(mapped[0].x)) {
            mapped.sort((a, b) => Number(a.x) - Number(b.x));
        }

        let finalX = mapped.map(d => d.x);
        let finalY = mapped.map(d => Number(d.y));

        // [핵심] Swap 기능: X와 Y를 뒤바꿈
        if (isSwapped) {
            let temp = finalX;
            finalX = finalY;
            finalY = temp;
        }

        const seriesOpt = options.series[ycol] || { color: '#000000', linewidth: 2, markersize: 7, show_line: true, show_marker: true };
        
        const trace = {
            x: finalX,
            y: finalY,
            name: ycol,
            mode: (seriesOpt.show_line ? 'lines' : '') + (seriesOpt.show_marker ? '+markers' : ''),
            line: { color: seriesOpt.color, width: seriesOpt.linewidth, dash: seriesOpt.linestyle },
            marker: { color: seriesOpt.color, size: seriesOpt.markersize, symbol: seriesOpt.marker, line: { color: '#000', width: 1 } },
            type: document.getElementById('chartType').value
        };

        if (yAxisSub && ycol === yAxisSub) {
            trace.yaxis = 'y2';
        }
        return trace;
    });

    const layout = {
        title: { text: document.getElementById('titleInput').value || '', font: { size: 18, color: '#000' } },
        template: 'plotly_white',
        xaxis: { 
            title: { text: isSwapped ? (displayFields[0] || 'Dependent') : (document.getElementById('xlabel_0')?.value || xAxisMain), font: { size: 14, color: '#000' } }, 
            showline: true, mirror: true, linecolor: '#000', linewidth: 2, showgrid: options.grid.enabled, gridcolor: options.grid.color,
            type: options.axis.xlog ? 'log' : '-'
        },
        yaxis: { 
            title: { text: isSwapped ? xAxisMain : (document.getElementById('ylabel_0')?.value || displayFields[0]), font: { size: 14, color: '#000' } }, 
            showline: true, mirror: true, linecolor: '#000', linewidth: 2, showgrid: options.grid.enabled, gridcolor: options.grid.color,
            autorange: options.axis.yinvert ? 'reversed' : true
        },
        margin: { l: 70, r: 70, t: 70, b: 70 },
        showlegend: document.getElementById('legendShow').checked,
        legend: { x: options.legend.pos === 'top left' ? 0.02 : 0.98, y: 0.98, xanchor: options.legend.pos === 'top left' ? 'left' : 'right', bordercolor: '#000', borderwidth: 1 }
    };

    if (yAxisSub) {
        layout.yaxis2 = { title: yAxisSub, overlaying: 'y', side: 'right', showline: true, linecolor: '#000', linewidth: 2 };
    }

    const config = { responsive: true, toImageButtonOptions: { format: 'png', filename: 'paper_graph', scale: 2 } };
    const width = document.getElementById('chartWidth').value;
    const height = document.getElementById('chartHeight').value || 550;
    if (width) layout.width = width;
    layout.height = height;

    previewArea.innerHTML = '';
    Plotly.newPlot(previewArea, traces, layout, config);
});

function collectOptionsFromUI() {
    const series = {};
    document.querySelectorAll('.series-control').forEach(sc => {
        const n = sc.dataset.name;
        series[n] = {
            color: sc.querySelector('.series-color').value,
            linewidth: Number(sc.querySelector('.series-linewidth').value),
            markersize: Number(sc.querySelector('.series-markersize').value),
            marker: sc.querySelector('.series-marker').value,
            linestyle: sc.querySelector('.series-linestyle').value,
            show_line: sc.querySelector('.series-showline').checked,
            show_marker: sc.querySelector('.series-showmarker').checked
        };
    });
    return {
        axis: { xlog: document.getElementById('xlog').checked, yinvert: document.getElementById('yinvert').checked },
        grid: { enabled: document.getElementById('gridToggle').checked, color: document.getElementById('gridColor').value },
        legend: { pos: document.getElementById('legendPos').value },
        series: series
    };
}

function renderSeriesControls() {
    const container = document.getElementById('seriesControls');
    const checked = Array.from(document.querySelectorAll('input[name="displayField"]:checked'));
    container.innerHTML = '';
    const symbols = ['circle', 'square', 'triangle-up', 'diamond', 'cross'];
    checked.forEach((cb, i) => {
        const name = cb.value;
        const div = document.createElement('div');
        div.className = 'series-control p-3 border rounded-lg bg-slate-50 shadow-sm';
        div.dataset.name = name;
        div.innerHTML = `
            <div class="font-bold text-[11px] mb-2 border-b border-slate-200 pb-1 text-slate-500 truncate">${name}</div>
            <div class="grid grid-cols-2 gap-2 text-[10px]">
                <label>Color <input type="color" class="series-color w-full h-4" value="#000000" /></label>
                <label>Symbol <select class="series-marker w-full border">${symbols.map(s => `<option value="${s}" ${symbols[i%5]===s?'selected':''}>${s}</option>`).join('')}</select></label>
                <label>Line W <input type="number" class="series-linewidth w-full border" value="2" /></label>
                <label>Size <input type="number" class="series-markersize w-full border" value="7" /></label>
                <div class="col-span-2 flex gap-3 pt-1">
                    <label class="flex items-center"><input type="checkbox" class="series-showline" checked /> Line</label>
                    <label class="flex items-center"><input type="checkbox" class="series-showmarker" checked /> Marker</label>
                    <select class="series-linestyle border ml-auto"><option value="solid">Solid</option><option value="dash">Dash</option></select>
                </div>
            </div>`;
        container.appendChild(div);
    });
}

function updateAxisLabelUI(xAxis, yFields) {
    const xCon = document.getElementById('xlabels-container');
    const yCon = document.getElementById('ylabels-container');
    xCon.innerHTML = `<label class="text-xs font-bold text-slate-500">X축 라벨</label><input id="xlabel_0" class="border p-2 rounded w-full text-sm" value="${xAxis}" />`;
    yCon.innerHTML = `<label class="text-xs font-bold text-slate-500">Y축 라벨</label><input id="ylabel_0" class="border p-2 rounded w-full text-sm" value="${yFields[0] || 'Value'}" />`;
}

btnUpdate.addEventListener('click', () => btnPlot.click());
