// app.js: 기존 기능을 모두 포함하되 데이터 매칭 버그를 수정한 버전

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

let workbookData = null; 
let columns = [];

// 탭 전환
tabUpload.addEventListener('click', ()=>{
  panelUpload.classList.remove('hidden'); panelEdit.classList.add('hidden');
  tabUpload.classList.add('bg-blue-500', 'text-white'); tabEdit.classList.remove('bg-blue-500', 'text-white');
});
tabEdit.addEventListener('click', ()=>{
  panelUpload.classList.add('hidden'); panelEdit.classList.remove('hidden');
  tabEdit.classList.add('bg-blue-500', 'text-white'); tabUpload.classList.remove('bg-blue-500', 'text-white');
});

// 파일 로드
btnLoad.addEventListener('click', () => {
  if (!fileInput.files.length) return alert('엑셀 파일을 선택하세요');
  const f = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const first = wb.SheetNames[0];
    const ws = wb.Sheets[first];
    workbookData = XLSX.utils.sheet_to_json(ws, { defval: null });
    
    if (workbookData.length === 0) return alert('데이터가 없습니다.');
    
    columns = Object.keys(workbookData[0]);
    renderColumns(columns);
    alert(`로드 완료: ${workbookData.length}행`);
  };
  reader.readAsArrayBuffer(f);
});

function renderColumns(cols) {
  const selects = ['xAxisMain', 'xAxisSub', 'yAxisMain', 'yAxisSub'].map(id => document.getElementById(id));
  selects.forEach(sel => {
    sel.innerHTML = '<option value="">선택 안함</option>';
    cols.forEach(c => sel.add(new Option(c, c)));
  });

  columnsArea.innerHTML = '';
  cols.forEach(c => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 p-1';
    div.innerHTML = `<input type="checkbox" name="displayField" value="${c}" id="chk_${c}" />
                     <label for="chk_${c}" class="text-sm truncate cursor-pointer">${c}</label>`;
    columnsArea.appendChild(div);
  });
  
  document.querySelectorAll('input[name="displayField"]').forEach(cb => {
    cb.addEventListener('change', renderSeriesControls);
  });
}

// [핵심] 차트 생성 로직
btnPlot.addEventListener('click', () => {
  if (!workbookData) return alert('데이터가 없습니다.');

  const xAxisMain = document.getElementById('xAxisMain').value;
  const xAxisSub = document.getElementById('xAxisSub').value;
  const yAxisSub = document.getElementById('yAxisSub').value;
  const displayFields = Array.from(document.querySelectorAll('input[name="displayField"]:checked')).map(i => i.value);

  if (!xAxisMain && !xAxisSub) return alert('X축을 선택하세요.');
  if (displayFields.length === 0) return alert('Y축 데이터를 선택하세요.');

  const options = collectOptionsFromUI();
  updateAxisLabelUI([xAxisMain, xAxisSub].filter(Boolean), displayFields);

  const traces = [];
  const layout = {
    title: document.getElementById('titleInput').value || '',
    xaxis: { title: document.getElementById('xlabel_0')?.value || xAxisMain, automargin: true },
    yaxis: { title: document.getElementById('ylabel_0')?.value || displayFields[0], automargin: true },
    template: 'plotly_white',
    showlegend: document.getElementById('legendShow').checked,
    grid: { rows: 1, columns: 1, pattern: 'independent' }
  };

  displayFields.forEach((ycol, idx) => {
    const currentX = (idx > 0 && xAxisSub) ? xAxisSub : xAxisMain;
    
    // 데이터 매칭 수정: Row 단위로 x, y를 직접 매핑
    let mapped = workbookData.map(row => ({
      x: row[currentX],
      y: row[ycol]
    })).filter(d => d.x !== null && d.y !== null);

    // X축 기준 정렬 (데이터 매칭 꼬임 방지 핵심)
    if (mapped.length > 0 && !isNaN(mapped[0].x)) {
      mapped.sort((a, b) => Number(a.x) - Number(b.x));
    }

    const seriesOpt = options.series[ycol] || { color: '#1f77b4', linewidth: 2, markersize: 6, show_line: true, show_marker: true };
    
    const trace = {
      x: mapped.map(d => d.x),
      y: mapped.map(d => Number(d.y)),
      name: ycol,
      mode: (seriesOpt.show_line ? 'lines' : '') + (seriesOpt.show_marker ? '+markers' : ''),
      line: { color: seriesOpt.color, width: seriesOpt.linewidth, dash: seriesOpt.linestyle },
      marker: { color: seriesOpt.color, size: seriesOpt.markersize, symbol: seriesOpt.marker },
      type: document.getElementById('chartType').value
    };

    // 보조 Y축 설정
    if (yAxisSub && ycol === yAxisSub) {
      trace.yaxis = 'y2';
      layout.yaxis2 = { title: yAxisSub, overlaying: 'y', side: 'right', automargin: true };
    }

    traces.push(trace);
  });

  // 기타 레이아웃 옵션 적용
  if (options.axis.xlog) layout.xaxis.type = 'log';
  if (options.axis.yinvert) layout.yaxis.autorange = 'reversed';
  if (options.grid.enabled) {
    layout.xaxis.showgrid = true; layout.xaxis.gridcolor = options.grid.color;
    layout.yaxis.showgrid = true; layout.yaxis.gridcolor = options.grid.color;
  }

  const width = document.getElementById('chartWidth').value;
  const height = document.getElementById('chartHeight').value || 500;
  if (width) layout.width = width;
  layout.height = height;

  Plotly.newPlot('previewArea', traces, layout, { responsive: true });
});

