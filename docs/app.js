// app.js: 라벨 커스텀 유지, 축 교차 전환 강화 및 계열 이름 수정 기능 추가

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
let isSwapped = false;

// 탭 전환
function toggleTab(toEdit) {
  if(toEdit) {
    panelUpload.classList.add('hidden'); panelEdit.classList.remove('hidden');
    tabEdit.classList.replace('bg-slate-200', 'bg-blue-600'); tabEdit.classList.add('text-white');
    tabUpload.classList.replace('bg-blue-600', 'bg-slate-200'); tabUpload.classList.remove('text-white');
  } else {
    panelUpload.classList.remove('hidden'); panelEdit.classList.add('hidden');
    tabUpload.classList.replace('bg-slate-200', 'bg-blue-600'); tabUpload.classList.add('text-white');
    tabEdit.classList.replace('bg-blue-600', 'bg-slate-200'); tabEdit.classList.remove('text-white');
  }
}
tabUpload.addEventListener('click', () => toggleTab(false));
tabEdit.addEventListener('click', () => toggleTab(true));

// 축 교차 전환 스위치 (X <-> Y)
btnSwap.addEventListener('click', () => {
  isSwapped = !isSwapped;
  btnSwap.classList.toggle('bg-blue-600', isSwapped);
  btnSwap.classList.toggle('bg-slate-800', !isSwapped);
  document.getElementById('swapText').textContent = isSwapped ? "축 교차 전환 (Swap X-Y) On" : "축 교차 전환 (Swap X-Y) Off";
  if (workbookData) btnPlot.click();
});

// 파일 로드
btnLoad.addEventListener('click', () => {
  if (!fileInput.files.length) return alert('파일을 선택하세요.');
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    workbookData = XLSX.utils.sheet_to_json(ws, { defval: null });
    columns = Object.keys(workbookData[0]);
    renderColumnControls();
    alert('데이터 로드 완료');
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
});

function renderColumnControls() {
  const selects = ['xAxisMain', 'xAxisSub', 'yAxisMain', 'yAxisSub'].map(id => document.getElementById(id));
  selects.forEach(sel => {
    sel.innerHTML = '<option value="">선택 안함</option>';
    columns.forEach(c => sel.add(new Option(c, c)));
  });
  columnsArea.innerHTML = '';
  columns.forEach(c => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 p-2 bg-white rounded border border-slate-100 shadow-sm';
    div.innerHTML = `<input type="checkbox" name="displayField" value="${c}" id="chk_${c}" class="w-4 h-4 cursor-pointer" />
                     <label for="chk_${c}" class="text-[11px] truncate cursor-pointer font-bold text-slate-600">${c}</label>`;
    columnsArea.appendChild(div);
  });
  document.querySelectorAll('input[name="displayField"]').forEach(cb => cb.addEventListener('change', renderSeriesControls));
}

