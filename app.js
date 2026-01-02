// app.js: 라벨 커스텀 유지 및 축 교차 전환 로직 강화 버전

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
    // 활성 X축 결정
    const activeX = (xAxisSub && idx > 0) ? xAxisSub : xAxisMain;
    
    let mapped = workbookData.map(row => ({ x: row[activeX], y: row[ycol] }))
                             .filter(d => d.x !== null && d.y !== null);

    // 정렬 (X축 기준)
    if (mapped.length > 0 && !isNaN(mapped[0].x)) mapped.sort((a, b) => Number(a.x) - Number(b.x));

    let finalX = mapped.map(d => d.x);
    let finalY = mapped.map(d => Number(d.y));

    // [중요] 축 교차 전환 처리 (데이터 좌표 대칭)
    if (isSwapped) { [finalX, finalY] = [finalY, finalX]; }

    const sOpt = options.series[ycol] || { color: '#000000', linewidth: 2, markersize: 7, show_line: true, show_marker: true };
    
    const trace = {
      x: finalX, y: finalY, name: ycol,
      mode: (sOpt.show_line ? 'lines' : '') + (sOpt.show_marker ? '+markers' : ''),
      line: { color: sOpt.color, width: sOpt.linewidth, dash: sOpt.linestyle },
      marker: { color: sOpt.color, size: sOpt.markersize, symbol: sOpt.marker, line: { color: '#000', width: 0.5 } },
      type: document.getElementById('chartType').value
    };

    // 보조축 할당 (Plotly는 xaxis2, yaxis2 형식을 사용)
    // Swap On일 경우: 기존의 Y가 X로 가고, X가 Y로 가야함.
    if (!isSwapped) {
      if (yAxisSub && ycol === yAxisSub) trace.yaxis = 'y2';
      if (xAxisSub && idx > 0) trace.xaxis = 'x2';
    } else {
      // Swap 상태에서는 보조 Y축 데이터가 보조 X축이 됨
      if (yAxisSub && ycol === yAxisSub) trace.xaxis = 'x2';
      // 보조 X축 데이터가 보조 Y축이 됨
      if (xAxisSub && idx > 0) trace.yaxis = 'y2';
    }

    return trace;
  });

  // 최종 라벨 결정
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
    
    // 주축 설정
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

  // 보조축 설정 (교차 전환 시 축 속성 자체를 스왑)
  if (!isSwapped) {
    if (yAxisSub) {
      layout.yaxis2 = {
        title: { text: labYS, font: { weight: 'bold' } },
        overlaying: 'y', side: 'right', showline: true, linecolor: '#000', linewidth: 2
      };
    }
    if (xAxisSub) {
      layout.xaxis2 = {
        title: { text: labXS, font: { weight: 'bold' } },
        overlaying: 'x', side: 'top', showline: true, linecolor: '#000', linewidth: 2
      };
    }
  } else {
    // Swap On: Y-Sub은 X2가 되고, X-Sub은 Y2가 됨 (선대칭 구현)
    if (yAxisSub) {
      layout.xaxis2 = {
        title: { text: labYS, font: { weight: 'bold' } },
        overlaying: 'x', side: 'top', showline: true, linecolor: '#000', linewidth: 2
      };
    }
    if (xAxisSub) {
      layout.yaxis2 = {
        title: { text: labXS, font: { weight: 'bold' } },
        overlaying: 'y', side: 'right', showline: true, linecolor: '#000', linewidth: 2
      };
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
    div.className = 'series-control p-3 border rounded-lg bg-slate-50';
    div.dataset.name = name;
    div.innerHTML = `
      <div class="font-bold text-[10px] mb-2 border-b text-slate-400 truncate">${name}</div>
      <div class="grid grid-cols-2 gap-2 text-[10px]">
        <label>Color <input type="color" class="series-color w-full h-4" value="#000000" /></label>
        <label>Symbol <select class="series-marker w-full border">${symbols.map(s => `<option value="${s}" ${symbols[i%5]===s?'selected':''}>${s}</option>`).join('')}</select></label>
        <label>Line <input type="number" class="series-linewidth w-full border" value="2" /></label>
        <label>Size <input type="number" class="series-markersize w-full border" value="7" /></label>
        <div class="col-span-2 flex gap-2 pt-1">
          <label><input type="checkbox" class="series-showline" checked /> 선</label>
          <label><input type="checkbox" class="series-showmarker" checked /> 마커</label>
          <select class="series-linestyle border ml-auto"><option value="solid">Solid</option><option value="dash">Dash</option></select>
        </div>
      </div>`;
    container.appendChild(div);
  });
}

/**
 * 라벨 커스텀 기능의 '리셋' 방지를 위한 업데이트 함수
 * 필드가 이미 존재하고 사용자가 값을 입력했다면 그 값을 보존함.
 */
function updateLabelsUI(xMain, xSub, yMain, ySub, yFields) {
  const xCon = document.getElementById('xlabels-container');
  const yCon = document.getElementById('ylabels-container');
  
  // 현재 입력되어 있는 값들을 백업
  const curXM = document.getElementById('xlabel_main')?.value;
  const curXS = document.getElementById('xlabel_sub')?.value;
  const curYM = document.getElementById('ylabel_main')?.value;
  const curYS = document.getElementById('ylabel_sub')?.value;

  // X축 컨테이너 구성
  let xHtml = `<label class="text-[10px] font-bold">주 X축 라벨</label>
               <input id="xlabel_main" class="border p-2 rounded w-full text-xs" value="${curXM !== undefined ? curXM : xMain}" />`;
  if(xSub) {
    xHtml += `<label class="text-[10px] font-bold mt-2 block">보조 X축 라벨</label>
              <input id="xlabel_sub" class="border p-2 rounded w-full text-xs" value="${curXS !== undefined ? curXS : xSub}" />`;
  }
  xCon.innerHTML = xHtml;

  // Y축 컨테이너 구성
  let yHtml = `<label class="text-[10px] font-bold">주 Y축 라벨</label>
               <input id="ylabel_main" class="border p-2 rounded w-full text-xs" value="${curYM !== undefined ? curYM : (yMain || yFields[0])}" />`;
  if(ySub) {
    yHtml += `<label class="text-[10px] font-bold mt-2 block">보조 Y축 라벨</label>
              <input id="ylabel_sub" class="border p-2 rounded w-full text-xs" value="${curYS !== undefined ? curYS : ySub}" />`;
  }
  yCon.innerHTML = yHtml;
}

btnUpdate.addEventListener('click', () => btnPlot.click());
