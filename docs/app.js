// app.js: 엑셀 데이터를 시각화하는 핵심 로직 (정렬 및 매칭 버그 수정판)

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
let selectedYFields = [];

// 탭 전환 로직
tabUpload.addEventListener('click', () => {
  panelUpload.classList.remove('hidden'); panelEdit.classList.add('hidden');
  tabUpload.className = "px-4 py-2 bg-blue-500 text-white rounded-t mr-1";
  tabEdit.className = "px-4 py-2 bg-gray-200 text-gray-700 rounded-t";
});
tabEdit.addEventListener('click', () => {
  panelUpload.classList.add('hidden'); panelEdit.classList.remove('hidden');
  tabEdit.className = "px-4 py-2 bg-blue-500 text-white rounded-t";
  tabUpload.className = "px-4 py-2 bg-gray-200 text-gray-700 rounded-t";
});

// 엑셀 로드
btnLoad.addEventListener('click', () => {
  if (!fileInput.files.length) return alert('엑셀 파일을 선택하세요');
  const f = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const first = wb.SheetNames[0];
    const ws = wb.Sheets[first];
    const aoa = XLSX.utils.sheet_to_json(ws, { defval: null });
    
    if (aoa.length === 0) return alert('데이터가 없는 시트입니다.');
    
    workbookData = aoa; 
    columns = Object.keys(aoa[0] || {});
    renderColumns(columns);
    alert(`파일 로드 완료: ${first} 시트 (${aoa.length}행)`);
  };
  reader.readAsArrayBuffer(f);
});

function renderColumns(cols) {
  const selects = ['xAxisMain', 'xAxisSub', 'yAxisMain', 'yAxisSub'].map(id => document.getElementById(id));
  selects.forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">선택 안함</option>';
    cols.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
    if (cols.includes(current)) sel.value = current;
  });

  columnsArea.innerHTML = '';
  cols.forEach(c => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 p-1 hover:bg-gray-50';
    div.innerHTML = `<input type="checkbox" name="displayField" value="${c}" id="chk_${c}" class="w-4 h-4" />
                     <label for="chk_${c}" class="text-sm truncate cursor-pointer">${c}</label>`;
    columnsArea.appendChild(div);
  });
  
  // 체크박스 변경 시 계열 설정 UI 갱신
  document.querySelectorAll('input[name="displayField"]').forEach(cb => {
    cb.addEventListener('change', renderSeriesControls);
  });
}

