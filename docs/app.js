// app.js: 논문용 그래프 생성 최적화 및 데이터 매칭 버그 수정

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
  tabUpload.classList.replace('bg-gray-300', 'bg-blue-600'); tabUpload.classList.add('text-white');
  tabEdit.classList.replace('bg-blue-600', 'bg-gray-300'); tabEdit.classList.remove('text-white');
});
tabEdit.addEventListener('click', ()=>{
  panelUpload.classList.add('hidden'); panelEdit.classList.remove('hidden');
  tabEdit.classList.replace('bg-gray-300', 'bg-blue-600'); tabEdit.classList.add('text-white');
  tabUpload.classList.replace('bg-blue-600', 'bg-gray-300'); tabUpload.classList.remove('text-white');
});

// 파일 로드
btnLoad.addEventListener('click', () => {
  if (!fileInput.files.length) return alert('엑셀 파일을 선택하세요');
  const f = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    workbookData = XLSX.utils.sheet_to_json(ws, { defval: null });
    
    if (workbookData.length === 0) return alert('데이터가 없습니다.');
    
    columns = Object.keys(workbookData[0]);
    renderColumns(columns);
    alert(`파일 로드 완료: ${workbookData.length}개의 행 발견`);
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
    div.className = 'flex items-center gap-2 p-2 hover:bg-gray-50 border rounded transition';
    div.innerHTML = `<input type="checkbox" name="displayField" value="${c}" id="chk_${c}" class="w-4 h-4 cursor-pointer" />
                     <label for="chk_${c}" class="text-xs truncate cursor-pointer font-medium">${c}</label>`;
    columnsArea.appendChild(div);
  });
  
  document.querySelectorAll('input[name="displayField"]').forEach(cb => {
    cb.addEventListener('change', renderSeriesControls);
  });
}

// 차트 생성
btnPlot.addEventListener('click', () => {
  if (!workbookData) return alert('먼저 엑셀 데이터를 로드하세요.');

  const xAxisMain = document.getElementById('xAxisMain').value;
  const xAxisSub = document.getElementById('xAxisSub').value;
  const yAxisMain = document.getElementById('yAxisMain').value; // 주 Y축
  const yAxisSub = document.getElementById('yAxisSub').value; // 보조 Y축
  const displayFields = Array.from(document.querySelectorAll('input[name="displayField"]:checked')).map(i => i.value);

  if (!xAxisMain && !xAxisSub) return alert('X축을 최소 하나 선택해야 합니다.');
  if (displayFields.length === 0) return alert('그래프에 표시할 데이터 항목을 체크하세요.');

  const options = collectOptionsFromUI();
  updateAxisLabelUI([xAxisMain, xAxisSub].filter(Boolean), displayFields);

  const traces = [];
  const layout = {
    title: { text: document.getElementById('titleInput').value || '', font: { size: 18, family: 'Arial', color: '#000' } },
    template: 'plotly_white',
    xaxis: { 
        title: { text: document.getElementById('xlabel_0')?.value || xAxisMain, font: { size: 14, color: '#000', weight: 'bold' } }, 
        showline: true, mirror: true, linecolor: '#000', linewidth: 2, 
        showgrid: options.grid.enabled, gridcolor: options.grid.color,
        ticks: 'outside', tickfont: { color: '#000' }
    },
    yaxis: { 
        title: { text: document.getElementById('ylabel_0')?.value || (displayFields[0] || 'Value'), font: { size: 14, color: '#000', weight: 'bold' } }, 
        showline: true, mirror: true, linecolor: '#000', linewidth: 2, 
        showgrid: options.grid.enabled, gridcolor: options.grid.color,
        ticks: 'outside', tickfont: { color: '#000' }
    },
    margin: { l: 80, r: 80, t: 80, b: 80 },
    showlegend: document.getElementById('legendShow').checked,
    legend: { bordercolor: '#000', borderwidth: 1, bgcolor: 'rgba(255,255,255,0)' }
  };

  displayFields.forEach((ycol, idx) => {
    const currentX = (idx > 0 && xAxisSub) ? xAxisSub : xAxisMain;
    
    // [데이터 매칭 오류 해결]
    let mapped = workbookData.map(row => ({
      x: row[currentX],
      y: row[ycol]
    })).filter(d => d.x !== null && d.y !== null);

    // [정렬] X축 기준 정렬 (논문 그래프의 기본)
    if (mapped.length > 0 && !isNaN(mapped[0].x)) {
      mapped.sort((a, b) => Number(a.x) - Number(b.x));
    }

    const seriesOpt = options.series[ycol] || { color: '#000000', linewidth: 2, markersize: 7, show_line: true, show_marker: true };
    
    const trace = {
      x: mapped.map(d => d.x),
      y: mapped.map(d => Number(d.y)),
      name: ycol,
      mode: (seriesOpt.show_line ? 'lines' : '') + (seriesOpt.show_marker ? '+markers' : ''),
      line: { color: seriesOpt.color, width: seriesOpt.linewidth, dash: seriesOpt.linestyle },
      marker: { color: seriesOpt.color, size: seriesOpt.markersize, symbol: seriesOpt.marker, line: { color: '#000', width: 1 } },
      type: document.getElementById('chartType').value
    };

    // 주축/보조축 할당 로직
    if (yAxisSub && ycol === yAxisSub) {
      trace.yaxis = 'y2';
      layout.yaxis2 = { 
        title: { text: yAxisSub, font: { size: 14, color: '#000' } }, 
        overlaying: 'y', side: 'right', showline: true, linecolor: '#000', linewidth: 2, ticks: 'outside' 
      };
    }

    traces.push(trace);
  });

  if (options.axis.xlog) layout.xaxis.type = 'log';
  if (options.axis.yinvert) layout.yaxis.autorange = 'reversed';

  const width = document.getElementById('chartWidth').value;
  const height = document.getElementById('chartHeight').value || 550;
  if (width) layout.width = width;
  layout.height = height;

  previewArea.innerHTML = '';
  Plotly.newPlot(previewArea, traces, layout, { 
    responsive: true, 
    toImageButtonOptions: { format: 'png', filename: 'research_graph', height: height, width: width || 800, scale: 2 } 
  });
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
    series: series
  };
}

