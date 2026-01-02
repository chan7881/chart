// app.js: 범례 위치(Bottom) 지원 및 보조축 Zeroline 버그 수정 포함

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

// 축 교차
btnSwap.addEventListener('click', () => {
  isSwapped = !isSwapped;
  const swapText = document.getElementById('swapText');
  
  if (isSwapped) {
    btnSwap.classList.replace('bg-slate-800', 'bg-blue-600');
    swapText.textContent = "축 교차 전환 (Swap X-Y) On";
  } else {
    btnSwap.classList.replace('bg-blue-600', 'bg-slate-800');
    swapText.textContent = "축 교차 전환 (Swap X-Y) Off";
  }
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
    
    if(!workbookData || workbookData.length === 0) return alert('데이터가 없습니다.');
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
    div.className = 'flex items-center gap-2 bg-white p-2 rounded shadow-sm border';
    div.innerHTML = `<input type="checkbox" name="displayField" value="${c}" id="chk_${c}" class="w-4 h-4 cursor-pointer" />
                     <label for="chk_${c}" class="text-xs truncate cursor-pointer font-bold text-slate-700 flex-1">${c}</label>`;
    columnsArea.appendChild(div);
  });
  
  document.querySelectorAll('input[name="displayField"]').forEach(cb => {
    cb.addEventListener('change', () => renderSeriesControls());
  });
}