btnPlot.addEventListener('click', () => {
  if (!workbookData) return alert('데이터가 없습니다.');
  
  const xAxisMain = document.getElementById('xAxisMain').value;
  const xAxisSub = document.getElementById('xAxisSub').value;
  const yAxisMain = document.getElementById('yAxisMain').value;
  const yAxisSub = document.getElementById('yAxisSub').value;
  const displayFields = Array.from(document.querySelectorAll('input[name="displayField"]:checked')).map(i => i.value);

  if (!xAxisMain || displayFields.length === 0) return alert('X축과 데이터 계열을 선택하세요.');

  // UI에서 옵션 수집
  const options = collectOptionsFromUI();
  
  // 라벨 UI 업데이트 (기존 값 존재 시 유지 로직 포함)
  updateLabelsUI(xAxisMain, xAxisSub, yAxisMain, yAxisSub, displayFields);

  const traces = displayFields.map((ycol, idx) => {
    const activeX = (xAxisSub && idx > 0) ? xAxisSub : xAxisMain;
    
    let mapped = workbookData.map(row => ({ x: row[activeX], y: row[ycol] }))
                             .filter(d => d.x !== null && d.y !== null);

    if (mapped.length > 0 && !isNaN(mapped[0].x)) mapped.sort((a, b) => Number(a.x) - Number(b.x));

    let finalX = mapped.map(d => d.x);
    let finalY = mapped.map(d => Number(d.y));

    if (isSwapped) { [finalX, finalY] = [finalY, finalX]; }

    const sOpt = options.series[ycol] || { color: '#000000', linewidth: 2, markersize: 7, show_line: true, show_marker: true, display_name: ycol };
    
    const trace = {
      x: finalX, y: finalY, 
      name: sOpt.display_name || ycol, // 사용자 지정 이름을 범례에 반영
      mode: (sOpt.show_line ? 'lines' : '') + (sOpt.show_marker ? '+markers' : ''),
      line: { color: sOpt.color, width: sOpt.linewidth, dash: sOpt.linestyle },
      marker: { color: sOpt.color, size: sOpt.markersize, symbol: sOpt.marker, line: { color: '#000', width: 0.5 } },
      type: document.getElementById('chartType').value
    };

    if (!isSwapped) {
      if (yAxisSub && ycol === yAxisSub) trace.yaxis = 'y2';
      if (xAxisSub && idx > 0) trace.xaxis = 'x2';
    } else {
      if (yAxisSub && ycol === yAxisSub) trace.xaxis = 'x2';
      if (xAxisSub && idx > 0) trace.yaxis = 'y2';
    }

    return trace;
  });

  const labXM = document.getElementById('xlabel_main')?.value || xAxisMain;
  const labXS = document.getElementById('xlabel_sub')?.value || xAxisSub;
  const labYM = document.getElementById('ylabel_main')?.value || yAxisMain || displayFields[0];
  const labYS = document.getElementById('ylabel_sub')?.value || yAxisSub;

  const layout = {
    title: { text: document.getElementById('titleInput').value || '' },
    template: 'plotly_white',
    margin: { l: 80, r: 80, t: 80, b: 80 },
    showlegend: document.getElementById('legendShow').checked,
    legend: { x: options.legend.pos.includes('left') ? 0.05 : 0.95, y: 0.95, xanchor: options.legend.pos.includes('left') ? 'left' : 'right', bordercolor: '#000', borderwidth: 1 },
    
    xaxis: { 
      title: { text: isSwapped ? labYM : labXM, font: { weight: 'bold' } },
      showline: true, mirror: true, linewidth: 2, linecolor: '#000', 
      showgrid: options.grid.enabled, gridcolor: options.grid.color,
      type: (isSwapped ? false : options.axis.xlog) ? 'log' : '-' 
    },
    yaxis: { 
      title: { text: isSwapped ? labXM : labYM, font: { weight: 'bold' } },
      showline: true, mirror: true, linewidth: 2, linecolor: '#000', 
      showgrid: options.grid.enabled, gridcolor: options.grid.color,
      autorange: options.axis.yinvert ? 'reversed' : true
    }
  };

  if (!isSwapped) {
    if (yAxisSub) {
      layout.yaxis2 = { title: { text: labYS, font: { weight: 'bold' } }, overlaying: 'y', side: 'right', showline: true, linecolor: '#000', linewidth: 2 };
    }
    if (xAxisSub) {
      layout.xaxis2 = { title: { text: labXS, font: { weight: 'bold' } }, overlaying: 'x', side: 'top', showline: true, linecolor: '#000', linewidth: 2 };
    }
  } else {
    if (yAxisSub) {
      layout.xaxis2 = { title: { text: labYS, font: { weight: 'bold' } }, overlaying: 'x', side: 'top', showline: true, linecolor: '#000', linewidth: 2 };
    }
    if (xAxisSub) {
      layout.yaxis2 = { title: { text: labXS, font: { weight: 'bold' } }, overlaying: 'y', side: 'right', showline: true, linecolor: '#000', linewidth: 2 };
    }
  }

  const width = document.getElementById('chartWidth').value;
  const height = document.getElementById('chartHeight').value || 550;
  if(width) layout.width = width;
  layout.height = height;

  Plotly.newPlot('previewArea', traces, layout, { responsive: true, toImageButtonOptions: { format: 'png', scale: 3 } });
});