// UI 설정 수집용 함수
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
    series: series
  };
}

function renderSeriesControls() {
  const container = document.getElementById('seriesControls');
  const checked = Array.from(document.querySelectorAll('input[name="displayField"]:checked'));
  container.innerHTML = '';
  checked.forEach((cb, i) => {
    const name = cb.value;
    const div = document.createElement('div');
    div.className = 'series-control p-2 border rounded bg-white';
    div.dataset.name = name;
    div.innerHTML = `
      <div class="font-bold text-xs mb-1 border-b">${name}</div>
      <div class="grid grid-cols-2 gap-1 text-[10px]">
        <label>색상 <input type="color" class="series-color w-full h-4" value="${['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'][i % 4]}" /></label>
        <label>마커 <select class="series-marker w-full border"><option value="circle">●</option><option value="square">■</option></select></label>
        <label>두께 <input type="number" class="series-linewidth w-full border" value="2" /></label>
        <label>크기 <input type="number" class="series-markersize w-full border" value="6" /></label>
        <label class="col-span-2">스타일 <select class="series-linestyle w-full border"><option value="solid">실선</option><option value="dash">파선</option></select></label>
        <div class="flex gap-2 mt-1">
          <label><input type="checkbox" class="series-showline" checked /> 선</label>
          <label><input type="checkbox" class="series-showmarker" checked /> 표식</label>
        </div>
      </div>`;
    container.appendChild(div);
  });
}

function updateAxisLabelUI(x_fields, y_fields) {
  const xCon = document.getElementById('xlabels-container');
  const yCon = document.getElementById('ylabels-container');
  xCon.innerHTML = ''; yCon.innerHTML = '';
  x_fields.forEach((f, i) => {
    xCon.innerHTML += `<label class="block text-xs mt-1">X축 ${i+1} (${f})</label><input id="xlabel_${i}" class="border p-1 rounded w-full text-sm" value="${f}" />`;
  });
  y_fields.forEach((f, i) => {
    yCon.innerHTML += `<label class="block text-xs mt-1">Y축 ${i+1} (${f})</label><input id="ylabel_${i}" class="border p-1 rounded w-full text-sm" value="${f}" />`;
  });
}

btnUpdate.addEventListener('click', () => btnPlot.click());