function renderSeriesControls() {
  const container = document.getElementById('seriesControls');
  const checked = Array.from(document.querySelectorAll('input[name="displayField"]:checked'));
  container.innerHTML = '';
  
  // 논문용 마커 배열 (검은색 스타일에서 구분용)
  const markers = ['circle', 'square', 'triangle-up', 'diamond', 'cross'];

  checked.forEach((cb, i) => {
    const name = cb.value;
    const div = document.createElement('div');
    div.className = 'series-control p-3 border rounded-md bg-white shadow-sm';
    div.dataset.name = name;
    div.innerHTML = `
      <div class="font-bold text-xs mb-2 border-b pb-1 text-gray-600 truncate">${name}</div>
      <div class="space-y-2 text-[10px]">
        <div class="flex justify-between items-center"><span>색상</span><input type="color" class="series-color w-12 h-5" value="#000000" /></div>
        <div class="flex justify-between items-center"><span>마커</span>
            <select class="series-marker border px-1">
                ${markers.map(m => `<option value="${m}" ${markers[i%markers.length]===m?'selected':''}>${m}</option>`).join('')}
            </select>
        </div>
        <div class="flex justify-between items-center"><span>선두께</span><input type="number" class="series-linewidth w-12 border px-1" value="2" /></div>
        <div class="flex justify-between items-center"><span>마커크기</span><input type="number" class="series-markersize w-12 border px-1" value="7" /></div>
        <div class="flex justify-between items-center"><span>스타일</span>
            <select class="series-linestyle border px-1"><option value="solid">Solid</option><option value="dash">Dash</option><option value="dot">Dot</option></select>
        </div>
        <div class="flex gap-4 mt-2 pt-2 border-t">
          <label class="flex items-center gap-1"><input type="checkbox" class="series-showline" checked /> 선</label>
          <label class="flex items-center gap-1"><input type="checkbox" class="series-showmarker" checked /> 표식</label>
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
    xCon.innerHTML += `<div class="mt-1"><label class="text-xs font-bold text-gray-500">X축 ${i+1} 라벨</label><input id="xlabel_${i}" class="border p-2 rounded w-full text-sm" value="${f}" /></div>`;
  });
  y_fields.slice(0,1).forEach((f, i) => {
    yCon.innerHTML += `<div class="mt-1"><label class="text-xs font-bold text-gray-500">Y축 라벨</label><input id="ylabel_${i}" class="border p-2 rounded w-full text-sm" value="${f}" /></div>`;
  });
}

btnUpdate.addEventListener('click', () => btnPlot.click());