function collectOptionsFromUI() {
  const series = {};
  document.querySelectorAll('.series-control').forEach(sc => {
    const n = sc.dataset.name;
    series[n] = {
      display_name: sc.querySelector('.series-displayname').value, // 계열 이름 수집
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
  
  // 기존의 설정값 백업 (이름 등)
  const existingSettings = {};
  document.querySelectorAll('.series-control').forEach(sc => {
    const n = sc.dataset.name;
    existingSettings[n] = {
      display_name: sc.querySelector('.series-displayname').value,
      color: sc.querySelector('.series-color').value,
      linewidth: sc.querySelector('.series-linewidth').value,
      markersize: sc.querySelector('.series-markersize').value,
      marker: sc.querySelector('.series-marker').value,
      linestyle: sc.querySelector('.series-linestyle').value,
      show_line: sc.querySelector('.series-showline').checked,
      show_marker: sc.querySelector('.series-showmarker').checked
    };
  });

  container.innerHTML = '';
  const symbols = ['circle', 'square', 'triangle-up', 'diamond', 'cross'];
  checked.forEach((cb, i) => {
    const name = cb.value;
    const old = existingSettings[name] || {};
    
    const div = document.createElement('div');
    div.className = 'series-control p-3 border rounded-lg bg-slate-50';
    div.dataset.name = name;
    div.innerHTML = `
      <div class="mb-2 border-b pb-1">
        <label class="text-[9px] uppercase font-bold text-slate-400 block">Display Name</label>
        <input type="text" class="series-displayname w-full border text-xs p-1 font-bold rounded" value="${old.display_name || name}" />
      </div>
      <div class="grid grid-cols-2 gap-2 text-[10px]">
        <label>Color <input type="color" class="series-color w-full h-4" value="${old.color || '#000000'}" /></label>
        <label>Symbol <select class="series-marker w-full border">${symbols.map(s => `<option value="${s}" ${(old.marker || symbols[i%5])===s?'selected':''}>${s}</option>`).join('')}</select></label>
        <label>Line <input type="number" class="series-linewidth w-full border" value="${old.linewidth || '2'}" /></label>
        <label>Size <input type="number" class="series-markersize w-full border" value="${old.markersize || '7'}" /></label>
        <div class="col-span-2 flex gap-2 pt-1">
          <label><input type="checkbox" class="series-showline" ${old.show_line !== false ? 'checked' : ''} /> 선</label>
          <label><input type="checkbox" class="series-showmarker" ${old.show_marker !== false ? 'checked' : ''} /> 마커</label>
          <select class="series-linestyle border ml-auto">
            <option value="solid" ${old.linestyle==='solid'?'selected':''}>Solid</option>
            <option value="dash" ${old.linestyle==='dash'?'selected':''}>Dash</option>
          </select>
        </div>
      </div>`;
    container.appendChild(div);
  });
}

function updateLabelsUI(xMain, xSub, yMain, ySub, yFields) {
  const xCon = document.getElementById('xlabels-container');
  const yCon = document.getElementById('ylabels-container');
  
  const curXM = document.getElementById('xlabel_main')?.value;
  const curXS = document.getElementById('xlabel_sub')?.value;
  const curYM = document.getElementById('ylabel_main')?.value;
  const curYS = document.getElementById('ylabel_sub')?.value;

  let xHtml = `<label class="text-[10px] font-bold">주 X축 라벨</label>
               <input id="xlabel_main" class="border p-2 rounded w-full text-xs" value="${curXM !== undefined ? curXM : xMain}" />`;
  if(xSub) {
    xHtml += `<label class="text-[10px] font-bold mt-2 block">보조 X축 라벨</label>
              <input id="xlabel_sub" class="border p-2 rounded w-full text-xs" value="${curXS !== undefined ? curXS : xSub}" />`;
  }
  xCon.innerHTML = xHtml;

  let yHtml = `<label class="text-[10px] font-bold">주 Y축 라벨</label>
               <input id="ylabel_main" class="border p-2 rounded w-full text-xs" value="${curYM !== undefined ? curYM : (yMain || yFields[0])}" />`;
  if(ySub) {
    yHtml += `<label class="text-[10px] font-bold mt-2 block">보조 Y축 라벨</label>
              <input id="ylabel_sub" class="border p-2 rounded w-full text-xs" value="${curYS !== undefined ? curYS : ySub}" />`;
  }
  yCon.innerHTML = yHtml;
}

btnUpdate.addEventListener('click', () => btnPlot.click());