btnPlot.addEventListener('click', () => {
  if (!workbookData) return alert('데이터가 없습니다.');
  
  const xAxisMain = document.getElementById('xAxisMain').value;
  const xAxisSub = document.getElementById('xAxisSub').value;
  const yAxisMain = document.getElementById('yAxisMain').value;
  const yAxisSub = document.getElementById('yAxisSub').value;
  const displayFields = Array.from(document.querySelectorAll('input[name="displayField"]:checked')).map(i => i.value);

  if (!xAxisMain || displayFields.length === 0) return alert('Main X축과 계열을 선택하세요.');

  const options = collectOptionsFromUI();
  updateLabelsUI(xAxisMain, xAxisSub, yAxisMain, yAxisSub, displayFields);

  const traces = displayFields.map((ycol, idx) => {
    const activeX = (xAxisSub && idx > 0) ? xAxisSub : xAxisMain;
    
    let mapped = workbookData.map(row => ({ x: row[activeX], y: row[ycol] }))
                             .filter(d => d.x !== null && d.y !== null);

    if (mapped.length > 0 && !isNaN(mapped[0].x)) {
      mapped.sort((a, b) => Number(a.x) - Number(b.x));
    }

    let finalX = mapped.map(d => d.x);
    let finalY = mapped.map(d => Number(d.y));

    if (isSwapped) { [finalX, finalY] = [finalY, finalX]; }

    const sOpt = options.series[ycol] || getDefaultSeriesStyle(ycol);
    
    const trace = {
      x: finalX, y: finalY, 
      name: sOpt.display_name,
      mode: (sOpt.show_line ? 'lines' : '') + (sOpt.show_marker ? '+markers' : ''),
      line: { color: sOpt.color, width: sOpt.linewidth, dash: sOpt.linestyle },
      marker: { color: sOpt.color, size: sOpt.markersize, symbol: sOpt.marker, line: { color: '#333', width: 0.5 } },
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

  const labXM = document.getElementById('xlabel_main').value;
  const labXS = document.getElementById('xlabel_sub') ? document.getElementById('xlabel_sub').value : '';
  const labYM = document.getElementById('ylabel_main').value;
  const labYS = document.getElementById('ylabel_sub') ? document.getElementById('ylabel_sub').value : '';

  const layout = {
    title: { text: document.getElementById('titleInput').value || '' },
    template: 'plotly_white',
    margin: { l: 80, r: 80, t: 80, b: 80 },
    showlegend: document.getElementById('legendShow').checked,
    
    // [FIX] 범례 위치 설정 강화 (Top/Bottom, Left/Right 지원)
    legend: { 
      x: options.legend.pos.includes('left') ? 0.02 : 0.98, 
      y: options.legend.pos.includes('bottom') ? 0.02 : 0.98, 
      xanchor: options.legend.pos.includes('left') ? 'left' : 'right', 
      yanchor: options.legend.pos.includes('bottom') ? 'bottom' : 'top',
      bordercolor: '#ccc', borderwidth: 1 
    },
    
    // 주축 (Main Axis)
    xaxis: { 
      title: { text: isSwapped ? labYM : labXM, font: { weight: 'bold' } },
      showline: true, mirror: true, linewidth: 2, linecolor: '#333', 
      showgrid: options.grid.enabled, 
      zeroline: options.grid.enabled, 
      gridcolor: options.grid.color,
      type: (isSwapped ? false : options.axis.xlog) ? 'log' : '-' 
    },
    yaxis: { 
      title: { text: isSwapped ? labXM : labYM, font: { weight: 'bold' } },
      showline: true, mirror: true, linewidth: 2, linecolor: '#333', 
      showgrid: options.grid.enabled, 
      zeroline: options.grid.enabled, 
      gridcolor: options.grid.color,
      autorange: options.axis.yinvert ? 'reversed' : true
    }
  };

  // 보조축 (Sub Axis) 설정 - zeroline: false 유지
  if (!isSwapped) {
    if (yAxisSub) layout.yaxis2 = { 
        title: { text: labYS, font: { weight: 'bold' } }, overlaying: 'y', side: 'right', 
        showline: true, linecolor: '#333', linewidth: 2, 
        showgrid: false, zeroline: false 
    };
    if (xAxisSub) layout.xaxis2 = { 
        title: { text: labXS, font: { weight: 'bold' } }, overlaying: 'x', side: 'top', 
        showline: true, linecolor: '#333', linewidth: 2, 
        showgrid: false, zeroline: false 
    };
  } else {
    // Swap 모드
    if (yAxisSub) layout.xaxis2 = { 
        title: { text: labYS, font: { weight: 'bold' } }, overlaying: 'x', side: 'top', 
        showline: true, linecolor: '#333', linewidth: 2, 
        showgrid: false, zeroline: false 
    };
    if (xAxisSub) layout.yaxis2 = { 
        title: { text: labXS, font: { weight: 'bold' } }, overlaying: 'y', side: 'right', 
        showline: true, linecolor: '#333', linewidth: 2, 
        showgrid: false, zeroline: false 
    };
  }

  const w = document.getElementById('chartWidth').value;
  const h = document.getElementById('chartHeight').value;
  if (w) layout.width = Number(w);
  if (h) layout.height = Number(h);

  Plotly.newPlot('previewArea', traces, layout, { responsive: true, displayModeBar: true });
});

function collectOptionsFromUI() {
  const series = {};
  document.querySelectorAll('.series-control').forEach(sc => {
    const n = sc.dataset.name;
    series[n] = {
      display_name: sc.querySelector('.series-displayname').value,
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

function getDefaultSeriesStyle(name) {
  return { color: '#000000', linewidth: 2, markersize: 8, show_line: true, show_marker: true, display_name: name, marker: 'circle', linestyle: 'solid' };
}

function renderSeriesControls() {
  const container = document.getElementById('seriesControls');
  const checked = Array.from(document.querySelectorAll('input[name="displayField"]:checked'));
  const backup = {};
  document.querySelectorAll('.series-control').forEach(sc => {
    backup[sc.dataset.name] = {
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
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2'];

  checked.forEach((cb, i) => {
    const name = cb.value;
    const old = backup[name] || {
      display_name: name, color: colors[i % colors.length], linewidth: 2, markersize: 8, marker: symbols[i % symbols.length], linestyle: 'solid', show_line: true, show_marker: true
    };
    const div = document.createElement('div');
    div.className = 'series-control p-3 border rounded-lg bg-slate-50 text-xs shadow-sm';
    div.dataset.name = name;
    div.innerHTML = `
      <div class="mb-2 border-b pb-2">
         <div class="flex justify-between items-center mb-1">
             <span class="font-bold text-slate-500 truncate max-w-[80px]">${name}</span>
             <span class="text-[9px] text-slate-400">Legend Name</span>
         </div>
         <input type="text" class="series-displayname w-full border p-1 rounded font-bold bg-white" value="${old.display_name}" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label>Color <input type="color" class="series-color w-full h-4" value="${old.color}" /></label>
        <label>Sym <select class="series-marker w-full border rounded"><option value="circle">●</option><option value="square">■</option><option value="triangle-up">▲</option><option value="diamond">◆</option></select></label>
        <label>Wid <input type="number" class="series-linewidth w-full border rounded" value="${old.linewidth}" step="0.5" /></label>
        <label>Size <input type="number" class="series-markersize w-full border rounded" value="${old.markersize}" /></label>
        <div class="col-span-2 flex gap-3 mt-1">
           <label><input type="checkbox" class="series-showline" ${old.show_line?'checked':''} /> Line</label>
           <label><input type="checkbox" class="series-showmarker" ${old.show_marker?'checked':''} /> Mark</label>
           <select class="series-linestyle border ml-auto rounded"><option value="solid">Solid</option><option value="dash">Dash</option></select>
        </div>
      </div>`;
    div.querySelector('.series-marker').value = old.marker;
    div.querySelector('.series-linestyle').value = old.linestyle;
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

  let xHtml = `<input id="xlabel_main" class="border p-2 rounded w-full text-xs" value="${curXM !== undefined ? curXM : xMain}" placeholder="Main X" />`;
  if(xSub) {
    xHtml += `<input id="xlabel_sub" class="border p-2 rounded w-full text-xs mt-2" value="${curXS !== undefined ? curXS : xSub}" placeholder="Sub X" />`;
  }
  xCon.innerHTML = xHtml;

  let yHtml = `<input id="ylabel_main" class="border p-2 rounded w-full text-xs" value="${curYM !== undefined ? curYM : (yMain || yFields[0])}" placeholder="Main Y" />`;
  if(ySub) {
    yHtml += `<input id="ylabel_sub" class="border p-2 rounded w-full text-xs mt-2" value="${curYS !== undefined ? curYS : ySub}" placeholder="Sub Y" />`;
  }
  yCon.innerHTML = yHtml;
}

btnUpdate.addEventListener('click', () => btnPlot.click());