btnPlot.addEventListener('click', async () => {
  if (!workbookData) return alert('먼저 파일을 로드하세요');

  const xAxisMain = document.getElementById('xAxisMain').value;
  const xAxisSub = document.getElementById('xAxisSub').value;
  const yAxisMain = document.getElementById('yAxisMain').value;
  const yAxisSub = document.getElementById('yAxisSub').value;
  const displayFields = Array.from(document.querySelectorAll('input[name="displayField"]:checked')).map(i => i.value);

  if (!xAxisMain && !xAxisSub) return alert('최소 하나의 X축을 선택해야 합니다.');
  if (displayFields.length === 0) return alert('표시할 값을 최소 하나 선택하세요.');

  const options = collectOptionsFromUI();
  updateAxisLabelUI([xAxisMain, xAxisSub].filter(Boolean), [yAxisMain, yAxisSub].filter(Boolean));

  const traces = [];
  const layout = {
    title: { text: document.getElementById('titleInput').value || '', font: { size: 16 } },
    template: 'plotly_white',
    xaxis: { title: { text: document.getElementById('xlabel_0')?.value || xAxisMain }, showline: true, mirror: true, linecolor: '#333' },
    yaxis: { title: { text: document.getElementById('ylabel_0')?.value || yAxisMain }, showline: true, mirror: true, linecolor: '#333' },
    margin: { l: 60, r: 60, t: 60, b: 60 },
    hovermode: 'closest',
    showlegend: document.getElementById('legendShow').checked
  };

  displayFields.forEach((ycol, idx) => {
    // [버그 수정]: X축과 Y축 데이터의 1:1 매칭 보장
    const currentXAxis = (idx > 0 && xAxisSub) ? xAxisSub : xAxisMain;
    
    // 데이터 추출 및 정렬 (선이 꼬이는 문제 해결)
    let traceData = workbookData.map(row => ({
      x: row[currentXAxis],
      y: row[ycol]
    })).filter(d => d.x !== null && d.y !== null);

    // X값이 숫자라면 오름차순 정렬
    if (traceData.length > 0 && !isNaN(traceData[0].x)) {
      traceData.sort((a, b) => a.x - b.x);
    }

    const xvals = traceData.map(d => d.x);
    const yvals = traceData.map(d => Number(d.y));
    const seriesOpt = options.series[ycol] || { color: '#000000', linewidth: 2, markersize: 6, show_line: true, show_marker: true };

    const trace = {
      x: xvals,
      y: yvals,
      name: ycol,
      mode: (seriesOpt.show_line ? 'lines' : '') + (seriesOpt.show_marker ? (seriesOpt.show_line ? '+markers' : 'markers') : ''),
      line: { color: seriesOpt.color, width: seriesOpt.linewidth, dash: seriesOpt.linestyle },
      marker: { color: seriesOpt.color, size: seriesOpt.markersize, symbol: seriesOpt.marker },
      type: document.getElementById('chartType').value === 'bar' ? 'bar' : 'scatter'
    };

    // 보조축 설정
    if (idx > 0 && (xAxisSub || yAxisSub)) {
      if (xAxisSub) { trace.xaxis = 'x2'; layout.xaxis2 = { overlaying: 'x', side: 'top', title: { text: document.getElementById('xlabel_1')?.value || xAxisSub } }; }
      if (yAxisSub) { trace.yaxis = 'y2'; layout.yaxis2 = { overlaying: 'y', side: 'right', title: { text: document.getElementById('ylabel_1')?.value || yAxisSub } }; }
    }

    traces.push(trace);

    // 추세선 로직
    if (options.trendline.enabled && xvals.length > 1) {
      try {
        const xv = xvals.map(Number);
        const yv = yvals.map(Number);
        let trendY = [];
        if (options.trendline.type === 'linear') {
          const { slope, intercept } = calculateLinearRegression(xv, yv);
          trendY = xv.map(x => slope * x + intercept);
        } else {
          const coeffs = polyfit(xv, yv, options.trendline.degree);
          trendY = polyval(coeffs, xv);
        }
        traces.push({
          x: xvals, y: trendY, mode: 'lines', name: `${ycol} 추세`,
          line: { color: options.trendline.color, width: options.trendline.width, dash: 'dash' },
          showlegend: false
        });
      } catch (e) { console.warn("Trendline error", e); }
    }
  });

  // 기타 레이아웃 설정 (로그, 범위 등)
  if (options.axis.xlim) layout.xaxis.range = options.axis.xlim;
  if (options.axis.ylim) layout.yaxis.range = options.axis.ylim;
  if (options.axis.xlog) layout.xaxis.type = 'log';
  if (options.axis.yinvert) layout.yaxis.autorange = 'reversed';
  if (options.grid.enabled) {
    layout.xaxis.showgrid = true; layout.xaxis.gridcolor = options.grid.color;
    layout.yaxis.showgrid = true; layout.yaxis.gridcolor = options.grid.color;
  }
  
  // 범례 위치
  if (options.legend.position === 'outside') {
    layout.legend = { x: 1.05, y: 1 };
  } else {
    const p = options.legend.position.split(' ');
    layout.legend = { x: p[1] === 'right' ? 1 : 0, y: p[0] === 'top' ? 1 : 0 };
  }

  const plotConfig = { responsive: true, displayModeBar: true };
  const width = document.getElementById('chartWidth').value;
  const height = document.getElementById('chartHeight').value || 480;
  if (width) layout.width = width;
  layout.height = height;

  previewArea.innerHTML = '';
  const gd = document.createElement('div');
  previewArea.appendChild(gd);
  Plotly.newPlot(gd, traces, layout, plotConfig);
});

// 헬퍼 함수들
function collectOptionsFromUI() {
  const xlim = document.getElementById('xlimInput').value.split(',').filter(s => s.trim() !== "").map(Number);
  const ylim = document.getElementById('ylimInput').value.split(',').filter(s => s.trim() !== "").map(Number);
  
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
    axis: { xlim: xlim.length === 2 ? xlim : null, ylim: ylim.length === 2 ? ylim : null, xlog: document.getElementById('xlog').checked, yinvert: document.getElementById('yinvert').checked },
    grid: { enabled: document.getElementById('gridToggle').checked, color: document.getElementById('gridColor').value },
    legend: { position: document.getElementById('legendPos').value },
    trendline: { enabled: document.getElementById('trendEnabled').checked, type: document.getElementById('trendType').value, degree: Number(document.getElementById('trendDegree').value), color: document.getElementById('trendColor').value, width: Number(document.getElementById('trendWidth').value) },
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
    div.className = 'series-control p-2 border rounded bg-white shadow-sm';
    div.dataset.name = name;
    div.innerHTML = `
      <div class="font-bold border-b mb-2 text-xs text-blue-800">${name}</div>
      <div class="grid grid-cols-2 gap-x-2 gap-y-1">
        <label class="text-[10px]">색상 <input type="color" class="series-color w-full h-5" value="${['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'][i % 4]}" /></label>
        <label class="text-[10px]">마커 <select class="series-marker w-full border text-[10px]"><option value="circle">●</option><option value="square">■</option><option value="triangle-up">▲</option></select></label>
        <label class="text-[10px]">선두께 <input type="number" class="series-linewidth w-full border text-[10px]" value="2" step="0.5" /></label>
        <label class="text-[10px]">마커크기 <input type="number" class="series-markersize w-full border text-[10px]" value="6" /></label>
        <label class="text-[10px]">스타일 <select class="series-linestyle w-full border text-[10px]"><option value="solid">실선</option><option value="dash">파선</option><option value="dot">점선</option></select></label>
        <div class="flex items-center gap-2 pt-3">
          <label class="text-[10px]"><input type="checkbox" class="series-showline" checked /> 선</label>
          <label class="text-[10px]"><input type="checkbox" class="series-showmarker" checked /> 표식</label>
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
    xCon.innerHTML += `<label class="block text-xs mt-1">X축 ${i+1} 이름 (${f})</label><input id="xlabel_${i}" class="border p-1 rounded w-full text-sm" value="${f}" />`;
  });
  y_fields.forEach((f, i) => {
    yCon.innerHTML += `<label class="block text-xs mt-1">Y축 ${i+1} 이름 (${f})</label><input id="ylabel_${i}" class="border p-1 rounded w-full text-sm" value="${f}" />`;
  });
}

function calculateLinearRegression(x, y) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumXX = x.reduce((a, b) => a + b * b, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function polyfit(x, y, degree) {
  const V = x.map(xi => Array.from({ length: degree + 1 }, (_, j) => Math.pow(xi, j)));
  const VT = math.transpose(V);
  const VTV = math.multiply(VT, V);
  const VTy = math.multiply(VT, y);
  return math.multiply(math.inv(VTV), VTy);
}

function polyval(coeffs, x) {
  return x.map(xi => coeffs.reduce((acc, c, j) => acc + c * Math.pow(xi, j), 0));
}

// 초기화
document.querySelectorAll('[id^="show-"]').forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    const content = document.getElementById(checkbox.id.replace('show-', '') + '-content');
    if (content) content.style.display = checkbox.checked ? 'block' : 'none';
  });
});

btnUpdate.addEventListener('click', () => btnPlot.click());
